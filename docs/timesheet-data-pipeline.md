# Timesheet Data Pipeline

This document records the current data-processing rules used for the 2022-2026 timesheet consolidation. It is the reference for future script cleanup and regression tests.

## Canonical Inputs

- Historical Wrike summary: `新需求/summary_hours_2022-2024_names_projects_updated.xlsx`
- OA report: `新需求/Timesheet Report-20260602135306.xlsx`
- ANX upload template: `新需求/ANX系统上传模板(new).xlsx`
- Employee contacts: `新需求/通讯录 (在职&离职).xlsx`
- Project standard names: `新需求/项目名称标准版.xls`

## Canonical Outputs

- Current standalone merged workbook: `新需求/wrike&OA-before-2026_period-priority.xlsx`
- Current upload-template workbook: `新需求/ANX系统上传模板(new).xlsx`

Before any further rerun, confirm which output is the delivery target. The standalone workbook and the upload template can diverge if only one is updated.

## Project Name Rules

Historical project names have already been standardized in `summary_hours_2022-2024_names_projects_updated.xlsx`.

Confirmed project merge examples:

- `SerDes Tulkun Serializer`, `SerDes Roc Deserializer` -> `Tulkun&Roc`
- `ss8nm_dp20rx_revAB`, `ss8nm_dprx Testchip AB backend`, `ss8nm_dprx_analog` -> `DP2.0`
- `Mulberry_DTD`, `Mulberry_Analog`, `Mulberry_System DTD`, `Mulberry_System SW` -> `Mulberry`
- `HDMI2.1_Design`, `HDMI2.1_DV` -> `HDMI2.1`
- `Titan_SCD`, `Titan_Backend_Development`, `Titan_SCD_Development`, `Titan_Analog`, `Titan_Cooperation` -> `Titan`
- `Admin Time Tracking, Created Tasks & Projects`, `Integrations, Admin Time Tracking, Created Tasks & Projects`, `Admin Time Tracking` -> `Admin Time Tracking`
- `PCIe Gen6` -> `PCIe`

Confirmed no-merge examples:

- `SerDes_Package` and `AutoSerDes_Test`
- `EDA-Tools` -> not merged to `Cedar`
- `Test_Automation_System-SCD` -> not merged to `Tomato`
- `PCIe` -> not merged to `Pine`

## Period Mapping Rules

Wrike historical rows are aggregated into the OA report structure.

For each Wrike date:

1. Use an existing OA period if the date is covered by one.
2. If multiple OA periods cover the date, prefer the standard OA period: Saturday to Friday, 7 days.
3. If no standard period covers the date, use the shortest valid OA period.
4. If no OA period covers the date, create a new Saturday-to-Friday 7-day period.

Known overlap case:

- `2024-06-28` is covered by both `2024-06-22~2024-06-28` and `2024-06-28~2024-07-03`; the standard Saturday-to-Friday period is selected.

## Merge Rules

- Add a `来源` column before the OA columns.
- OA source rows use `来源 = OA`.
- Historical rows use `来源 = wrike`.
- Historical rows are aggregated by employee, project-or-nonproject, BU, and resolved period.
- Project rows fill `项目名称(新)`, `BU`, and the first `合计`.
- Non-project rows fill `非项目名称` and the second `合计`; BU stays blank for non-project rows.
- Historical-only fields absent from Wrike remain blank: position, employee id, aftermarket, project manager, project leader, approval status, current node, pending operator, task detail.

## Employee Info Fill Rules

Department and position are filled in the merged upload template from these sources, in priority order:

1. `ANX系统上传模板(new).xlsx` employee base sheet
2. `通讯录 (在职&离职).xlsx`
3. OA original report

Matching policy:

- Exact full-name match first.
- Unique English-name fallback second.
- Conflicts are not guessed.

Remaining known unfilled people after the latest fill:

- `Mincheol Kim`
- `Bob (Pushui) Xu`
- `Guanting Chen`
- `Elliott Ko`
- `彭金龙/Dragon Peng`
- `Malox Peng`
- `Greg Stewart`

## Validation Targets

- Historical source rows: `166,319`
- Historical source hours: `1,064,077.8`
- OA source rows: `32,416`
- OA source hours: `746,244.0`
- Merged total hours: `1,810,321.8`
- No `??` encoding artifacts
- Output workbook opens without Excel repair prompts

## Engineering Cleanup Targets

Current scripts are task-specific and contain hard-coded paths and expected totals. The next cleanup should consolidate them into a parameterized pipeline:

- `scripts/timesheet_pipeline/config.yaml`
- `scripts/timesheet_pipeline/project_mapping.py`
- `scripts/timesheet_pipeline/employee_mapping.py`
- `scripts/timesheet_pipeline/period_mapping.py`
- `scripts/timesheet_pipeline/merge_wrike_oa.py`
- `scripts/timesheet_pipeline/validate_outputs.py`

All business mappings should move out of script bodies into config or mapping tables. Validation should be executable without modifying source workbooks.
