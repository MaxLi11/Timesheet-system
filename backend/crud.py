import json
from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import database

UPLOAD_VANISHED_KEY = "vanished_after_upload"


def _active_entry_filter():
    status = func.lower(func.coalesce(database.TimeEntry.employee_status, ""))
    return (~status.contains("离职")) & (~status.contains("terminated"))


def save_time_entries(db: Session, entries: list):
    """
    Replaces all existing time entries with the new upload.
    Each upload completely refreshes the timesheet data.
    """
    if not entries:
        return 0

    # 1. Clear all existing time entries
    db.query(database.TimeEntry).delete(synchronize_session=False)

    # 2. Bulk insert all new entries in chunks
    CHUNK_SIZE = 5000
    for i in range(0, len(entries), CHUNK_SIZE):
        chunk = entries[i : i + CHUNK_SIZE]
        db.bulk_insert_mappings(database.TimeEntry, chunk)

    db.commit()
    return len(entries)

def get_stats(db: Session, start_date: date = None, end_date: date = None):
    """
    Retrieves time entries where current_node = 'Close' (case-insensitive).
    This ensures only fully-approved entries are counted in the main statistics.
    Includes all employees (active and terminated) — no employee status filter.
    """
    from sqlalchemy import func
    query = db.query(database.TimeEntry).filter(
        func.lower(database.TimeEntry.current_node) == 'close'
    )
    if start_date:
        query = query.filter(database.TimeEntry.start_date >= start_date)
    if end_date:
        query = query.filter(database.TimeEntry.end_date <= end_date)
    
    return query.all()

def clear_all_data(db: Session):
    """
    Clears all data from the time_entries table.
    """
    db.query(database.ProjectScheduleMilestone).delete()
    db.query(database.ProjectSchedule).delete()
    db.query(database.TimeEntry).delete()
    db.query(database.Employee).delete()
    db.query(database.AppState).delete()
    db.commit()


def get_distinct_employee_names_in_time_entries(db: Session):
    """All distinct 员工姓名 in current snapshot (before replace)."""
    rows = db.query(database.TimeEntry.employee_name).distinct().all()
    out = set()
    for (name,) in rows:
        if name is None:
            continue
        text = str(name).strip()
        if text:
            out.add(text)
    return out


def get_active_employee_name_set(db: Session):
    """在职员工姓名（与主统计一致，排除离职/terminated）。"""
    rows = (
        db.query(database.Employee.name)
        .filter(~func.lower(func.coalesce(database.Employee.status, "")).contains("离职"))
        .filter(~func.lower(func.coalesce(database.Employee.status, "")).contains("terminated"))
        .all()
    )
    return {str(r[0]).strip() for r in rows if r[0] and str(r[0]).strip()}


def compute_vanished_after_upload(previous_names: set, new_entries: list, active_name_set: set):
    """
    上一版有工时行、本版 Excel 中完全没有出现的人员（按姓名）。
    若 active_name_set 非空，则只保留仍在职的人员。
    """
    new_names = set()
    for entry in new_entries:
        name = (entry.get("employee_name") or "").strip()
        if name:
            new_names.add(name)
    raw = previous_names - new_names
    if active_name_set:
        raw = raw & active_name_set
    return sorted(raw)


def save_vanished_after_upload(db: Session, names: list):
    payload = json.dumps({"names": names}, ensure_ascii=False)
    row = db.query(database.AppState).filter(database.AppState.key == UPLOAD_VANISHED_KEY).first()
    now = datetime.utcnow()
    if row:
        row.value_json = payload
        row.updated_at = now
    else:
        db.add(
            database.AppState(
                key=UPLOAD_VANISHED_KEY,
                value_json=payload,
                updated_at=now,
            )
        )
    db.commit()


def get_vanished_after_upload(db: Session):
    row = db.query(database.AppState).filter(database.AppState.key == UPLOAD_VANISHED_KEY).first()
    if not row or not row.value_json:
        return {"names": [], "updated_at": None}
    try:
        data = json.loads(row.value_json)
    except json.JSONDecodeError:
        return {"names": [], "updated_at": None}
    names = data.get("names") or []
    updated = row.updated_at.isoformat() + "Z" if row.updated_at else None
    return {"names": names, "updated_at": updated}


def save_employee_profiles(db: Session, profiles: list):
    db.query(database.Employee).delete(synchronize_session=False)
    if not profiles:
        db.commit()
        return 0

    # 审核：检测姓名重复（工号不同但姓名相同）
    name_count = {}
    for p in profiles:
        n = (p.get("employee_name") or "").strip()
        if n:
            name_count[n] = name_count.get(n, 0) + 1
    duplicates = [n for n, c in name_count.items() if c > 1]
    if duplicates:
        print(f"[员工基础信息审核] 姓名重复（{len(duplicates)}人）: {duplicates}")

    dedup = {}
    for profile in profiles:
        employee_name = (profile.get("employee_name") or "").strip()
        if not employee_name:
            continue
        dedup[employee_name] = {
            "name": employee_name,
            "employee_id": (profile.get("employee_id") or "").strip() or None,
            "department": (profile.get("department_full") or "").strip(),
            "department_abbr": (profile.get("department") or "").strip(),
            "position": (profile.get("position") or "").strip(),
            "status": (profile.get("employee_status") or "").strip(),
        }

    if dedup:
        db.bulk_insert_mappings(database.Employee, list(dedup.values()))
    db.commit()
    return len(dedup)


def get_active_employees(db: Session):
    rows = (
        db.query(database.Employee)
        .filter(~func.lower(func.coalesce(database.Employee.status, "")).contains("离职"))
        .filter(~func.lower(func.coalesce(database.Employee.status, "")).contains("terminated"))
        .order_by(database.Employee.name.asc())
        .all()
    )
    return [
        {
            "employee_name": row.name or "",
            "employee_id": row.employee_id or "",
            "department_full": row.department or "",
            "department": row.department_abbr or "",  # 部门简称，供漏填检查基数使用
            "position": row.position or "",
            "status": row.status or "",
        }
        for row in rows
    ]


def save_project_schedules(db: Session, projects: list):
    db.query(database.ProjectScheduleMilestone).delete()
    db.query(database.ProjectSchedule).delete()
    db.flush()

    total_milestones = 0
    for project in projects:
        schedule = database.ProjectSchedule(
            project_name=project["project_name"],
            bu=project.get("bu"),
            status=project.get("status"),
            project_order=project.get("order", 0),
            planned_days=project.get("planned_days"),
            actual_days=project.get("actual_days"),
            delta_days=project.get("delta_days"),
        )
        db.add(schedule)
        db.flush()

        milestones = []
        for milestone in project.get("milestones", []):
            milestones.append(
                database.ProjectScheduleMilestone(
                    schedule_id=schedule.id,
                    milestone_name=milestone["name"],
                    milestone_order=milestone.get("order", 0),
                    planned_date=milestone.get("planned_date"),
                    actual_date=milestone.get("actual_date"),
                    delta_days=milestone.get("delta_days"),
                )
            )
        if milestones:
            db.add_all(milestones)
            total_milestones += len(milestones)

    db.commit()
    return {
        "projects_processed": len(projects),
        "milestones_processed": total_milestones,
    }


def get_project_schedule_analysis(db: Session):
    projects = (
        db.query(database.ProjectSchedule)
        .order_by(database.ProjectSchedule.project_order.asc(), database.ProjectSchedule.id.asc())
        .all()
    )

    return {
        "projects": [_serialize_project_schedule(db, project) for project in projects]
    }


def _serialize_project_schedule(db: Session, project):
    milestones = (
        db.query(database.ProjectScheduleMilestone)
        .filter(database.ProjectScheduleMilestone.schedule_id == project.id)
        .order_by(database.ProjectScheduleMilestone.milestone_order.asc())
        .all()
    )
    mapped_timesheet_projects = _resolve_mapped_timesheet_projects(db, project.project_name)

    return {
        "project_name": project.project_name,
        "bu": project.bu or "",
        "status": project.status or "",
        "mapped_timesheet_projects": mapped_timesheet_projects,
        "cycle_summary": {
            "planned_days": _coerce_number(project.planned_days),
            "actual_days": _coerce_number(project.actual_days),
            "delta_days": _coerce_number(project.delta_days),
        },
        "milestones": [
            {
                "name": milestone.milestone_name,
                "order": milestone.milestone_order,
                "planned_date": milestone.planned_date.isoformat() if milestone.planned_date else None,
                "actual_date": milestone.actual_date.isoformat() if milestone.actual_date else None,
                "delta_days": _coerce_number(milestone.delta_days),
                "is_pending": milestone.actual_date is None,
            }
            for milestone in milestones
        ],
        "intervals": _build_project_intervals(db, mapped_timesheet_projects, milestones),
    }


def _resolve_mapped_timesheet_projects(db: Session, schedule_project_name: str):
    if schedule_project_name == "Balsa3/Bamboo2":
        mapped_projects = ["Balsa3"]
        bamboo2_exists = db.query(database.TimeEntry.id).filter(
            database.TimeEntry.project_name == "Bamboo2"
        ).first()
        if bamboo2_exists:
            mapped_projects.append("Bamboo2")
        return mapped_projects
    return [schedule_project_name]


def _build_project_intervals(db: Session, mapped_projects: list, milestones: list):
    intervals = []
    actual_milestones = [milestone for milestone in milestones if milestone.actual_date]
    for index in range(len(actual_milestones) - 1):
        current_milestone = actual_milestones[index]
        next_milestone = actual_milestones[index + 1]

        department_rows = (
            db.query(
                database.TimeEntry.department,
                func.sum(database.TimeEntry.hours).label("total_hours"),
            )
            .filter(func.lower(database.TimeEntry.current_node) == "close")
            .filter(_active_entry_filter())
            .filter(database.TimeEntry.project_name.in_(mapped_projects))
            .filter(database.TimeEntry.start_date >= current_milestone.actual_date)
            .filter(database.TimeEntry.start_date < next_milestone.actual_date)
            .group_by(database.TimeEntry.department)
            .order_by(func.sum(database.TimeEntry.hours).desc(), database.TimeEntry.department.asc())
            .all()
        )

        total_hours = sum((row.total_hours or 0) for row in department_rows)
        interval = {
            "from_milestone": current_milestone.milestone_name,
            "to_milestone": next_milestone.milestone_name,
            "start_date": current_milestone.actual_date.isoformat(),
            "end_date": next_milestone.actual_date.isoformat(),
            "total_hours": round(float(total_hours or 0), 1),
            "department_shares": [],
        }
        if total_hours > 0:
            interval["department_shares"] = [
                {
                    "department": row.department or "",
                    "hours": round(float(row.total_hours or 0), 1),
                    "share": round(float((row.total_hours or 0) / total_hours), 6),
                }
                for row in department_rows
            ]

        intervals.append(interval)

    return intervals


def _coerce_number(value):
    if value is None:
        return None
    numeric = float(value)
    if numeric.is_integer():
        return int(numeric)
    return round(numeric, 2)

def get_reporting_rate(db: Session):
    """
    Returns time entries for the Reporting Rate feature (完整填报率 · 工时差异).
    Original rule: exclude rows where 核准状态 is exactly '未提交 Not Submitted' (after strip).
    """
    entries = db.query(
        database.TimeEntry.start_date,
        database.TimeEntry.end_date,
        database.TimeEntry.employee_name,
        database.TimeEntry.employee_id,
        database.TimeEntry.department,
        database.TimeEntry.hours,
        database.TimeEntry.approval_status
    ).filter(_active_entry_filter()).all()

    return [
        {
            "start_date": str(e.start_date),
            "end_date": str(e.end_date),
            "employee_name": e.employee_name,
            "employee_id": e.employee_id,
            "department": e.department,
            "hours": e.hours
        }
        for e in entries
        if (e.approval_status or "").strip() != "未提交 Not Submitted"
    ]

def get_approval_rate(db: Session):
    """
    Returns time entries where current_node is NOT 'Close' (case-insensitive)
    and NOT 'Prepare', representing entries pending approval.
    """
    excluded = {'close', 'prepare'}
    entries = db.query(
        database.TimeEntry.start_date,
        database.TimeEntry.end_date,
        database.TimeEntry.employee_name,
        database.TimeEntry.department,
        database.TimeEntry.hours,
        database.TimeEntry.current_node,
        database.TimeEntry.pending_approver,
        database.TimeEntry.project_name
    ).filter(_active_entry_filter()).all()

    result = []
    for e in entries:
        node = (e.current_node or '').strip().lower()
        if node and node not in excluded:
            result.append({
                "start_date": str(e.start_date),
                "end_date": str(e.end_date),
                "employee_name": e.employee_name,
                "department": e.department,
                "hours": e.hours,
                "current_node": e.current_node,
                "pending_approver": e.pending_approver or '',
                "project_name": e.project_name
            })
    return result


# ── 工作周划分 ──────────────────────────────────────────────

def save_work_weeks(db: Session, weeks: list):
    """整表替换工作周划分数据"""
    db.query(database.WorkWeek).delete()
    db.flush()
    for w in weeks:
        db.add(database.WorkWeek(
            week_start=w["week_start"],
            week_end=w["week_end"],
            week_code=w["week_code"],
            work_month=w["work_month"],
        ))
    db.commit()
    return {"weeks_processed": len(weeks)}


# ── 人月占比 / 行军图 / 每人每月总工时（共用口径）────────────────

_NON_PROJECT_INCLUDE = {"management", "others", "training"}


def _resolve_entry_work_month(start_date, work_week_rows: list) -> str:
    """
    按工作周划分表归属 work_month：start_date 落在某周的 [week_start, week_end] 内则取该周 work_month；
    否则用 start_date 自然月。与前端仪表盘按周区间匹配一致。
    """
    if not start_date:
        return ""
    for w in work_week_rows:
        if w.week_start <= start_date <= w.week_end:
            return w.work_month or ""
    return start_date.strftime("%Y-%m")


def _entry_counts_toward_monthly_total(e) -> bool:
    """Close 口径下行是否计入「员工当月总工时」分母（项目 + 非项目 M/O/T）。"""
    if e.category == "Project":
        return True
    if e.category == "Non-Project":
        proj = str(e.project_name or "").strip().lower()
        return proj in _NON_PROJECT_INCLUDE
    return False


def _custom_export_base_entries(db: Session):
    """定制化导出共用：Close + 在职。"""
    return (
        db.query(database.TimeEntry)
        .filter(func.lower(database.TimeEntry.current_node) == "close")
        .filter(_active_entry_filter())
        .all()
    )


def get_person_month_ratio(db: Session):
    """
    计算每个项目每位员工每月的工时占比。
    Close + 在职；分母 = 项目类 + 非项目 Management/Others/Training。
    月份：工作周表区间内归属 work_month，否则自然月。
    """
    work_week_rows = db.query(database.WorkWeek).all()
    entries = _custom_export_base_entries(db)

    employee_month_total: dict = {}
    for e in entries:
        if not _entry_counts_toward_monthly_total(e):
            continue
        month = _resolve_entry_work_month(e.start_date, work_week_rows)
        if not month:
            continue
        key = (e.employee_name, month)
        employee_month_total[key] = employee_month_total.get(key, 0) + float(e.hours or 0)

    project_employee_month: dict = {}
    employee_meta: dict = {}

    for e in entries:
        if e.category != "Project":
            continue
        month = _resolve_entry_work_month(e.start_date, work_week_rows)
        if not month:
            continue
        key = (e.project_name, e.employee_name, month)
        project_employee_month[key] = project_employee_month.get(key, 0) + float(e.hours or 0)

        if e.employee_name not in employee_meta:
            employee_meta[e.employee_name] = {
                "department_full": e.department_full or "",
                "department": e.department or "",
                "position": e.position or "",
            }
        else:
            meta = employee_meta[e.employee_name]
            if not meta["department_full"] and e.department_full:
                meta["department_full"] = e.department_full
            if not meta["department"] and e.department:
                meta["department"] = e.department
            if not meta["position"] and e.position:
                meta["position"] = e.position

    result_map: dict = {}

    for (project, employee, month), proj_hours in project_employee_month.items():
        total = employee_month_total.get((employee, month), 0)
        ratio = round(proj_hours / total, 6) if total > 0 else 0

        row_key = (project, employee)
        if row_key not in result_map:
            meta = employee_meta.get(employee, {})
            result_map[row_key] = {
                "project_name": project,
                "employee_name": employee,
                "department_full": meta.get("department_full", ""),
                "department": meta.get("department", ""),
                "position": meta.get("position", ""),
                "months": {},
            }
        result_map[row_key]["months"][month] = ratio

    month_from_projects = {m for (_, _, m) in project_employee_month.keys()}
    month_from_totals = {m for (_, m) in employee_month_total.keys()}
    all_months = sorted(month_from_projects | month_from_totals)

    rows = sorted(result_map.values(), key=lambda r: (r["project_name"], r["employee_name"]))

    return {"months": all_months, "rows": rows}


def get_person_month_march(db: Session):
    """
    人月行军图：每项目每员工每月项目工时、占比、当月总工时。
    Close + 在职；当月总工时 = 项目 + 非项目 M/O/T；项目格仅 Project。
    月份归属同 get_person_month_ratio。
    """
    work_week_rows = db.query(database.WorkWeek).all()
    entries = _custom_export_base_entries(db)

    emp_month_total: dict = {}
    for e in entries:
        if not _entry_counts_toward_monthly_total(e):
            continue
        month = _resolve_entry_work_month(e.start_date, work_week_rows)
        if not month:
            continue
        key = (e.employee_name, month)
        emp_month_total[key] = emp_month_total.get(key, 0) + float(e.hours or 0)

    proj_emp_month: dict = {}
    emp_meta: dict = {}
    for e in entries:
        if e.category != "Project":
            continue
        month = _resolve_entry_work_month(e.start_date, work_week_rows)
        if not month:
            continue
        key = (e.project_name, e.employee_name, month)
        proj_emp_month[key] = proj_emp_month.get(key, 0) + float(e.hours or 0)
        if e.employee_name not in emp_meta:
            emp_meta[e.employee_name] = {
                "department_full": e.department_full or "",
                "department": e.department or "",
                "position": e.position or "",
            }

    month_from_projects = {m for (_, _, m) in proj_emp_month.keys()}
    month_from_totals = {m for (_, m) in emp_month_total.keys()}
    all_months = sorted(month_from_projects | month_from_totals)

    row_map: dict = {}
    for (proj, emp, month), proj_hours in proj_emp_month.items():
        total = emp_month_total.get((emp, month), 0)
        ratio = round(proj_hours / total, 6) if total > 0 else 0
        key = (proj, emp)
        if key not in row_map:
            meta = emp_meta.get(emp, {})
            row_map[key] = {
                "project_name": proj,
                "employee_name": emp,
                "department_full": meta.get("department_full", ""),
                "department": meta.get("department", ""),
                "position": meta.get("position", ""),
                "months": {},
            }
        row_map[key]["months"][month] = {
            "proj_hours": round(proj_hours, 2),
            "ratio": ratio,
            "total_hours": round(total, 2),
        }

    rows = sorted(row_map.values(), key=lambda r: (r["project_name"], r["employee_name"]))

    summary: dict = {}
    for month in all_months:
        s_proj = sum(v["months"].get(month, {}).get("proj_hours", 0) for v in rows)
        s_ratio = sum(v["months"].get(month, {}).get("ratio", 0) for v in rows)
        s_total = sum(h for (emp, m), h in emp_month_total.items() if m == month)
        summary[month] = {
            "proj_hours": round(s_proj, 3),
            "ratio": round(s_ratio, 3),
            "total_hours": round(s_total, 3),
        }

    return {"months": all_months, "rows": rows, "summary": summary}


def get_employee_monthly_total(db: Session):
    """
    每人每月总工时：Close + 在职；统计项目 + 非项目 Management/Others/Training。
    月份归属同 get_person_month_ratio。
    """
    work_week_rows = db.query(database.WorkWeek).all()
    entries = _custom_export_base_entries(db)

    emp_month: dict = {}
    for e in entries:
        if not _entry_counts_toward_monthly_total(e):
            continue
        month = _resolve_entry_work_month(e.start_date, work_week_rows)
        if not month:
            continue
        key = (e.employee_name, month)
        emp_month[key] = emp_month.get(key, 0) + float(e.hours or 0)

    all_months = sorted({m for (_, m) in emp_month})
    all_employees = sorted({emp for (emp, _) in emp_month})

    rows = []
    for emp in all_employees:
        month_data = {m: round(emp_month[(emp, m)], 2) for m in all_months if (emp, m) in emp_month}
        total = round(sum(month_data.values()), 2)
        rows.append({"employee_name": emp, "months": month_data, "total": total})

    return {"months": all_months, "rows": rows}
