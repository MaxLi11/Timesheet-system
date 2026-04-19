import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileDown, CheckCircle2 } from 'lucide-react';
import * as dataHelper from '../../utils/dataHelper';
import { applyWorkbookStyle, saveWorkbook } from '../../utils/excelStyles';

export const ReportingPanel = ({
  reportingData,
  activeEmployees,
  workWeeks,
  t,
  lang,
  pageMeta,
  uiText
}) => {
  const [targetHours, setTargetHours] = useState(40);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState(null);
  const [completenessYear, setCompletenessYear] = useState('');
  const [completenessMonth, setCompletenessMonth] = useState('');
  const [completenessWeek, setCompletenessWeek] = useState(null);
  const [expandedDepts, setExpandedDepts] = useState(new Set());

  const periodOptions = useMemo(
    () => dataHelper.getReportingPeriodOptions(reportingData),
    [reportingData]
  );

  useEffect(() => {
    if (periodOptions.years.length > 0 && !filterYear) {
      const latestYear = periodOptions.years[periodOptions.years.length - 1];
      setFilterYear(latestYear);
    }
    if (periodOptions.years.length > 0 && !completenessYear) {
      const latestYear = periodOptions.years[periodOptions.years.length - 1];
      setCompletenessYear(latestYear);
    }
  }, [periodOptions.years, filterYear, completenessYear]);

  const handleYearChange = (y) => { setFilterYear(y); setFilterMonth(''); setFilterWeek(null); };
  const handleMonthChange = (m) => { setFilterMonth(m); setFilterWeek(null); };
  const handleCompletenessYearChange = (y) => { setCompletenessYear(y); setCompletenessMonth(''); setCompletenessWeek(null); };
  const handleCompletenessMonthChange = (m) => { setCompletenessMonth(m); setCompletenessWeek(null); };

  const reportingRecords = useMemo(() =>
    dataHelper.computeReportingRate(reportingData, filterYear, filterMonth, filterWeek, Number(targetHours)),
    [reportingData, filterYear, filterMonth, filterWeek, targetHours]
  );

  const reportingByDept = useMemo(() =>
    dataHelper.groupReportingByDept(reportingRecords),
    [reportingRecords]
  );

  const reportingCompleteness = useMemo(
    () => dataHelper.computeReportingCompleteness(reportingData, activeEmployees, completenessYear, completenessMonth, completenessWeek),
    [reportingData, activeEmployees, completenessYear, completenessMonth, completenessWeek]
  );

  const toggleDept = (dept) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const exportReportingExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.reporting);
    ws.addRow([t.period_key, t.dept, t.employee, '员工ID', t.targetHours, t.actual, t.gap, '状态']);
    reportingRecords.forEach(r => ws.addRow([r.period_key, r.department, r.employee_name, r.employee_id, Number(targetHours), r.actual_hours, r.gap, r.gap > 0 ? t.deficit : t.excess]));
    applyWorkbookStyle(wb);
    const periodLabel = (filterWeek && filterWeek.week_code) || filterMonth || filterYear || 'all';
    await saveWorkbook(wb, `完整填报率_${periodLabel}_target${targetHours}h.xlsx`);
  };

  const pageHighlights = useMemo(() => [
    { label: t.targetHours, value: `${targetHours}h` },
    { label: uiText.deptGroups || 'Department Groups', value: Object.keys(reportingByDept).length },
    { label: uiText.periodRange || 'Period Range', value: (filterWeek && filterWeek.week_code) || filterMonth || filterYear || uiText.allPeriods || 'All Periods' }
  ], [targetHours, reportingByDept, filterWeek, filterMonth, filterYear, t.targetHours, uiText]);

  return (
    <>
      <header className="page-hero">
        <div className="page-intro-copy">
          <p className="page-eyebrow">{pageMeta.eyebrow}</p>
          <h1 className="page-title">{pageMeta.title}</h1>
          <p className="page-summary">{pageMeta.description}</p>
        </div>
        <div className="page-hero-panel">
          <div className="hero-panel-header">
            <span>{t.currentView || "当前视图"}</span>
            <strong>{pageMeta.eyebrow}</strong>
          </div>
          <div className="hero-panel-grid">
            {pageHighlights.map((item) => (
              <div key={item.label} className="hero-panel-stat">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="reporting-tab section-shell">
        <div className="reporting-top-bar">
          <div className="reporting-filters">
            <div className="filter-group">
              <label>{t.selectYear}</label>
              <select value={filterYear} onChange={e => handleYearChange(e.target.value)}>
                {periodOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {filterYear && (
              <div className="filter-group">
                <label>{t.selectMonth}</label>
                <select value={filterMonth} onChange={e => handleMonthChange(e.target.value)}>
                  <option value="">{t.allMonths}</option>
                  {(periodOptions.monthsByYear[filterYear] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {filterMonth && (
              <div className="filter-group">
                <label>{t.selectWeek}</label>
                <select
                  value={filterWeek ? (filterWeek.week_code || '') : ''}
                  onChange={e => {
                    const code = e.target.value;
                    if (!code) { setFilterWeek(null); return; }
                    const ww = workWeeks.find(w => w.week_code === code);
                    setFilterWeek(ww || null);
                  }}
                >
                  <option value="">{t.allWeeks}</option>
                  {workWeeks.length > 0
                    ? workWeeks
                        .filter(w => w.work_month === `${filterYear}-${filterMonth}`)
                        .map(w => (
                          <option key={w.week_code} value={w.week_code}>{w.week_code}</option>
                        ))
                    : (periodOptions.weeksByMonth[`${filterYear}-${filterMonth}`] || []).map(w => (
                        <option key={w.week} value={w.week}>{w.label}</option>
                      ))
                  }
                </select>
              </div>
            )}
          </div>

          <div className="reporting-actions">
            <div className="target-input">
              <label>{t.targetHours}</label>
              <input type="number" min="1" max="9999" value={targetHours}
                onChange={e => setTargetHours(e.target.value)}
                className="hours-input" />
              <span className="per-period">{t.perPeriod}</span>
            </div>

            {reportingRecords.length > 0 && (
              <button className="export-btn" onClick={exportReportingExcel}>
                <FileDown size={16} /> {t.export}
              </button>
            )}
          </div>
        </div>

        <p className="module-caption" style={{ marginBottom: '0.75rem' }}>{t.reportingGapCaption}</p>

        {Object.keys(reportingByDept).length === 0 ? (
          <div className="card no-issues table-card">{t.noIssues}</div>
        ) : (
          Object.entries(reportingByDept).map(([dept, info]) => (
            <div key={dept} className="dept-accordion">
              <div className="dept-header" onClick={() => toggleDept(dept)}>
                <div className="dept-name">
                  {expandedDepts.has(dept) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <strong>{dept}</strong>
                  <span className="emp-count">({info.employees.length} 人)</span>
                </div>
                <div className={`dept-gap ${info.totalGap > 0 ? 'deficit' : 'excess'}`}>
                  {info.totalGap > 0 ? `↓ ${info.totalGap}h ${t.deficit}` : `↑ ${Math.abs(info.totalGap)}h ${t.excess}`}
                </div>
              </div>

              {expandedDepts.has(dept) && (
                <div className="emp-table-wrap">
                  <table className="emp-table">
                    <thead>
                      <tr>
                        <th>{t.period_key}</th>
                        <th>{t.employee}</th>
                        <th>{t.actual}</th>
                        <th>{t.targetHours}</th>
                        <th>{t.gap}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.employees.map((emp, i) => (
                        <tr key={i}>
                          <td>{emp.period_key}</td>
                          <td>{emp.employee_name}</td>
                          <td>{emp.actual_hours}h</td>
                          <td>{targetHours}h</td>
                          <td className={emp.gap > 0 ? 'gap-deficit' : 'gap-excess'}>
                            {emp.gap > 0 ? `↓ ${emp.gap}h` : `↑ ${Math.abs(emp.gap)}h`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}

        <div style={{ marginBottom: '0.9rem', marginTop: '2rem' }}>
          <div className="card-heading-row" style={{ marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                {t.completenessTitle}
                {!reportingCompleteness.no_filter && (reportingCompleteness.total_count ?? 0) > 0 && (
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-accent, #4f8ef7)' }}>
                    {lang === 'zh' ? '完整填报率' : 'Reporting Rate'}：
                    <strong>{reportingCompleteness.submitted_count ?? 0}</strong>
                    {' / '}
                    <strong>{reportingCompleteness.total_count}</strong>
                    {' '}
                    ({Math.round(((reportingCompleteness.submitted_count ?? 0) / reportingCompleteness.total_count) * 100)}%)
                  </span>
                )}
              </h3>
              <p className="module-caption" style={{ marginTop: '6px' }}>{t.completenessMethodBDesc}</p>
            </div>
            <button
              className="export-btn"
              onClick={async () => {
                const ExcelJS = (await import('exceljs')).default;
                const wb = new ExcelJS.Workbook();
                const ws = wb.addWorksheet(lang === 'zh' ? '漏填名单' : 'Missing');
                const empMap = {};
                (activeEmployees || []).forEach(e => { empMap[(e.employee_name || '').trim()] = e.team_leader || ''; });
                ws.addRow([lang === 'zh' ? '部门简称' : 'Department', 'Team Leader', lang === 'zh' ? '员工姓名' : 'Employee Name']);
                (reportingCompleteness.missing_employees || []).forEach(name => {
                  ws.addRow([
                    Object.entries(reportingCompleteness.missing_by_dept || {}).find(([, names]) => names.includes(name))?.[0] || '',
                    empMap[name] || '',
                    name,
                  ]);
                });
                applyWorkbookStyle(wb);
                const periodLabel = (completenessWeek && completenessWeek.week_code) || completenessMonth || completenessYear || 'all';
                await saveWorkbook(wb, `${lang === 'zh' ? '漏填名单' : 'missing_employees'}_${periodLabel}.xlsx`);
              }}
            >
              <FileDown size={16} /> {lang === 'zh' ? '导出 Excel' : 'Export Excel'}
            </button>
          </div>

          <div className="reporting-filters" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="filter-group">
              <label>{t.selectYear}</label>
              <select value={completenessYear} onChange={e => handleCompletenessYearChange(e.target.value)}>
                {periodOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {completenessYear && (
              <div className="filter-group">
                <label>{t.selectMonth}</label>
                <select value={completenessMonth} onChange={e => handleCompletenessMonthChange(e.target.value)}>
                  <option value="">{t.allMonths}</option>
                  {(periodOptions.monthsByYear[completenessYear] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            {completenessMonth && (
              <div className="filter-group">
                <label>{t.selectWeek}</label>
                <select
                  value={completenessWeek ? (completenessWeek.week_code || '') : ''}
                  onChange={e => {
                    const code = e.target.value;
                    if (!code) { setCompletenessWeek(null); return; }
                    const ww = workWeeks.find(w => w.week_code === code);
                    setCompletenessWeek(ww || null);
                  }}
                >
                  <option value="">{t.allWeeks}</option>
                  {workWeeks.length > 0
                    ? workWeeks
                        .filter(w => w.work_month === `${completenessYear}-${completenessMonth}`)
                        .map(w => (
                          <option key={w.week_code} value={w.week_code}>{w.week_code}</option>
                        ))
                    : (periodOptions.weeksByMonth[`${completenessYear}-${completenessMonth}`] || []).map(w => (
                        <option key={w.week} value={w.week}>{w.label}</option>
                      ))
                  }
                </select>
              </div>
            )}
          </div>

          {reportingCompleteness.no_filter ? (
            <div className="card no-issues table-card">{lang === 'zh' ? '请先选择年份和月份/周次，查看对应漏填人员' : 'Please select a year and month/week to view missing submissions'}</div>
          ) : (reportingCompleteness.missing_count ?? 0) === 0 ? (
            <div className="card no-issues table-card">
              <div className="empty-state-content">
                <CheckCircle2 size={42} strokeWidth={1.2} color="#33b47e" />
                <p>{t.completenessNoMissing || '本期无漏填记录。'}</p>
              </div>
            </div>
          ) : (
            Object.entries(reportingCompleteness.missing_by_dept || {}).sort(([a], [b]) => a.localeCompare(b)).map(([dept, names]) => (
              <div key={dept} className="dept-accordion">
                <div className="dept-header" onClick={() => toggleDept(`missing-${dept}`)}>
                  <div className="dept-name">
                    {expandedDepts.has(`missing-${dept}`) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <strong>{dept}</strong>
                    <span className="emp-count">({names.length} 人)</span>
                  </div>
                </div>
                {expandedDepts.has(`missing-${dept}`) && (
                  <div className="emp-table-wrap">
                    <table className="emp-table">
                      <thead>
                        <tr>
                          <th>{lang === 'zh' ? '员工姓名' : 'Name'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {names.map((name, i) => (
                          <tr key={i}>
                            <td>{name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
