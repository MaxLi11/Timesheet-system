from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import database, parser, crud
import shutil
import os
import traceback

app = FastAPI(title="Timesheet Analysis API")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/ping")
def ping():
    return {"status": "pong"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# Preset work-week file bundled with the backend
_PRESET_WORK_WEEK_PATH = os.path.join(os.path.dirname(__file__), "data", "work_weeks_preset.xlsx")

# Initialize database
@app.on_event("startup")
async def startup_event():
    print("Starting up... Initializing database...")
    try:
        database.init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Database initialization failed: {e}")

    # Auto-seed work_weeks from preset file if the table is empty
    db = database.SessionLocal()
    try:
        count = db.query(database.WorkWeek).count()
        if count == 0 and os.path.exists(_PRESET_WORK_WEEK_PATH):
            print("work_weeks table is empty – seeding from preset file...")
            try:
                weeks = parser.parse_work_week(_PRESET_WORK_WEEK_PATH)
                if weeks:
                    crud.save_work_weeks(db, weeks)
                    print(f"Seeded {len(weeks)} work weeks from preset.")
                else:
                    print("Preset file parsed but returned no rows.")
            except Exception as e:
                print(f"Failed to seed work weeks: {e}")
        elif count > 0:
            print(f"work_weeks already has {count} rows, skipping preset seed.")
    finally:
        db.close()

# Dependency for DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Timesheet Analysis API is running"}


def _store_uploaded_file_temporarily(file: UploadFile):
    temp_path = os.path.join(os.getcwd(), f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return temp_path

@app.post("/upload")
async def upload_timesheet(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Uploads an Excel file, parses it, and saves data to the database.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    temp_path = _store_uploaded_file_temporarily(file)

    try:
        parsed = parser.parse_timesheet(temp_path, include_metadata=True)
        entries = parsed.get("entries", [])
        if not entries:
            raise HTTPException(status_code=400, detail="No valid data found in the Excel file.")
        employee_profiles = parsed.get("employee_profiles", [])
        audit = parsed.get("audit", {})

        previous_employee_names = crud.get_distinct_employee_names_in_time_entries(db)
        count = crud.save_time_entries(db, entries)
        employee_count = crud.save_employee_profiles(db, employee_profiles)
        active_names = crud.get_active_employee_name_set(db)
        vanished = crud.compute_vanished_after_upload(
            previous_employee_names, entries, active_names
        )
        crud.save_vanished_after_upload(db, vanished)

        # 审核：工时记录中出现、但不在员工基础信息里的游离人员
        if employee_profiles:
            profile_names = {(p.get("employee_name") or "").strip() for p in employee_profiles}
            entry_names = {(e.get("employee_name") or "").strip() for e in entries if e.get("employee_name")}
            ghost_names = sorted(entry_names - profile_names)
            if ghost_names:
                print(f"[员工基础信息审核] 工时记录中存在、但不在员工基础信息里的人员（{len(ghost_names)}人）: {ghost_names}")

        return {
            "message": "Upload successful",
            "rows_processed": count,
            "employees_processed": employee_count,
            "vanished_count": len(vanished),
            "vanished_employees": vanished,
            "audit": audit,
        }
    except Exception as e:
        # This block already exists for general exceptions during parsing/saving
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                # Add specific handling for errors during file cleanup
                traceback.print_exc()
                # Optionally, you could log this error without re-raising
                # if the main operation was successful, or re-raise if cleanup
                # failure is critical. For now, we'll just log it.
                print(f"Error removing temporary file {temp_path}: {e}")


@app.post("/upload-project-schedule")
async def upload_project_schedule(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Uploads the project schedule Excel and replaces the current schedule dataset.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    temp_path = _store_uploaded_file_temporarily(file)
    try:
        projects = parser.parse_project_schedule(temp_path)
        if not projects:
            raise HTTPException(status_code=400, detail="No valid schedule data found in the Excel file.")

        result = crud.save_project_schedules(db, projects)
        return {"message": "Upload successful", **result}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                traceback.print_exc()
                print(f"Error removing temporary file {temp_path}: {e}")


@app.get("/stats")
def get_statistics(db: Session = Depends(get_db)):
    """
    Returns all time entries for the frontend to aggregate/visualize.
    """
    entries = crud.get_stats(db)
    return entries

@app.post("/clear")
def clear_data(db: Session = Depends(get_db)):
    """
    Clears all data from the database.
    """
    crud.clear_all_data(db)
    return {"message": "All data cleared successfully"}

@app.get("/vanished-after-upload")
def get_vanished_after_upload(db: Session = Depends(get_db)):
    """
    相对上一份上传：曾有工时行、本文件中完全没有出现的人员（按姓名，限在职）。
    """
    return crud.get_vanished_after_upload(db)


@app.get("/reporting-rate")
def get_reporting_rate(db: Session = Depends(get_db)):
    """
    Returns all time entries with aggregation-ready fields for the
    Complete Reporting Rate feature. The frontend handles aggregation
    so we can reuse the same logic per period and target hours.
    """
    return crud.get_reporting_rate(db)


@app.get("/active-employees")
def get_active_employees(db: Session = Depends(get_db)):
    """
    Returns active employee roster for reporting completeness checks.
    """
    return crud.get_active_employees(db)

@app.get("/approval-rate")
def get_approval_rate(db: Session = Depends(get_db)):
    """
    Returns time entries where current_node is not 'Close' or 'Prepare',
    i.e. entries pending approval. Used for the Approval Completion Rate feature.
    """
    return crud.get_approval_rate(db)


@app.get("/project-schedule-analysis")
def get_project_schedule_analysis(db: Session = Depends(get_db)):
    """
    Returns aggregated project schedule monitoring data for the project analysis page.
    """
    return crud.get_project_schedule_analysis(db)


@app.post("/upload-work-week")
async def upload_work_week(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    上传工作周划分 Excel，整表替换。
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件。")

    temp_path = _store_uploaded_file_temporarily(file)
    try:
        weeks = parser.parse_work_week(temp_path)
        if not weeks:
            raise HTTPException(status_code=400, detail="未能从文件中解析到有效的工作周数据。")
        result = crud.save_work_weeks(db, weeks)
        return {"message": "上传成功", **result}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"Error removing temporary file {temp_path}: {e}")


@app.get("/work-weeks")
def get_work_weeks(db: Session = Depends(get_db)):
    """
    返回全部工作周划分数据，供前端周筛选器使用。
    """
    rows = db.query(database.WorkWeek).order_by(database.WorkWeek.week_start).all()
    return [
        {
            "week_code": r.week_code,
            "week_start": str(r.week_start),
            "week_end": str(r.week_end),
            "work_month": r.work_month,
        }
        for r in rows
    ]


@app.get("/person-month-ratio")
def get_person_month_ratio(db: Session = Depends(get_db)):
    """
    返回每个项目每位员工每月的工时占比数据。
    Close + 在职；分母 = 项目 + 非项目 M/O/T；分子仅项目。
    月份口径（统一标准）：周结束日服在次月的，周整体归属次月；同月周不变。
    """
    return crud.get_person_month_ratio(db)


@app.get("/export-person-month-march")
def export_person_month_march(db: Session = Depends(get_db)):
    """
    人月行军图：每项目每员工每月项目工时、人月占比、当月总工时。
    Close + 在职；当月总工时 = 项目 + 非项目 Management/Others/Training；项目格仅 Project。
    月份口径（统一标准）：周结束日在次月的，周整体归属次月；同月周不变。
    """
    return crud.get_person_month_march(db)


@app.get("/export-employee-monthly-total")
def export_employee_monthly_total(db: Session = Depends(get_db)):
    """
    每人每月总工时：每位员工各月分母口径工时总和（项目 + M/O/T 非项目）。
    Close + 在职。月份口径（统一标准）：周结束日在次月的，周整体归属次月；同月周不变。
    """
    return crud.get_employee_monthly_total(db)
