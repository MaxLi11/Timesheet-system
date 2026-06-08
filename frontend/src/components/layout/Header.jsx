import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, Upload, X } from 'lucide-react';

const compactList = (items, fallback) => {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.slice(0, 6).join(', ') + (items.length > 6 ? ` +${items.length - 6}` : '');
};

const fullList = (items, fallback) => {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.join(', ');
};

const formatNumber = (value) => {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const addCsvRows = (rows, section, items, mapper) => {
  if (!Array.isArray(items) || items.length === 0) {
    rows.push([section, '', '', '', '', '', '', '', '']);
    return;
  }
  items.forEach((item) => rows.push([section, ...mapper(item)]));
};

const downloadAuditCsv = (report, t) => {
  const audit = report.audit || {};
  const rows = [
    ['section', 'name', 'project', 'category', 'from', 'to', 'start_date', 'end_date', 'value'],
    ['summary', t.uploadRows, '', '', '', '', '', '', report.rowsProcessed],
    ['summary', t.uploadEmployees, '', '', '', '', '', '', report.employeesProcessed],
    ['summary', t.uploadProjectHours, '', '', '', '', '', '', audit.project_hours || 0],
    ['summary', t.uploadNonProjectHours, '', '', '', '', '', '', audit.non_project_hours || 0],
    ['summary', t.uploadTotalHours, '', '', '', '', '', '', audit.total_hours || 0],
  ];
  addCsvRows(rows, 'bu_overwrite', audit.bu_overwrites, (item) => [
    '', item.project_name || '', '', item.from_bu || '', item.to_bu || '', '', '', '',
  ]);
  addCsvRows(rows, 'unmatched_employee', audit.unmatched_employees, (name) => [
    name, '', '', '', '', '', '', '',
  ]);
  addCsvRows(rows, 'unmatched_project', audit.unmatched_projects, (name) => [
    '', name, '', '', '', '', '', '',
  ]);
  addCsvRows(rows, 'blank_project_bu', audit.blank_project_bu_rows, (item) => [
    '', item.project_name || item.source_project_name || '', '', '', '', '', '', '',
  ]);
  addCsvRows(rows, 'duplicate_row', audit.duplicate_rows, (item) => [
    item.employee_name || '', item.project_name || '', item.category || '', '', '', item.start_date || '', item.end_date || '', item.count || '',
  ]);

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `upload-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const Header = ({
  status,
  statusLabel,
  t,
  uiText,
  lang,
  setLang,
  handleFileUpload,
  navItems,
  activeTab,
  setActiveTab,
  uploadAuditReport,
  clearUploadAuditReport
}) => {
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);
  const audit = uploadAuditReport?.audit || {};
  const monthlySummary = audit.monthly_summary || {};
  const latestMonth = Object.keys(monthlySummary).sort().at(-1);
  const latestMonthSummary = latestMonth ? monthlySummary[latestMonth] : null;
  const buOverwrites = Array.isArray(audit.bu_overwrites) ? audit.bu_overwrites : [];
  const unmatchedEmployees = Array.isArray(audit.unmatched_employees) ? audit.unmatched_employees : [];
  const unmatchedProjects = Array.isArray(audit.unmatched_projects) ? audit.unmatched_projects : [];
  const blankProjectBuRows = Array.isArray(audit.blank_project_bu_rows) ? audit.blank_project_bu_rows : [];
  const duplicateRows = Array.isArray(audit.duplicate_rows) ? audit.duplicate_rows : [];
  const riskCount = unmatchedEmployees.length + unmatchedProjects.length + blankProjectBuRows.length + Number(audit.duplicate_row_count || 0);
  const riskLabel = riskCount === 0 ? t.uploadRiskClean : riskCount <= 10 ? t.uploadRiskReview : t.uploadRiskAttention;
  const monthlyCount = useMemo(() => Object.keys(monthlySummary).length, [monthlySummary]);

  return (
    <header className="topbar-surface">
      <div className="topbar-main">
        <div className="brand-lockup">
          <div className="logo">
            <div className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="anx-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0066FF" />
                    <stop offset="100%" stopColor="#00D4FF" />
                  </linearGradient>
                  <linearGradient id="anx-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4D72FF" />
                    <stop offset="100%" stopColor="#7AA6FF" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="16" cy="16" r="13" stroke="url(#anx-gradient-1)" strokeWidth="1.5" fill="none" opacity="0.3"/>
                <path d="M16 6 L24 20 L20 20 L16 12 L12 20 L8 20 Z" fill="url(#anx-gradient-1)" filter="url(#glow)"/>
                <circle cx="16" cy="16" r="2" fill="#FFFFFF" opacity="0.95"/>
                <circle cx="16" cy="16" r="8" stroke="url(#anx-gradient-2)" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray="2 3"/>
              </svg>
            </div>
            <div className="logo-copy">
              <span className="logo-title">Anx Showtime</span>
              <div className="logo-badge">
                <span className="logo-badge-dot"></span>
                {uiText.workspace}
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-utilities">
          <div className={`utility-status ${status}`}>
            <div className="status-dot"></div>
            <div className="utility-status-copy">
              <span>{t.backend}</span>
              <strong>{statusLabel}</strong>
            </div>
          </div>

          <label className="utility-upload">
            <Upload size={18} />
            <span>{t.upload}</span>
            <input type="file" hidden onChange={handleFileUpload} />
          </label>

          <div className="lang-toggle utility-lang-toggle">
            <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>CN</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </div>

      <div className="topbar-nav-shell">
        <nav className="topbar-nav" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`top-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <NavIcon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {uploadAuditReport && (
        <section className="upload-audit-panel" aria-live="polite">
          <div className="upload-audit-heading">
            <div className="upload-audit-title">
              <CheckCircle2 size={18} />
              <div>
                <strong>{t.uploadAuditTitle}</strong>
                <span>{uploadAuditReport.fileName}</span>
              </div>
            </div>
            <div className="upload-audit-actions">
              <button type="button" className="icon-button" onClick={() => downloadAuditCsv(uploadAuditReport, t)} aria-label={t.uploadDownloadAudit}>
                <Download size={16} />
              </button>
              <button type="button" className="icon-button" onClick={clearUploadAuditReport} aria-label={t.close}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="upload-audit-metrics">
            <div><span>{t.uploadRows}</span><strong>{uploadAuditReport.rowsProcessed}</strong></div>
            <div><span>{t.uploadEmployees}</span><strong>{uploadAuditReport.employeesProcessed}</strong></div>
            <div><span>{t.uploadProjectHours}</span><strong>{formatNumber(audit.project_hours)}</strong></div>
            <div><span>{t.uploadNonProjectHours}</span><strong>{formatNumber(audit.non_project_hours)}</strong></div>
            <div><span>{t.uploadTotalHours}</span><strong>{formatNumber(audit.total_hours)}</strong></div>
            <div><span>{t.uploadBuOverwrites}</span><strong>{buOverwrites.length}</strong></div>
            <div><span>{t.uploadRiskStatus}</span><strong>{riskLabel}</strong></div>
            <div><span>{t.uploadDuplicateRows}</span><strong>{Number(audit.duplicate_row_count || 0)}</strong></div>
            <div><span>{t.uploadMonthCount}</span><strong>{monthlyCount}</strong></div>
          </div>

          <div className="upload-audit-details">
            <p>
              <span>{t.uploadBuDetails}</span>
              {buOverwrites.length
                ? buOverwrites.slice(0, 4).map((item) => `${item.project_name}: ${item.from_bu || '-'} -> ${item.to_bu || '-'}`).join('; ')
                : t.uploadNone}
            </p>
            <p><span>{t.uploadUnmatchedEmployees}</span>{compactList(unmatchedEmployees, t.uploadNone)}</p>
            <p><span>{t.uploadUnmatchedProjects}</span>{compactList(unmatchedProjects, t.uploadNone)}</p>
            <p>
              <span>{t.uploadBlankBuProjects}</span>
              {blankProjectBuRows.length
                ? blankProjectBuRows.slice(0, 6).map((item) => item.project_name || item.source_project_name || '-').join(', ')
                : t.uploadNone}
            </p>
            {latestMonthSummary && (
              <p>
                <span>{t.uploadLatestMonth}</span>
                {latestMonth}: {formatNumber(latestMonthSummary.total_hours)}h
              </p>
            )}
          </div>

          <button type="button" className="upload-audit-expand" onClick={() => setIsAuditExpanded((value) => !value)}>
            <ChevronDown size={16} className={isAuditExpanded ? 'is-open' : ''} />
            {isAuditExpanded ? t.uploadHideDetails : t.uploadShowDetails}
          </button>

          {isAuditExpanded && (
            <div className="upload-audit-expanded">
              <div>
                <span>{t.uploadUnmatchedEmployees}</span>
                <p>{fullList(unmatchedEmployees, t.uploadNone)}</p>
              </div>
              <div>
                <span>{t.uploadUnmatchedProjects}</span>
                <p>{fullList(unmatchedProjects, t.uploadNone)}</p>
              </div>
              <div>
                <span>{t.uploadBlankBuProjects}</span>
                <p>
                  {blankProjectBuRows.length
                    ? blankProjectBuRows.map((item) => item.project_name || item.source_project_name || '-').join(', ')
                    : t.uploadNone}
                </p>
              </div>
              <div>
                <span>{t.uploadDuplicateRows}</span>
                <p>
                  {duplicateRows.length
                    ? duplicateRows.slice(0, 8).map((item) => `${item.employee_name} / ${item.project_name} / ${item.start_date} - ${item.end_date} x${item.count}`).join('; ')
                    : t.uploadNone}
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </header>
  );
};
