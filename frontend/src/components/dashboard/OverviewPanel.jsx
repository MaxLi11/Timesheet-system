import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import EChartsReact from 'echarts-for-react';
import { ChevronDown } from 'lucide-react';
import * as dataHelper from '../../utils/dataHelper';
import { getEntryWorkMonth } from '../../utils/dataHelper';
import { EDITORIAL_THEME, tooltipBase, chartText, chartAxis, chartSplitLine } from '../../constants/theme';

export const OverviewPanel = ({ data, workWeeks, t, uiText, pageMeta, statusLabel }) => {
  const [dashYear, setDashYear] = useState('');
  const [dashMonth, setDashMonth] = useState('');
  const [dashWeek, setDashWeek] = useState(null);
  const [dashGranularity, setDashGranularity] = useState('monthly');
  const [dashSelectedDepts, setDashSelectedDepts] = useState(new Set());
  const [dashSelectedProjects, setDashSelectedProjects] = useState(new Set());
  const [dashDeptOpen, setDashDeptOpen] = useState(false);
  const [dashProjOpen, setDashProjOpen] = useState(false);

  const dashPeriodOptions = useMemo(() => dataHelper.getReportingPeriodOptions(data), [data]);

  const filteredData = useMemo(() => {
    if (!dashYear && !dashMonth && !dashWeek && dashSelectedDepts.size === 0 && dashSelectedProjects.size === 0) {
      return data.filter(item => item.category !== 'Non-Project');
    }
    return data.filter(item => {
      if (item.category === 'Non-Project') return false;
      if (dashYear || dashMonth || dashWeek) {
        if (!item.start_date) return false;
        if (dashWeek && dashWeek.week_start) {
          const itemDate = dayjs(item.start_date);
          if (itemDate.isBefore(dayjs(dashWeek.week_start), 'day') ||
              itemDate.isAfter(dayjs(dashWeek.week_end), 'day')) return false;
        } else {
          // 统一口径：按工作周归属月（week_end 所在月）比对
          const entryMonth = getEntryWorkMonth(item, workWeeks);
          const entryYear = entryMonth.slice(0, 4);
          const entryMonthNum = entryMonth.slice(5, 7);
          if (dashYear && entryYear !== dashYear) return false;
          if (dashMonth && entryMonthNum !== dashMonth) return false;
        }
      }
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      if (dashSelectedProjects.size > 0 && !dashSelectedProjects.has(item.project_name)) return false;
      return true;
    });
  }, [data, dashYear, dashMonth, dashWeek, dashSelectedDepts, dashSelectedProjects, workWeeks]);

  const dashAvailableDepts = useMemo(() => {
    if (!dashYear && !dashMonth && !dashWeek)
      return Array.from(new Set(data.filter(i => i.category !== 'Non-Project').map(i => i.department).filter(Boolean))).sort();
    
    const timeFiltered = data.filter(item => {
      if (item.category === 'Non-Project') return false;
      if (!item.start_date) return false;
      if (dashWeek && dashWeek.week_start) {
        const d = dayjs(item.start_date);
        if (d.isBefore(dayjs(dashWeek.week_start), 'day') || d.isAfter(dayjs(dashWeek.week_end), 'day')) return false;
      } else {
        const entryMonth = getEntryWorkMonth(item, workWeeks);
        if (dashYear && entryMonth.slice(0, 4) !== dashYear) return false;
        if (dashMonth && entryMonth.slice(5, 7) !== dashMonth) return false;
      }
      return true;
    });
    return Array.from(new Set(timeFiltered.map(i => i.department).filter(Boolean))).sort();
  }, [data, dashYear, dashMonth, dashWeek, workWeeks]);

  const dashAvailableProjects = useMemo(() => {
    if (!dashYear && !dashMonth && !dashWeek && dashSelectedDepts.size === 0)
      return Array.from(new Set(data.filter(i => i.category !== 'Non-Project').map(i => i.project_name).filter(Boolean))).sort();
    
    const preFiltered = data.filter(item => {
      if (item.category === 'Non-Project') return false;
      if (dashYear || dashMonth || dashWeek) {
        if (!item.start_date) return false;
        if (dashWeek && dashWeek.week_start) {
          const d = dayjs(item.start_date);
          if (d.isBefore(dayjs(dashWeek.week_start), 'day') || d.isAfter(dayjs(dashWeek.week_end), 'day')) return false;
        } else {
          const entryMonth = getEntryWorkMonth(item, workWeeks);
          if (dashYear && entryMonth.slice(0, 4) !== dashYear) return false;
          if (dashMonth && entryMonth.slice(5, 7) !== dashMonth) return false;
        }
      }
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      return true;
    });
    return Array.from(new Set(preFiltered.map(i => i.project_name).filter(Boolean))).sort();
  }, [data, dashYear, dashMonth, dashWeek, dashSelectedDepts, workWeeks]);

  const toggleDashDept = (dept) => {
    setDashSelectedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const toggleDashProject = (proj) => {
    setDashSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj); else next.add(proj);
      return next;
    });
  };

  const totalHoursValue = useMemo(() => filteredData.reduce((sum, entry) => sum + entry.hours, 0), [filteredData]);
  const avgProjectHoursValue = useMemo(() => totalHoursValue / (dashAvailableProjects.length || 1), [dashAvailableProjects.length, totalHoursValue]);
  const dataPointsValue = filteredData.length;

  const activeFilterCount = useMemo(() => (
    [dashYear, dashMonth, dashWeek].filter(Boolean).length +
    (dashSelectedDepts.size > 0 ? 1 : 0) +
    (dashSelectedProjects.size > 0 ? 1 : 0)
  ), [dashMonth, dashSelectedDepts.size, dashSelectedProjects.size, dashWeek, dashYear]);

  const overviewTimeframeLabel = useMemo(() => {
    if (dashYear && dashMonth && dashWeek) return `${dashYear}-${dashMonth} / ${dashWeek.week_code || dashWeek}`;
    if (dashYear && dashMonth) return `${dashYear}-${dashMonth}`;
    if (dashYear) return dashYear;
    return uiText.allPeriods;
  }, [dashMonth, dashWeek, dashYear, uiText.allPeriods]);

  const effectiveDashGranularity = useMemo(() => (dashMonth || dashWeek ? 'weekly' : dashGranularity), [dashGranularity, dashMonth, dashWeek]);
  const isDashGranularityLocked = Boolean(dashMonth || dashWeek);

  const topDepartment = useMemo(() => {
    const grouped = dataHelper.groupByField(filteredData, 'department').sort((a, b) => b.value - a.value);
    return grouped[0]?.name || '—';
  }, [filteredData]);

  const trendChartOpt = useMemo(() => {
    const agg = dataHelper.aggregateProjectData(filteredData, effectiveDashGranularity, workWeeks);
    return {
      color: EDITORIAL_THEME.palette,
      tooltip: {
        ...tooltipBase,
        trigger: 'item',
        formatter: (params) => `${params.seriesName}<br/>${params.name}: ${params.value} h`
      },
      legend: { data: agg.projects, textStyle: chartText, top: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: agg.labels, axisLabel: chartAxis },
      yAxis: { type: 'value', axisLabel: chartAxis, splitLine: chartSplitLine },
      series: agg.series.map((series, index) => ({
        ...series,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: {
          ...(series.lineStyle || {}),
          width: 3,
          color: EDITORIAL_THEME.palette[index % EDITORIAL_THEME.palette.length]
        },
        itemStyle: {
          ...(series.itemStyle || {}),
          color: EDITORIAL_THEME.palette[index % EDITORIAL_THEME.palette.length]
        }
      }))
    };
  }, [effectiveDashGranularity, filteredData, workWeeks]);

  const rankingChartOpt = useMemo(() => {
    const grouped = dataHelper.groupByField(filteredData, 'project_name');
    const sorted = grouped.sort((a, b) => b.value - a.value).slice(0, 30);
    const topProjNames = new Set(sorted.map(i => i.name));

    const projMonthlyData = {};
    filteredData.forEach(item => {
      if (topProjNames.has(item.project_name)) {
        if (!projMonthlyData[item.project_name]) projMonthlyData[item.project_name] = new Set();
        projMonthlyData[item.project_name].add(dayjs(item.start_date).format('YYYY-MM'));
      }
    });

    const avgData = sorted.map(i => {
      const monthCount = (projMonthlyData[i.name]?.size || 1);
      return parseFloat((i.value / monthCount).toFixed(1));
    });

    return {
      color: [EDITORIAL_THEME.accent, EDITORIAL_THEME.brass],
      tooltip: {
        ...tooltipBase,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let res = `${params[0].name}<br/>`;
          params.forEach(p => {
            res += `${p.marker} ${p.seriesName}: ${p.value} h<br/>`;
          });
          return res;
        }
      },
      legend: { data: [t.totalHours, t.avgMonthlyHours], textStyle: chartText, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sorted.map(i => i.name),
        axisLabel: { ...chartAxis, rotate: sorted.length > 5 ? 30 : 0, interval: 0 }
      },
      yAxis: [
        { type: 'value', name: t.totalHours, axisLabel: chartAxis, splitLine: chartSplitLine },
        { type: 'value', name: t.avgMonthlyHours, axisLabel: { ...chartAxis, color: EDITORIAL_THEME.brass }, splitLine: { show: false } }
      ],
      series: [
        {
          name: t.totalHours,
          type: 'bar',
          data: sorted.map(i => i.value),
          itemStyle: { borderRadius: [6, 6, 0, 0], color: EDITORIAL_THEME.accent },
          emphasis: { focus: 'series' }
        },
        {
          name: t.avgMonthlyHours,
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: avgData,
          itemStyle: { color: EDITORIAL_THEME.brass },
          lineStyle: { width: 3, color: EDITORIAL_THEME.brass },
          emphasis: { focus: 'series' }
        }
      ]
    };
  }, [filteredData, t.totalHours, t.avgMonthlyHours]);

  // Compute derived calendar height so it can be passed to EChartsReact style
  const heatmapCalHeight = useMemo(() => {
    const raw = dataHelper.prepareHeatmapData(filteredData);
    const validData = Array.isArray(raw) ? raw : [];
    if (dashYear) return dashMonth ? '160px' : '220px';
    if (validData.length > 0) {
      const dates = validData.map(d => d[0]).sort();
      const minYear = dates[0].slice(0, 4);
      const maxYear = dates[dates.length - 1].slice(0, 4);
      const yearSpan = parseInt(maxYear) - parseInt(minYear) + 1;
      return `${Math.max(220, yearSpan * 200)}px`;
    }
    return '220px';
  }, [filteredData, dashYear, dashMonth]);

  const heatmapDataOpt = useMemo(() => {
    const raw = dataHelper.prepareHeatmapData(filteredData);
    const validData = Array.isArray(raw) ? raw : [];

    // Derive calendar range from actual data to correctly span multiple years
    let calRange;
    if (dashYear && dashMonth) {
      calRange = `${dashYear}-${dashMonth}`;
    } else if (dashYear) {
      calRange = dashYear;
    } else if (validData.length > 0) {
      const dates = validData.map(d => d[0]).sort();
      const minYear = dates[0].slice(0, 4);
      const maxYear = dates[dates.length - 1].slice(0, 4);
      calRange = minYear === maxYear ? minYear : [dates[0], dates[dates.length - 1]];
    } else {
      calRange = dayjs().year().toString();
    }

    // Chart height adapts to range span - computed externally as heatmapCalHeight

    return {
      tooltip: {
        ...tooltipBase,
        position: 'top',
        formatter: (p) => {
          const d = p.data;
          return d ? `${d[0]}<br/>${t.totalHours}: ${d[1]} h` : '';
        }
      },
      visualMap: {
        min: 0,
        max: 80,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        top: 0,
        inRange: { color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] }
      },
      calendar: {
        top: 60,
        left: 30,
        right: 30,
        cellSize: ['auto', 18],
        range: calRange,
        itemStyle: { borderWidth: 0.5, borderColor: '#fff' },
        yearLabel: { show: !dashMonth, textStyle: { color: '#7687a5', fontSize: 12 } }
      },
      series: {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: validData,
        itemStyle: { borderRadius: 2 }
      }
    };
  }, [filteredData, dashYear, dashMonth, t.totalHours]);

  return (
    <>
      <header className="page-hero page-hero-overview">
        <div className="page-intro-copy">
          <p className="page-eyebrow">{pageMeta.eyebrow}</p>
          <h1 className="page-title">{pageMeta.title}</h1>
          <p className="page-summary">{pageMeta.description}</p>
          <div className="hero-meta-row">
            <span className="hero-meta-pill">
              <span>{uiText.liveSync}</span>
              <strong>{statusLabel}</strong>
            </span>
            <span className="hero-meta-pill">
              <span>{uiText.activeFilters}</span>
              <strong>{activeFilterCount}</strong>
            </span>
            <span className="hero-meta-pill">
              <span>{uiText.topDept}</span>
              <strong>{topDepartment}</strong>
            </span>
          </div>
        </div>
        <div className="stats-grid hero-stats-grid">
          <div className="card stat-card stat-card-primary">
            <h3>{t.totalHours}</h3>
            <p className="stat-value primary">{totalHoursValue.toFixed(1)} h</p>
            <span className="stat-footnote">{uiText.periodRange}: {overviewTimeframeLabel}</span>
          </div>
          <div className="card stat-card stat-card-accent">
            <h3>{t.avgProject}</h3>
            <p className="stat-value accent">{avgProjectHoursValue.toFixed(1)} h</p>
            <span className="stat-footnote">{uiText.visibleProjects}: {dashAvailableProjects.length}</span>
          </div>
          <div className="card stat-card stat-card-soft">
            <h3>{t.dataPoints}</h3>
            <p className="stat-value success">{dataPointsValue}</p>
            <span className="stat-footnote">{uiText.visibleDepts}: {dashAvailableDepts.length}</span>
          </div>
        </div>
      </header>

      <div className="reporting-tab section-shell">
        <div className="reporting-top-bar">
          <div className="reporting-filters">
            <div className="filter-group">
              <label>{t.selectYear}</label>
              <select value={dashYear} onChange={e => { setDashYear(e.target.value); setDashMonth(''); setDashWeek(null); }}>
                <option value="">{t.allMonths}</option>
                {dashPeriodOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {dashYear && (
              <div className="filter-group">
                <label>{t.selectMonth}</label>
                <select value={dashMonth} onChange={e => { setDashMonth(e.target.value); setDashWeek(null); }}>
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
                <select
                  value={dashWeek ? (dashWeek.week_code || dashWeek.week || dashWeek) : ''}
                  onChange={e => {
                    const code = e.target.value;
                    if (!code) { setDashWeek(null); return; }
                    const ww = workWeeks.find(w => w.week_code === code);
                    setDashWeek(ww || { week: code, isIso: true });
                  }}
                >
                  <option value="">{t.allWeeks}</option>
                  {workWeeks.length > 0
                    ? workWeeks
                        .filter(w => w.work_month === `${dashYear}-${dashMonth}`)
                        .map(w => <option key={w.week_code} value={w.week_code}>{w.week_code}</option>)
                    : (dashPeriodOptions.weeksByMonth[`${dashYear}-${dashMonth}`] || []).map(w => (
                        <option key={w.week} value={w.week}>{w.label}</option>
                      ))
                  }
                </select>
              </div>
            )}

            <div className="filter-group granularity-filter">
              <label>{t.chartUnit}</label>
              <div className="granularity-toggle" role="tablist" aria-label={t.chartUnit}>
                <button
                  type="button"
                  className={!isDashGranularityLocked && dashGranularity === 'monthly' ? 'is-active' : ''}
                  onClick={() => setDashGranularity('monthly')}
                  disabled={isDashGranularityLocked}
                >
                  {t.period.monthly}
                </button>
                <button
                  type="button"
                  className={!isDashGranularityLocked && dashGranularity === 'quarterly' ? 'is-active' : ''}
                  onClick={() => setDashGranularity('quarterly')}
                  disabled={isDashGranularityLocked}
                >
                  {t.period.quarterly}
                </button>
              </div>
              {isDashGranularityLocked && <span className="granularity-hint">{t.autoWeekly}</span>}
            </div>

            <div className="filter-group dropdown-container">
              <label>{t.filterDept}</label>
              <button className="dropdown-button" onClick={() => { setDashDeptOpen(!dashDeptOpen); setDashProjOpen(false); }}>
                {dashSelectedDepts.size === 0 ? (t.allDepts || '全部部门') : `已选择 ${dashSelectedDepts.size} 项`}
                <ChevronDown size={16} />
              </button>
              {dashDeptOpen && (
                <>
                  <div className="dropdown-overlay" onClick={() => setDashDeptOpen(false)} />
                  <div className="approval-project-panel">
                    <div className="project-panel-header">
                      <span className="filter-group-label">{t.filterDept}</span>
                      <div className="project-panel-btns">
                        <button type="button" onClick={() => setDashSelectedDepts(new Set(dashAvailableDepts))}>{t.selectAll}</button>
                        <button type="button" onClick={() => setDashSelectedDepts(new Set())}>{t.clearAll}</button>
                      </div>
                    </div>
                    <div className="project-checkboxes">
                      {dashAvailableDepts.map(dept => (
                        <label key={dept} className={`project-chip ${dashSelectedDepts.has(dept) ? 'selected' : ''}`}>
                          <input type="checkbox" checked={dashSelectedDepts.has(dept)} onChange={() => toggleDashDept(dept)} />
                          <span className="chip-label">{dept}</span>
                        </label>
                      ))}
                      {dashAvailableDepts.length === 0 && <span className="text-muted empty-state-text">无可选部门</span>}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="filter-group dropdown-container">
              <label>{t.filterProject}</label>
              <button className="dropdown-button" onClick={() => { setDashProjOpen(!dashProjOpen); setDashDeptOpen(false); }}>
                {dashSelectedProjects.size === 0 ? (t.allProjects || '全部项目') : `已选择 ${dashSelectedProjects.size} 项`}
                <ChevronDown size={16} />
              </button>
              {dashProjOpen && (
                <>
                  <div className="dropdown-overlay" onClick={() => setDashProjOpen(false)} />
                  <div className="approval-project-panel">
                    <div className="project-panel-header">
                      <span className="filter-group-label">{t.filterProject}</span>
                      <div className="project-panel-btns">
                        <button type="button" onClick={() => setDashSelectedProjects(new Set(dashAvailableProjects))}>{t.selectAll}</button>
                        <button type="button" onClick={() => setDashSelectedProjects(new Set())}>{t.clearAll}</button>
                      </div>
                    </div>
                    <div className="project-checkboxes">
                      {dashAvailableProjects.map(proj => (
                        <label key={proj} className={`project-chip ${dashSelectedProjects.has(proj) ? 'selected' : ''}`}>
                          <input type="checkbox" checked={dashSelectedProjects.has(proj)} onChange={() => toggleDashProject(proj)} />
                          <span className="chip-label">{proj}</span>
                        </label>
                      ))}
                      {dashAvailableProjects.length === 0 && <span className="text-muted empty-state-text">无可选项目</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-grid layout-main">
          <div className="card chart-card full-width">
            <h2>{t.trendTitle}</h2>
            <div className="chart-container-large">
              <EChartsReact option={trendChartOpt} style={{ height: '380px', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge={true} />
            </div>
          </div>
          <div className="card chart-card full-width">
            <h2>{t.rankingTitle || '项目工时排名'}</h2>
            <div className="chart-container-large">
              <EChartsReact option={rankingChartOpt} style={{ height: '380px', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge={true} />
            </div>
          </div>
          <div className="card chart-card full-width heatmap-container">
            <h2>{t.heatmapTitle}</h2>
            <div className="chart-container-large heatmap-scroll-wrapper">
              <EChartsReact option={heatmapDataOpt} style={{ height: heatmapCalHeight, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge={true} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
