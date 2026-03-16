import re
import unittest
from pathlib import Path


CSS_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "index.css"
APP_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "App.jsx"


class ProjectScheduleFrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = CSS_PATH.read_text(encoding="utf-8")
        cls.app = APP_PATH.read_text(encoding="utf-8")

    def assertCssPattern(self, pattern):
        self.assertRegex(self.css, re.compile(pattern, re.MULTILINE | re.DOTALL))

    def test_project_schedule_state_and_api_hooks_exist(self):
        self.assertIn(
            "const [projectScheduleData, setProjectScheduleData] = useState({ projects: [] });",
            self.app,
        )
        self.assertIn(
            "const [legacyProjectChartOpen, setLegacyProjectChartOpen] = useState(false);",
            self.app,
        )
        self.assertIn(
            "const [scheduleSelectedProjects, setScheduleSelectedProjects] = useState(new Set());",
            self.app,
        )
        self.assertIn("fetch(`${API_BASE_URL}/project-schedule-analysis`)", self.app)
        self.assertIn("fetch(`${API_BASE_URL}/upload-project-schedule`", self.app)

    def test_project_analysis_page_contains_collapsed_legacy_module_and_new_schedule_section(self):
        self.assertIn('className="legacy-project-chart-card', self.app)
        self.assertIn('className="legacy-chart-toggle"', self.app)
        self.assertIn('className="project-schedule-section', self.app)
        self.assertIn('className="project-schedule-toolbar"', self.app)
        self.assertIn('className="project-schedule-card"', self.app)
        self.assertIn("visibleScheduleProjects.map(project =>", self.app)

    def test_project_schedule_styles_define_toolbar_cards_and_mobile_layout(self):
        self.assertCssPattern(
            r"\.legacy-project-chart-card\s*\{[^}]*padding:\s*1rem 1\.08rem;"
        )
        self.assertCssPattern(
            r"\.legacy-chart-toggle\s*\{[^}]*min-height:\s*2\.35rem;[^}]*border-radius:\s*16px;"
        )
        self.assertCssPattern(
            r"\.project-schedule-toolbar\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;"
        )
        self.assertCssPattern(
            r"\.project-schedule-grid\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0\.88rem;"
        )
        self.assertCssPattern(
            r"\.project-schedule-card\s*\{[^}]*padding:\s*1\.04rem;[^}]*border-radius:\s*26px;"
        )
        self.assertIn(".project-meta-pills", self.css)
        self.assertRegex(
            self.css,
            re.compile(
                r"@media\s*\(max-width:\s*900px\)\s*\{[^}]*\.project-schedule-toolbar",
                re.MULTILINE | re.DOTALL,
            ),
        )


if __name__ == "__main__":
    unittest.main()
