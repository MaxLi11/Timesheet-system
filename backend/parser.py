import pandas as pd
from datetime import datetime
import numpy as np

def parse_timesheet(file_path: str):
    """
    Parses the timesheet Excel file and returns a list of dictionaries for the DB.
    """
    try:
        # Read the first sheet (Sheet0 usually contains the data)
        df = pd.read_excel(file_path, sheet_name=0)
        
        # Mapping based on the provided sample structure
        # Columns seen: 员工, 所属部门, 工号, 开始日期, 结束日期, 项目名称(新), 非项目名称, 合计, 任务详情, 核准状态
        
        required_cols = ['员工', '所属部门', '工号', '开始日期', '结束日期', '合计']
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Required column '{col}' missing from Excel file.")

        data_rows = []
        for _, row in df.iterrows():
            # Basic validation
            if pd.isna(row['员工']) or pd.isna(row['合计']):
                continue

            # Project vs Non-Project detection
            project_name = row.get('项目名称(新)', '')
            non_project_name = row.get('非项目名称', '')
            
            # If both are empty, might be an invalid row
            if pd.isna(project_name) and pd.isna(non_project_name):
                continue
            
            category = "Project" if not pd.isna(project_name) and str(project_name).strip() != "" else "Non-Project"
            display_name = str(project_name) if category == "Project" else str(non_project_name)

            # Date formatting
            try:
                start_date = row['开始日期']
                if isinstance(start_date, str):
                    start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                elif isinstance(start_date, datetime):
                    start_date = start_date.date()
                
                end_date = row['结束日期']
                if isinstance(end_date, str):
                    end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                elif isinstance(end_date, datetime):
                    end_date = end_date.date()
            except Exception:
                continue # Skip if date format is invalid

            entry = {
                "employee_name": str(row['员工']),
                "employee_id": str(row['工号']),
                "department": str(row['所属部门']),
                "project_name": display_name,
                "category": category,
                "start_date": start_date,
                "end_date": end_date,
                "hours": float(row['合计']),
                "task_details": str(row.get('任务详情', '')),
                "approval_status": str(row.get('核准状态', ''))
            }
            data_rows.append(entry)
            
        return data_rows
    except Exception as e:
        print(f"Error parsing Excel: {e}")
        return []

if __name__ == "__main__":
    # Test with current file
    import os
    test_path = r"d:\Antigravity\Project-timesheet\Timesheet Report-20260309172417(1).xlsx"
    if os.path.exists(test_path):
        results = parse_timesheet(test_path)
        print(f"Parsed {len(results)} rows successfully.")
        if results:
            print("Sample data:", results[0])
