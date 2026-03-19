import sqlite3
import sys
import unittest
from datetime import date
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import crud, database, main, parser  # noqa: E402


class CustomDataBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db_path = ROOT / "tests" / ".tmp_custom_data_backend.db"
        if cls.test_db_path.exists():
            cls.test_db_path.unlink()

        cls.original_engine = database.engine
        cls.original_session_local = database.SessionLocal

        test_engine = create_engine(
            f"sqlite:///{cls.test_db_path}",
            connect_args={"check_same_thread": False},
        )
        database.engine = test_engine
        database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
        database.init_db()

        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        database.engine.dispose()
        database.engine = cls.original_engine
        database.SessionLocal = cls.original_session_local
        if cls.test_db_path.exists():
            cls.test_db_path.unlink()

    def setUp(self):
        database.Base.metadata.drop_all(bind=database.engine)
        database.Base.metadata.create_all(bind=database.engine)
        self.timesheet_path = ROOT / "tests" / ".tmp_custom_data_timesheet.xlsx"
        if self.timesheet_path.exists():
            self.timesheet_path.unlink()

    def tearDown(self):
        if self.timesheet_path.exists():
            self.timesheet_path.unlink()

    def create_timesheet_workbook(self):
        df = pd.DataFrame(
            [
                {
                    "员工": "张三/Zhang San",
                    "创建人": "张三/Zhang San",
                    "所属公司": "ANX",
                    "所属部门": "130 R&D - Engineering Support (Suzhou)",
                    "职位": "Testing Engineer",
                    "工号": "E001",
                    "开始日期": "2025-01-03",
                    "结束日期": "2025-01-03",
                    "项目名称(作废)": "",
                    "项目名称(新)": "Alpha",
                    "aftermarket": "",
                    "项目经理": "",
                    "Project Leader": "",
                    "任务详情": "bring-up",
                    "合计": 8,
                    "非项目名称": "",
                    "任务详情.1": "",
                    "合计.1": "",
                    "核准状态": "Approved",
                    "当前节点": "Close",
                    "未操作者": "",
                }
            ]
        )
        with pd.ExcelWriter(self.timesheet_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)

    def test_parse_timesheet_captures_position_and_full_department(self):
        self.create_timesheet_workbook()

        entries = parser.parse_timesheet(str(self.timesheet_path))

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["department"], "AE")
        self.assertEqual(entries[0]["department_full"], "130 R&D - Engineering Support (Suzhou)")
        self.assertEqual(entries[0]["position"], "Testing Engineer")

    def test_stats_endpoint_returns_position_and_full_department_fields(self):
        db = database.SessionLocal()
        try:
            crud.save_time_entries(
                db,
                [
                    {
                        "employee_name": "Alice",
                        "employee_id": "E001",
                        "department": "AE",
                        "department_full": "130 R&D - Engineering Support (Suzhou)",
                        "position": "Testing Engineer",
                        "project_name": "Alpha",
                        "category": "Project",
                        "start_date": date(2025, 1, 10),
                        "end_date": date(2025, 1, 10),
                        "hours": 8.0,
                        "task_details": "bring-up",
                        "approval_status": "Approved",
                        "current_node": "Close",
                        "pending_approver": "",
                    }
                ],
            )
        finally:
            db.close()

        response = self.client.get("/stats")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["department"], "AE")
        self.assertEqual(payload[0]["department_full"], "130 R&D - Engineering Support (Suzhou)")
        self.assertEqual(payload[0]["position"], "Testing Engineer")

    def test_init_db_backfills_new_time_entry_columns_on_existing_database(self):
        legacy_db_path = ROOT / "tests" / ".tmp_custom_data_legacy.db"
        if legacy_db_path.exists():
            legacy_db_path.unlink()

        legacy_conn = sqlite3.connect(legacy_db_path)
        try:
            legacy_conn.execute(
                """
                CREATE TABLE time_entries (
                    id INTEGER NOT NULL PRIMARY KEY,
                    employee_name VARCHAR,
                    employee_id VARCHAR,
                    department VARCHAR,
                    project_name VARCHAR,
                    category VARCHAR,
                    start_date DATE,
                    end_date DATE,
                    hours FLOAT,
                    task_details VARCHAR,
                    approval_status VARCHAR,
                    current_node VARCHAR,
                    pending_approver VARCHAR
                )
                """
            )
            legacy_conn.commit()
        finally:
            legacy_conn.close()

        legacy_engine = create_engine(
            f"sqlite:///{legacy_db_path}",
            connect_args={"check_same_thread": False},
        )
        legacy_session_local = sessionmaker(autocommit=False, autoflush=False, bind=legacy_engine)
        original_engine = database.engine
        original_session_local = database.SessionLocal
        try:
            database.engine = legacy_engine
            database.SessionLocal = legacy_session_local
            database.init_db()
            columns = {column["name"] for column in inspect(database.engine).get_columns("time_entries")}
        finally:
            database.engine = original_engine
            database.SessionLocal = original_session_local
            legacy_engine.dispose()
            if legacy_db_path.exists():
                legacy_db_path.unlink()

        self.assertIn("department_full", columns)
        self.assertIn("position", columns)


if __name__ == "__main__":
    unittest.main()
