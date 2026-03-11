import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  Calendar,
  Users,
  RefreshCcw,
  Zap,
  Filter,
  ChevronDown,
  ChevronRight,
  FileDown,
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import * as dataHelper from './utils/dataHelper';

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  // Global Dashboard & Timeline filters
  const [dashYear, setDashYear] = useState('');
  const [dashMonth, setDashMonth] = useState('');
  const [dashWeek, setDashWeek] = useState('');
  const [dashSelectedDepts, setDashSelectedDepts] = useState(new Set());
  const [dashSelectedProjects, setDashSelectedProjects] = useState(new Set());
  const [status, setStatus] = useState('checking'); // 'checking', 'connected', 'error'
  const [lang, setLang] = useState('zh'); // 'zh' or 'en'
  // Reporting Rate state
  const [reportingData, setReportingData] = useState([]);
  const [targetHours, setTargetHours] = useState(40);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  // Approval Rate state
  const [approvalData, setApprovalData] = useState([]);
  const [approvalYear, setApprovalYear] = useState('');
  const [approvalMonth, setApprovalMonth] = useState('');
  const [selectedProjects, setSelectedProjects] = useState(new Set()); // multi-select
  const [selectedApprover, setSelectedApprover] = useState(''); // single-select

  const t = {
    zh: {
      dashboard: '仪表盘', stats: '统计分析', timeline: '项目时间轴', activity: '活跃度',
      reporting: '完整填报率', approval: '审批完成率',
      title: '工时洞察', subtitle: '实时的工时统计与分析', sync: '同步数据', filters: '筛选:',
      reportingTitle: '完整填报率', reportingSubtitle: '筛选工时填报差异信息',
      approvalTitle: '审批完成率', approvalSubtitle: '统计待审批工时信息',
      period: { weekly: '周统计', monthly: '月统计', quarterly: '季度统计' },
      totalHours: '总工时', avgProject: '项目平均', dataPoints: '数据点',
      trendTitle: '工时走势', distTitle: '项目分布', heatmapTitle: '活跃热力图', ganttTitle: '项目时间明细',
      upload: '上传 Excel', backend: '后台连接', connected: '已连接', disconnected: '未连接', checking: '检查中...',
      success: '成功！已处理', uploadFailed: '上传失败', none: '全体',
      targetHours: '应填报工时', perPeriod: 'h / 周期',
      dept: '部门', employee: '员工', actual: '实际工时', gap: '差额', period_key: '周期',
      export: '导出 Excel', noIssues: '所有部门填报正常，未发现差异。',
      deficit: '不足', excess: '超出',
      selectYear: '选择年度', selectMonth: '选择月份', selectWeek: '选择周（可选）',
      allMonths: '全年', allWeeks: '全月',
      filterDept: '选择部门（可多选）', allDepts: '全部部门',
      pleaseSelectYear: '请先选择年度',
      pendingApprover: '未操作者', pendingCount: '待审条数', pendingHours: '待审工时',
      noApprovalIssues: '当前筛选周期内没有待审批工时。',
      filterProject: '筛选项目（可多选）', filterApprover: '筛选未操作者',
      allApprovers: '全部人员', selectAll: '全选', clearAll: '清空'
    },
    en: {
      dashboard: 'Dashboard', stats: 'Statistics', timeline: 'Timeline', activity: 'Activity',
      reporting: 'Reporting Rate', approval: 'Approval Rate',
      title: 'Timesheet Insights', subtitle: 'Real-time statistics and analysis', sync: 'Sync Data', filters: 'Filters:',
      reportingTitle: 'Reporting Rate', reportingSubtitle: 'Filter timesheet reporting discrepancy information',
      approvalTitle: 'Approval Completion Rate', approvalSubtitle: 'View pending approval timesheet entries',
      period: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' },
      totalHours: 'Total Hours', avgProject: 'Avg. per Project', dataPoints: 'Data Points',
      trendTitle: 'Hours Trend', distTitle: 'Project Distribution', heatmapTitle: 'Activity Heatmap', ganttTitle: 'Project Timeline',
      upload: 'Upload Excel', backend: 'Backend', connected: 'Connected', disconnected: 'Disconnected', checking: 'Checking...',
      success: 'Success! Processed', uploadFailed: 'Upload failed', none: 'All',
      targetHours: 'Target Hours', perPeriod: 'h / Period',
      dept: 'Dept', employee: 'Employee', actual: 'Actual', gap: 'Gap', period_key: 'Period',
      export: 'Export Excel', noIssues: 'All departments are reporting correctly. No issues found.',
      deficit: 'Deficit', excess: 'Excess',
      selectYear: 'Select Year', selectMonth: 'Select Month', selectWeek: 'Select Week (optional)',
      allMonths: 'All Months', allWeeks: 'All Weeks',
      filterDept: 'Filter Departments', allDepts: 'All Depts',
      pleaseSelectYear: 'Please select a year first',
      pendingApprover: 'Pending Approver', pendingCount: 'Pending Count', pendingHours: 'Pending Hours',
      noApprovalIssues: 'No pending approvals in the selected period.',
      filterProject: 'Filter Projects (multi-select)', filterApprover: 'Filter Approver',
      allApprovers: 'All Approvers', selectAll: 'All', clearAll: 'Clear'
    }
  }[lang];

  const checkConnection = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/ping');
      if (res.ok) setStatus('connected');
      else setStatus('error');
    } catch (err) {
      setStatus('error');
    }
  };

  const fetchReportingData = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/reporting-rate');
      if (!res.ok) return;
      const json = await res.json();
      setReportingData(json);
    } catch (err) {
      console.error('Failed to fetch reporting data:', err);
    }
  }, []);

  const fetchApprovalData = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/approval-rate');
      if (!res.ok) return;
      const json = await res.json();
      setApprovalData(json);
    } catch (err) {
      console.error('Failed to fetch approval data:', err);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:8000/stats');
      if (!res.ok) throw new Error('Backend responded with error');
      const json = await res.json();
      setData(json);
      setStatus('connected');
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    fetchData();
    fetchReportingData();
    fetchApprovalData();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [fetchReportingData, fetchApprovalData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:8000/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      alert(`${t.success} ${result.rows_processed} rows.`);
      fetchData();
      fetchReportingData();
      fetchApprovalData();
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reporting rate period options (available years / months / weeks from data)
  const periodOptions = useMemo(
    () => dataHelper.getReportingPeriodOptions(reportingData),
    [reportingData]
  );

  // Auto-select latest year when data first loads
  useEffect(() => {
    if (periodOptions.years.length > 0 && !filterYear) {
      const latestYear = periodOptions.years[periodOptions.years.length - 1];
      setFilterYear(latestYear);
    }
  }, [periodOptions.years, filterYear]);

  // Reset month/week when year changes
  const handleYearChange = (y) => { setFilterYear(y); setFilterMonth(''); setFilterWeek(''); };
  const handleMonthChange = (m) => { setFilterMonth(m); setFilterWeek(''); };

  const reportingRecords = useMemo(() =>
    dataHelper.computeReportingRate(reportingData, filterYear, filterMonth, filterWeek, Number(targetHours)),
    [reportingData, filterYear, filterMonth, filterWeek, targetHours]
  );

  const reportingByDept = useMemo(() =>
    dataHelper.groupReportingByDept(reportingRecords),
    [reportingRecords]
  );

  // Approval Rate computed
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

  // Available projects and approvers for the current period
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

  // Toggle a project in the multi-select set
  const toggleProject = (proj) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj); else next.add(proj);
      return next;
    });
    setSelectedApprover(''); // reset approver when projects change
  };

  const exportApprovalExcel = () => {
    const rows = approvalRecords.map(r => ({
      [t.dept]: r.department,
      [t.pendingApprover]: r.pending_approver,
      [t.pendingCount]: r.count,
      [t.pendingHours]: r.total_hours
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.approval);
    const periodLabel = approvalMonth || approvalYear || 'all';
    XLSX.writeFile(wb, `审批完成率_${periodLabel}.xlsx`);
  };

  const toggleDept = (dept) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const exportReportingExcel = () => {
    const rows = reportingRecords.map(r => ({
      [t.period_key]: r.period_key,
      [t.dept]: r.department,
      [t.employee]: r.employee_name,
      '员工ID': r.employee_id,
      [t.targetHours]: Number(targetHours),
      [t.actual]: r.actual_hours,
      [t.gap]: r.gap,
      '状态': r.gap > 0 ? t.deficit : t.excess
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.reporting);
    const periodLabel = filterWeek || filterMonth || filterYear || 'all';
    XLSX.writeFile(wb, `完整填报率_${periodLabel}_target${targetHours}h.xlsx`);
  };

  const dashPeriodOptions = useMemo(() => dataHelper.getReportingPeriodOptions(data), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Time Filters
      const itemDate = dayjs(item.start_date);
      const y = itemDate.year().toString();
      const m = (itemDate.month() + 1).toString().padStart(2, '0');
      const w = itemDate.isoWeek().toString();

      if (dashYear && y !== dashYear) return false;
      if (dashMonth && m !== dashMonth) return false;
      if (dashWeek && w !== dashWeek) return false;

      // 2. Department & Project Multi-select Filters
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      if (dashSelectedProjects.size > 0 && !dashSelectedProjects.has(item.project_name)) return false;

      return true;
    });
  }, [data, dashYear, dashMonth, dashWeek, dashSelectedDepts, dashSelectedProjects]);

  const dashAvailableDepts = useMemo(() => {
    // Determine available departments based on TIME filtered data only (so selecting a dept doesn't shrink the dept list)
    const timeFiltered = data.filter(item => {
      const itemDate = dayjs(item.start_date);
      if (dashYear && itemDate.year().toString() !== dashYear) return false;
      if (dashMonth && (itemDate.month() + 1).toString().padStart(2, '0') !== dashMonth) return false;
      if (dashWeek && itemDate.isoWeek().toString() !== dashWeek) return false;
      return true;
    });
    return Array.from(new Set(timeFiltered.map(i => i.department))).sort();
  }, [data, dashYear, dashMonth, dashWeek]);

  const dashAvailableProjects = useMemo(() => {
    // Determine available projects based on TIME and DEPT filtered data
    const preFiltered = data.filter(item => {
      const itemDate = dayjs(item.start_date);
      if (dashYear && itemDate.year().toString() !== dashYear) return false;
      if (dashMonth && (itemDate.month() + 1).toString().padStart(2, '0') !== dashMonth) return false;
      if (dashWeek && itemDate.isoWeek().toString() !== dashWeek) return false;
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      return true;
    });
    return Array.from(new Set(preFiltered.map(i => i.project_name))).sort();
  }, [data, dashYear, dashMonth, dashWeek, dashSelectedDepts]);

  const toggleDashDept = (dept) => {
    setDashSelectedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
    // Optional: clear related project selections when changing dept, but letting user keep it is fine too
  };

  const toggleDashProject = (proj) => {
    setDashSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj); else next.add(proj);
      return next;
    });
  };

  const trendChartOpt = useMemo(() => {
    // Determine aggregation dynamically based on what's selected
    let aggType = 'monthly';
    if (dashWeek) aggType = 'weekly';
    else if (dashMonth) aggType = 'weekly';
    else if (dashYear) aggType = 'monthly';
    else aggType = 'quarterly'; // all data view

    const agg = dataHelper.aggregateProjectData(filteredData, aggType);
    // The structure of `agg` from dataHelper.aggregateProjectData is expected to be:
    // { projects: [...], labels: [...], series: [...] }
    // The instruction provided `const projNames = Object.keys(agg); const periods = Array.from(new Set(projNames.flatMap(p => Object.keys(agg[p])))).sort();`
    // which suggests a different `agg` structure. Assuming the original `agg` structure is correct for ECharts.
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#6366f1', textStyle: { color: '#fff' } },
      legend: { data: agg.projects, textStyle: { color: '#94a3b8' }, top: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: agg.labels, axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: agg.series
    };
  }, [filteredData, dashYear, dashMonth, dashWeek]);

  const pieChartOpt = useMemo(() => {
    const grouped = dataHelper.groupByField(filteredData, 'project_name');
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#1e293b', borderWidth: 2 },
        label: { show: false },
        data: grouped.slice(0, 10) // Top 10
      }]
    };
  }, [filteredData]);



  const ganttOpt = useMemo(() => {
    const projData = {};
    filteredData.forEach(item => {
      if (!projData[item.project_name]) {
        projData[item.project_name] = { start: item.start_date, end: item.end_date };
      } else {
        if (dayjs(item.start_date).isBefore(projData[item.project_name].start)) projData[item.project_name].start = item.start_date;
        if (dayjs(item.end_date).isAfter(projData[item.project_name].end)) projData[item.project_name].end = item.end_date;
      }
    });

    const categories = Object.keys(projData);
    const chartData = categories.map((cat, index) => {
      return {
        name: cat,
        value: [index, projData[cat].start, projData[cat].end],
        itemStyle: { normal: { color: '#6366f1' } }
      };
    });

    return {
      tooltip: { formatter: (params) => `${params.name}: ${params.value[1]} ~ ${params.value[2]}` },
      grid: { left: '150px' },
      xAxis: { type: 'time', axisLabel: { color: '#94a3b8' } },
      yAxis: { data: categories, axisLabel: { color: '#94a3b8' } },
      series: [{
        type: 'custom',
        renderItem: (params, api) => {
          const categoryIndex = api.value(0);
          const start = api.coord([api.value(1), categoryIndex]);
          const end = api.coord([api.value(2), categoryIndex]);
          const height = api.size([0, 1])[1] * 0.6;
          return {
            type: 'rect',
            shape: { x: start[0], y: start[1] - height / 2, width: end[0] - start[0], height: height },
            style: api.style()
          };
        },
        encode: { x: [1, 2], y: 0 },
        data: chartData
      }]
    };
  }, [filteredData]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <Zap size={32} color="#6366f1" fill="#6366f1" />
          <span>Antigravity</span>
        </div>

        <nav className="nav-section">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><LayoutDashboard size={20} /> {t.dashboard}</div>
          <div className={`nav-item ${activeTab === 'gantt' ? 'active' : ''}`} onClick={() => setActiveTab('gantt')}><Users size={20} /> {t.timeline}</div>
          <div className={`nav-item ${activeTab === 'reporting' ? 'active' : ''}`} onClick={() => setActiveTab('reporting')}><ClipboardCheck size={20} /> {t.reporting}</div>
          <div className={`nav-item ${activeTab === 'approval' ? 'active' : ''}`} onClick={() => setActiveTab('approval')}><CheckCircle2 size={20} /> {t.approval}</div>
        </nav>

        <div className="sidebar-footer">
          <div className="lang-toggle">
            <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>CN</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>

          <div className="connection-status">
            <div className="status-dot-container">
              <div className="status-dot" style={{
                background: status === 'connected' ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--warning)',
                boxShadow: status === 'connected' ? '0 0 10px var(--success)' : 'none'
              }}></div>
            </div>
            <div className="status-text">
              <span>{t.backend}: {status === 'connected' ? t.connected : status === 'error' ? t.disconnected : t.checking}</span>
              {status === 'error' && <RefreshCcw size={12} className="refresh-icon" onClick={checkConnection} />}
            </div>
          </div>

          <label className="upload-btn">
            <Upload size={20} />
            <span>{t.upload}</span>
            <input type="file" hidden onChange={handleFileUpload} />
          </label>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1>{activeTab === 'reporting' ? t.reportingTitle : activeTab === 'approval' ? t.approvalTitle : t.title}</h1>
            <p className="subtitle">{activeTab === 'reporting' ? t.reportingSubtitle : activeTab === 'approval' ? t.approvalSubtitle : t.subtitle}</p>
          </div>
          <button onClick={fetchData} className="refresh-btn"><RefreshCcw size={16} /> {t.sync}</button>
        </header>

        {(activeTab === 'reporting' || activeTab === 'approval') && (
          <div className="filters-bar" style={{ display: 'none' }} />
        )}

        {activeTab !== 'reporting' && activeTab !== 'approval' && (
          <div className="reporting-tab" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
            {/* Top controls: Period and action buttons could go here if needed */}
            <div className="reporting-top-bar" style={{ marginBottom: dashAvailableDepts.length > 0 ? '0.5rem' : '1.5rem' }}>
              <div className="reporting-filters">
                <div className="filter-group">
                  <label>{t.selectYear}</label>
                  <select value={dashYear} onChange={e => { setDashYear(e.target.value); setDashMonth(''); setDashWeek(''); }}>
                    <option value="">{t.allMonths}</option>
                    {dashPeriodOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {dashYear && (
                  <div className="filter-group">
                    <label>{t.selectMonth}</label>
                    <select value={dashMonth} onChange={e => { setDashMonth(e.target.value); setDashWeek(''); }}>
                      <option value="">{t.allMonths}</option>
                      {(dashPeriodOptions.monthsByYear[dashYear] || []).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {dashMonth && (
                  <div className="filter-group">
                    <label>{t.selectWeek}</label>
                    <select value={dashWeek} onChange={e => setDashWeek(e.target.value)}>
                      <option value="">{t.allWeeks}</option>
                      {(dashPeriodOptions.weeksByMonth[`${dashYear}-${dashMonth}`] || []).map(w => (
                        <option key={w.week} value={w.week}>{w.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Department Multi-select panel */}
            <div className="approval-project-panel" style={{ marginBottom: '0.5rem' }}>
              <div className="project-panel-header">
                <span className="filter-group-label">{t.filterDept}</span>
                <div className="project-panel-btns">
                  <button onClick={() => setDashSelectedDepts(new Set(dashAvailableDepts))}>{t.selectAll || '全选'}</button>
                  <button onClick={() => setDashSelectedDepts(new Set())}>{t.clearAll || '清空'}</button>
                </div>
              </div>
              <div className="project-checkboxes">
                {dashAvailableDepts.map(dept => (
                  <label key={dept} className={`project-chip ${dashSelectedDepts.has(dept) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={dashSelectedDepts.has(dept)} onChange={() => toggleDashDept(dept)} />
                    {dept}
                  </label>
                ))}
                {dashAvailableDepts.length === 0 && <span className="text-muted" style={{ fontSize: '0.8rem' }}>暂无部门数据</span>}
              </div>
            </div>

            {/* Project Multi-select panel */}
            <div className="approval-project-panel" style={{ marginBottom: '1.5rem' }}>
              <div className="project-panel-header">
                <span className="filter-group-label">{t.filterProject}</span>
                <div className="project-panel-btns">
                  <button onClick={() => setDashSelectedProjects(new Set(dashAvailableProjects))}>{t.selectAll || '全选'}</button>
                  <button onClick={() => setDashSelectedProjects(new Set())}>{t.clearAll || '清空'}</button>
                </div>
              </div>
              <div className="project-checkboxes">
                {dashAvailableProjects.map(proj => (
                  <label key={proj} className={`project-chip ${dashSelectedProjects.has(proj) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={dashSelectedProjects.has(proj)} onChange={() => toggleDashProject(proj)} />
                    {proj}
                  </label>
                ))}
                {dashAvailableProjects.length === 0 && <span className="text-muted" style={{ fontSize: '0.8rem' }}>暂无项目数据</span>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <>
            <div className="stats-grid">
              <div className="card"><h3>{t.totalHours}</h3><p className="stat-value primary">{filteredData.reduce((a, b) => a + b.hours, 0).toFixed(1)} h</p></div>
              <div className="card"><h3>{t.avgProject}</h3><p className="stat-value accent">{(filteredData.reduce((a, b) => a + b.hours, 0) / (dashAvailableProjects.length || 1)).toFixed(1)} h</p></div>
              <div className="card"><h3>{t.dataPoints}</h3><p className="stat-value success">{filteredData.length}</p></div>
            </div>
            <div className="stats-grid main-charts">
              <div className="card"><h3>{t.trendTitle}</h3><ReactECharts option={trendChartOpt} style={{ height: '350px' }} /></div>
              <div className="card"><h3>{t.distTitle}</h3><ReactECharts option={pieChartOpt} style={{ height: '350px' }} /></div>
            </div>
          </>
        )}

        {activeTab === 'gantt' && (
          <div className="card"><h3>{t.ganttTitle}</h3><ReactECharts option={ganttOpt} style={{ height: '500px' }} /></div>
        )}

        {activeTab === 'reporting' && (
          <div className="reporting-tab">
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
                    <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                      <option value="">{t.allWeeks}</option>
                      {(periodOptions.weeksByYearMonth[filterMonth] || []).map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
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

            {Object.keys(reportingByDept).length === 0 ? (
              <div className="card no-issues">{t.noIssues}</div>
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
          </div>
        )}

        {activeTab === 'approval' && (
          <div className="reporting-tab">
            {/* Top control bar: period + actions */}
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
                {/* Approver single-select */}
                <div className="filter-group">
                  <label>{t.filterApprover}</label>
                  <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)}>
                    <option value="">{t.allApprovers}</option>
                    {availableApprovers.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="reporting-actions">
                {approvalRecords.length > 0 && (
                  <button className="export-btn" onClick={exportApprovalExcel}>
                    <FileDown size={16} /> {t.export}
                  </button>
                )}
              </div>
            </div>

            {/* Project multi-select panel */}
            {availableProjects.length > 0 && (
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
                      {proj}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Summary cards */}
            {approvalRecords.length > 0 && (
              <div className="approval-summary-cards">
                <div className="approval-summary-card">
                  <span className="summary-label">{t.pendingApprover}（{approvalRecords.length} 人）</span>
                </div>
                <div className="approval-summary-card accent">
                  <span className="summary-label">{t.pendingCount}</span>
                  <span className="summary-value">{approvalRecords.reduce((a, r) => a + r.count, 0)}</span>
                </div>
                <div className="approval-summary-card danger">
                  <span className="summary-label">{t.pendingHours}</span>
                  <span className="summary-value">{approvalRecords.reduce((a, r) => a + r.total_hours, 0).toFixed(2)}h</span>
                </div>
              </div>
            )}

            {approvalRecords.length === 0 ? (
              <div className="card no-issues">{t.noApprovalIssues}</div>
            ) : (
              <div className="dept-accordion">
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
                          <td style={{ color: '#f59e0b', fontWeight: 700 }}>{r.count}</td>
                          <td style={{ color: '#ef4444', fontWeight: 700 }}>{r.total_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
