import sys
import unittest
from datetime import date
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import crud, database, main, parser  # noqa: E402


TIMESHEET_COLUMNS = [
    "员工",
    "创建人",
    "所属公司",
    "所属部门",
    "职位",
    "工号",
    "开始日期",
    "结束日期",
    "项目名称(新)",
    "BU",
    "aftermarket",
    "项目经理",
    "Project Leader",
    "任务详情",
    "合计",
    "非项目名称",
    "任务详情.1",
    "合计.1",
    "核准状态",
    "当前节点",
    "未操作者",
]


def timesheet_row(
    employee,
    project_name="",
    bu="",
    project_hours=None,
    non_project_name="",
    non_project_hours=None,
    start_date="2025-12-29",
    end_date="2026-01-02",
    project_task="project work",
    non_project_task="non-project work",
):
    row = {column: "" for column in TIMESHEET_COLUMNS}
    row.update(
        {
            "员工": employee,
            "创建人": employee,
            "所属公司": "ANX",
            "所属部门": "125.2 R&D - System Eng SW",
            "职位": "Engineer",
            "工号": "RAW",
            "开始日期": start_date,
            "结束日期": end_date,
            "项目名称(新)": project_name,
            "BU": bu,
            "任务详情": project_task,
            "合计": project_hours,
            "非项目名称": non_project_name,
            "任务详情.1": non_project_task,
            "合计.1": non_project_hours,
            "核准状态": "Approved",
            "当前节点": "Close",
        }
    )
    return row


def make_upload_workbook(path: Path):
    sheet0 = pd.DataFrame(
        [
            timesheet_row(
                "Bob (Pushui) Xu",
                project_name="Barolo-3",
                bu="WRONG",
                project_hours=8,
            ),
            timesheet_row(
                "薛亮/Liang Xue",
                project_name="IP",
                bu="",
                project_hours=2,
            ),
            timesheet_row(
                "Alice",
                project_name="",
                non_project_name="Training",
                non_project_hours=4,
            ),
        ],
        columns=TIMESHEET_COLUMNS,
    )
    supplemental = pd.DataFrame(
        [
            timesheet_row(
                "Alice",
                project_name="KGD(MHD)",
                bu="",
                project_hours=6,
                start_date="2026-01-05",
                end_date="2026-01-09",
            )
        ],
        columns=TIMESHEET_COLUMNS,
    )
    standard_projects = pd.DataFrame(
        [
            {"Internal ID": 1, "Name": "Barolo3", "BU": "DTD"},
            {"Internal ID": 2, "Name": "KGD", "BU": "SCD"},
            {"Internal ID": 3, "Name": "Cape Cod", "BU": "DTD"},
        ]
    )
    employee_profiles = pd.DataFrame(
        [
            {
                "工号": "E001",
                "姓名": "Pushui Xu",
                "部门": "135.2 R&D - Product Marketing",
                "分部": "",
                "直接上级": "",
                "岗位": "PM",
                "姓名简称": "pxu",
                "部门简称": "PM",
                "Team leader": "",
                "BU": "",
            },
            {
                "工号": "E002",
                "姓名": "Liang Xue",
                "部门": "125.2 R&D - System Eng SW",
                "分部": "",
                "直接上级": "",
                "岗位": "SW",
                "姓名简称": "lxue",
                "部门简称": "SW",
                "Team leader": "",
                "BU": "",
            },
            {
                "工号": "E003",
                "姓名": "Alice",
                "部门": "110.1 R&D - Digital",
                "分部": "",
                "直接上级": "",
                "岗位": "Digital",
                "姓名简称": "alice",
                "部门简称": "Digital",
                "Team leader": "",
                "BU": "",
            },
        ]
    )
    dept_mapping = pd.DataFrame(
        [
            {"部门": "125.2 R&D - System Eng SW", "部门简称": "SW"},
            {"部门": "135.2 R&D - Product Marketing", "部门简称": "PM"},
            {"部门": "110.1 R&D - Digital", "部门简称": "Digital"},
        ]
    )
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        sheet0.to_excel(writer, sheet_name="Sheet0", index=False)
        supplemental.to_excel(writer, sheet_name="wrike&OA-before-2026", index=False)
        standard_projects.to_excel(writer, sheet_name="项目标准名称", index=False)
        employee_profiles.to_excel(writer, sheet_name="员工基础信息", index=False)
        dept_mapping.to_excel(writer, sheet_name="部门简称匹配表", index=False)


class AnxUploadRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db_path = ROOT / "tests" / ".tmp_anx_upload_rules.db"
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
        database.init_db()
        self.workbook_path = ROOT / "tests" / ".tmp_anx_upload_rules.xlsx"
        if self.workbook_path.exists():
            self.workbook_path.unlink()
        make_upload_workbook(self.workbook_path)

    def tearDown(self):
        if self.workbook_path.exists():
            self.workbook_path.unlink()

    def test_parse_applies_confirmed_employee_project_and_bu_rules(self):
        parsed = parser.parse_timesheet(str(self.workbook_path), include_metadata=True)
        entries = parsed["entries"]
        audit = parsed["audit"]

        self.assertEqual(len(entries), 4)
        by_project = {(entry["employee_name"], entry["project_name"]): entry for entry in entries}

        self.assertIn(("Pushui Xu", "Barolo3"), by_project)
        self.assertEqual(by_project[("Pushui Xu", "Barolo3")]["employee_id"], "E001")
        self.assertEqual(by_project[("Pushui Xu", "Barolo3")]["department"], "PM")
        self.assertEqual(by_project[("Pushui Xu", "Barolo3")]["bu"], "DTD")

        self.assertIn(("Liang Xue", "IP"), by_project)
        self.assertEqual(by_project[("Liang Xue", "IP")]["bu"], "SCD")

        self.assertIn(("Alice", "KGD"), by_project)
        self.assertEqual(by_project[("Alice", "KGD")]["bu"], "SCD")

        non_project = next(entry for entry in entries if entry["category"] == "Non-Project")
        self.assertEqual(non_project["bu"], "")
        self.assertEqual(non_project["task_details"], "non-project work")

        self.assertEqual(audit["rows_processed"], 4)
        self.assertEqual(audit["project_hours"], 16.0)
        self.assertEqual(audit["non_project_hours"], 4.0)
        self.assertEqual(audit["total_hours"], 20.0)
        self.assertEqual(
            audit["bu_overwrites"],
            [{"project_name": "Barolo3", "from_bu": "WRONG", "to_bu": "DTD"}],
        )
        self.assertEqual(audit["unmatched_employees"], [])
        self.assertEqual(audit["blank_project_bu_rows"], [])
        self.assertEqual(audit["monthly_summary"]["2026-01"]["total_hours"], 20.0)

    def test_upload_response_includes_rule_audit_and_persists_bu(self):
        with self.workbook_path.open("rb") as workbook:
            response = self.client.post(
                "/upload",
                files={
                    "file": (
                        self.workbook_path.name,
                        workbook,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["rows_processed"], 4)
        self.assertEqual(payload["audit"]["project_hours"], 16.0)
        self.assertEqual(payload["audit"]["monthly_summary"]["2026-01"]["total_hours"], 20.0)

        db = database.SessionLocal()
        try:
            barolo = (
                db.query(database.TimeEntry)
                .filter(database.TimeEntry.project_name == "Barolo3")
                .one()
            )
            self.assertEqual(barolo.bu, "DTD")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
