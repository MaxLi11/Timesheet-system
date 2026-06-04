import os
import re
import calendar
import numpy as np
from datetime import date, datetime, date as date_cls
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

CONFIRMED_EMPLOYEE_ALIASES = {
    "薛亮/Liang Xue": "Liang Xue",
    "李宪/Xian Li": "Xian Li",
    "Mincheol Kim": "MIN CHEOL KIM/Rick",
    "Bob (Pushui) Xu": "Pushui Xu",
    "侯中原/Zhongyuan Hou": "侯中原",
    "彭金龙/Dragon Peng": "彭金龙/Jinlong Peng",
    "Guanting Chen": "Ting Chen",
}

PROJECT_ALIAS_OVERRIDES = {
    "Evergreen": "Chico Creek",
    "clinq": "Cape Cod",
    "blinq": "Cape Cod",
    "linq": "Cape Cod",
    "Cape code": "Cape Cod",
    "Cape Code": "Cape Cod",
    "Oliver": "Olive",
    "Cisco": "Nantucket",
    "Tulkun": "Tulkun&Roc",
    "Roc": "Tulkun&Roc",
    "Catalina-BA": "Catalina",
    "Catalina-S": "Catalina",
    "Catalina/Coronado": "Catalina",
    "Barolo-3": "Barolo3",
    "Colorado-3": "Colorado3",
    "KGD(MHD)": "KGD",
}

MANUAL_PROJECT_BU = {
    "IP": "SCD",
    "DP20 RX Link": "SCD",
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
        project_standards = _extract_project_standards(workbook)
        audit = _new_upload_audit()

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

        required_columns = ["员工", "所属部门", "工号", "开始日期", "结束日期"]
        entries_map = {}

        # 别名映射：小写 key，提前构建一次
        alias_lower = {k.lower(): v for k, v in project_alias_mapping.items()}

        def _parse_frame_rows(df, is_supplemental=False):
            """向量化解析：所有列预先提取为 numpy 数组，只保留必要的 Python 循环。"""
            missing_columns = [c for c in required_columns if c not in df.columns]
            if missing_columns:
                if is_supplemental:
                    return
                raise ValueError(f"Excel文件中缺少以下必填列: {', '.join(missing_columns)}。")

            n = len(df)
            if n == 0:
                return

            # ── 向量化列提取（替代 iterrows 中的 row.get） ────────────────────
            def _vcol(col):
                """把指定列提取为干净的字符串 numpy 数组，NaN / 'nan' → ''。"""
                if col not in df.columns:
                    return np.full(n, '', dtype=object)
                arr = df[col].fillna('').astype(str).str.strip().values
                # 把字面量 'nan' / 'None' 替换为空字符串
                arr[arr == 'nan']  = ''
                arr[arr == 'None'] = ''
                return arr

            emp_arr      = _vcol('员工')
            dept_arr     = _vcol('所属部门')
            emp_id_arr   = _vcol('工号')
            pos_arr      = _vcol('职位')
            task_project_arr = _vcol('任务详情_项目')
            if not task_project_arr.any():
                task_project_arr = _vcol('任务详情')
            task_non_project_arr = _vcol('任务详情_非项目')
            if not task_non_project_arr.any():
                task_non_project_arr = _vcol('任务详情.1')
            approval_arr = _vcol('核准状态')
            node_arr     = _vcol('当前节点')
            approver_arr = _vcol('未操作者')
            proj_new_arr = _vcol('项目名称(新)')
            proj_old_arr = _vcol('项目名称(作废)')
            non_proj_arr = _vcol('非项目名称')
            bu_arr       = _vcol('BU')

            def _vnum(col):
                if col not in df.columns:
                    return np.full(n, np.nan)
                return pd.to_numeric(df[col], errors='coerce').values

            hours_proj_arr     = _vnum('合计_项目')
            hours_non_proj_arr = _vnum('合计_非项目')

            # ── 批量日期解析（最大加速点，替代逐行 _normalize_excel_date）───────
            start_list = [
                d.date() if pd.notna(d) else None
                for d in pd.to_datetime(df['开始日期'], errors='coerce')
            ]
            end_list = [
                d.date() if pd.notna(d) else None
                for d in pd.to_datetime(df['结束日期'], errors='coerce')
            ]

            # ── 主循环：仅做数组索引，无 Series 构建开销 ─────────────────────
            for i in range(n):
                raw_employee_name = emp_arr[i]
                if not raw_employee_name:
                    continue
                employee_name, profile = _resolve_employee_profile(
                    raw_employee_name,
                    employee_lookup,
                    audit,
                )

                # 解析 category / project_name / hours
                pnew = proj_new_arr[i]
                if pnew:
                    category     = 'Project'
                    project_name = pnew
                    hours_raw    = hours_proj_arr[i]
                    task_details = task_project_arr[i]
                else:
                    pold = proj_old_arr[i]
                    if pold:
                        category     = 'Project'
                        project_name = pold
                        hours_raw    = hours_proj_arr[i]
                        task_details = task_project_arr[i]
                    else:
                        np_name = non_proj_arr[i]
                        if np_name:
                            category     = 'Non-Project'
                            project_name = np_name
                            hours_raw    = hours_non_proj_arr[i]
                            task_details = task_non_project_arr[i]
                        else:
                            continue

                if not project_name:
                    continue

                entry_bu = ""
                if category == "Project":
                    project_name, entry_bu = _resolve_project_name_and_bu(
                        project_name,
                        bu_arr[i],
                        project_standards,
                        alias_lower,
                        audit,
                    )

                # NaN 检查（pd.to_numeric 结果为 float64，nan != nan）
                if hours_raw != hours_raw or hours_raw == 0:
                    continue

                start_date = start_list[i]
                end_date   = end_list[i]
                if start_date is None or end_date is None:
                    continue

                profile_department = profile.get('department_full') or ''
                profile_position   = profile.get('position') or ''
                profile_status     = profile.get('employee_status') or ''

                raw_department = profile_department or dept_arr[i]

                if is_supplemental:
                    month_key = end_date.strftime('%Y-%m')
                    merge_key = (employee_name, project_name, category, month_key)
                    if merge_key in entries_map:
                        entries_map[merge_key]['hours'] += float(hours_raw)
                        continue
                    last_day  = calendar.monthrange(end_date.year, end_date.month)[1]
                    s_start   = date_cls(end_date.year, end_date.month, 1)
                    s_end     = date_cls(end_date.year, end_date.month, last_day)
                else:
                    merge_key = (employee_name, project_name, category, start_date, end_date, len(entries_map))
                    s_start   = start_date
                    s_end     = end_date

                entry = {
                    'employee_name':    employee_name,
                    'employee_id':      (profile.get('employee_id') or '') or emp_id_arr[i],
                    'employee_status':  profile_status,
                    'department':       _map_department_name(raw_department, dept_mapping),
                    'department_full':  profile_department or raw_department,
                    'position':         profile_position or pos_arr[i],
                    'bu':               entry_bu,
                    'project_name':     project_name,
                    'category':         category,
                    'start_date':       s_start,
                    'end_date':         s_end,
                    'hours':            float(hours_raw),
                    'task_details':     task_details,
                    'approval_status':  approval_arr[i],
                    'current_node':     node_arr[i],
                    'pending_approver': approver_arr[i],
                }

                if merge_key not in entries_map:
                    entries_map[merge_key] = entry
                else:
                    entries_map[merge_key]['hours'] += float(hours_raw)

        # 先解析表1（主工时）
        _parse_frame_rows(timesheet_frames[0], is_supplemental=False)
        # 再累加其余补录表
        for supplemental_df in timesheet_frames[1:]:
            _parse_frame_rows(supplemental_df, is_supplemental=True)

        entries = list(entries_map.values())
        _finalize_upload_audit(audit, entries)

        if include_metadata:
            return {'entries': entries, 'employee_profiles': employee_profiles, 'audit': audit}
        return entries
    except Exception as exc:
        raise Exception(f'解析Excel失败: {exc}') from exc


def _normalize_timesheet_columns(columns):
    normalized_columns = []
    heji_count = 0
    task_count = 0

    for column in columns:
        column_name = TIMESHEET_COLUMN_ALIASES.get(str(column).strip(), str(column).strip())
        if column_name == "合计":
            normalized_columns.append("合计_项目" if heji_count == 0 else "合计_非项目")
            heji_count += 1
        elif column_name == "合计.1":
            normalized_columns.append("合计_非项目")
        elif column_name == "任务详情":
            normalized_columns.append("任务详情_项目" if task_count == 0 else "任务详情_非项目")
            task_count += 1
        elif column_name == "任务详情.1":
            normalized_columns.append("任务详情_非项目")
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


def _dedupe_append(items, item):
    if item not in items:
        items.append(item)


def _normalize_project_key(value):
    return re.sub(r"[^a-z0-9]+", "", _clean_text(value).lower())


def _new_upload_audit():
    return {
        "rows_processed": 0,
        "project_hours": 0.0,
        "non_project_hours": 0.0,
        "total_hours": 0.0,
        "bu_overwrites": [],
        "unmatched_employees": [],
        "historical_exception_projects": [],
        "unmatched_projects": [],
        "blank_project_bu_rows": [],
        "monthly_summary": {},
    }


def _resolve_employee_profile(raw_employee_name, employee_lookup, audit):
    raw_name = _clean_text(raw_employee_name)
    alias_name = CONFIRMED_EMPLOYEE_ALIASES.get(raw_name, raw_name)
    profile = employee_lookup.get(alias_name) or employee_lookup.get(raw_name) or {}
    if profile:
        return profile.get("employee_name") or alias_name, profile

    if employee_lookup:
        _dedupe_append(audit["unmatched_employees"], raw_name)
    return alias_name, {}


def _extract_project_standards(workbook):
    by_lower_name = {}
    by_normalized = {}

    for _, df in workbook.items():
        if not isinstance(df, pd.DataFrame):
            continue
        cols = {str(c).strip() for c in df.columns}
        if "Name" not in cols or "BU" not in cols:
            continue

        for _, row in df.iterrows():
            name = _clean_text(row.get("Name"))
            bu = _clean_text(row.get("BU"))
            if not name:
                continue
            item = {"name": name, "bu": bu}
            by_lower_name[name.lower()] = item
            key = _normalize_project_key(name)
            if key:
                by_normalized.setdefault(key, []).append(item)

    return {"by_lower_name": by_lower_name, "by_normalized": by_normalized}


def _standard_project_match(project_name, project_standards):
    name = _clean_text(project_name)
    if not name:
        return None

    exact = project_standards.get("by_lower_name", {}).get(name.lower())
    if exact:
        return exact

    normalized = _normalize_project_key(name)
    candidates = project_standards.get("by_normalized", {}).get(normalized, [])
    unique = {}
    for candidate in candidates:
        unique[(candidate["name"], candidate.get("bu", ""))] = candidate
    if len(unique) == 1:
        return next(iter(unique.values()))
    return None


def _resolve_project_name_and_bu(raw_project_name, raw_bu, project_standards, alias_lower, audit):
    original_name = _clean_text(raw_project_name)
    original_bu = _clean_text(raw_bu)
    aliased_name = alias_lower.get(original_name.lower(), original_name)

    standard = _standard_project_match(aliased_name, project_standards)
    if standard:
        project_name = standard["name"]
        bu = standard.get("bu", "")
        if original_bu and bu and original_bu != bu:
            _dedupe_append(
                audit["bu_overwrites"],
                {"project_name": project_name, "from_bu": original_bu, "to_bu": bu},
            )
        if not bu:
            _dedupe_append(
                audit["blank_project_bu_rows"],
                {"project_name": project_name, "source_project_name": original_name},
            )
        return project_name, bu

    manual_bu = MANUAL_PROJECT_BU.get(aliased_name)
    if manual_bu:
        if original_bu and original_bu != manual_bu:
            _dedupe_append(
                audit["bu_overwrites"],
                {"project_name": aliased_name, "from_bu": original_bu, "to_bu": manual_bu},
            )
        return aliased_name, manual_bu

    if original_bu:
        _dedupe_append(
            audit["historical_exception_projects"],
            {"project_name": aliased_name, "bu": original_bu},
        )
        return aliased_name, original_bu

    _dedupe_append(audit["unmatched_projects"], aliased_name)
    _dedupe_append(
        audit["blank_project_bu_rows"],
        {"project_name": aliased_name, "source_project_name": original_name},
    )
    return aliased_name, ""


def _finalize_upload_audit(audit, entries):
    audit["rows_processed"] = len(entries)
    monthly = {}
    project_hours = 0.0
    non_project_hours = 0.0

    for entry in entries:
        hours = float(entry.get("hours") or 0)
        category = entry.get("category") or ""
        if category == "Project":
            project_hours += hours
        elif category == "Non-Project":
            non_project_hours += hours

        end_date = entry.get("end_date")
        if end_date:
            month_key = end_date.strftime("%Y-%m")
            bucket = monthly.setdefault(
                month_key,
                {"project_hours": 0.0, "non_project_hours": 0.0, "total_hours": 0.0},
            )
            if category == "Project":
                bucket["project_hours"] += hours
            elif category == "Non-Project":
                bucket["non_project_hours"] += hours
            bucket["total_hours"] += hours

    audit["project_hours"] = round(project_hours, 3)
    audit["non_project_hours"] = round(non_project_hours, 3)
    audit["total_hours"] = round(project_hours + non_project_hours, 3)
    audit["monthly_summary"] = {
        month: {
            "project_hours": round(values["project_hours"], 3),
            "non_project_hours": round(values["non_project_hours"], 3),
            "total_hours": round(values["total_hours"], 3),
        }
        for month, values in sorted(monthly.items())
    }


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
    alias_mapping = {
        source.lower(): target
        for source, target in PROJECT_ALIAS_OVERRIDES.items()
    }
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
                "team_leader":     _clean_text(row.get('Team leader', '')),
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

    归属月份口径（统一标准）：
      按 week_end 所在自然月确定 work_month。
      若某周的结束日期跨入次月，则该周整体归属次月；同月内的周不受影响。
      Excel 第4列月份标签不再参与计算。
    """
    try:
        df = pd.read_excel(file_path, sheet_name=0, header=None)
    except Exception as exc:
        raise Exception(f"读取工作周划分文件失败: {exc}") from exc

    # 第0行是表头，从第1行开始是数据
    results = []

    for row_index in range(1, len(df)):
        row = df.iloc[row_index]
        week_start = _normalize_excel_date(row.iloc[0])
        week_end = _normalize_excel_date(row.iloc[1])
        week_code = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ""

        if not week_start or not week_end or not week_code:
            continue

        # 统一口径：按 week_end 所在月份归属
        work_month = week_end.strftime("%Y-%m")

        results.append({
            "week_start": week_start,
            "week_end": week_end,
            "week_code": week_code,
            "work_month": work_month,
        })

    return results


if __name__ == "__main__":

    test_path = Path(__file__).resolve().parents[1] / "Timesheet Report-20260309172417(1).xlsx"
    if os.path.exists(test_path):
        results = parse_timesheet(str(test_path))
        print(f"Parsed {len(results)} rows successfully.")
        if results:
            print("Sample data (mapped dept):", results[0])
