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
    "105 R&D - Analog": "Analog",
    "310.2 Marketing - Product": "PM",
    "310.2 Marketing \u2013 Product": "PM",
    "360 System": "AE",
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


def parse_timesheet(file_path: str, include_metadata: bool = False):
    try:
        workbook = pd.read_excel(file_path, sheet_name=None)
        if not isinstance(workbook, dict):
            workbook = {"Sheet0": workbook}

        # 步骤1：读取项目别名映射（表3）
        project_alias_mapping = _extract_project_alias_mapping(workbook)

        # 步骤2：读取员工信息（表4）和部门映射（表5）
        employee_profiles = _extract_employee_profiles(workbook)
        employee_lookup = {
            _clean_text(profile.get("employee_name")): profile
            for profile in employee_profiles
            if _clean_text(profile.get("employee_name"))
        }
        dept_mapping = _extract_department_mapping(workbook) or load_dept_mapping()

        # 步骤3：识别所有工时表（表1主工时 + 表2原OA补录）
        timesheet_frames = _extract_timesheet_frames(workbook)
        if not timesheet_frames:
            raise ValueError("未找到可解析的工时数据sheet。")

        # 步骤4：从第一个工时表（表1主工时）解析基础工时
        #         然后把其余工时表（表2原OA）的工时按员工+项目+月份累加进来
        required_columns = ["员工", "所属部门", "工号", "开始日期", "结束日期"]

        # 用字典做去重+累加：key=(employee_name, project_name, category, start_date, end_date)
        # 注意：原OA补录按月对应，相同员工+项目+月的工时累加
        entries_map = {}

        def _parse_frame_rows(df, is_supplemental=False):
            missing_columns = [c for c in required_columns if c not in df.columns]
            if missing_columns:
                if is_supplemental:
                    return  # 补录表允许跳过，不报错
                raise ValueError(f"Excel文件中缺少以下必填列: {', '.join(missing_columns)}。")

            for _, row in df.iterrows():
                category, project_name, hours_value = _resolve_timesheet_identity(
                    row, project_alias_mapping
                )
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

                profile = employee_lookup.get(employee_name, {})
                profile_department = _clean_text(profile.get("department_full"))
                profile_position = _clean_text(profile.get("position"))
                profile_status = _clean_text(profile.get("employee_status"))

                raw_department = _clean_text(row.get("所属部门")) or profile_department

                # 原OA补录按月累加：key用(员工, 项目, category, 年月)
                # 主表（表1）用精确日期作为key，保留每一条独立记录
                if is_supplemental:
                    month_key = start_date.strftime("%Y-%m")
                    merge_key = (employee_name, project_name, category, month_key)
                    if merge_key in entries_map:
                        entries_map[merge_key]["hours"] += float(numeric_hours)
                        continue
                    # 原OA新增条目，用当月第一天作为start_date
                    import calendar
                    last_day = calendar.monthrange(start_date.year, start_date.month)[1]
                    from datetime import date as date_type
                    supplemental_start = date_type(start_date.year, start_date.month, 1)
                    supplemental_end = date_type(start_date.year, start_date.month, last_day)
                else:
                    # 主表每条记录用唯一序号区分，完整保留所有条目
                    merge_key = (employee_name, project_name, category, start_date, end_date, len(entries_map))
                    supplemental_start = start_date
                    supplemental_end = end_date

                entry = {
                    "employee_name": employee_name,
                    "employee_id": _clean_text(row.get("工号")) or _clean_text(profile.get("employee_id")),
                    "employee_status": profile_status,
                    "department": _map_department_name(raw_department, dept_mapping),
                    "department_full": profile_department or raw_department,
                    "position": profile_position or _clean_text(row.get("职位")),
                    "project_name": project_name,
                    "category": category,
                    "start_date": supplemental_start if is_supplemental else start_date,
                    "end_date": supplemental_end if is_supplemental else end_date,
                    "hours": float(numeric_hours),
                    "task_details": _clean_text(row.get("任务详情")),
                    "approval_status": _clean_text(row.get("核准状态")),
                    "current_node": _clean_text(row.get("当前节点")),
                    "pending_approver": _clean_text(row.get("未操作者")),
                }

                if merge_key not in entries_map:
                    entries_map[merge_key] = entry
                else:
                    # 主表中同月同员工同项目的多条记录，工时累加
                    entries_map[merge_key]["hours"] += float(numeric_hours)

        # 先解析表1（主工时，第一个识别到的工时表）
        _parse_frame_rows(timesheet_frames[0], is_supplemental=False)

        # 再把其余工时表（原OA补录等）按月累加进来
        for supplemental_df in timesheet_frames[1:]:
            _parse_frame_rows(supplemental_df, is_supplemental=True)

        entries = list(entries_map.values())

        if include_metadata:
            return {"entries": entries, "employee_profiles": employee_profiles}
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


def _resolve_timesheet_identity(row, project_alias_mapping=None):
    alias_mapping = project_alias_mapping or {}

    def normalize_project_name(value):
        text = _clean_text(value)
        if not text:
            return ""
        # 项目别名替换：同时检查新旧两列中的项目名
        return alias_mapping.get(text.lower(), text)

    # 优先用"项目名称(新)"列，同时做别名替换
    project_new = _clean_text(row.get("项目名称(新)"))
    if project_new:
        return "Project", normalize_project_name(project_new), row.get("合计_项目")

    # 再看"项目名称(作废)"列，同样做别名替换
    project_legacy = _clean_text(row.get("项目名称(作废)"))
    if project_legacy:
        return "Project", normalize_project_name(project_legacy), row.get("合计_项目")

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


def _extract_timesheet_frames(workbook):
    frames = []
    for sheet_name, df in workbook.items():
        if not isinstance(df, pd.DataFrame):
            continue
        normalized_df = df.copy()
        normalized_df.columns = _normalize_timesheet_columns(normalized_df.columns)
        if _is_timesheet_frame(normalized_df):
            frames.append(normalized_df)
    return frames


def _is_timesheet_frame(df: pd.DataFrame):
    required_columns = {"员工", "所属部门", "工号", "开始日期", "结束日期"}
    if not required_columns.issubset(set(df.columns)):
        return False
    return any(
        column in df.columns
        for column in ("项目名称(新)", "项目名称(作废)", "非项目名称", "合计_项目", "合计_非项目")
    )


def _extract_project_alias_mapping(workbook):
    alias_mapping = {}
    for _, df in workbook.items():
        if not isinstance(df, pd.DataFrame) or df.shape[1] < 2:
            continue
        if df.shape[1] > 3 or df.shape[0] > 200:
            continue
        two_col_df = df.iloc[:, :2].copy()
        for _, row in two_col_df.iterrows():
            source = _clean_text(row.iloc[0])
            target = _clean_text(row.iloc[1])
            if not source or not target or source == target:
                continue
            if source.lower() in {"原项目名", "原项目", "source", "old"}:
                continue
            alias_mapping[source.lower()] = target
    return alias_mapping


def _extract_employee_profiles(workbook):
    """
    解析员工基础信息 sheet。
    按列名匹配，适配「员工基础信息」sheet 的实际结构：
      工号 | 姓名 | 部门 | 分部 | 直接上级 | 岗位 | 姓名简称 | 部门简称 | Team leader | BU
    """
    for _, df in workbook.items():
        if not isinstance(df, pd.DataFrame):
            continue
        cols = [str(c).strip() for c in df.columns]
        # 必须同时含有"姓名"和"部门简称"列才认定为员工基础信息 sheet
        if '姓名' not in cols or '部门简称' not in cols:
            continue
        profiles = []
        for _, row in df.iterrows():
            employee_name = _clean_text(row.get('姓名', ''))
            if not employee_name:
                continue
            profiles.append({
                "employee_name":   employee_name,
                "employee_id":     _clean_text(row.get('工号', '')),
                "department_full": _clean_text(row.get('部门', '')),
                "position":        _clean_text(row.get('岗位', '')),
                "department":      _clean_text(row.get('部门简称', '')),
                "employee_status": "",  # 新表所有人均为在职，无离职标记列
            })
        if profiles:
            return profiles
    return []


def _extract_department_mapping(workbook):
    def _build_mapping(df):
        mapping = {}
        for _, row in df.iloc[:, :2].iterrows():
            full_name = _clean_text(row.iloc[0])
            short_name = _clean_text(row.iloc[1])
            if not full_name or not short_name:
                continue
            mapping[full_name] = short_name
            stripped = re.sub(r"\s*\([^)]*\)\s*$", "", full_name).strip()
            if stripped and stripped != full_name:
                mapping.setdefault(stripped, short_name)
        return mapping

    # First pass: look for sheet whose first two columns are 部门/简称
    for _, df in workbook.items():
        if not isinstance(df, pd.DataFrame) or df.shape[1] < 2 or df.shape[0] < 5:
            continue
        cols = [str(c).strip() for c in df.columns[:2]]
        if "部门" in cols[0] and "简称" in cols[1]:
            mapping = _build_mapping(df)
            if mapping:
                return mapping

    # Second pass: generic heuristic (original logic)
    for _, df in workbook.items():
        if not isinstance(df, pd.DataFrame) or df.shape[1] < 2 or df.shape[0] < 5:
            continue
        if _is_timesheet_frame(df):
            continue
        mapping = _build_mapping(df)
        if len(mapping) >= 20:
            return mapping
    return {}


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


def parse_work_week(file_path: str):
    """
    解析工作周划分 Excel 文件。
    返回列表，每项包含：week_start, week_end, week_code, work_month（格式 YYYY-MM）
    """
    try:
        df = pd.read_excel(file_path, sheet_name=0, header=None)
    except Exception as exc:
        raise Exception(f"读取工作周划分文件失败: {exc}") from exc

    # 第0行是表头，从第1行开始是数据
    results = []
    current_month_label = None  # 例如 "1月"
    current_year = None

    for row_index in range(1, len(df)):
        row = df.iloc[row_index]
        week_start = _normalize_excel_date(row.iloc[0])
        week_end = _normalize_excel_date(row.iloc[1])
        week_code = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ""

        if not week_start or not week_end or not week_code:
            continue

        # 从 week_code 推断年份，例如 "202601-W1" -> 2026
        year_from_code = int(week_code[:4]) if len(week_code) >= 4 else None

        # 工作月份列（第4列），只有每月第一周才有值
        month_label = str(row.iloc[4]).strip() if pd.notna(row.iloc[4]) else ""
        if month_label and month_label != "nan":
            current_month_label = month_label
            current_year = year_from_code

        # 把 "1月" 转成 "2026-01"
        work_month = _month_label_to_key(current_month_label, current_year)
        if not work_month:
            continue

        results.append({
            "week_start": week_start,
            "week_end": week_end,
            "week_code": week_code,
            "work_month": work_month,
        })

    return results


def _month_label_to_key(label: str, year: int) -> str:
    """把 '3月' + 2026 转成 '2026-03'"""
    if not label or not year:
        return ""
    try:
        month_num = int(str(label).replace("月", "").strip())
        return f"{year}-{month_num:02d}"
    except (ValueError, AttributeError):
        return ""


if __name__ == "__main__":

    test_path = Path(__file__).resolve().parents[1] / "Timesheet Report-20260309172417(1).xlsx"
    if os.path.exists(test_path):
        results = parse_timesheet(str(test_path))
        print(f"Parsed {len(results)} rows successfully.")
        if results:
            print("Sample data (mapped dept):", results[0])
