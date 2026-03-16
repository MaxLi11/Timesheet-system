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


MILESTONE_COLUMNS = [
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

SCHEDULE_COLUMNS = [
    "Unnamed: 0",
    "BU",
    "Project Name",
    "Status",
    "Unnamed: 4",
    *MILESTONE_COLUMNS,
    "Unnamed: 21",
    "Unnamed: 22",
    "Unnamed: 23",
    "Unnamed: 24",
    "Unnamed: 25",
    "Unnamed: 26",
    "Unnamed: 27",
    "Unnamed: 28",
    "Unnamed: 29",
    "Unnamed: 30",
]


def build_project_rows(project_name, bu, status, planned_dates, actual_dates, delta_days, cycle_days):
    rows = []
    row_specs = [
        ("MRD plan", planned_dates, cycle_days["planned"]),
        ("Actual/Outlook", actual_dates, cycle_days["actual"]),
        ("Delta", delta_days, cycle_days["delta"]),
    ]
    for row_index, (row_type, values, cycle_value) in enumerate(row_specs):
        row = {column: None for column in SCHEDULE_COLUMNS}
        if row_index == 0:
            row["BU"] = bu
            row["Project Name"] = project_name
            row["Status"] = status
        row["Unnamed: 4"] = row_type
        row["Unnamed: 30"] = cycle_value
        for milestone in MILESTONE_COLUMNS:
            row[milestone] = values.get(milestone)
        rows.append(row)
    return rows


def make_schedule_workbook(path: Path, project_specs):
    rows = []
    for spec in project_specs:
        rows.extend(
            build_project_rows(
                project_name=spec["project_name"],
                bu=spec["bu"],
                status=spec["status"],
                planned_dates=spec["planned_dates"],
                actual_dates=spec["actual_dates"],
                delta_days=spec["delta_days"],
                cycle_days=spec["cycle_days"],
            )
        )

    df = pd.DataFrame(rows, columns=SCHEDULE_COLUMNS)
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Schedule", index=False, startrow=2)


class ProjectScheduleFeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db_path = ROOT / "tests" / ".tmp_project_schedule_feature.db"
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
        self.schedule_path = ROOT / "tests" / ".tmp_project_schedule_feature.xlsx"
        if self.schedule_path.exists():
            self.schedule_path.unlink()

    def tearDown(self):
        if self.schedule_path.exists():
            self.schedule_path.unlink()

    def seed_time_entries(self, entries):
        db = database.SessionLocal()
        try:
            crud.save_time_entries(db, entries)
        finally:
            db.close()

    def build_sample_projects(self):
        return [
            {
                "project_name": "Balsa3/Bamboo2",
                "bu": "DTD",
                "status": "待TO",
                "planned_dates": {
                    "Gate0（kick off)": date(2025, 1, 1),
                    "Gate1(Initial PRD)": date(2025, 2, 1),
                    "Final PRD": date(2025, 3, 1),
                    "RTP": date(2025, 4, 10),
                },
                "actual_dates": {
                    "Gate0（kick off)": date(2025, 1, 3),
                    "Gate1(Initial PRD)": date(2025, 2, 5),
                    "Final PRD": date(2025, 3, 10),
                },
                "delta_days": {
                    "Gate0（kick off)": 2,
                    "Gate1(Initial PRD)": 4,
                    "Final PRD": 9,
                    "RTP": None,
                },
                "cycle_days": {"planned": 100, "actual": 90, "delta": -10},
            },
            {
                "project_name": "Walnut2",
                "bu": "DTD",
                "status": "待验证",
                "planned_dates": {
                    "Pre-Gate0": date(2025, 1, 5),
                    "Gate0（kick off)": date(2025, 1, 20),
                    "Gate1(Initial PRD)": date(2025, 2, 20),
                    "Final PRD": date(2025, 4, 1),
                },
                "actual_dates": {
                    "Pre-Gate0": date(2025, 1, 10),
                    "Gate0（kick off)": date(2025, 1, 24),
                    "Gate1(Initial PRD)": date(2025, 2, 24),
                },
                "delta_days": {
                    "Pre-Gate0": 5,
                    "Gate0（kick off)": 4,
                    "Gate1(Initial PRD)": 4,
                },
                "cycle_days": {"planned": 120, "actual": 115, "delta": -5},
            },
        ]

    def test_parse_project_schedule_reads_three_row_blocks_and_cycle_summary(self):
        self.assertTrue(
            hasattr(parser, "parse_project_schedule"),
            "Expected backend.parser.parse_project_schedule to exist.",
        )

        make_schedule_workbook(self.schedule_path, self.build_sample_projects())
        parsed_projects = parser.parse_project_schedule(str(self.schedule_path))

        self.assertEqual([item["project_name"] for item in parsed_projects], ["Balsa3/Bamboo2", "Walnut2"])
        self.assertEqual(parsed_projects[0]["planned_days"], 100)
        self.assertEqual(parsed_projects[0]["actual_days"], 90)
        self.assertEqual(parsed_projects[0]["delta_days"], -10)
        self.assertEqual(len(parsed_projects[0]["milestones"]), len(MILESTONE_COLUMNS))

        gate0 = next(
            item for item in parsed_projects[0]["milestones"] if item["name"] == "Gate0（kick off)"
        )
        self.assertEqual(gate0["planned_date"], date(2025, 1, 1))
        self.assertEqual(gate0["actual_date"], date(2025, 1, 3))
        self.assertEqual(gate0["delta_days"], 2)

        rtp = next(item for item in parsed_projects[0]["milestones"] if item["name"] == "RTP")
        self.assertIsNone(rtp["actual_date"])
        self.assertTrue(rtp["is_pending"])

    def test_schedule_upload_and_analysis_endpoints_replace_data_and_compute_interval_shares(self):
        make_schedule_workbook(self.schedule_path, self.build_sample_projects())
        self.seed_time_entries(
            [
                {
                    "employee_name": "Alice",
                    "employee_id": "E001",
                    "department": "Digital",
                    "project_name": "Balsa3",
                    "category": "Project",
                    "start_date": date(2025, 1, 10),
                    "end_date": date(2025, 1, 10),
                    "hours": 5.0,
                    "task_details": "Gate0 prep",
                    "approval_status": "Approved",
                    "current_node": "Close",
                    "pending_approver": "",
                },
                {
                    "employee_name": "Bob",
                    "employee_id": "E002",
                    "department": "AE",
                    "project_name": "Balsa3",
                    "category": "Project",
                    "start_date": date(2025, 1, 20),
                    "end_date": date(2025, 1, 20),
                    "hours": 15.0,
                    "task_details": "Gate0 AE",
                    "approval_status": "Approved",
                    "current_node": "Close",
                    "pending_approver": "",
                },
                {
                    "employee_name": "Carol",
                    "employee_id": "E003",
                    "department": "SW",
                    "project_name": "Balsa3",
                    "category": "Project",
                    "start_date": date(2025, 1, 15),
                    "end_date": date(2025, 1, 15),
                    "hours": 20.0,
                    "task_details": "Should be excluded",
                    "approval_status": "Pending",
                    "current_node": "Prepare",
                    "pending_approver": "Manager",
                },
                {
                    "employee_name": "Dave",
                    "employee_id": "E004",
                    "department": "Digital",
                    "project_name": "Balsa3",
                    "category": "Project",
                    "start_date": date(2025, 2, 20),
                    "end_date": date(2025, 2, 20),
                    "hours": 8.0,
                    "task_details": "Gate1 work",
                    "approval_status": "Approved",
                    "current_node": "Close",
                    "pending_approver": "",
                },
                {
                    "employee_name": "Eve",
                    "employee_id": "E005",
                    "department": "Analog",
                    "project_name": "Walnut2",
                    "category": "Project",
                    "start_date": date(2025, 1, 30),
                    "end_date": date(2025, 1, 30),
                    "hours": 99.0,
                    "task_details": "Other project",
                    "approval_status": "Approved",
                    "current_node": "Close",
                    "pending_approver": "",
                },
            ]
        )

        with self.schedule_path.open("rb") as schedule_file:
            response = self.client.post(
                "/upload-project-schedule",
                files={
                    "file": (
                        self.schedule_path.name,
                        schedule_file,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"message": "Upload successful", "projects_processed": 2, "milestones_processed": 32},
        )

        analysis_response = self.client.get("/project-schedule-analysis")
        self.assertEqual(analysis_response.status_code, 200)
        payload = analysis_response.json()
        self.assertEqual([item["project_name"] for item in payload["projects"]], ["Balsa3/Bamboo2", "Walnut2"])

        balsa = payload["projects"][0]
        self.assertEqual(balsa["mapped_timesheet_projects"], ["Balsa3"])
        self.assertEqual(
            balsa["cycle_summary"],
            {"planned_days": 100, "actual_days": 90, "delta_days": -10},
        )
        self.assertEqual(len(balsa["intervals"]), 2)

        first_interval = balsa["intervals"][0]
        self.assertEqual(first_interval["from_milestone"], "Gate0（kick off)")
        self.assertEqual(first_interval["to_milestone"], "Gate1(Initial PRD)")
        self.assertEqual(first_interval["start_date"], "2025-01-03")
        self.assertEqual(first_interval["end_date"], "2025-02-05")
        self.assertAlmostEqual(first_interval["total_hours"], 20.0)

        shares = {item["department"]: item["share"] for item in first_interval["department_shares"]}
        self.assertAlmostEqual(shares["AE"], 0.75)
        self.assertAlmostEqual(shares["Digital"], 0.25)
        self.assertNotIn("SW", shares)

        replacement_projects = [self.build_sample_projects()[1]]
        make_schedule_workbook(self.schedule_path, replacement_projects)
        with self.schedule_path.open("rb") as schedule_file:
            replace_response = self.client.post(
                "/upload-project-schedule",
                files={
                    "file": (
                        self.schedule_path.name,
                        schedule_file,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(replace_response.status_code, 200)
        replaced_payload = self.client.get("/project-schedule-analysis").json()
        self.assertEqual([item["project_name"] for item in replaced_payload["projects"]], ["Walnut2"])

    def test_balsa_bamboo_mapping_expands_when_bamboo2_timesheet_exists(self):
        make_schedule_workbook(self.schedule_path, [self.build_sample_projects()[0]])
        self.seed_time_entries(
            [
                {
                    "employee_name": "Alice",
                    "employee_id": "E001",
                    "department": "Digital",
                    "project_name": "Balsa3",
                    "category": "Project",
                    "start_date": date(2025, 1, 10),
                    "end_date": date(2025, 1, 10),
                    "hours": 5.0,
                    "task_details": "Balsa3 baseline",
                    "approval_status": "Approved",
                    "current_node": "Close",
                    "pending_approver": "",
                }
            ]
        )

        with self.schedule_path.open("rb") as schedule_file:
            upload_response = self.client.post(
                "/upload-project-schedule",
                files={
                    "file": (
                        self.schedule_path.name,
                        schedule_file,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(upload_response.status_code, 200)
        initial_payload = self.client.get("/project-schedule-analysis").json()
        self.assertEqual(initial_payload["projects"][0]["mapped_timesheet_projects"], ["Balsa3"])

        db = database.SessionLocal()
        try:
            db.add(
                database.TimeEntry(
                    employee_name="Bamboo User",
                    employee_id="E009",
                    department="AE",
                    project_name="Bamboo2",
                    category="Project",
                    start_date=date(2025, 1, 12),
                    end_date=date(2025, 1, 12),
                    hours=6.0,
                    task_details="Bamboo2 now exists",
                    approval_status="Approved",
                    current_node="Close",
                    pending_approver="",
                )
            )
            db.commit()
        finally:
            db.close()

        merged_payload = self.client.get("/project-schedule-analysis").json()
        self.assertEqual(
            merged_payload["projects"][0]["mapped_timesheet_projects"],
            ["Balsa3", "Bamboo2"],
        )


if __name__ == "__main__":
    unittest.main()
