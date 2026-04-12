# 定制化数据导出四张报表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在"定制化数据导出"页面实现四张报表的导出，与样板文件 `新需求/新需求-人月等.xlsx` 格式完全一致。

**Architecture:** 后端新增两个 API 接口（`/export-person-month-march` 和 `/export-employee-monthly-total`），前端新增两个导出函数并更新现有两个导出的格式细节。四张报表均基于 `current_node='Close'` 且 `category='Project'` 的工时数据。

**Tech Stack:** Python/FastAPI (后端), SQLAlchemy, pandas, React/Vite (前端), SheetJS (xlsx), openpyxl

---

## 数据源说明

数据库表 `time_entries`，筛选条件：
- `lower(current_node) = 'close'`
- `category = 'Project'`

关键字段：`employee_name`, `project_name`, `department`(简称), `department_full`(全称), `position`, `hours`, `start_date`

月份归属：`start_date` 的年月（`YYYY-MM` 格式）

---

## 四张报表规格

### 报表1：每项目工时
- **行**：项目名 × 员工（唯一组合）
- **列**：项目 | 员工 | 所属部门(全称) | 部门简称 | 职位 | [只有数据的月份列] | 总计
- **值**：当月该项目该员工的工时小时数（无数据留空，不填0）
- **排序**：项目名 → 员工名
- **现有函数**：`frontend/src/utils/customDataExport.js` 的 `buildCustomProjectHoursExport`
- **需要修改**：月份列改为只显示有数据的月（去掉中间空月补0逻辑）

### 报表2：人月行军图
- **行**：项目名 × 员工（唯一组合）
- **列**：项目名称 | 员工 | 所属部门 | 部门简称 | 职位 | 每个月3列（该项目该员工总工时 | 人月 | 当月总工时）| 3列总计
- **值**：
  - 该项目该员工总工时 = 当月该员工在该项目的工时
  - 人月 = 该项目工时 ÷ 该员工当月所有项目总工时（保留6位小数）
  - 当月总工时 = 该员工当月所有项目总工时
  - 无数据时留空（不填0）
- **第0行**：全局汇总（所有员工当月总工时合计、人月合计、当月总工时合计）
- **排序**：项目名 → 员工名
- **新接口**：`GET /export-person-month-march` → 返回结构化数据

### 报表3：人月
- **行**：项目名 × 员工（唯一组合）
- **列**：项目名称 | 员工 | 所属部门 | 部门简称 | 职位 | [只有数据的月份列] | 总计
- **值**：人月占比（保留6位小数，无数据时为0）
- **排序**：项目名 → 员工名
- **现有接口**：`GET /person-month-ratio` 已有，格式基本对齐，需核对
- **现有前端**：`exportPersonMonthRatioExcel` 已有，格式需核对

### 报表4：每人每月总工时
- **行**：每位员工一行
- **列**：姓名 | [只有数据的月份列] | 总计
- **值**：该员工当月所有项目工时总和（无数据留空）
- **排序**：员工名
- **新接口**：`GET /export-employee-monthly-total` → 返回结构化数据

---

## 文件改动范围

### 后端
- **修改**：`backend/crud.py` — 新增 `get_person_month_march()` 和 `get_employee_monthly_total()` 函数
- **修改**：`backend/main.py` — 新增两个 GET 路由

### 前端
- **修改**：`frontend/src/utils/customDataExport.js` — 修改 `buildCustomProjectHoursExport` 月份逻辑
- **修改**：`frontend/src/App.jsx` — 新增两个导出按钮和导出函数，UI 卡片改为4个

---

## Task 1：修改"每项目工时"月份逻辑（去掉空月补0）

**Files:**
- Modify: `frontend/src/utils/customDataExport.js`

- [ ] **Step 1: 修改 `buildCustomProjectHoursExport`**

将现有的 `buildContinuousMonths`（生成连续月份）替换为直接使用实际有数据的月份列表：

```javascript
// 旧逻辑（删除）：
// const continuousMonths = monthKeys.length
//   ? buildContinuousMonths(monthKeys[0], monthKeys[monthKeys.length - 1])
//   : [];

// 新逻辑：只保留有数据的月份（去重后排序）
const continuousMonths = [...new Set(monthKeys)].sort(compareText);
```

同时修改行值生成：无数据时留空（`null`）而不是 `0`：

```javascript
const rows = sortedGroups.map((group) => {
  const monthValues = continuousMonths.map((monthKey) => {
    const val = group.monthHours.get(monthKey);
    return val !== undefined ? normalizeNumber(val) : null; // null = 留空
  });
  const totalHours = normalizeNumber(
    [...group.monthHours.values()].reduce((sum, v) => sum + Number(v || 0), 0)
  );
  return [
    group.project_name,
    group.employee_name,
    group.department_full,
    group.department,
    group.position,
    ...monthValues,
    totalHours,
  ];
});
```

- [ ] **Step 2: 验证**

在浏览器控制台确认导出的 Excel 月份列只包含有数据的月，无数据月份不出现。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/customDataExport.js
git commit -m "fix: export only months with data in per-project hours report"
```

---

## Task 2：后端新增"人月行军图"接口

**Files:**
- Modify: `backend/crud.py` — 新增 `get_person_month_march()`
- Modify: `backend/main.py` — 新增路由 `GET /export-person-month-march`

- [ ] **Step 1: 在 `backend/crud.py` 末尾新增函数**

```python
def get_person_month_march(db: Session):
    """
    人月行军图：每个项目每位员工每月的工时、人月占比、当月总工时。
    只统计 current_node='Close' + category='Project'。
    返回:
      {
        "months": ["2024-01", ...],   # 有数据的月份（非连续，排序）
        "rows": [
          {
            "project_name": "Aloe",
            "employee_name": "张三",
            "department_full": "110 R&D - Digital",
            "department": "Digital",
            "position": "Staff Engineer",
            "months": {
              "2024-01": {"proj_hours": 40.0, "ratio": 0.5, "total_hours": 80.0},
              ...
            }
          }, ...
        ],
        "summary": {
          "2024-01": {"proj_hours": 200.0, "ratio": 5.0, "total_hours": 400.0},
          ...
        }
      }
    """
    entries = db.query(database.TimeEntry).filter(
        func.lower(database.TimeEntry.current_node) == "close",
        database.TimeEntry.category == "Project"
    ).all()

    # 员工每月总工时
    emp_month_total = {}  # (employee_name, month) -> total_hours
    for e in entries:
        if not e.start_date:
            continue
        month = e.start_date.strftime("%Y-%m")
        key = (e.employee_name, month)
        emp_month_total[key] = emp_month_total.get(key, 0) + float(e.hours or 0)

    # 项目×员工每月工时
    proj_emp_month = {}  # (project, employee, month) -> hours
    emp_meta = {}  # employee_name -> {department_full, department, position}
    for e in entries:
        if not e.start_date:
            continue
        month = e.start_date.strftime("%Y-%m")
        key = (e.project_name, e.employee_name, month)
        proj_emp_month[key] = proj_emp_month.get(key, 0) + float(e.hours or 0)
        if e.employee_name not in emp_meta:
            emp_meta[e.employee_name] = {
                "department_full": e.department_full or "",
                "department": e.department or "",
                "position": e.position or "",
            }

    # 有数据的月份
    all_months = sorted({m for (_, _, m) in proj_emp_month})

    # 组装行数据：(project, employee) -> row
    row_map = {}
    for (proj, emp, month), proj_hours in proj_emp_month.items():
        total = emp_month_total.get((emp, month), 0)
        ratio = round(proj_hours / total, 6) if total > 0 else 0
        key = (proj, emp)
        if key not in row_map:
            meta = emp_meta.get(emp, {})
            row_map[key] = {
                "project_name": proj,
                "employee_name": emp,
                "department_full": meta.get("department_full", ""),
                "department": meta.get("department", ""),
                "position": meta.get("position", ""),
                "months": {}
            }
        row_map[key]["months"][month] = {
            "proj_hours": round(proj_hours, 2),
            "ratio": ratio,
            "total_hours": round(total, 2)
        }

    rows = sorted(row_map.values(), key=lambda r: (r["project_name"], r["employee_name"]))

    # 汇总行（第0行）：每月所有员工的合计
    summary = {}
    for month in all_months:
        s_proj = sum(v["months"].get(month, {}).get("proj_hours", 0) for v in rows)
        s_ratio = sum(v["months"].get(month, {}).get("ratio", 0) for v in rows)
        s_total = emp_month_total_by_month = sum(
            h for (emp, m), h in emp_month_total.items() if m == month
        )
        summary[month] = {
            "proj_hours": round(s_proj, 3),
            "ratio": round(s_ratio, 3),
            "total_hours": round(s_total, 3)
        }

    return {"months": all_months, "rows": rows, "summary": summary}
```

- [ ] **Step 2: 在 `backend/main.py` 新增路由**

```python
@app.get("/export-person-month-march")
def export_person_month_march(db: Session = Depends(get_db)):
    """人月行军图数据接口"""
    return crud.get_person_month_march(db)
```

- [ ] **Step 3: Commit**

```bash
git add backend/crud.py backend/main.py
git commit -m "feat: add person-month march chart export API"
```

---

## Task 3：后端新增"每人每月总工时"接口

**Files:**
- Modify: `backend/crud.py` — 新增 `get_employee_monthly_total()`
- Modify: `backend/main.py` — 新增路由 `GET /export-employee-monthly-total`

- [ ] **Step 1: 在 `backend/crud.py` 末尾新增函数**

```python
def get_employee_monthly_total(db: Session):
    """
    每人每月总工时：每位员工每月所有项目的工时总和。
    只统计 current_node='Close' + category='Project'。
    返回:
      {
        "months": ["2024-01", ...],
        "rows": [
          {"employee_name": "张三", "months": {"2024-01": 80.0, ...}, "total": 960.0},
          ...
        ]
      }
    """
    entries = db.query(database.TimeEntry).filter(
        func.lower(database.TimeEntry.current_node) == "close",
        database.TimeEntry.category == "Project"
    ).all()

    emp_month = {}  # (employee_name, month) -> hours
    for e in entries:
        if not e.start_date:
            continue
        month = e.start_date.strftime("%Y-%m")
        key = (e.employee_name, month)
        emp_month[key] = emp_month.get(key, 0) + float(e.hours or 0)

    all_months = sorted({m for (_, m) in emp_month})
    all_employees = sorted({emp for (emp, _) in emp_month})

    rows = []
    for emp in all_employees:
        month_data = {m: round(emp_month[(emp, m)], 2) for m in all_months if (emp, m) in emp_month}
        total = round(sum(month_data.values()), 2)
        rows.append({"employee_name": emp, "months": month_data, "total": total})

    return {"months": all_months, "rows": rows}
```

- [ ] **Step 2: 在 `backend/main.py` 新增路由**

```python
@app.get("/export-employee-monthly-total")
def export_employee_monthly_total(db: Session = Depends(get_db)):
    """每人每月总工时数据接口"""
    return crud.get_employee_monthly_total(db)
```

- [ ] **Step 3: Commit**

```bash
git add backend/crud.py backend/main.py
git commit -m "feat: add employee monthly total hours export API"
```

---

## Task 4：前端新增两个导出函数 + 更新UI

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: 新增"人月行军图"导出函数**

在 `exportPersonMonthRatioExcel` 函数附近新增：

```javascript
const exportPersonMonthMarchExcel = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/export-person-month-march`);
    if (!res.ok) throw new Error('获取数据失败');
    const { months, rows, summary } = await res.json();
    if (!rows || rows.length === 0) {
      alert('暂无数据');
      return;
    }

    // 构建表头：Row0汇总 + Row1月份 + Row2子标题
    const baseHeaders = ['项目名称', '员工', '所属部门', '部门简称', '职位'];
    const monthHeaders = months.flatMap(m => [m, m, m]);
    const subHeaders = months.flatMap(() => ['该项目该员工总工时', '人月', '当月总工时']);
    const totalHeaders = ['总计', '总计', '总计'];

    // Row0：汇总行
    const summaryRow = [
      '', '', '', '', '',
      ...months.flatMap(m => [
        summary[m]?.proj_hours ?? '',
        summary[m]?.ratio ?? '',
        summary[m]?.total_hours ?? ''
      ]),
      '', '', ''
    ];

    // 数据行
    const dataRows = rows.map(r => [
      r.project_name, r.employee_name, r.department_full, r.department, r.position,
      ...months.flatMap(m => {
        const d = r.months[m];
        return d ? [d.proj_hours, d.ratio, d.total_hours] : ['', '', ''];
      }),
      // 总计3列
      Object.values(r.months).reduce((s, d) => s + d.proj_hours, 0).toFixed(2),
      Object.values(r.months).reduce((s, d) => s + d.ratio, 0).toFixed(6),
      Object.values(r.months).reduce((s, d) => s + d.total_hours, 0).toFixed(2),
    ]);

    const sheetData = [
      summaryRow,
      [...baseHeaders, ...monthHeaders, ...totalHeaders],
      ['', '', '', '', '', ...subHeaders, '该项目该员工总工时', '人月', '当月总工时'],
      ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '人月行军图');
    const now = new Date();
    const pad = v => String(v).padStart(2, '0');
    XLSX.writeFile(wb, `人月行军图_Close口径_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
  } catch (err) {
    alert(`导出失败: ${err.message}`);
  }
};
```

- [ ] **Step 2: 新增"每人每月总工时"导出函数**

```javascript
const exportEmployeeMonthlyTotalExcel = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/export-employee-monthly-total`);
    if (!res.ok) throw new Error('获取数据失败');
    const { months, rows } = await res.json();
    if (!rows || rows.length === 0) {
      alert('暂无数据');
      return;
    }

    const headers = ['姓名', ...months, '总计'];
    const dataRows = rows.map(r => [
      r.employee_name,
      ...months.map(m => r.months[m] ?? ''),
      r.total
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '每人每月总工时');
    const now = new Date();
    const pad = v => String(v).padStart(2, '0');
    XLSX.writeFile(wb, `每人每月总工时_Close口径_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
  } catch (err) {
    alert(`导出失败: ${err.message}`);
  }
};
```

- [ ] **Step 3: 在 UI 中新增两张报表的导出卡片**

在 `activeTab === 'custom_data'` 的 section 内，在现有两个卡片后新增：

```jsx
{/* 人月行军图导出 */}
<div className="card custom-data-card elevated-module">
  <div className="card-heading-row">
    <div>
      <h3>{lang === 'zh' ? '人月行军图导出' : 'Person-Month March Chart Export'}</h3>
      <p className="module-caption">
        {lang === 'zh'
          ? '每项目每员工每月：工时 + 人月占比 + 当月总工时，Close口径'
          : 'Per project/employee/month: hours + ratio + monthly total, Close only'}
      </p>
    </div>
    <button type="button" className="export-btn" style={actionButtonStyle} onClick={exportPersonMonthMarchExcel}>
      <FileDown size={16} /> {lang === 'zh' ? '导出行军图' : 'Export March Chart'}
    </button>
  </div>
</div>

{/* 每人每月总工时导出 */}
<div className="card custom-data-card elevated-module">
  <div className="card-heading-row">
    <div>
      <h3>{lang === 'zh' ? '每人每月总工时导出' : 'Employee Monthly Total Hours Export'}</h3>
      <p className="module-caption">
        {lang === 'zh'
          ? '每位员工各月项目总工时汇总，Close口径'
          : 'Total project hours per employee per month, Close only'}
      </p>
    </div>
    <button type="button" className="export-btn" style={actionButtonStyle} onClick={exportEmployeeMonthlyTotalExcel}>
      <FileDown size={16} /> {lang === 'zh' ? '导出总工时' : 'Export Total Hours'}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Build 验证**

```bash
cd frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add person-month march chart and employee monthly total export buttons"
```

---

## Task 5：验证四张报表与样板一致

- [ ] **Step 1: 启动本地服务，上传工时 Excel**

- [ ] **Step 2: 逐一导出四张报表，与 `新需求/新需求-人月等.xlsx` 对比**

  - 每项目工时：月份列是否只有有数据的月？总计是否正确？
  - 人月行军图：每月3列是否正确？汇总行是否正确？
  - 人月：占比值是否与样板一致（抽查3~5行）？
  - 每人每月总工时：员工数、月份是否正确？总计是否正确？

- [ ] **Step 3: Push 到 GitHub**

```bash
git push origin main
```
