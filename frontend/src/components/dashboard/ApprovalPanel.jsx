import React, { useState, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';
import { ChevronDown, FileDown, CheckCircle2 } from 'lucide-react';
import * as dataHelper from '../../utils/dataHelper';
import { applyWorkbookStyle, saveWorkbook } from '../../utils/excelStyles';

export const ApprovalPanel = ({
  approvalData,
  t,
  pageMeta,
  uiText
}) => {
  const [approvalYear, setApprovalYear] = useState('');
  const [approvalMonth, setApprovalMonth] = useState('');
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [selectedApprover, setSelectedApprover] = useState('');
  const [appProjOpen, setAppProjOpen] = useState(false);

  const approvalYears = useMemo(() => {
    const years = new Set();
    approvalData.forEach(e => years.add(String(dayjs(e.start_date).year())));
    return [...years].sort();
  }, [approvalData]);

  const approvalMonths = useMemo(() => {
    if (!approvalYear) return [];
    const months = new Set();
    approvalData.forEach(e => {
      const d = dayjs(e.start_date);
      if (String(d.year()) === approvalYear) months.add(d.format('YYYY-MM'));
    });
    return [...months].sort();
  }, [approvalData, approvalYear]);

  // Auto-select latest year for approval
  useEffect(() => {
    if (approvalYears.length > 0 && !approvalYear)
      setApprovalYear(approvalYears[approvalYears.length - 1]);
  }, [approvalYears, approvalYear]);

  const availableProjects = useMemo(() =>
    dataHelper.getApprovalProjects(approvalData, approvalYear, approvalMonth),
    [approvalData, approvalYear, approvalMonth]
  );

  const availableApprovers = useMemo(() =>
    dataHelper.getApprovalApprovers(approvalData, approvalYear, approvalMonth, selectedProjects),
    [approvalData, approvalYear, approvalMonth, selectedProjects]
  );

  const approvalRecords = useMemo(() =>
    dataHelper.computeApprovalRate(approvalData, approvalYear, approvalMonth, selectedProjects, selectedApprover),
    [approvalData, approvalYear, approvalMonth, selectedProjects, selectedApprover]
  );

  const toggleProject = (proj) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj); else next.add(proj);
      return next;
    });
    setSelectedApprover(''); // reset approver when projects change
  };

  const exportApprovalExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.approval);
    ws.addRow([t.pendingApprover, t.pendingCount, t.pendingHours]);
    approvalRecords.forEach(r => ws.addRow([r.pending_approver, r.count, r.total_hours]));
    const totalCount = approvalRecords.reduce((s, r) => s + (r.count || 0), 0);
    const totalHours = Math.round(approvalRecords.reduce((s, r) => s + (r.total_hours || 0), 0) * 100) / 100;
    ws.addRow(['总计', totalCount, totalHours]);
    applyWorkbookStyle(wb, { totalRow: ws.rowCount });
    await saveWorkbook(wb, `审批完成率_${approvalMonth || approvalYear || 'all'}.xlsx`);
  };

  const pageHighlights = useMemo(() => {
    const approvalPendingCount = approvalRecords.reduce((sum, row) => sum + row.count, 0);
    const approvalPendingHours = approvalRecords.reduce((sum, row) => sum + row.total_hours, 0);
    return [
      { label: t.pendingCount, value: approvalPendingCount },
      { label: t.pendingHours, value: `${approvalPendingHours.toFixed(1)}h` },
      { label: uiText.periodRange || 'Period', value: approvalMonth || approvalYear || uiText.allPeriods || 'All' }
    ];
  }, [approvalRecords, approvalMonth, approvalYear, t.pendingCount, t.pendingHours, uiText]);

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
              <select value={approvalYear} onChange={e => { setApprovalYear(e.target.value); setApprovalMonth(''); setSelectedProjects(new Set()); setSelectedApprover(''); }}>
                {approvalYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {approvalYear && (
              <div className="filter-group">
                <label>{t.selectMonth}</label>
                <select value={approvalMonth} onChange={e => { setApprovalMonth(e.target.value); setSelectedProjects(new Set()); setSelectedApprover(''); }}>
                  <option value="">{t.allMonths}</option>
                  {approvalMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            
            <div className="filter-group">
              <label>{t.filterApprover}</label>
              <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)}>
                <option value="">{t.allApprovers}</option>
                {availableApprovers.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="filter-group dropdown-container">
              <label>{t.filterProject}</label>
              <button
                className="dropdown-button"
                onClick={() => setAppProjOpen(!appProjOpen)}
              >
                {selectedProjects.size === 0 ? (t.allProjects || '全部项目') : `已选择 ${selectedProjects.size} 项`}
                <ChevronDown size={16} />
              </button>
              {appProjOpen && (
                <>
                  <div className="dropdown-overlay" onClick={() => setAppProjOpen(false)} />
                  <div className="approval-project-panel">
                    <div className="project-panel-header">
                      <span className="filter-group-label">{t.filterProject}</span>
                      <div className="project-panel-btns">
                        <button onClick={() => { setSelectedProjects(new Set(availableProjects)); setSelectedApprover(''); }}>{t.selectAll}</button>
                        <button onClick={() => { setSelectedProjects(new Set()); setSelectedApprover(''); }}>{t.clearAll}</button>
                      </div>
                    </div>
                    <div className="project-checkboxes">
                      {availableProjects.map(proj => (
                        <label key={proj} className={`project-chip ${selectedProjects.has(proj) ? 'selected' : ''}`}>
                          <input type="checkbox" checked={selectedProjects.has(proj)} onChange={() => toggleProject(proj)} />
                          <span className="chip-label">{proj}</span>
                        </label>
                      ))}
                      {availableProjects.length === 0 && <span className="text-muted empty-state-text">暂无项目数据</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="reporting-stats">
            {approvalRecords.length > 0 && (
              <div className="inline-summary-stats">
                <span className="stat-item">{t.pendingApprover} <strong>{approvalRecords.length}</strong></span>
                <span className="stat-item accent">{t.pendingCount} <strong>{approvalRecords.reduce((a, r) => a + r.count, 0)}</strong></span>
                <span className="stat-item danger">{t.pendingHours} <strong>{approvalRecords.reduce((a, r) => a + r.total_hours, 0).toFixed(1)}h</strong></span>
              </div>
            )}
          </div>
          <div className="reporting-actions">
            {approvalRecords.length > 0 && (
              <button className="export-btn" onClick={exportApprovalExcel}>
                <FileDown size={16} /> {t.export}
              </button>
            )}
          </div>
        </div>

        {approvalRecords.length === 0 ? (
          <div className="card no-issues table-card">
            <div className="empty-state-content">
              <CheckCircle2 size={42} strokeWidth={1.2} color="#33b47e" />
              <p>{t.noApprovalIssues}</p>
            </div>
          </div>
        ) : (
          <div className="dept-accordion table-card">
            <div className="emp-table-wrap">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th>{t.dept}</th>
                    <th>{t.pendingApprover}</th>
                    <th>{t.pendingCount}</th>
                    <th>{t.pendingHours}</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalRecords.map((r, i) => (
                    <tr key={i}>
                      <td>{r.department}</td>
                      <td>{r.pending_approver}</td>
                      <td className="cell-accent">{r.count}</td>
                      <td className="cell-danger">{r.total_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
