import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

from scripts.timesheet_pipeline.config import default_config


class TimesheetPipelineConfigTests(unittest.TestCase):
    def test_default_config_records_canonical_files_and_totals(self):
        config = default_config(Path("D:/Antigravity/Project-timesheet"))

        self.assertTrue(config.base_dir.endswith("新需求"))
        self.assertEqual(
            config.files.historical_summary,
            "summary_hours_2022-2024_names_projects_updated.xlsx",
        )
        self.assertEqual(config.files.oa_report, "Timesheet Report-20260602135306.xlsx")
        self.assertEqual(config.expected.historical_rows, 166_319)
        self.assertEqual(config.expected.oa_rows, 32_416)
        self.assertEqual(config.expected.merged_hours, 1_810_321.8)

    def test_period_policy_prefers_existing_oa_period_then_sat_to_fri_fallback(self):
        policy = default_config().period_policy

        self.assertEqual(policy.week_start, "Saturday")
        self.assertEqual(policy.week_end, "Friday")
        self.assertTrue(policy.prefer_existing_oa_period)
        self.assertEqual(
            policy.overlap_tiebreaker,
            "standard_sat_to_fri_7_day_then_shortest_valid",
        )
        self.assertEqual(policy.fallback_period, "create_sat_to_fri_7_day_period")

    def test_config_cli_outputs_json(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "scripts.timesheet_pipeline.config", "--show"],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        )
        payload = json.loads(result.stdout)

        self.assertEqual(payload["expected"]["historical_hours"], 1_064_077.8)
        self.assertEqual(payload["period_policy"]["week_start"], "Saturday")


if __name__ == "__main__":
    unittest.main()
