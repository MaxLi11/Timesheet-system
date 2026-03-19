import os
import re
from datetime import date, datetime
from pathlib import Path

import pandas as pd


DEFAULT_DEPT_MAPPING = {
    "110.1 R&D - Digital": "Digital",
    "110.2 R&D - Digital": "Digital",
    "110 R&D - Digital": "Digital",
    "130.1 R&D - System Eng AE": "AE",
    "130.2 R&D - System Eng AE": "AE",
    "130 R&D - Engineering Support": "AE",
    "135.1 R&D - Technology Innovation Lab": "TIL",
    "105.1 R&D - Analog": "Analog",
    "105.2 R&D - Analog": "Analog",
    "105.1 R&D Analog": "Analog",
    "115.1 R&D - Layout": "Layout",
    "115.2 R&D - Layout": "Layout",
    "115 R&D - Layout": "Layout",
    "120 R&D - Test": "Test",
    "125 R&D - System Eng SW": "SW",
    "125.2 R&D - System Eng SW": "SW",
    "135.2 R&D - Product Marketing": "PM",
}

_DEPT_MAPPING_CACHE = DEFAULT_DEPT_MAPPING.copy()
_LAST_MAPPING_MTIME = 0

PROJECT_SCHEDULE_SHEET = "Schedule"
PROJECT_SCHEDULE_HEADER_ROW = 2
PROJECT_SCHEDULE_ROW_TYPE_COLUMN = "Unnamed: 4"
PROJECT_SCHEDULE_CYCLE_COLUMN = "Unnamed: 30"
PROJECT_SCHEDULE_MILESTONES = [
    "Pre-Gate0",
    "Gate0（kick off)",
    "Gate1(Initial PRD)",
    "Design Review 1",
    "Final PRD",
    "RTL freeze",
    "Tape out 1",
    "Fab out 1",
    "BS/1st silicon",
    "Tape out 2",
    "Fab out2",
    "ES/2nd silicon",
    "ATE for MP ready",
    "Validation done",
    "CS",
    "RTP",
]

TIMESHEET_COLUMN_ALIASES = {
    "鍛樺伐": "员工",
    "鎵€灞為儴闂?": "所属部门",
    "鑱屼綅": "职位",
    "宸ュ彿": "工号",
    "寮€濮嬫棩鏈?": "开始日期",
    "缁撴潫鏃ユ湡": "结束日期",
    "椤圭洰鍚嶇О(浣滃簾)": "项目名称(作废)",
    "椤圭洰鍚嶇О(鏂?": "项目名称(新)",
    "闈為」鐩悕绉?": "非项目名称",
    "浠诲姟璇︽儏": "任务详情",
    "鍚堣": "合计",
    "鏍稿噯鐘舵€?": "核准状态",
    "褰撳墠鑺傜偣": "当前节点",
    "鏈搷浣滆€?": "未操作者",
}


def load_dept_mapping():
    global _DEPT_MAPPING_CACHE, _LAST_MAPPING_MTIME
    mapping_path = Path(__file__).resolve().parents[1] / "部门简称.xlsx"

    if not mapping_path.exists():
        return _DEPT_MAPPING_CACHE

    try:
        current_mtime = mapping_path.stat().st_mtime
        if current_mtime > _LAST_MAPPING_MTIME:
            mapping_df = pd.read_excel(mapping_path, sheet_name=0)
            file_mapping = dict(
                zip(mapping_df["部门"].astype(str), mapping_df["部门简称"].astype(str))
            )
            combined = DEFAULT_DEPT_MAPPING.copy()
            combined.update(file_mapping)
            _DEPT_MAPPING_CACHE = combined
            _LAST_MAPPING_MTIME = current_mtime
            print(f"DEBUG: Department mapping reloaded (mtime: {current_mtime})")
    except Exception as exc:
        print(f"Warning: Failed to load department mapping: {exc}")

    return _DEPT_MAPPING_CACHE


def parse_timesheet(file_path: str):
    dept_mapping = load_dept_mapping()
    try:
        df = pd.read_excel(file_path, sheet_name=0)
        df.columns = _normalize_timesheet_columns(df.columns)

        required_columns = ["员工", "所属部门", "工号", "开始日期", "结束日期"]
        missing_columns = [column for column in required_columns if column not in df.columns]
        if missing_columns:
            raise ValueError(f"Excel文件中缺少以下必填列: {', '.join(missing_columns)}。")

        entries = []
        for index, row in df.iterrows():
            category, project_name, hours_value = _resolve_timesheet_identity(row)
            if not project_name:
                continue

            employee_name = _clean_text(row.get("员工"))
            numeric_hours = pd.to_numeric(hours_value, errors="coerce")
            if not employee_name or pd.isna(numeric_hours) or float(numeric_hours) == 0:
                continue

            start_date = _normalize_excel_date(row.get("开始日期"))
            end_date = _normalize_excel_date(row.get("结束日期"))
            if not start_date or not end_date:
                continue

            raw_department = _clean_text(row.get("所属部门"))
            entries.append(
                {
                    "employee_name": employee_name,
                    "employee_id": _clean_text(row.get("工号")),
                    "department": _map_department_name(raw_department, dept_mapping),
                    "department_full": raw_department,
                    "position": _clean_text(row.get("职位")),
                    "project_name": project_name,
                    "category": category,
                    "start_date": start_date,
                    "end_date": end_date,
                    "hours": float(numeric_hours),
                    "task_details": _clean_text(row.get("任务详情")),
                    "approval_status": _clean_text(row.get("核准状态")),
                    "current_node": _clean_text(row.get("当前节点")),
                    "pending_approver": _clean_text(row.get("未操作者")),
                }
            )

        return entries
    except Exception as exc:
        raise Exception(f"解析Excel失败: {exc}") from exc


def _normalize_timesheet_columns(columns):
    normalized_columns = []
    heji_count = 0

    for column in columns:
        column_name = TIMESHEET_COLUMN_ALIASES.get(str(column).strip(), str(column).strip())
        if column_name == "合计":
            normalized_columns.append("合计_项目" if heji_count == 0 else "合计_非项目")
            heji_count += 1
        elif column_name == "合计.1":
            normalized_columns.append("合计_非项目")
        else:
            normalized_columns.append(column_name)

    return normalized_columns


def _resolve_timesheet_identity(row):
    project_new = _clean_text(row.get("项目名称(新)"))
    if project_new:
        return "Project", project_new, row.get("合计_项目")

    project_legacy = _clean_text(row.get("项目名称(作废)"))
    if project_legacy:
        return "Project", project_legacy, row.get("合计_项目")

    non_project_name = _clean_text(row.get("非项目名称"))
    if non_project_name:
        return "Non-Project", non_project_name, row.get("合计_非项目")

    return None, None, None


def _clean_text(value):
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def _map_department_name(raw_department, dept_mapping):
    if not raw_department:
        return ""
    if raw_department in dept_mapping:
        return dept_mapping[raw_department]

    trimmed_department = re.sub(r"\s*\([^)]*\)\s*$", "", raw_department).strip()
    if trimmed_department in dept_mapping:
        return dept_mapping[trimmed_department]

    for source_name, short_name in dept_mapping.items():
        if raw_department.startswith(source_name) or trimmed_department.startswith(source_name):
            return short_name

    return raw_department


def _normalize_excel_date(value):
    if pd.isna(value) or value in ("", None):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()
    return None


def _normalize_number(value):
    if pd.isna(value) or value in ("", None):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric.is_integer():
        return int(numeric)
    return numeric


def parse_project_schedule(file_path: str):
    try:
        df = pd.read_excel(
            file_path,
            sheet_name=PROJECT_SCHEDULE_SHEET,
            header=PROJECT_SCHEDULE_HEADER_ROW,
        )
    except ValueError as exc:
        raise Exception(f"Project schedule sheet '{PROJECT_SCHEDULE_SHEET}' not found.") from exc

    required_columns = [
        "BU",
        "Project Name",
        "Status",
        PROJECT_SCHEDULE_ROW_TYPE_COLUMN,
        PROJECT_SCHEDULE_CYCLE_COLUMN,
        *PROJECT_SCHEDULE_MILESTONES,
    ]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise Exception(
            f"Project schedule Excel is missing required columns: {', '.join(missing_columns)}"
        )

    parsed_projects = []
    row_index = 0
    while row_index + 2 < len(df):
        plan_row = df.iloc[row_index]
        row_type = str(plan_row.get(PROJECT_SCHEDULE_ROW_TYPE_COLUMN) or "").strip()
        if row_type != "MRD plan":
            row_index += 1
            continue

        actual_row = df.iloc[row_index + 1]
        delta_row = df.iloc[row_index + 2]
        project_name = str(plan_row.get("Project Name") or "").strip()
        if not project_name:
            row_index += 3
            continue

        project = {
            "project_name": project_name,
            "bu": str(plan_row.get("BU") or "").strip(),
            "status": str(plan_row.get("Status") or "").strip(),
            "order": len(parsed_projects),
            "planned_days": _normalize_number(plan_row.get(PROJECT_SCHEDULE_CYCLE_COLUMN)),
            "actual_days": _normalize_number(actual_row.get(PROJECT_SCHEDULE_CYCLE_COLUMN)),
            "delta_days": _normalize_number(delta_row.get(PROJECT_SCHEDULE_CYCLE_COLUMN)),
            "milestones": [],
        }

        for milestone_order, milestone_name in enumerate(PROJECT_SCHEDULE_MILESTONES):
            actual_date = _normalize_excel_date(actual_row.get(milestone_name))
            project["milestones"].append(
                {
                    "name": milestone_name,
                    "order": milestone_order,
                    "planned_date": _normalize_excel_date(plan_row.get(milestone_name)),
                    "actual_date": actual_date,
                    "delta_days": _normalize_number(delta_row.get(milestone_name)),
                    "is_pending": actual_date is None,
                }
            )

        parsed_projects.append(project)
        row_index += 3

    return parsed_projects


if __name__ == "__main__":
    test_path = Path(__file__).resolve().parents[1] / "Timesheet Report-20260309172417(1).xlsx"
    if os.path.exists(test_path):
        results = parse_timesheet(str(test_path))
        print(f"Parsed {len(results)} rows successfully.")
        if results:
            print("Sample data (mapped dept):", results[0])
