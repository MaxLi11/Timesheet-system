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
        self.assertIn("import.meta.env.VITE_API_URL", self.app)
        self.assertIn("(import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api')", self.app)
        self.assertNotIn("http://192.168.137.73:8000", self.app)
        self.assertIn(
            "const [projectScheduleData, setProjectScheduleData] = useState({ projects: [] });",
            self.app,
        )
        self.assertIn(
            "const [scheduleSelectedProjects, setScheduleSelectedProjects] = useState(new Set());",
            self.app,
        )
        self.assertNotIn(
            "const [legacyProjectChartOpen, setLegacyProjectChartOpen] = useState(false);",
            self.app,
        )
        self.assertIn("fetch(`${API_BASE_URL}/project-schedule-analysis`)", self.app)
        self.assertIn("fetch(`${API_BASE_URL}/upload-project-schedule`", self.app)

    def test_project_analysis_page_contains_schedule_section_without_legacy_module(self):
        self.assertIn('className="project-schedule-section', self.app)
        self.assertIn('className="project-schedule-actions"', self.app)
        self.assertIn('className="project-schedule-card"', self.app)
        self.assertIn("visibleScheduleProjects.map(project =>", self.app)
        self.assertNotIn('className="legacy-project-chart-card', self.app)
        self.assertNotIn('className="legacy-chart-toggle"', self.app)
        self.assertNotIn("const projectAnalysisOpt = useMemo(() => {", self.app)
        self.assertIn("{activeTab === 'overview' && (", self.app)
        self.assertNotIn("{(activeTab === 'overview' || activeTab === 'project_analysis') && (", self.app)

    def test_project_schedule_chart_uses_monthly_hours_with_progress_bars(self):
        self.assertIn("dataHelper.aggregateProjectDeptData(scheduleProjectEntries, 'monthly')", self.app)
        self.assertIn("position: 'top'", self.app)
        self.assertIn("type: 'custom'", self.app)
        self.assertIn("renderItem: (params, api) => {", self.app)
        self.assertIn("t.monthlyHours", self.app)
        self.assertIn("t.milestoneProgress", self.app)
        self.assertIn("formatScheduleMonthLabel", self.app)
        self.assertIn("dayjs(value).format('M.D')", self.app)
        self.assertIn("type: 'line'", self.app)
        self.assertNotIn("text: t.milestoneProgress", self.app)
        self.assertIn("style={{ height: '560px' }}", self.app)
        self.assertIn("gridIndex: 0,", self.app)
        self.assertIn("gridIndex: 1,", self.app)
        self.assertIn("position: 'right'", self.app)

    def test_project_schedule_card_contains_milestone_legend_copy(self):
        self.assertIn("scheduleLegendPlanned", self.app)
        self.assertIn("scheduleLegendActual", self.app)
        self.assertIn("scheduleLegendPending", self.app)
        self.assertRegex(
            self.app,
            re.compile(
                r'className="project-schedule-legend".*?project-schedule-legend-marker planned.*?\{t\.scheduleLegendPlanned\}.*?project-schedule-legend-marker actual.*?\{t\.scheduleLegendActual\}.*?project-schedule-legend-marker pending.*?\{t\.scheduleLegendPending\}',
                re.MULTILINE | re.DOTALL,
            ),
        )

    def test_schedule_project_picker_uses_outside_click_close_without_overlay(self):
        self.assertIn("const scheduleProjectPickerRef = useRef(null);", self.app)
        self.assertIn("document.addEventListener('pointerdown', handleSchedulePickerPointerDown);", self.app)
        self.assertRegex(
            self.app,
            re.compile(
                r'project-schedule-actions">.*?<label className="utility-upload schedule-upload-control">.*?</label>.*?<div className="filter-group dropdown-container" ref=\{scheduleProjectPickerRef\}>.*?<label>\{t\.filterScheduleProjects\}</label>',
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertNotRegex(
            self.app,
            re.compile(
                r'Department Multi-select Dropdown \*/\s*<div className="filter-group dropdown-container" ref=\{scheduleProjectPickerRef\}>',
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertIn("`已选 ${scheduleSelectedProjects.size} 个`", self.app)
        self.assertNotIn(
            '<div className="dropdown-overlay" onClick={() => setScheduleProjectPickerOpen(false)} />',
            self.app,
        )

    def test_project_schedule_actions_and_department_legend_are_compact_and_aligned(self):
        self.assertIn("bottom: 'auto'", self.app)
        self.assertRegex(
            self.app,
            re.compile(
                r"legend:\s*\{[^}]*show:\s*hasMonthlyHours,[^}]*data:\s*departments,[^}]*type:\s*'scroll',[^}]*top:\s*206,[^}]*left:\s*'center',[^}]*right:\s*'auto',[^}]*bottom:\s*'auto'",
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertRegex(
            self.app,
            re.compile(
                r"grid:\s*\[[^\]]*\{ left:\s*110,\s*right:\s*132,\s*top:\s*40,\s*height:\s*176 \},\s*\{ left:\s*110,\s*right:\s*132,\s*top:\s*242,\s*height:\s*240 \}",
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertCssPattern(
            r"\.project-schedule-actions\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;"
        )
        self.assertCssPattern(
            r"\.project-schedule-actions\s+\.approval-project-panel\s*\{[^}]*right:\s*0;"
        )
        self.assertRegex(
            self.css,
            re.compile(
                r"@media\s*\(max-width:\s*900px\)\s*\{.*?\.project-schedule-actions\s*\{[^}]*align-items:\s*stretch;",
                re.MULTILINE | re.DOTALL,
            ),
        )

    def test_project_schedule_styles_define_toolbar_cards_and_mobile_layout(self):
        self.assertCssPattern(
            r"\.project-schedule-grid\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0\.88rem;"
        )
        self.assertCssPattern(
            r"\.project-schedule-card\s*\{[^}]*padding:\s*1\.04rem;[^}]*border-radius:\s*26px;"
        )
        self.assertCssPattern(
            r"\.project-schedule-legend\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;"
        )
        self.assertCssPattern(
            r"\.project-schedule-legend-marker\.planned\s*\{[^}]*background:\s*rgba\(122,\s*166,\s*255,\s*0\.2\);"
        )
        self.assertCssPattern(
            r"\.project-schedule-legend-marker\.actual\s*\{[^}]*background:\s*rgba\(77,\s*114,\s*255,\s*0\.18\);"
        )
        self.assertCssPattern(
            r"\.project-schedule-legend-marker\.pending\s*\{[^}]*border-left:\s*2px dashed rgba\(255,\s*139,\s*75,\s*0\.95\);"
        )
        self.assertCssPattern(
            r"\.approval-project-panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*max-height:\s*min\(30rem,\s*calc\(100vh\s*-\s*8rem\)\);[^}]*overflow:\s*hidden;"
        )
        self.assertCssPattern(
            r"\.project-checkboxes\s*\{[^}]*max-height:\s*none;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;"
        )
        self.assertIn(".project-meta-pills", self.css)
        self.assertRegex(
            self.css,
            re.compile(
                r"@media\s*\(max-width:\s*900px\)\s*\{[^}]*\.project-schedule-actions",
                re.MULTILINE | re.DOTALL,
            ),
        )


if __name__ == "__main__":
    unittest.main()
