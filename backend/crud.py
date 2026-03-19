from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import database

def save_time_entries(db: Session, entries: list):
    """
    Saves a list of time entry dictionaries to the database using upsert logic.
    For each entry, delete the matching record by (employee_id, project_name, category,
    start_date, end_date) before inserting, so that:
    - Re-uploading the same file updates existing records
    - Uploading a different file for the same period does NOT delete unrelated records
    """
    if not entries:
        return 0

    for e in entries:
        q = db.query(database.TimeEntry).filter(
            database.TimeEntry.start_date == e['start_date'],
            database.TimeEntry.end_date == e['end_date'],
            database.TimeEntry.project_name == e['project_name'],
            database.TimeEntry.category == e['category'],
        )
        eid = (e.get('employee_id') or '').strip()
        if eid:
            q = q.filter(database.TimeEntry.employee_id == eid)
        else:
            q = q.filter(database.TimeEntry.employee_name == e['employee_name'])
        q.delete(synchronize_session=False)

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
    The approval and reporting-rate features use their own separate queries.
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
    db.commit()


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
    Returns time entries for the Reporting Rate feature.
    Excludes rows where approval_status starts with '未提交' (i.e. 'Not Submitted').
    This ensures only entries that have been at least submitted are counted.
    """
    entries = db.query(
        database.TimeEntry.start_date,
        database.TimeEntry.end_date,
        database.TimeEntry.employee_name,
        database.TimeEntry.employee_id,
        database.TimeEntry.department,
        database.TimeEntry.hours,
        database.TimeEntry.approval_status
    ).all()

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
        # Exclude '未提交 Not Submitted' entries (exact match)
        if (e.approval_status or '').strip() != '未提交 Not Submitted'
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
    ).all()

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


def _build_week_to_month_map(db: Session) -> dict:
    """返回 {week_start_date: 'YYYY-MM'} 的字典，用于快速查月份"""
    rows = db.query(database.WorkWeek).all()
    return {row.week_start: row.work_month for row in rows}


# ── 人月占比计算 ────────────────────────────────────────────

_NON_PROJECT_INCLUDE = {"management", "others", "training"}


def get_person_month_ratio(db: Session):
    """
    计算每个项目每位员工每月的工时占比。
    只统计 current_node == Close 的记录。
    月份归属：优先查工作周划分表，查不到则用开始日期自然月。
    """
    week_map = _build_week_to_month_map(db)

    entries = db.query(database.TimeEntry).filter(
        func.lower(database.TimeEntry.current_node) == "close"
    ).all()

    def resolve_month(start_date) -> str:
        if start_date and start_date in week_map:
            return week_map[start_date]
        if start_date:
            return start_date.strftime("%Y-%m")
        return ""

    # 第一步：统计每位员工每月的总工时
    # key: (employee_name, month)  value: total_hours
    employee_month_total: dict = {}

    for e in entries:
        month = resolve_month(e.start_date)
        if not month:
            continue
        key = (e.employee_name, month)
        hours = float(e.hours or 0)

        if e.category == "Project":
            employee_month_total[key] = employee_month_total.get(key, 0) + hours
        elif e.category == "Non-Project":
            proj = str(e.project_name or "").strip().lower()
            if proj in _NON_PROJECT_INCLUDE:
                employee_month_total[key] = employee_month_total.get(key, 0) + hours

    # 第二步：统计每个项目每位员工每月的工时
    # key: (project_name, employee_name, month)  value: hours
    project_employee_month: dict = {}
    employee_meta: dict = {}  # employee_name -> {department_full, department, position}

    for e in entries:
        if e.category != "Project":
            continue
        month = resolve_month(e.start_date)
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

    # 第三步：计算占比，组装结果
    # 按 project_name, employee_name 分组，月份作为动态列
    result_map: dict = {}  # (project, employee) -> row dict

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

    # 收集所有月份并排序
    all_months = sorted({m for (_, _, m) in project_employee_month.keys()})

    rows = sorted(result_map.values(), key=lambda r: (r["project_name"], r["employee_name"]))

    return {"months": all_months, "rows": rows}
