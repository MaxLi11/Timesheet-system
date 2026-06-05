import re
import unittest
from pathlib import Path


CSS_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "index.css"
APP_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "App.jsx"
PROJECT_ANALYSIS_PANEL_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "components" / "dashboard" / "ProjectAnalysisPanel.jsx"
TIMESHEET_HOOK_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "hooks" / "useTimesheetData.js"
CHART_BUILDERS_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "utils" / "chartBuilders.js"
TRANSLATIONS_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "i18n" / "translations.js"


class ProjectScheduleFrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = CSS_PATH.read_text(encoding="utf-8")
        cls.app = APP_PATH.read_text(encoding="utf-8")
        cls.project_analysis_panel = PROJECT_ANALYSIS_PANEL_PATH.read_text(encoding="utf-8")
        cls.timesheet_hook = TIMESHEET_HOOK_PATH.read_text(encoding="utf-8")
        cls.chart_builders = CHART_BUILDERS_PATH.read_text(encoding="utf-8")
        cls.translations = TRANSLATIONS_PATH.read_text(encoding="utf-8")

    def assertCssPattern(self, pattern):
        self.assertRegex(self.css, re.compile(pattern, re.MULTILINE | re.DOTALL))

    def test_project_schedule_state_and_api_hooks_exist(self):
        self.assertIn("import.meta.env.VITE_API_URL", self.timesheet_hook)
        self.assertIn("(import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api')", self.timesheet_hook)
        self.assertNotIn("http://192.168.137.73:8000", self.timesheet_hook)
        self.assertIn(
            "const [projectScheduleData, setProjectScheduleData] = useState({ projects: [] });",
            self.timesheet_hook,
        )
        self.assertIn(
            "const [scheduleSelectedProjects, setScheduleSelectedProjects] = useState(new Set());",
            self.project_analysis_panel,
        )
        self.assertNotIn(
            "const [legacyProjectChartOpen, setLegacyProjectChartOpen] = useState(false);",
            self.project_analysis_panel,
        )
        self.assertIn("fetch(`${API_BASE_URL}/project-schedule-analysis`)", self.timesheet_hook)
        self.assertIn("fetch(`${API_BASE_URL}/upload-project-schedule`", self.timesheet_hook)

    def test_project_analysis_page_contains_schedule_section_without_legacy_module(self):
        self.assertIn('className="project-schedule-section', self.project_analysis_panel)
        self.assertIn('className="utility-upload schedule-upload-control"', self.project_analysis_panel)
        self.assertIn('className="project-schedule-card"', self.project_analysis_panel)
        self.assertIn("visibleScheduleProjects.map(project =>", self.project_analysis_panel)
        self.assertNotIn('className="legacy-project-chart-card', self.project_analysis_panel)
        self.assertNotIn('className="legacy-chart-toggle"', self.project_analysis_panel)
        self.assertNotIn("const projectAnalysisOpt = useMemo(() => {", self.project_analysis_panel)
        self.assertIn("{activeTab === 'overview' && (", self.app)
        self.assertNotIn("{(activeTab === 'overview' || activeTab === 'project_analysis') && (", self.app)

    def test_project_schedule_chart_uses_monthly_hours_with_progress_bars(self):
        self.assertIn("dataHelper.aggregateProjectDeptData(scheduleProjectEntries, 'monthly')", self.chart_builders)
        self.assertIn("export const buildProjectScheduleChartOption", self.chart_builders)
        self.assertIn("export const buildMilestoneIntervalChartOption", self.chart_builders)
        self.assertIn("export const formatScheduleMonthLabel", self.chart_builders)
        self.assertIn("dayjs(value).format('M.D')", self.chart_builders)
        self.assertIn("type: 'bar'", self.chart_builders)
        self.assertIn("stack: 'hours'", self.chart_builders)
        self.assertIn("stack: 'ms-hours'", self.chart_builders)
        self.assertIn("scheduleChartMode === 'monthly'", self.project_analysis_panel)
        self.assertIn("scheduleChartOptions.get(project.project_name)", self.project_analysis_panel)
        self.assertIn("milestoneChartOptions.get(project.project_name)", self.project_analysis_panel)
        self.assertIn("style={{ height: '320px' }}", self.project_analysis_panel)

    def test_project_schedule_card_contains_milestone_legend_copy(self):
        self.assertIn("scheduleLegendPlanned", self.translations)
        self.assertIn("scheduleLegendActual", self.translations)
        self.assertIn("scheduleLegendPending", self.translations)
        self.assertIn("chartModeMonthly", self.translations)
        self.assertIn("chartModeMilestone", self.translations)
        self.assertIn("{t.chartModeMonthly}", self.project_analysis_panel)
        self.assertIn("{t.chartModeMilestone}", self.project_analysis_panel)

    def test_schedule_project_picker_uses_outside_click_close_without_overlay(self):
        self.assertIn("const scheduleProjectPickerRef = useRef(null);", self.project_analysis_panel)
        self.assertIn("document.addEventListener('pointerdown', handleDown);", self.project_analysis_panel)
        self.assertRegex(
            self.project_analysis_panel,
            re.compile(
                r'<label className="utility-upload schedule-upload-control".*?</label>.*?<div className="filter-group dropdown-container" ref=\{scheduleProjectPickerRef\}.*?<label>\{t\.filterScheduleProjects\}</label>',
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertNotRegex(
            self.project_analysis_panel,
            re.compile(
                r'Department Multi-select Dropdown \*/\s*<div className="filter-group dropdown-container" ref=\{scheduleProjectPickerRef\}>',
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertIn("`已选 ${scheduleSelectedProjects.size} 个`", self.project_analysis_panel)
        self.assertIn("`${scheduleSelectedProjects.size} selected`", self.project_analysis_panel)
        self.assertNotIn(
            '<div className="dropdown-overlay" onClick={() => setScheduleProjectPickerOpen(false)} />',
            self.project_analysis_panel,
        )

    def test_project_schedule_actions_and_department_legend_are_compact_and_aligned(self):
        self.assertIn("bottom: 6", self.chart_builders)
        self.assertRegex(
            self.chart_builders,
            re.compile(
                r"legend:\s*\{[^}]*show:\s*hasMonthlyHours,[^}]*data:\s*departments,[^}]*type:\s*'scroll',[^}]*top:\s*6,[^}]*left:\s*'center'",
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertRegex(
            self.chart_builders,
            re.compile(
                r"grid:\s*\{ left:\s*60,\s*right:\s*30,\s*top:\s*40,\s*bottom:\s*30 \}",
                re.MULTILINE | re.DOTALL,
            ),
        )
        self.assertCssPattern(
            r"\.project-schedule-actions\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-start;"
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
            r"\.project-schedule-grid\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0\.72rem;"
        )
        self.assertCssPattern(
            r"\.project-schedule-card\s*\{[^}]*padding:\s*0\.82rem;[^}]*border-radius:\s*22px;"
        )
        self.assertCssPattern(r"\.schedule-mode-toggle\s*\{[^}]*display:\s*inline-flex;")
        self.assertCssPattern(r"\.schedule-mode-toggle button\s*\{[^}]*font-size:\s*0\.8rem;")
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
