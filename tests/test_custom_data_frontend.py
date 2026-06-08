import json
import os
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "frontend" / "src" / "App.jsx"
HEADER_PATH = ROOT / "frontend" / "src" / "components" / "layout" / "Header.jsx"
HOOK_PATH = ROOT / "frontend" / "src" / "hooks" / "useTimesheetData.js"
CUSTOM_EXPORT_PATH = ROOT / "frontend" / "src" / "utils" / "customDataExport.js"


class CustomDataFrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP_PATH.read_text(encoding="utf-8")
        cls.custom_data_panel = (
            ROOT / "frontend" / "src" / "components" / "dashboard" / "CustomDataPanel.jsx"
        ).read_text(encoding="utf-8")
        cls.header = HEADER_PATH.read_text(encoding="utf-8")
        cls.timesheet_hook = HOOK_PATH.read_text(encoding="utf-8")

    def run_export_helper(self, entries):
        helper_url = CUSTOM_EXPORT_PATH.resolve().as_uri()
        command = [
            "node",
            "--input-type=module",
            "-e",
            (
                f"import {{ buildCustomProjectHoursExport }} from '{helper_url}';"
                "const entries = JSON.parse(process.env.CUSTOM_EXPORT_INPUT);"
                "const result = buildCustomProjectHoursExport(entries, [], new Date('2026-03-18T09:15:00Z'));"
                "console.log(JSON.stringify(result));"
            ),
        ]
        env = dict(os.environ, CUSTOM_EXPORT_INPUT=json.dumps(entries))
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            check=False,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        return json.loads(result.stdout)

    def test_custom_data_tab_and_export_card_exist(self):
        self.assertIn("customDataTitle", self.app)
        self.assertIn("customDataSubtitle", self.app)
        self.assertIn("{ id: 'custom_data'", self.app)
        self.assertIn("activeTab === 'custom_data'", self.app)
        self.assertIn("CustomDataPanel", self.app)
        self.assertIn("exportCustomData", self.custom_data_panel)
        self.assertIn("const exportCustomProjectHoursExcel = async () => {", self.custom_data_panel)
        self.assertIn("buildCustomProjectHoursExport(data, weeks)", self.custom_data_panel)
        self.assertIn("const ExcelJS = (await import('exceljs')).default;", self.custom_data_panel)
        self.assertIn("ws.addRow(workbookData.headers);", self.custom_data_panel)
        self.assertIn("applyWorkbookStyle(wb);", self.custom_data_panel)

    def test_upload_audit_report_is_visible_after_timesheet_upload(self):
        self.assertIn("uploadAuditReport", self.timesheet_hook)
        self.assertIn("setUploadAuditReport", self.timesheet_hook)
        self.assertIn("result.audit || {}", self.timesheet_hook)
        self.assertIn("uploadAuditReport={uploadAuditReport}", self.app)
        self.assertIn("clearUploadAuditReport={clearUploadAuditReport}", self.app)
        self.assertIn("upload-audit-panel", self.header)
        self.assertIn("audit.bu_overwrites", self.header)
        self.assertIn("audit.unmatched_projects", self.header)
        self.assertIn("audit.monthly_summary", self.header)
        self.assertIn("downloadAuditCsv", self.header)
        self.assertIn("upload-audit-expanded", self.header)
        self.assertIn("audit.duplicate_rows", self.header)
        self.assertIn("uploadDuplicateRows", self.header)

    def test_custom_export_helper_builds_continuous_month_matrix(self):
        result = self.run_export_helper(
            [
                {
                    "project_name": "Alpha",
                    "employee_name": "Zed",
                    "employee_id": "E002",
                    "bu": "SCD",
                    "department": "AE",
                    "department_full": "Full AE",
                    "position": "Engineer",
                    "category": "Project",
                    "start_date": "2025-01-10",
                    "hours": 5,
                },
                {
                    "project_name": "Alpha",
                    "employee_name": "Bob",
                    "employee_id": "E001",
                    "bu": "DTD",
                    "department": "Digital",
                    "department_full": "Full Digital",
                    "position": "Designer",
                    "category": "Project",
                    "start_date": "2025-01-02",
                    "hours": 2,
                },
                {
                    "project_name": "Alpha",
                    "employee_name": "Bob",
                    "employee_id": "E001",
                    "bu": "DTD",
                    "department": "Digital",
                    "department_full": "Full Digital",
                    "position": "Designer",
                    "category": "Project",
                    "start_date": "2025-03-07",
                    "hours": 4,
                },
                {
                    "project_name": "Alpha",
                    "employee_name": "Bob",
                    "employee_id": "E001",
                    "bu": "DTD",
                    "department": "Digital",
                    "department_full": "Full Digital",
                    "position": "Designer",
                    "category": "Non-Project",
                    "start_date": "2025-02-07",
                    "hours": 99,
                },
                {
                    "project_name": "Beta",
                    "employee_name": "Amy",
                    "employee_id": "",
                    "bu": "SCD",
                    "department": "Test",
                    "department_full": "Full Test",
                    "position": "Lead",
                    "category": "Project",
                    "start_date": "2025-02-01",
                    "hours": 6,
                },
                {
                    "project_name": "Beta",
                    "employee_name": "Amy",
                    "employee_id": "",
                    "bu": "SCD",
                    "department": "Test",
                    "department_full": "Full Test",
                    "position": "Lead",
                    "category": "Project",
                    "start_date": "2025-03-01",
                    "hours": 3,
                },
            ]
        )

        self.assertEqual(
            result["headers"],
            ["BU", "项目", "员工", "部门简称", "所属部门", "职位", "2025-01", "2025-02", "2025-03", "总计"],
        )
        self.assertEqual(result["rows"][0], ["DTD", "Alpha", "Bob", "Digital", "Full Digital", "Designer", 2, None, 4, 6])
        self.assertEqual(result["rows"][1], ["SCD", "Alpha", "Zed", "AE", "Full AE", "Engineer", 5, None, None, 5])
        self.assertEqual(result["rows"][2], ["SCD", "Beta", "Amy", "Test", "Full Test", "Lead", None, 6, 3, 9])
        self.assertEqual(result["sheetName"], "每项目工时")
        self.assertEqual(result["filename"], "每项目工时_Close口径_20260318_0915.xlsx")

    def test_custom_export_places_bu_first_and_department_abbr_before_full_department(self):
        result = self.run_export_helper(
            [
                {
                    "project_name": "Alpha",
                    "employee_name": "Bob",
                    "employee_id": "E001",
                    "bu": "SCD",
                    "department": "Digital",
                    "department_full": "110.1 R&D - Digital",
                    "position": "Designer",
                    "category": "Project",
                    "current_node": "Close",
                    "start_date": "2025-01-02",
                    "hours": 2,
                },
            ]
        )

        self.assertEqual(result["headers"][:6], ["BU", "项目", "员工", "部门简称", "所属部门", "职位"])
        self.assertEqual(result["rows"][0][:6], ["SCD", "Alpha", "Bob", "Digital", "110.1 R&D - Digital", "Designer"])

    def test_person_month_ratio_export_has_total_column(self):
        self.assertIn(
            "ws.addRow(['BU', '项目名称', '员工', '部门简称', '所属部门', '职位', ...months, '总计']);",
            self.custom_data_panel,
        )
        self.assertIn("...months.map(m => r.months[m] ?? 0),", self.custom_data_panel)
        self.assertIn(
            "parseFloat(Object.values(r.months || {}).reduce((sum, value) => sum + Number(value || 0), 0).toFixed(6))",
            self.custom_data_panel,
        )


if __name__ == "__main__":
    unittest.main()
