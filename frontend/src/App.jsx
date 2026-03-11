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
  ClipboardCheck
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import * as dataHelper from './utils/dataHelper';

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    period: 'monthly',
    department: 'All',
    project: 'All'
  });
  const [status, setStatus] = useState('checking'); // 'checking', 'connected', 'error'
  const [lang, setLang] = useState('zh'); // 'zh' or 'en'
  // Reporting Rate state
  const [reportingData, setReportingData] = useState([]);
  const [targetHours, setTargetHours] = useState(40);
  const [reportingPeriod, setReportingPeriod] = useState('weekly');
  const [expandedDepts, setExpandedDepts] = useState(new Set());

  const t = {
    zh: {
      dashboard: '仪表盘', stats: '统计分析', timeline: '项目时间轴', activity: '活跃度',
      reporting: '完整填报率',
      title: '工时洞察', subtitle: '实时的工时统计与分析', sync: '同步数据', filters: '筛选:',
      period: { weekly: '周统计', monthly: '月统计', quarterly: '季度统计' },
      totalHours: '总工时', avgProject: '项目平均', dataPoints: '数据点',
      trendTitle: '工时走势', distTitle: '项目分布', heatmapTitle: '活跃热力图', ganttTitle: '项目时间明细',
      upload: '上传 Excel', backend: '后台连接', connected: '已连接', disconnected: '未连接', checking: '检查中...',
      success: '成功！已处理', uploadFailed: '上传失败', none: '全体',
      targetHours: '应填报工时', perPeriod: '/ 周期',
      dept: '部门', employee: '员工', actual: '实际工时', gap: '差额', period_key: '周期',
      export: '导出 Excel', noIssues: '所有部门填报正常，未发现差异。',
      deficit: '不足', excess: '超出'
    },
    en: {
      dashboard: 'Dashboard', stats: 'Statistics', timeline: 'Timeline', activity: 'Activity',
      reporting: 'Reporting Rate',
      title: 'Timesheet Insights', subtitle: 'Real-time statistics and analysis', sync: 'Sync Data', filters: 'Filters:',
      period: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' },
      totalHours: 'Total Hours', avgProject: 'Avg. per Project', dataPoints: 'Data Points',
      trendTitle: 'Hours Trend', distTitle: 'Project Distribution', heatmapTitle: 'Activity Heatmap', ganttTitle: 'Project Timeline',
      upload: 'Upload Excel', backend: 'Backend', connected: 'Connected', disconnected: 'Disconnected', checking: 'Checking...',
      success: 'Success! Processed', uploadFailed: 'Upload failed', none: 'All',
      targetHours: 'Target Hours', perPeriod: '/ Period',
      dept: 'Dept', employee: 'Employee', actual: 'Actual', gap: 'Gap', period_key: 'Period',
      export: 'Export Excel', noIssues: 'All departments are reporting correctly. No issues found.',
      deficit: 'Deficit', excess: 'Excess'
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
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [fetchReportingData]);

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
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reporting rate computed data
  const reportingRecords = useMemo(() =>
    dataHelper.computeReportingRate(reportingData, reportingPeriod, Number(targetHours)),
    [reportingData, reportingPeriod, targetHours]
  );

  const reportingByDept = useMemo(() =>
    dataHelper.groupReportingByDept(reportingRecords),
    [reportingRecords]
  );

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
    XLSX.writeFile(wb, `完整填报率_${reportingPeriod}_target${targetHours}h.xlsx`);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchDept = filters.department === 'All' || item.department === filters.department;
      const matchProj = filters.project === 'All' || item.project_name === filters.project;
      return matchDept && matchProj;
    });
  }, [data, filters.department, filters.project]);

  const departments = useMemo(() => ['All', ...new Set(data.map(i => i.department))], [data]);
  const projects = useMemo(() => ['All', ...new Set(data.map(i => i.project_name))], [data]);

  const trendChartOpt = useMemo(() => {
    const agg = dataHelper.aggregateProjectData(filteredData, filters.period);
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#6366f1', textStyle: { color: '#fff' } },
      legend: { data: agg.projects, textStyle: { color: '#94a3b8' }, top: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: agg.labels, axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: agg.series
    };
  }, [filteredData, filters.period]);

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

  const heatmapOpt = useMemo(() => {
    const hData = dataHelper.prepareHeatmapData(filteredData);
    return {
      visualMap: { min: 0, max: 8, calculable: true, orient: 'horizontal', left: 'center', top: 'top', inRange: { color: ['rgba(99, 102, 241, 0.1)', '#6366f1'] } },
      calendar: { top: 60, left: 30, right: 30, cellSize: ['auto', 20], range: '2026', itemStyle: { borderWidth: 0.5 }, dayLabel: { color: '#94a3b8' }, monthLabel: { color: '#94a3b8' } },
      series: { type: 'heatmap', coordinateSystem: 'calendar', data: hData }
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
          <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}><BarChart3 size={20} /> {t.stats}</div>
          <div className={`nav-item ${activeTab === 'gantt' ? 'active' : ''}`} onClick={() => setActiveTab('gantt')}><Users size={20} /> {t.timeline}</div>
          <div className={`nav-item ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')}><Calendar size={20} /> {t.activity}</div>
          <div className={`nav-item ${activeTab === 'reporting' ? 'active' : ''}`} onClick={() => setActiveTab('reporting')}><ClipboardCheck size={20} /> {t.reporting}</div>
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
            <h1>{t.title}</h1>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <button onClick={fetchData} className="refresh-btn"><RefreshCcw size={16} /> {t.sync}</button>
        </header>

        <div className="filters-bar">
          <div className="filter-label"><Filter size={16} /> {t.filters}</div>
          <select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value })}>
            <option value="weekly">{t.period.weekly}</option>
            <option value="monthly">{t.period.monthly}</option>
            <option value="quarterly">{t.period.quarterly}</option>
          </select>
          <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}>
            {departments.map(d => <option key={d} value={d}>{d === 'All' ? t.none : d}</option>)}
          </select>
          <select value={filters.project} onChange={e => setFilters({ ...filters, project: e.target.value })}>
            {projects.map(p => <option key={p} value={p}>{p === 'All' ? t.none : p}</option>)}
          </select>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="stats-grid">
              <div className="card"><h3>{t.totalHours}</h3><p className="stat-value primary">{filteredData.reduce((a, b) => a + b.hours, 0).toFixed(1)} h</p></div>
              <div className="card"><h3>{t.avgProject}</h3><p className="stat-value accent">{(filteredData.reduce((a, b) => a + b.hours, 0) / (projects.length - 1 || 1)).toFixed(1)} h</p></div>
              <div className="card"><h3>{t.dataPoints}</h3><p className="stat-value success">{filteredData.length}</p></div>
            </div>
            <div className="stats-grid main-charts">
              <div className="card"><h3>{t.trendTitle}</h3><ReactECharts option={trendChartOpt} style={{ height: '350px' }} /></div>
              <div className="card"><h3>{t.distTitle}</h3><ReactECharts option={pieChartOpt} style={{ height: '350px' }} /></div>
            </div>
          </>
        )}

        {activeTab === 'heatmap' && (
          <div className="card"><h3>{t.heatmapTitle}</h3><ReactECharts option={heatmapOpt} style={{ height: '500px' }} /></div>
        )}

        {activeTab === 'gantt' && (
          <div className="card"><h3>{t.ganttTitle}</h3><ReactECharts option={ganttOpt} style={{ height: '500px' }} /></div>
        )}

        {activeTab === 'reporting' && (
          <div className="reporting-tab">
            <div className="reporting-header">
              <div className="reporting-controls">
                <div className="period-toggle">
                  <button className={reportingPeriod === 'weekly' ? 'active' : ''} onClick={() => setReportingPeriod('weekly')}>{t.period.weekly}</button>
                  <button className={reportingPeriod === 'monthly' ? 'active' : ''} onClick={() => setReportingPeriod('monthly')}>{t.period.monthly}</button>
                </div>
                <div className="target-input">
                  <label>{t.targetHours}</label>
                  <input type="number" min="1" max="999" value={targetHours}
                    onChange={e => setTargetHours(e.target.value)}
                    className="hours-input" />
                  <span className="per-period">{t.perPeriod}</span>
                </div>
              </div>
              {reportingRecords.length > 0 && (
                <button className="export-btn" onClick={exportReportingExcel}>
                  <FileDown size={16} /> {t.export}
                </button>
              )}
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
      </main>
    </div>
  );
};

export default App;
