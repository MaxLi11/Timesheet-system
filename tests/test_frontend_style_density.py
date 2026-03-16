import re
import unittest
from pathlib import Path


CSS_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "index.css"
APP_PATH = Path(__file__).resolve().parents[1] / "frontend" / "src" / "App.jsx"


class FrontendStyleDensityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = CSS_PATH.read_text(encoding="utf-8")
        cls.app = APP_PATH.read_text(encoding="utf-8")

    def assertCssPattern(self, pattern):
        self.assertRegex(self.css, re.compile(pattern, re.MULTILINE | re.DOTALL))

    def test_page_title_and_summary_are_tightened(self):
        self.assertCssPattern(
            r"\.page-title\s*\{[^}]*max-width:\s*12ch;[^}]*font-size:\s*clamp\(1\.48rem,\s*2\.35vw,\s*2\.02rem\);[^}]*line-height:\s*1\.03;"
        )
        self.assertCssPattern(
            r"\.page-summary\s*\{[^}]*font-size:\s*0\.82rem;[^}]*line-height:\s*1\.42;"
        )

    def test_hero_summary_modules_are_compacted(self):
        self.assertCssPattern(
            r"\.hero-meta-pill\s*\{[^}]*padding:\s*0\.38rem 0\.54rem;[^}]*font-size:\s*0\.63rem;"
        )
        self.assertCssPattern(
            r"\.hero-meta-pill strong\s*\{[^}]*font-size:\s*0\.7rem;"
        )
        self.assertCssPattern(
            r"\.hero-meta-pill span\s*\{[^}]*white-space:\s*nowrap;"
        )
        self.assertCssPattern(
            r"\.page-hero-panel\s*\{[^}]*padding:\s*0\.82rem;"
        )
        self.assertCssPattern(
            r"\.hero-panel-header\s*\{[^}]*font-size:\s*0\.6rem;"
        )
        self.assertCssPattern(
            r"\.hero-panel-header strong\s*\{[^}]*font-size:\s*0\.72rem;"
        )
        self.assertCssPattern(
            r"\.hero-panel-stat,\s*\.insight-item\s*\{[^}]*padding:\s*0\.56rem 0\.6rem;"
        )
        self.assertCssPattern(
            r"\.hero-panel-stat span,\s*\.insight-item span\s*\{[^}]*font-size:\s*0\.6rem;"
        )
        self.assertCssPattern(
            r"\.hero-panel-stat strong,\s*\.insight-item strong\s*\{[^}]*font-size:\s*0\.84rem;"
        )

    def test_kpi_cards_are_scaled_down(self):
        self.assertCssPattern(
            r"\.card h3,\s*\.chart-card h3\s*\{[^}]*font-size:\s*0\.64rem;"
        )
        self.assertCssPattern(
            r"\.stat-card h3\s*\{[^}]*font-size:\s*0\.88rem;"
        )
        self.assertCssPattern(
            r"\.module-caption\s*\{[^}]*font-size:\s*0\.78rem;"
        )
        self.assertCssPattern(
            r"\.stat-card\s*\{[^}]*min-height:\s*7\.75rem;"
        )
        self.assertCssPattern(
            r"\.stat-value\s*\{[^}]*font-size:\s*clamp\(1\.42rem,\s*2\.7vw,\s*2\.02rem\);"
        )
        self.assertCssPattern(
            r"\.stat-footnote\s*\{[^}]*font-size:\s*0\.66rem;"
        )
        self.assertCssPattern(
            r"\.stat-value\s*\{[^}]*white-space:\s*nowrap;"
        )
        self.assertCssPattern(
            r"\.overview-secondary-grid\s*\{[^}]*grid-template-columns:\s*1fr;"
        )

    def test_top_nav_and_filters_use_smaller_controls(self):
        self.assertCssPattern(
            r"\.top-nav-item\s*\{[^}]*padding:\s*0\.72rem 0\.84rem;[^}]*font-size:\s*0\.82rem;"
        )
        self.assertCssPattern(
            r"\.reporting-top-bar\s*\{[^}]*gap:\s*0\.72rem 0\.82rem;[^}]*padding:\s*0\.88rem 0\.96rem;"
        )
        self.assertCssPattern(
            r"\.reporting-filters\s*\{[^}]*align-items:\s*flex-start;[^}]*gap:\s*0\.62rem 0\.72rem;"
        )
        self.assertCssPattern(
            r"\.filter-group\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*flex-start;[^}]*gap:\s*0\.3rem;[^}]*min-width:\s*7\.2rem;"
        )
        self.assertCssPattern(
            r"\.filter-group label,\s*\.target-input label,\s*\.filter-group-label\s*\{[^}]*font-size:\s*0\.58rem;"
        )
        self.assertCssPattern(
            r"select,\s*input\[type='number'\],\s*\.dropdown-button\s*\{[^}]*min-height:\s*2\.3rem;[^}]*font-size:\s*0\.82rem;"
        )
        self.assertCssPattern(
            r"\.dropdown-button\s*\{[^}]*min-width:\s*8rem;[^}]*max-width:\s*10\.6rem;[^}]*overflow:\s*hidden;"
        )
        self.assertCssPattern(
            r"\.target-input\s*\{[^}]*padding:\s*0\.26rem 0\.34rem 0\.26rem 0\.58rem;"
        )
        self.assertCssPattern(
            r"\.hours-input\s*\{[^}]*width:\s*4rem;[^}]*min-height:\s*1\.95rem;"
        )

    def test_dashboard_granularity_toggle_is_present_and_compact(self):
        self.assertIn(
            "const [dashGranularity, setDashGranularity] = useState('monthly');",
            self.app,
        )
        self.assertIn(
            "const effectiveDashGranularity = useMemo(() => (dashMonth || dashWeek ? 'weekly' : dashGranularity), [dashGranularity, dashMonth, dashWeek]);",
            self.app,
        )
        self.assertIn(
            "dataHelper.aggregateProjectData(filteredData, effectiveDashGranularity)",
            self.app,
        )
        self.assertIn(
            "dataHelper.aggregateProjectDeptData(filteredData, effectiveDashGranularity)",
            self.app,
        )
        self.assertIn('className="granularity-toggle"', self.app)
        self.assertIn('{t.period.monthly}', self.app)
        self.assertIn('{t.period.quarterly}', self.app)
        self.assertCssPattern(
            r"\.granularity-toggle\s*\{[^}]*padding:\s*0\.2rem;[^}]*border-radius:\s*16px;"
        )
        self.assertCssPattern(
            r"\.granularity-toggle button\s*\{[^}]*min-height:\s*2rem;[^}]*font-size:\s*0\.76rem;"
        )

    def test_summary_pills_and_table_copy_are_reduced(self):
        self.assertCssPattern(
            r"\.inline-summary-stats \.stat-item\s*\{[^}]*font-size:\s*0\.74rem;"
        )
        self.assertCssPattern(
            r"\.emp-table th\s*\{[^}]*font-size:\s*0\.66rem;"
        )
        self.assertCssPattern(
            r"\.emp-table td\s*\{[^}]*font-size:\s*0\.9rem;"
        )

    def test_mobile_title_is_also_scaled_down(self):
        self.assertIn(
            "font-size: clamp(1.36rem, 4.8vw, 1.82rem);",
            self.css,
        )

    def test_top_department_copy_is_renamed_for_clarity(self):
        self.assertIn("topDept: '最高工时部门'", self.app)
        self.assertIn("topDept: 'Top Hours Dept'", self.app)


    def test_overview_insight_module_is_removed(self):
        self.assertIn('className="overview-secondary-grid"', self.app)
        self.assertNotIn('className="card overview-insight-card elevated-module"', self.app)

    def test_gantt_section_is_removed(self):
        self.assertNotIn("id: 'gantt'", self.app)
        self.assertNotIn("activeTab === 'gantt'", self.app)
        self.assertNotIn("const ganttOpt = useMemo", self.app)
        self.assertNotIn("ReactECharts option={ganttOpt}", self.app)


if __name__ == "__main__":
    unittest.main()
