from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class CanonicalFiles:
    historical_summary: str
    oa_report: str
    anx_template: str
    employee_contacts: str
    project_standards: str
    standalone_output: str
    template_output: str


@dataclass(frozen=True)
class ExpectedTotals:
    historical_rows: int
    historical_hours: float
    oa_rows: int
    oa_hours: float
    merged_hours: float


@dataclass(frozen=True)
class PeriodPolicy:
    week_start: str
    week_end: str
    prefer_existing_oa_period: bool
    overlap_tiebreaker: str
    fallback_period: str


@dataclass(frozen=True)
class PipelineConfig:
    base_dir: str
    files: CanonicalFiles
    expected: ExpectedTotals
    period_policy: PeriodPolicy

    def to_dict(self) -> dict:
        return asdict(self)


def default_config(repo_root: Path | None = None) -> PipelineConfig:
    root = repo_root or Path(__file__).resolve().parents[2]
    base_dir = root / "新需求"

    return PipelineConfig(
        base_dir=str(base_dir),
        files=CanonicalFiles(
            historical_summary="summary_hours_2022-2024_names_projects_updated.xlsx",
            oa_report="Timesheet Report-20260602135306.xlsx",
            anx_template="ANX系统上传模板(new).xlsx",
            employee_contacts="通讯录 (在职&离职).xlsx",
            project_standards="项目名称标准版.xls",
            standalone_output="wrike&OA-before-2026_period-priority.xlsx",
            template_output="ANX系统上传模板(new).xlsx",
        ),
        expected=ExpectedTotals(
            historical_rows=166_319,
            historical_hours=1_064_077.8,
            oa_rows=32_416,
            oa_hours=746_244.0,
            merged_hours=1_810_321.8,
        ),
        period_policy=PeriodPolicy(
            week_start="Saturday",
            week_end="Friday",
            prefer_existing_oa_period=True,
            overlap_tiebreaker="standard_sat_to_fri_7_day_then_shortest_valid",
            fallback_period="create_sat_to_fri_7_day_period",
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Show timesheet pipeline configuration.")
    parser.add_argument("--show", action="store_true", help="Print the default config as JSON.")
    args = parser.parse_args()

    if args.show:
        print(json.dumps(default_config().to_dict(), ensure_ascii=False, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
