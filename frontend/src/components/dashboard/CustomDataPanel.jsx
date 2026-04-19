import React from 'react';
import { FileDown } from 'lucide-react';
import { buildCustomProjectHoursExport } from '../../utils/customDataExport';
import { applyWorkbookStyle, saveWorkbook } from '../../utils/excelStyles';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');

export const CustomDataPanel = ({ 
  data, 
  workWeeks, 
  setWorkWeeks, 
  handleWorkWeekUpload, 
  t, 
  lang 
}) => {

  const exportCustomProjectHoursExcel = async () => {
    try {
      let weeks = workWeeks;
      if (!weeks.length) {
        const res = await fetch(`${API_BASE_URL}/work-weeks`);
        if (res.ok) { 
          const json = await res.json(); 
          weeks = Array.isArray(json) ? json : []; 
          if (weeks.length && setWorkWeeks) setWorkWeeks(weeks); 
        }
      }
      const workbookData = buildCustomProjectHoursExport(data, weeks);
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(workbookData.sheetName);
      ws.addRow(workbookData.headers);
      workbookData.rows.forEach(r => ws.addRow(r));
      applyWorkbookStyle(wb);
      await saveWorkbook(wb, workbookData.filename);
    } catch (err) { 
      alert(`${lang === 'zh' ? '导出失败' : 'Export failed'}: ${err.message}`); 
    }
  };

  const exportPersonMonthRatioExcel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/person-month-ratio`);
      if (!res.ok) throw new Error('获取数据失败');
      const { months, rows } = await res.json();
      if (!rows || rows.length === 0) { alert('暂无数据，请先上传工时表和工作周划分文件。'); return; }
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('人月占比');
      ws.addRow(['项目名称', '员工', '所属部门', '部门简称', '职位', ...months]);
      rows.forEach(r => ws.addRow([r.project_name, r.employee_name, r.department_full, r.department, r.position, ...months.map(m => r.months[m] ?? 0)]));
      applyWorkbookStyle(wb);
      const now = new Date(); const pad = v => String(v).padStart(2, '0');
      await saveWorkbook(wb, `人月占比_Close口径_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
    } catch (err) { alert(`导出失败: ${err.message}`); }
  };

  const exportPersonMonthMarchExcel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/export-person-month-march`);
      if (!res.ok) throw new Error('获取数据失败');
      const { months, rows, summary } = await res.json();
      if (!rows || rows.length === 0) { alert(lang === 'zh' ? '暂无数据，请先上传工时表。' : 'No data.'); return; }
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(lang === 'zh' ? '人月行军图' : 'March Chart');
      const baseH = [lang==='zh'?'项目名称':'Project', lang==='zh'?'员工':'Employee', lang==='zh'?'所属部门':'Department', lang==='zh'?'部门简称':'Dept', lang==='zh'?'职位':'Position'];
      const subCol = lang==='zh' ? ['该项目该员工总工时','人月','当月总工时'] : ['Proj Hours','Ratio','Monthly Total'];
      const totalCol = lang==='zh' ? ['总计','总计','总计'] : ['Total','Total','Total'];
      // Row1: summary
      ws.addRow(['','','','','', ...months.flatMap(m => [summary[m]?.proj_hours??'', summary[m]?.ratio??'', summary[m]?.total_hours??'']), '','','']);
      // Row2: month headers
      ws.addRow([...baseH, ...months.flatMap(m => [m,m,m]), ...totalCol]);
      // Row3: sub-headers
      ws.addRow(['','','','','', ...months.flatMap(()=>subCol), ...subCol]);
      rows.forEach(r => {
        const totProjH = Object.values(r.months).reduce((s,d)=>s+d.proj_hours,0);
        const totRatio = Object.values(r.months).reduce((s,d)=>s+d.ratio,0);
        const totTotalH = Object.values(r.months).reduce((s,d)=>s+d.total_hours,0);
        ws.addRow([r.project_name, r.employee_name, r.department_full, r.department, r.position,
          ...months.flatMap(m => { const d=r.months[m]; return d?[d.proj_hours,d.ratio,d.total_hours]:['','','']; }),
          parseFloat(totProjH.toFixed(2)), parseFloat(totRatio.toFixed(6)), parseFloat(totTotalH.toFixed(2))]);
      });
      applyWorkbookStyle(wb, { headerRows: [2, 3], totalRow: 1 });
      const now = new Date(); const pad = v => String(v).padStart(2,'0');
      await saveWorkbook(wb, `${lang==='zh'?'人月行军图':'person_month_march'}_Close_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
    } catch (err) { alert(`${lang==='zh'?'导出失败':'Export failed'}: ${err.message}`); }
  };

  const exportEmployeeMonthlyTotalExcel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/export-employee-monthly-total`);
      if (!res.ok) throw new Error('获取数据失败');
      const { months, rows } = await res.json();
      if (!rows || rows.length === 0) { alert(lang === 'zh' ? '暂无数据，请先上传工时表。' : 'No data.'); return; }
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(lang === 'zh' ? '每人每月总工时' : 'Monthly Total');
      ws.addRow([lang==='zh'?'姓名':'Employee', ...months, lang==='zh'?'总计':'Total']);
      rows.forEach(r => ws.addRow([r.employee_name, ...months.map(m => r.months[m] ?? ''), r.total]));
      const totalRowData = [lang==='zh'?'总计':'Total', ...months.map(m => rows.reduce((s,r)=>s+(r.months[m]??0),0)), rows.reduce((s,r)=>s+r.total,0)];
      const totalRow = ws.addRow(totalRowData);
      applyWorkbookStyle(wb, { totalRow: ws.rowCount });
      const now = new Date(); const pad = v => String(v).padStart(2,'0');
      await saveWorkbook(wb, `${lang==='zh'?'每人每月总工时':'employee_monthly_total'}_Close_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
    } catch (err) { alert(`${lang==='zh'?'导出失败':'Export failed'}: ${err.message}`); }
  };

  const actionButtonStyle = {
    width: '220px',
    minHeight: '2.9rem',
    justifyContent: 'center',
    boxSizing: 'border-box'
  };

  const secondaryActionButtonStyle = {
    ...actionButtonStyle,
    background: 'rgba(77, 114, 255, 0.12)',
    color: 'var(--primary)',
    border: '1px solid rgba(77, 114, 255, 0.25)',
    boxShadow: 'none'
  };

  return (
    <>
      <header className="page-hero" style={{ gridTemplateColumns: '1fr' }}>
        <div className="page-intro-copy">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', width: '100%' }}>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{t.customDataHeroTitle}</h1>
            </div>
            <label className="export-btn" style={{ ...secondaryActionButtonStyle, cursor: 'pointer', margin: 0, flex: '0 0 auto' }}>
              <FileDown size={16} /> {t.uploadWorkWeek}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleWorkWeekUpload} />
            </label>
          </div>
        </div>
      </header>

      <div className="section-shell">
        <div className="card custom-data-card elevated-module">
          <div className="card-heading-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>{t.customDataTitle}</h3>
              <p className="module-caption" style={{ marginTop: '8px' }}>{t.customDataSubtitle}</p>
            </div>
            <button type="button" className="export-btn" style={actionButtonStyle} onClick={exportCustomProjectHoursExcel}>
              <FileDown size={16} /> {t.exportCustomData}
            </button>
          </div>
        </div>

        <div className="card custom-data-card elevated-module">
          <div className="card-heading-row">
            <div>
              <h3>{t.personMonthRatioTitle}</h3>
              <p className="module-caption">{t.personMonthRatioSubtitle}</p>
            </div>
            <button type="button" className="export-btn" style={actionButtonStyle} onClick={exportPersonMonthRatioExcel}>
              <FileDown size={16} /> {t.exportPersonMonthRatio}
            </button>
          </div>
        </div>

        <div className="card custom-data-card elevated-module">
          <div className="card-heading-row">
            <div>
              <h3>{lang === 'zh' ? '人月行军图导出' : 'Person-Month March Chart Export'}</h3>
              <p className="module-caption">
                {lang === 'zh'
                  ? '每项目每员工每月：项目工时 + 人月占比 + 当月总工时，Close口径'
                  : 'Per project/employee/month: hours + ratio + monthly total, Close only'}
              </p>
            </div>
            <button type="button" className="export-btn" style={actionButtonStyle} onClick={exportPersonMonthMarchExcel}>
              <FileDown size={16} /> {lang === 'zh' ? '导出行军图' : 'Export March Chart'}
            </button>
          </div>
        </div>

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
      </div>
    </>
  );
};
