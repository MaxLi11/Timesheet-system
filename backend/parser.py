import pandas as pd
from datetime import datetime, date
import numpy as np
import os

# Default mapping embedded in the code so the Excel file is optional
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
    "135.2 R&D - Product Marketing": "PM"
}

_DEPT_MAPPING_CACHE = DEFAULT_DEPT_MAPPING.copy()
_LAST_MAPPING_MTIME = 0

def load_dept_mapping():
    """
    Loads department name mapping from 部门简称.xlsx with caching.
    Uses DEFAULT_DEPT_MAPPING as the base.
    """
    global _DEPT_MAPPING_CACHE, _LAST_MAPPING_MTIME
    mapping_path = r"d:\Antigravity\Project-timesheet\部门简称.xlsx"
    
    if not os.path.exists(mapping_path):
        return _DEPT_MAPPING_CACHE

    try:
        current_mtime = os.path.getmtime(mapping_path)
        if current_mtime > _LAST_MAPPING_MTIME:
            mapping_df = pd.read_excel(mapping_path, sheet_name='Sheet1')
            file_mapping = dict(zip(mapping_df['部门'].astype(str), mapping_df['部门简称'].astype(str)))
            # Merge: Default mapping + File mapping (File takes precedence)
            combined = DEFAULT_DEPT_MAPPING.copy()
            combined.update(file_mapping)
            _DEPT_MAPPING_CACHE = combined
            _LAST_MAPPING_MTIME = current_mtime
            print(f"DEBUG: Department mapping reloaded (mtime: {current_mtime})")
    except Exception as e:
        print(f"Warning: Failed to load department mapping: {e}")
    
    return _DEPT_MAPPING_CACHE

def parse_timesheet(file_path: str):
    """
    Parses the timesheet Excel file and returns a list of dictionaries for the DB.
    Handles duplicate '合计' columns (O for Projects, R for Non-Projects).
    """
    dept_mapping = load_dept_mapping()
    try:
        # Read the first sheet
        df = pd.read_excel(file_path, sheet_name=0)
        
        # Get raw columns to detect duplicates and rename them
        raw_cols = list(df.columns)
        new_cols = []
        heji_count = 0
        for col in raw_cols:
            c_name = str(col).strip()
            if c_name == '合计':
                if heji_count == 0:
                    new_cols.append('合计_项目')
                else:
                    new_cols.append('合计_非项目')
                heji_count += 1
            else:
                new_cols.append(c_name)
        df.columns = new_cols
        
        required_cols = ['员工', '所属部门', '工号', '开始日期', '结束日期']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Excel文件中缺少以下必填列: {', '.join(missing)}。")

        data_rows = []
        for index, row in df.iterrows():
            # Project vs Non-Project detection
            proj_new = row.get('项目名称(新)', '')
            proj_old = row.get('项目名称(作废)', '')
            non_project_name = row.get('非项目名称', '')
            
            # 1. Check Project Name (New)
            if not pd.isna(proj_new) and str(proj_new).strip() != "":
                category = "Project"
                display_name = str(proj_new).strip()
                hours_val = row.get('合计_项目')
            # 2. Check Project Name (Obsolete)
            elif not pd.isna(proj_old) and str(proj_old).strip() != "":
                category = "Project"
                display_name = str(proj_old).strip()
                hours_val = row.get('合计_项目')
            # 3. Check Non-Project
            elif not pd.isna(non_project_name) and str(non_project_name).strip() != "":
                category = "Non-Project"
                display_name = str(non_project_name).strip()
                hours_val = row.get('合计_非项目')
            else:
                # Row has no identifier, skip
                continue

            # Basic validation for hours and employee
            if pd.isna(row['员工']) or pd.isna(hours_val) or str(hours_val).strip() == "" or float(hours_val) == 0:
                continue

            # Date formatting with error handling
            try:
                start_date = row['开始日期']
                end_date = row['结束日期']
                
                if pd.isna(start_date) or pd.isna(end_date):
                    continue

                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date.strip(), '%Y-%m-%d').date()
                elif isinstance(start_date, datetime):
                    start_date = start_date.date()
                
                if isinstance(end_date, str):
                    end_date = datetime.strptime(end_date.strip(), '%Y-%m-%d').date()
                elif isinstance(end_date, datetime):
                    end_date = end_date.date()
                
                # Double check we actually have date objects
                if not isinstance(start_date, date) or not isinstance(end_date, date):
                    continue
            except Exception as de:
                print(f"Row {index} date error: {de}")
                continue 

            # Apply department mapping
            raw_dept = str(row['所属部门']).strip()
            dept_name = dept_mapping.get(raw_dept, raw_dept)

            entry = {
                "employee_name": str(row['员工']).strip(),
                "employee_id": str(row['工号']).strip(),
                "department": dept_name,
                "project_name": display_name,
                "category": category,
                "start_date": start_date,
                "end_date": end_date,
                "hours": float(hours_val),
                "task_details": str(row.get('任务详情', '')).strip(),
                "approval_status": str(row.get('核准状态', '')).strip()
            }
            data_rows.append(entry)
            
        return data_rows
    except Exception as e:
        raise Exception(f"解析Excel失败: {str(e)}")

if __name__ == "__main__":
    import os
    test_path = r"d:\Antigravity\Project-timesheet\Timesheet Report-20260309172417(1).xlsx"
    if os.path.exists(test_path):
        results = parse_timesheet(test_path)
        print(f"Parsed {len(results)} rows successfully.")
        if results:
            print("Sample data (mapped dept):", results[0])
