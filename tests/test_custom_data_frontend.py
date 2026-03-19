import json
import os
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "frontend" / "src" / "App.jsx"
CUSTOM_EXPORT_PATH = ROOT / "frontend" / "src" / "utils" / "customDataExport.js"


class CustomDataFrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP_PATH.read_text(encoding="utf-8")

    def run_export_helper(self, entries):
        helper_url = CUSTOM_EXPORT_PATH.resolve().as_uri()
        command = [
            "node",
            "--input-type=module",
            "-e",
            (
                f"import {{ buildCustomProjectHoursExport }} from '{helper_url}';"
                "const entries = JSON.parse(process.env.CUSTOM_EXPORT_INPUT);"
                "const result = buildCustomProjectHoursExport(entries, new Date('2026-03-18T09:15:00Z'));"
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
        self.assertIn("exportCustomData", self.app)
        self.assertIn("customDataReuploadHint", self.app)
        self.assertIn("{ id: 'custom_data'", self.app)
        self.assertIn("activeTab === 'custom_data'", self.app)
        self.assertIn("const exportCustomProjectHoursExcel = () => {", self.app)
        self.assertIn("buildCustomProjectHoursExport(data)", self.app)
        self.assertIn("XLSX.utils.aoa_to_sheet", self.app)

    def test_custom_export_helper_builds_continuous_month_matrix(self):
        result = self.run_export_helper(
            [
                {
                    "project_name": "Alpha",
                    "employee_name": "Zed",
                    "employee_id": "E002",
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
            ["项目", "员工", "所属部门", "部门简称", "职位", "2025-01", "2025-02", "2025-03", "总计"],
        )
        self.assertEqual(result["rows"][0], ["Alpha", "Bob", "Full Digital", "Digital", "Designer", 2, 0, 4, 6])
        self.assertEqual(result["rows"][1], ["Alpha", "Zed", "Full AE", "AE", "Engineer", 5, 0, 0, 5])
        self.assertEqual(result["rows"][2], ["Beta", "Amy", "Full Test", "Test", "Lead", 0, 6, 3, 9])
        self.assertEqual(result["sheetName"], "每项目工时")
        self.assertEqual(result["filename"], "每项目工时_Close口径_20260318_0915.xlsx")


if __name__ == "__main__":
    unittest.main()
