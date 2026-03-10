import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  RefreshCcw,
  Zap,
  Filter
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:8000/stats');
      if (!res.ok) throw new Error('Backend responded with error');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      // alert('无法连接到后端服务 (127.0.0.1:8000)，请确保 Backend 窗口已启动。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      alert(`Success! Processed ${result.rows_processed} rows.`);
      fetchData();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
    const agg = dataHelper.aggregateData(filteredData, filters.period);
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#6366f1', textStyle: { color: '#fff' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: agg.labels, axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        data: agg.values,
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.2, color: '#6366f1' },
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1' }
      }]
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
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><LayoutDashboard size={20} />Overview</div>
          <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}><BarChart3 size={20} />Statistics</div>
          <div className={`nav-item ${activeTab === 'gantt' ? 'active' : ''}`} onClick={() => setActiveTab('gantt')}><Users size={20} />Timeline</div>
          <div className={`nav-item ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')}><Calendar size={20} />Activity</div>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <label className="upload-zone">
            <Upload size={24} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '0.8rem' }}>Upload Excel</p>
            <input type="file" hidden onChange={handleFileUpload} />
          </label>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1 style={{ fontSize: '2rem' }}>Timesheet Insights</h1>
            <p style={{ color: 'var(--text-muted)' }}>Real-time statistics and analysis</p>
          </div>
          <button onClick={fetchData} className="refresh-btn"><RefreshCcw size={16} /> Sync Data</button>
        </header>

        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}><Filter size={16} /> Filters:</div>
          <select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value })}>
            <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
          </select>
          <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.project} onChange={e => setFilters({ ...filters, project: e.target.value })}>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="stats-grid">
              <div className="card"><h3>Total Hours</h3><p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>{filteredData.reduce((a, b) => a + b.hours, 0).toFixed(1)} h</p></div>
              <div className="card"><h3>Avg. per Project</h3><p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent)' }}>{(filteredData.reduce((a, b) => a + b.hours, 0) / (projects.length - 1 || 1)).toFixed(1)} h</p></div>
              <div className="card"><h3>Data points</h3><p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)' }}>{filteredData.length}</p></div>
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className="card"><h3>Hours Trend</h3><ReactECharts option={trendChartOpt} style={{ height: '350px' }} /></div>
              <div className="card"><h3>Project Distribution</h3><ReactECharts option={pieChartOpt} style={{ height: '350px' }} /></div>
            </div>
          </>
        )}

        {activeTab === 'heatmap' && (
          <div className="card"><h3>Activity Heatmap</h3><ReactECharts option={heatmapOpt} style={{ height: '500px' }} /></div>
        )}

        {activeTab === 'gantt' && (
          <div className="card"><h3>Project Timeline (行军图)</h3><ReactECharts option={ganttOpt} style={{ height: '500px' }} /></div>
        )}
      </main>
    </div>
  );
};
export default App;
