import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileDown,
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
import * as XLSX from 'xlsx';
import * as dataHelper from './utils/dataHelper';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');
const EDITORIAL_THEME = {
  graphite: '#162033',
  slate: '#4f6078',
  slateSoft: '#7687a5',
  mist: '#d7e0ef',
  paper: '#eaf0fb',
  cloud: '#ffffff',
  border: 'rgba(115, 138, 176, 0.18)',
  splitLine: 'rgba(128, 152, 188, 0.18)',
  accent: '#4d72ff',
  accentSoft: '#dce5ff',
  brass: '#ff8b4b',
  brassSoft: '#ffe3d4',
  sage: '#69a4ff',
  danger: '#eb6a5b',
  tooltipShadow: '0 20px 48px rgba(48, 70, 112, 0.16)',
  palette: ['#4d72ff', '#7aa6ff', '#ff8b4b', '#6fbfff', '#6b8dff', '#ffb36e']
};

const tooltipBase = {
  backgroundColor: EDITORIAL_THEME.cloud,
  borderColor: EDITORIAL_THEME.border,
  borderWidth: 1,
  padding: [12, 14],
  textStyle: {
    color: EDITORIAL_THEME.graphite,
    fontWeight: 600,
    fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif'
  },
  extraCssText: `box-shadow: ${EDITORIAL_THEME.tooltipShadow}; border-radius: 16px;`
};

const chartText = { color: EDITORIAL_THEME.slateSoft, fontWeight: 600 };
const chartAxis = { color: EDITORIAL_THEME.slateSoft, fontWeight: 500 };
const chartSplitLine = { lineStyle: { color: EDITORIAL_THEME.splitLine } };

const SCHEDULE_SERIES_COLORS = {
  planned: '#7aa6ff',
  actual: '#4d72ff',
  pending: '#ff8b4b'
};

const formatScheduleNumber = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const buildScheduleDeltaLabel = (value, lang) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  const prefix = numeric > 0 ? '+' : '';
  return lang === 'zh' ? `${prefix}${numeric}天` : `${prefix}${numeric}d`;
};

const buildIntervalLabel = (interval) => `${interval.from_milestone} -> ${interval.to_milestone}`;

const formatScheduleMonthLabel = (value) => {
  if (!value) return '--';
  const [year, month] = String(value).split('-');
  if (!year || !month) return value;
  const monthNumber = Number(month);
  if (Number.isNaN(monthNumber)) return value;
  return `${year}.${monthNumber}`;
};

const formatCompactScheduleDate = (value) => {
  if (!value) return '';
  const parsedValue = dayjs(value);
  if (!parsedValue.isValid()) return '';
  return dayjs(value).format('M.D');
};

const buildLegacyProjectScheduleChartOption = (project, lang, t) => {
  const milestones = project?.milestones || [];
  const intervals = project?.intervals || [];
  const allDates = milestones
    .flatMap(milestone => [milestone.planned_date, milestone.actual_date])
    .filter(Boolean)
    .map(value => dayjs(value));
  const minDate = (allDates.length ? dayjs(Math.min(...allDates.map(item => item.valueOf()))) : dayjs()).subtract(10, 'day');
  const maxDate = (allDates.length ? dayjs(Math.max(...allDates.map(item => item.valueOf()))) : dayjs()).add(10, 'day');
  const hasIntervalHours = intervals.some(interval => (interval.total_hours || 0) > 0);
  const intervalLabels = intervals.map(buildIntervalLabel);
  const departments = Array.from(
    new Set(
      intervals.flatMap(interval =>
        (interval.department_shares || []).map(share => share.department).filter(Boolean)
      )
    )
  );

  const plannedSeries = milestones
    .filter(milestone => milestone.planned_date)
    .map(milestone => ({
      value: [milestone.planned_date, milestone.name],
      milestone
    }));
  const actualSeries = milestones
    .filter(milestone => milestone.actual_date)
    .map(milestone => ({
      value: [milestone.actual_date, milestone.name],
      milestone,
      deltaLabel: buildScheduleDeltaLabel(milestone.delta_days, lang)
    }));
  const pendingSeries = milestones
    .filter(milestone => !milestone.actual_date)
    .map(milestone => ({
      value: [milestone.planned_date || maxDate.format('YYYY-MM-DD'), milestone.name],
      milestone
    }));

  const series = [
    {
      name: lang === 'zh' ? '计划时间' : 'Planned',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbolSize: 12,
      data: plannedSeries,
      itemStyle: {
        color: SCHEDULE_SERIES_COLORS.planned,
        borderColor: '#ffffff',
        borderWidth: 2
      },
      z: 3
    },
    {
      name: lang === 'zh' ? '实际时间' : 'Actual',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbolSize: 14,
      data: actualSeries,
      itemStyle: {
        color: SCHEDULE_SERIES_COLORS.actual,
        shadowBlur: 16,
        shadowColor: 'rgba(77, 114, 255, 0.26)'
      },
      label: {
        show: true,
        position: 'right',
        color: EDITORIAL_THEME.graphite,
        fontSize: 11,
        fontWeight: 700,
        formatter: ({ data }) => data.deltaLabel || ''
      },
      z: 4
    },
    {
      name: lang === 'zh' ? '未到达' : 'Pending',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbol: 'diamond',
      symbolSize: 12,
      data: pendingSeries,
      itemStyle: {
        color: EDITORIAL_THEME.cloud,
        borderColor: SCHEDULE_SERIES_COLORS.pending,
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'right',
        color: SCHEDULE_SERIES_COLORS.pending,
        fontSize: 11,
        fontWeight: 700,
        formatter: () => (lang === 'zh' ? '未到达' : 'Pending')
      },
      z: 3
    }
  ];

  departments.forEach((department, index) => {
    series.push({
      name: department,
      type: 'bar',
      stack: 'interval-share',
      xAxisIndex: 1,
      yAxisIndex: 1,
      barMaxWidth: 34,
      itemStyle: {
        color: EDITORIAL_THEME.palette[index % EDITORIAL_THEME.palette.length],
        borderRadius: [8, 8, 0, 0]
      },
      emphasis: { focus: 'series' },
      data: intervals.map(interval => {
        const share = (interval.department_shares || []).find(item => item.department === department);
        return share ? Number((share.share * 100).toFixed(2)) : 0;
      })
    });
  });

  return {
    color: EDITORIAL_THEME.palette,
    animationDuration: 450,
    legend: {
      type: 'scroll',
      bottom: 6,
      textStyle: chartText
    },
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      formatter: (params) => {
        if (params.seriesType === 'scatter') {
          const milestone = params.data?.milestone;
          if (!milestone) return '';
          const plannedDate = milestone.planned_date ? dayjs(milestone.planned_date).format('YYYY-MM-DD') : '--';
          const actualDate = milestone.actual_date ? dayjs(milestone.actual_date).format('YYYY-MM-DD') : (lang === 'zh' ? '未到达' : 'Pending');
          const deltaLabel = buildScheduleDeltaLabel(milestone.delta_days, lang) || '--';
          return `
            <div style="font-weight:800; margin-bottom:6px;">${milestone.name}</div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '计划' : 'Planned'}</span><strong>${plannedDate}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '实际' : 'Actual'}</span><strong>${actualDate}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '变化' : 'Delta'}</span><strong>${deltaLabel}</strong></div>
          `;
        }

        const interval = intervals[params.dataIndex];
        if (!interval) return '';
        const share = interval.department_shares?.find(item => item.department === params.seriesName);
        return `
          <div style="font-weight:800; margin-bottom:6px;">${buildIntervalLabel(interval)}</div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '部门' : 'Department'}</span><strong>${params.seriesName}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '工时' : 'Hours'}</span><strong>${formatScheduleNumber(share?.hours ?? 0)}h</strong></div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '占比' : 'Share'}</span><strong>${formatScheduleNumber(params.value)}%</strong></div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '区间总工时' : 'Interval Total'}</span><strong>${formatScheduleNumber(interval.total_hours)}h</strong></div>
        `;
      }
    },
    grid: [
      { left: 124, right: 28, top: 36, height: 250 },
      { left: 92, right: 28, top: 372, height: 188 }
    ],
    xAxis: [
      {
        type: 'time',
        min: minDate.format('YYYY-MM-DD'),
        max: maxDate.format('YYYY-MM-DD'),
        axisLabel: {
          ...chartAxis,
          formatter: value => dayjs(value).format('MM-DD')
        },
        splitLine: chartSplitLine
      },
      {
        type: 'category',
        data: intervalLabels,
        axisLabel: {
          ...chartAxis,
          interval: 0,
          fontSize: 11,
          formatter: value => (value.length > 18 ? `${value.slice(0, 18)}...` : value)
        },
        splitLine: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'category',
        data: milestones.map(milestone => milestone.name),
        inverse: true,
        axisLabel: {
          ...chartAxis,
          fontSize: 11,
          width: 96,
          overflow: 'truncate'
        },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          ...chartAxis,
          formatter: value => `${value}%`
        },
        splitLine: chartSplitLine
      }
    ],
    series,
    graphic: [
      {
        type: 'text',
        left: 20,
        top: 10,
        style: {
          text: t.milestoneTimeline,
          fill: EDITORIAL_THEME.graphite,
          font: '700 13px "IBM Plex Sans", "Noto Sans SC", sans-serif'
        }
      },
      {
        type: 'text',
        left: 20,
        top: 344,
        style: {
          text: t.intervalShare,
          fill: EDITORIAL_THEME.graphite,
          font: '700 13px "IBM Plex Sans", "Noto Sans SC", sans-serif'
        }
      },
      ...(!hasIntervalHours ? [{
        type: 'text',
        left: 'center',
        top: 458,
        style: {
          text: t.intervalNoHours,
          fill: EDITORIAL_THEME.slateSoft,
          font: '600 12px "IBM Plex Sans", "Noto Sans SC", sans-serif',
          textAlign: 'center'
        }
      }] : [])
    ]
  };
};

const buildScheduleMonthScale = (dateValues) => {
  const validDates = dateValues
    .filter(Boolean)
    .map(value => dayjs(value))
    .filter(value => value.isValid());
  const fallbackDate = dayjs();
  const initialDate = validDates[0] || fallbackDate;
  const startMonth = initialDate.startOf('month');
  const endMonth = validDates.reduce(
    (latest, current) => (current.isAfter(latest) ? current : latest),
    initialDate
  ).startOf('month');
  const monthStarts = [];
  let cursor = startMonth;

  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    monthStarts.push(cursor);
    cursor = cursor.add(1, 'month');
  }

  const monthIndexMap = new Map(
    monthStarts.map((monthStart, index) => [monthStart.format('YYYY-MM'), index])
  );

  return {
    monthLabels: monthStarts.map(monthStart => monthStart.format('YYYY-MM')),
    min: -0.5,
    max: Math.max(monthStarts.length - 0.5, 0.5),
    toAxisValue: (value) => {
      if (!value) return null;
      const date = dayjs(value);
      if (!date.isValid()) return null;
      const monthIndex = monthIndexMap.get(date.format('YYYY-MM'));
      if (monthIndex === undefined) return null;
      const dayFraction = (date.date() - 0.5) / date.daysInMonth();
      return monthIndex - 0.5 + Math.min(Math.max(dayFraction, 0), 1);
    }
  };
};

const buildProjectScheduleChartOption = (project, lang, t, timesheetEntries = []) => {
  const milestones = project?.milestones || [];
  const mappedProjects = project?.mapped_timesheet_projects || [];
  const scheduleProjectEntries = timesheetEntries.filter(entry => mappedProjects.includes(entry.project_name));
  const monthlyHours = dataHelper.aggregateProjectDeptData(scheduleProjectEntries, 'monthly');
  const monthScale = buildScheduleMonthScale([
    ...milestones.flatMap(milestone => [milestone.planned_date, milestone.actual_date]),
    ...monthlyHours.labels.map(label => `${label}-01`)
  ]);
  const hasMonthlyHours = monthlyHours.series.some(series =>
    series.data.some(value => Number(value || 0) > 0)
  );
  const monthlySeriesMaps = new Map(
    monthlyHours.series.map(series => [
      series.name,
      new Map(monthlyHours.labels.map((label, index) => [label, Number(series.data[index] || 0)]))
    ])
  );
  const departmentTotals = new Map(
    monthlyHours.departments.map(department => [
      department,
      monthScale.monthLabels.reduce(
        (sum, label) => sum + Number(monthlySeriesMaps.get(department)?.get(label) || 0),
        0
      )
    ])
  );
  const departments = [...monthlyHours.departments].sort(
    (a, b) => (departmentTotals.get(b) || 0) - (departmentTotals.get(a) || 0) || a.localeCompare(b)
  );
  const monthlyTotalsByLabel = new Map(
    monthScale.monthLabels.map(label => [
      label,
      departments.reduce(
        (sum, department) => sum + Number(monthlySeriesMaps.get(department)?.get(label) || 0),
        0
      )
    ])
  );
  const milestoneProgressData = milestones.map((milestone, index) => {
    const plannedValue = monthScale.toAxisValue(milestone.planned_date);
    const actualValue = monthScale.toAxisValue(milestone.actual_date);
    const anchorValue = plannedValue ?? actualValue ?? Math.max(monthScale.min + 0.16, monthScale.max - 0.16);
    const pendingValue = actualValue ?? Math.min(monthScale.max - 0.08, anchorValue + 0.18);

    return {
      value: [plannedValue ?? anchorValue, actualValue ?? pendingValue, index],
      milestone,
      actualDateLabel: formatCompactScheduleDate(milestone.actual_date),
      deltaLabel: buildScheduleDeltaLabel(milestone.delta_days, lang),
      hasPlannedDate: Boolean(milestone.planned_date),
      hasActualDate: Boolean(milestone.actual_date),
      pendingLabel: lang === 'zh' ? '未到达' : 'Pending'
    };
  });

  const series = [
    ...departments.map((department, index) => ({
      name: department,
      type: 'bar',
      stack: 'monthly-hours',
      xAxisIndex: 0,
      yAxisIndex: 0,
      barMaxWidth: 28,
      itemStyle: {
        color: EDITORIAL_THEME.palette[index % EDITORIAL_THEME.palette.length],
        borderRadius: [8, 8, 0, 0]
      },
      emphasis: { focus: 'series' },
      data: monthScale.monthLabels.map((label, idx) => {
        const midMonthDate = `${label}-15`;
        const xCoord = monthScale.toAxisValue(midMonthDate);
        return [
          xCoord !== null ? xCoord : idx,
          Number((monthlySeriesMaps.get(department)?.get(label) || 0).toFixed(1))
        ];
      })
    })),
    {
      name: t.milestoneProgress,
      type: 'custom',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: milestoneProgressData,
      renderItem: (params, api) => {
        const item = milestoneProgressData[params.dataIndex];
        const rowIndex = api.value(2);
        const rowCoord = api.coord([monthScale.min, rowIndex]);
        const plannedCoord = item.hasPlannedDate ? api.coord([api.value(0), rowIndex]) : null;
        const actualCoord = item.hasActualDate ? api.coord([api.value(1), rowIndex]) : null;
        const pendingCoord = !item.hasActualDate ? api.coord([api.value(1), rowIndex]) : null;
        const trackStartX = plannedCoord?.[0] ?? actualCoord?.[0] ?? pendingCoord?.[0] ?? rowCoord[0];
        const trackEndX = actualCoord?.[0] ?? pendingCoord?.[0] ?? trackStartX;
        const left = Math.min(trackStartX, trackEndX);
        const right = Math.max(trackStartX, trackEndX);
        const trackHeight = Math.max(7, Math.min(12, api.size([0, 1])[1] * 0.26));
        const trackWidth = Math.max(right - left, item.hasActualDate ? 4 : 16);
        const y = rowCoord[1] - trackHeight / 2;
        const lineHeight = Math.max(12, Math.min(22, api.size([0, 1])[1] * 0.64));
        const lineTop = rowCoord[1] - lineHeight / 2;
        const lineBottom = rowCoord[1] + lineHeight / 2;
        const labelText = item.hasActualDate ? item.actualDateLabel : item.pendingLabel;
        const labelX = (actualCoord?.[0] ?? pendingCoord?.[0] ?? right) + 7;

        return {
          type: 'group',
          children: [
            {
              type: 'rect',
              shape: {
                x: left,
                y,
                width: trackWidth,
                height: trackHeight,
                r: trackHeight / 2
              },
              style: {
                fill: item.hasActualDate ? 'rgba(140, 156, 184, 0.12)' : 'rgba(255, 139, 75, 0.08)',
                stroke: item.hasActualDate ? 'rgba(126, 145, 175, 0.26)' : 'rgba(255, 139, 75, 0.34)',
                lineWidth: 1,
                lineDash: item.hasActualDate ? undefined : [4, 3]
              }
            },
            ...(plannedCoord ? [{
              type: 'line',
              shape: {
                x1: plannedCoord[0],
                y1: lineTop,
                x2: plannedCoord[0],
                y2: lineBottom
              },
              style: {
                stroke: SCHEDULE_SERIES_COLORS.planned,
                lineWidth: 2,
                opacity: 0.92
              }
            }] : []),
            ...(actualCoord ? [{
              type: 'line',
              shape: {
                x1: actualCoord[0],
                y1: lineTop - 1,
                x2: actualCoord[0],
                y2: lineBottom + 1
              },
              style: {
                stroke: SCHEDULE_SERIES_COLORS.actual,
                lineWidth: 3,
                shadowBlur: 10,
                shadowColor: 'rgba(77, 114, 255, 0.22)'
              }
            }] : pendingCoord ? [{
              type: 'line',
              shape: {
                x1: pendingCoord[0],
                y1: lineTop,
                x2: pendingCoord[0],
                y2: lineBottom
              },
              style: {
                stroke: SCHEDULE_SERIES_COLORS.pending,
                lineWidth: 2,
                lineDash: [4, 3],
                opacity: 0.92
              }
            }] : []),
            ...(labelText ? [{
              type: 'text',
              style: {
                x: labelX,
                y: rowCoord[1] - 6,
                text: labelText,
                fill: item.hasActualDate ? SCHEDULE_SERIES_COLORS.actual : SCHEDULE_SERIES_COLORS.pending,
                font: '700 10px "IBM Plex Sans", "Noto Sans SC", sans-serif'
              }
            }] : [])
          ]
        };
      }
    }
  ];

  return {
    color: EDITORIAL_THEME.palette,
    animationDuration: 450,
    legend: {
      show: hasMonthlyHours,
      data: departments,
      type: 'scroll',
      top: 290,
      left: 'center',
      right: 'auto',
      bottom: 'auto',
      itemGap: 14,
      textStyle: chartText
    },
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      formatter: (params) => {
        if (params.seriesType === 'custom') {
          const milestone = params.data?.milestone;
          if (!milestone) return '';
          const plannedDate = milestone.planned_date ? dayjs(milestone.planned_date).format('YYYY-MM-DD') : '--';
          const actualDate = milestone.actual_date ? dayjs(milestone.actual_date).format('YYYY-MM-DD') : (lang === 'zh' ? '未到达' : 'Pending');
          const deltaLabel = buildScheduleDeltaLabel(milestone.delta_days, lang) || '--';
          return `
            <div style="font-weight:800; margin-bottom:6px;">${milestone.name}</div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '计划' : 'Planned'}</span><strong>${plannedDate}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '实际' : 'Actual'}</span><strong>${actualDate}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '变化' : 'Delta'}</span><strong>${deltaLabel}</strong></div>
          `;
        }

        const monthLabelKey = params.name || params.axisValue || '--';
        const monthLabel = formatScheduleMonthLabel(monthLabelKey);
        return `
          <div style="font-weight:800; margin-bottom:6px;">${monthLabel}</div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '部门' : 'Department'}</span><strong>${params.seriesName}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '工时' : 'Hours'}</span><strong>${formatScheduleNumber(params.value)}h</strong></div>
          <div style="display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '月度总工时' : 'Monthly Total'}</span><strong>${formatScheduleNumber(monthlyTotalsByLabel.get(monthLabelKey) || 0)}h</strong></div>
        `;
      }
    },
    grid: [
      { left: 110, right: 132, top: 40, height: 260 },
      { left: 110, right: 132, top: 326, height: 240 }
    ],
    xAxis: [
      {
        gridIndex: 0,
        type: 'value',
        position: 'top',
        min: monthScale.min,
        max: monthScale.max,
        interval: 1,
        axisLabel: {
          ...chartAxis,
          fontSize: 10.5,
          formatter: (value) => {
            const index = Math.round(value + 0.5);
            return formatScheduleMonthLabel(monthScale.monthLabels[index] || '');
          }
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: EDITORIAL_THEME.border } },
        splitLine: chartSplitLine
      },
      {
        gridIndex: 1,
        type: 'value',
        min: monthScale.min,
        max: monthScale.max,
        interval: 1,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false }
      }
    ],
    yAxis: [
      {
        gridIndex: 0,
        type: 'value',
        min: 0,
        axisLabel: {
          ...chartAxis,
          formatter: value => `${value}h`
        },
        splitLine: chartSplitLine
      },
      {
        gridIndex: 1,
        type: 'category',
        position: 'right',
        data: milestones.map(milestone => milestone.name),
        inverse: true,
        axisLabel: {
          ...chartAxis,
          fontSize: 9,
          width: 92,
          overflow: 'truncate'
        },
        axisTick: { show: false },
        axisLine: { show: false }
      }
    ],
    series,
    graphic: [
      {
        type: 'text',
        left: 20,
        top: 10,
        style: {
          text: t.monthlyHours,
          fill: EDITORIAL_THEME.graphite,
          font: '700 13px "IBM Plex Sans", "Noto Sans SC", sans-serif'
        }
      },
      ...(!hasMonthlyHours ? [{
        type: 'text',
        left: 'center',
        top: 168,
        style: {
          text: t.scheduleHoursEmpty,
          fill: EDITORIAL_THEME.slateSoft,
          font: '600 12px "IBM Plex Sans", "Noto Sans SC", sans-serif',
          textAlign: 'center'
        }
      }] : [])
    ]
  };
};

const App = () => {
  const isEmbed = useMemo(() => new URLSearchParams(window.location.search).get('embed') === 'true', []);
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  // Global dashboard filters
  const [dashYear, setDashYear] = useState('');
  const [dashMonth, setDashMonth] = useState('');
  const [dashWeek, setDashWeek] = useState('');
  const [dashGranularity, setDashGranularity] = useState('monthly');
  const [dashSelectedDepts, setDashSelectedDepts] = useState(new Set());
  const [dashSelectedProjects, setDashSelectedProjects] = useState(new Set());
  const [dashDeptOpen, setDashDeptOpen] = useState(false);
  const [dashProjOpen, setDashProjOpen] = useState(false);
  const [appProjOpen, setAppProjOpen] = useState(false);
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
  const [projectScheduleData, setProjectScheduleData] = useState({ projects: [] });
  const [scheduleSelectedProjects, setScheduleSelectedProjects] = useState(new Set());
  const [scheduleProjectPickerOpen, setScheduleProjectPickerOpen] = useState(false);
  const scheduleProjectPickerRef = useRef(null);

  const t = {
    zh: {
      dashboard: '仪表盘', stats: '统计分析', activity: '活跃度',
      reporting: '完整填报率', approval: '审批完成率',
      title: '仪表盘', subtitle: '实时的工时统计与分析', sync: '同步数据', filters: '筛选',
      reportingTitle: '完整填报率', reportingSubtitle: '筛选工时填报差异信息',
      approvalTitle: '审批完成率', approvalSubtitle: '统计待审批工时信息',
      period: { weekly: '周统计', monthly: '月统计', quarterly: '季度统计' },
      totalHours: '总工时', avgProject: '项目平均', dataPoints: '数据点',
      trendTitle: '工时走势', distTitle: '项目分布', heatmapTitle: '活跃热力图',
      upload: '上传 Excel', backend: '后台连接', connected: '已连接', disconnected: '未连接', checking: '检查中...',
      success: '成功！已处理', uploadFailed: '上传失败', none: '全体',
      targetHours: '应填报工时', perPeriod: 'h / 周期',
      dept: '部门', employee: '员工', actual: '实际工时', gap: '差额', period_key: '周期',
      export: '导出 Excel', noIssues: '所有部门填报正常，未发现差异。',
      deficit: '不足', excess: '超出',
      selectYear: '选择年度', selectMonth: '选择月份', selectWeek: '选择周（可选）',
      chartUnit: '图表单位', autoWeekly: '当前按周',
      allMonths: '全年', allWeeks: '全月',
      filterDept: '选择部门（可多选）', allDepts: '全部部门',
      pleaseSelectYear: '请先选择年度',
      pendingApprover: '未操作者', pendingCount: '待审条数', pendingHours: '待审工时',
      noApprovalIssues: '当前筛选周期内没有待审批工时。',
      filterProject: '筛选项目（可多选）', filterApprover: '筛选未操作者',
      allApprovers: '全部人员', selectAll: '全选', clearAll: '清空',
      rankingTitle: '项目工时排名', avgMonthlyHours: '月均工时',
      projectAnalysis: '项目工时分析', deptContribution: '部门工时占比',
      selectProjects: '选择分析项目（可多选）',
      legacyContributionTitle: '原有部门工时占比',
      legacyContributionSubtitle: '保留旧图作为对照，默认折叠',
      scheduleMonitorTitle: '项目节点进度监控',
      scheduleMonitorSubtitle: '展示计划与实际节点，以及区间部门工时占比',
      uploadProjectSchedule: '上传项目进度 Excel',
      scheduleUploadSuccess: '项目进度已上传，已处理',
      allScheduleProjects: '全部项目',
      mappedProjects: '工时映射',
      projectStatus: '状态',
      plannedCycle: '计划周期',
      actualCycle: '实际周期',
      deltaCycle: '变化天数',
      scheduleLegendPlanned: '计划日期',
      scheduleLegendActual: '实际日期',
      scheduleLegendPending: '未到达',
      showChart: '展开图表',
      hideChart: '收起图表',
      noScheduleData: '暂无项目进度数据，请先上传项目进度 Excel',
      milestoneTimeline: '节点计划 / 实际时间线',
      intervalShare: '节点区间部门工时占比',
      intervalNoHours: '当前可用区间内暂时没有 Close 工时',
      filterScheduleProjects: '选择项目（可多选）'
    },
    en: {
      dashboard: 'Dashboard', stats: 'Statistics', activity: 'Activity',
      reporting: 'Reporting Rate', approval: 'Approval Rate',
      title: 'Timesheet Insights', subtitle: 'Real-time statistics and analysis', sync: 'Sync Data', filters: 'Filters:',
      reportingTitle: 'Reporting Rate', reportingSubtitle: 'Filter timesheet reporting discrepancy information',
      approvalTitle: 'Approval Completion Rate', approvalSubtitle: 'View pending approval timesheet entries',
      period: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' },
      totalHours: 'Total Hours', avgProject: 'Avg. per Project', dataPoints: 'Data Points',
      trendTitle: 'Hours Trend', distTitle: 'Project Distribution', heatmapTitle: 'Activity Heatmap',
      upload: 'Upload Excel', backend: 'Backend', connected: 'Connected', disconnected: 'Disconnected', checking: 'Checking...',
      success: 'Success! Processed', uploadFailed: 'Upload failed', none: 'All',
      targetHours: 'Target Hours', perPeriod: 'h / Period',
      dept: 'Dept', employee: 'Employee', actual: 'Actual', gap: 'Gap', period_key: 'Period',
      export: 'Export Excel', noIssues: 'All departments are reporting correctly. No issues found.',
      deficit: 'Deficit', excess: 'Excess',
      selectYear: 'Select Year', selectMonth: 'Select Month', selectWeek: 'Select Week (optional)',
      chartUnit: 'Chart Unit', autoWeekly: 'Auto Weekly',
      allMonths: 'All Months', allWeeks: 'All Weeks',
      filterDept: 'Filter Departments', allDepts: 'All Depts',
      pleaseSelectYear: 'Please select a year first',
      pendingApprover: 'Pending Approver', pendingCount: 'Pending Count', pendingHours: 'Pending Hours',
      noApprovalIssues: 'No pending approvals in the selected period.',
      filterProject: 'Filter Projects (multi-select)', filterApprover: 'Filter Approver',
      allApprovers: 'All Approvers', selectAll: 'All', clearAll: 'Clear',
      rankingTitle: 'Project Hours Ranking', avgMonthlyHours: 'Avg. Monthly Hours',
      projectAnalysis: 'Project Analysis', deptContribution: 'Dept. Contribution',
      selectProjects: 'Select Projects',
      legacyContributionTitle: 'Legacy Dept. Contribution',
      legacyContributionSubtitle: 'Keep the original contribution chart available as a collapsed reference.',
      scheduleMonitorTitle: 'Project Schedule Monitor',
      scheduleMonitorSubtitle: 'View monthly department hours with milestone progress bars in one chart.',
      uploadProjectSchedule: 'Upload Project Schedule Excel',
      scheduleUploadSuccess: 'Project schedule uploaded.',
      allScheduleProjects: 'All Schedule Projects',
      mappedProjects: 'Mapped Timesheet Projects',
      projectStatus: 'Status',
      plannedCycle: 'Planned Cycle',
      actualCycle: 'Actual Cycle',
      deltaCycle: 'Delta Days',
      scheduleLegendPlanned: 'Planned',
      scheduleLegendActual: 'Actual',
      scheduleLegendPending: 'Pending',
      showChart: 'Show Chart',
      hideChart: 'Hide Chart',
      noScheduleData: 'No project schedule data yet. Upload the project schedule Excel first.',
      monthlyHours: 'Monthly Department Hours',
      milestoneProgress: 'Milestone Progress',
      scheduleHoursEmpty: 'No Close hours are available for the current project yet.',
      milestoneTimeline: 'Milestone Planned / Actual Timeline',
      intervalShare: 'Department Share by Milestone Interval',
      intervalNoHours: 'No Close hours are available in the current milestone intervals.',
      filterScheduleProjects: 'Select Projects (multi-select)'
    }
  }[lang];

  t.scheduleMonitorSubtitle = lang === 'zh'
    ? '月度部门工时与项目节点进度条联动展示'
    : 'View monthly department hours with milestone progress bars in one chart.';
  t.monthlyHours = lang === 'zh' ? '月度部门工时' : 'Monthly Department Hours';
  t.milestoneProgress = lang === 'zh' ? '项目节点进度' : 'Milestone Progress';
  t.scheduleHoursEmpty = lang === 'zh'
    ? '当前项目暂时没有 Close 工时'
    : 'No Close hours are available for the current project yet.';

  const uiText = {
    zh: {
      workspace: '工时智能工作台',
      currentView: '当前视图',
      activeFilters: '已启用筛选',
      visibleProjects: '可见项目',
      visibleDepts: '可见部门',
      topDept: '最高工时部门',
      periodRange: '周期范围',
      deptGroups: '部门分组',
      liveSync: '在线同步',
      allPeriods: '全部周期'
    },
    en: {
      workspace: 'Time Intelligence Workspace',
      currentView: 'Current View',
      activeFilters: 'Active Filters',
      visibleProjects: 'Visible Projects',
      visibleDepts: 'Visible Depts',
      topDept: 'Top Hours Dept',
      periodRange: 'Period Range',
      deptGroups: 'Dept Groups',
      liveSync: 'Live Sync',
      allPeriods: 'All Periods'
    }
  }[lang];

  const pageMeta = useMemo(() => {
    const metaByTab = {
      overview: {
        eyebrow: t.dashboard,
        title: t.title,
        description: t.subtitle
      },
      project_analysis: {
        eyebrow: t.projectAnalysis,
        title: t.scheduleMonitorTitle,
        description: t.scheduleMonitorSubtitle
      },
      reporting: {
        eyebrow: t.reporting,
        title: t.reportingTitle,
        description: t.reportingSubtitle
      },
      approval: {
        eyebrow: t.approval,
        title: t.approvalTitle,
        description: t.approvalSubtitle
      }
    };
    return metaByTab[activeTab] || metaByTab.overview;
  }, [
    activeTab,
    t.approval,
    t.approvalSubtitle,
    t.approvalTitle,
    t.dashboard,
    t.deptContribution,
    t.projectAnalysis,
    t.reporting,
    t.reportingSubtitle,
    t.reportingTitle,
    t.scheduleMonitorSubtitle,
    t.scheduleMonitorTitle,
    t.selectProjects,
    t.subtitle,
    t.title
  ]);

  const navItems = useMemo(() => ([
    { id: 'overview', label: t.dashboard, icon: LayoutDashboard },
    { id: 'project_analysis', label: t.projectAnalysis, icon: BarChart3 },
    { id: 'reporting', label: t.reporting, icon: ClipboardCheck },
    { id: 'approval', label: t.approval, icon: CheckCircle2 }
  ]), [t.approval, t.dashboard, t.projectAnalysis, t.reporting]);

  const statusLabel = status === 'connected' ? t.connected : status === 'error' ? t.disconnected : t.checking;

  const checkConnection = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ping`);
      if (res.ok) setStatus('connected');
      else setStatus('error');
    } catch {
      // ignore
    }
  };

  const fetchReportingData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reporting-rate`);
      if (!res.ok) return;
      const json = await res.json();
      setReportingData(json);
    } catch (err) {
      console.error('Failed to fetch reporting data:', err);
    }
  }, []);

  const fetchApprovalData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/approval-rate`);
      if (!res.ok) return;
      const json = await res.json();
      setApprovalData(json);
    } catch (err) {
      console.error('Failed to fetch approval data:', err);
    }
  }, []);

  const fetchProjectScheduleData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/project-schedule-analysis`);
      if (!res.ok) return;
      const json = await res.json();
      setProjectScheduleData(json);
    } catch (err) {
      console.error('Failed to fetch project schedule data:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // setLoading(true); // Temporarily removing loading to clear lint warning, or keep it but use it in UI.
      const res = await fetch(`${API_BASE_URL}/stats`);
      if (!res.ok) throw new Error('Backend responded with error');
      const json = await res.json();
      setData(json);
      setStatus('connected');
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    checkConnection();
    fetchData();
    fetchReportingData();
    fetchApprovalData();
    fetchProjectScheduleData();
    const interval = setInterval(() => {
        checkConnection();
        // optionally refresh data periodically, but checking connection is enough
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchReportingData, fetchApprovalData, fetchProjectScheduleData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      alert(`${t.success} ${result.rows_processed} rows.`);
      fetchData();
      fetchReportingData();
      fetchApprovalData();
      fetchProjectScheduleData();
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleProjectScheduleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload-project-schedule`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      alert(`${t.scheduleUploadSuccess} ${result.projects_processed} / ${result.milestones_processed}`);
      fetchProjectScheduleData();
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    const scheduleProjects = projectScheduleData.projects || [];
    if (scheduleProjects.length === 0) {
      setScheduleSelectedProjects(new Set());
      return;
    }

    setScheduleSelectedProjects(prev => {
      if (prev.size === 0) {
        return new Set([scheduleProjects[0].project_name]);
      }
      const validSelections = scheduleProjects
        .map(project => project.project_name)
        .filter(projectName => prev.has(projectName));
      return validSelections.length > 0 ? new Set(validSelections) : new Set([scheduleProjects[0].project_name]);
    });
  }, [projectScheduleData]);

  useEffect(() => {
    if (!scheduleProjectPickerOpen) return undefined;

    const handleSchedulePickerPointerDown = (event) => {
      if (scheduleProjectPickerRef.current?.contains(event.target)) return;
      setScheduleProjectPickerOpen(false);
    };

    document.addEventListener('pointerdown', handleSchedulePickerPointerDown);
    return () => document.removeEventListener('pointerdown', handleSchedulePickerPointerDown);
  }, [scheduleProjectPickerOpen]);

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

  // Toggle a project in the multi-select set (for approval)
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
    // Fast path: no filters active
    if (!dashYear && !dashMonth && !dashWeek && dashSelectedDepts.size === 0 && dashSelectedProjects.size === 0) return data;

    return data.filter(item => {
      // Time filters — only parse date when a time filter is actually set
      if (dashYear || dashMonth || dashWeek) {
        if (!item.start_date) return false;
        const itemDate = dayjs(item.start_date);
        if (dashYear && itemDate.year().toString() !== dashYear) return false;
        if (dashMonth && (itemDate.month() + 1).toString().padStart(2, '0') !== dashMonth) return false;
        if (dashWeek && itemDate.isoWeek().toString().padStart(2, '0') !== dashWeek) return false;
      }
      // Dept & Project multi-select
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      if (dashSelectedProjects.size > 0 && !dashSelectedProjects.has(item.project_name)) return false;
      return true;
    });
  }, [data, dashYear, dashMonth, dashWeek, dashSelectedDepts, dashSelectedProjects]);

  const dashAvailableDepts = useMemo(() => {
    // Fast path: no time filter — just grab all distinct depts without dayjs
    if (!dashYear && !dashMonth && !dashWeek)
      return Array.from(new Set(data.map(i => i.department).filter(Boolean))).sort();

    const timeFiltered = data.filter(item => {
      if (!item.start_date) return false;
      const d = dayjs(item.start_date);
      if (dashYear && d.year().toString() !== dashYear) return false;
      if (dashMonth && (d.month() + 1).toString().padStart(2, '0') !== dashMonth) return false;
      if (dashWeek && d.isoWeek().toString().padStart(2, '0') !== dashWeek) return false;
      return true;
    });
    return Array.from(new Set(timeFiltered.map(i => i.department).filter(Boolean))).sort();
  }, [data, dashYear, dashMonth, dashWeek]);

  const dashAvailableProjects = useMemo(() => {
    // Fast path: no time or dept filters
    if (!dashYear && !dashMonth && !dashWeek && dashSelectedDepts.size === 0)
      return Array.from(new Set(data.map(i => i.project_name).filter(Boolean))).sort();

    const preFiltered = data.filter(item => {
      if (dashYear || dashMonth || dashWeek) {
        if (!item.start_date) return false;
        const d = dayjs(item.start_date);
        if (dashYear && d.year().toString() !== dashYear) return false;
        if (dashMonth && (d.month() + 1).toString().padStart(2, '0') !== dashMonth) return false;
        if (dashWeek && d.isoWeek().toString().padStart(2, '0') !== dashWeek) return false;
      }
      if (dashSelectedDepts.size > 0 && !dashSelectedDepts.has(item.department)) return false;
      return true;
    });
    return Array.from(new Set(preFiltered.map(i => i.project_name).filter(Boolean))).sort();
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

  const totalHoursValue = useMemo(() =>
    filteredData.reduce((sum, entry) => sum + entry.hours, 0),
    [filteredData]
  );

  const avgProjectHoursValue = useMemo(() => (
    totalHoursValue / (dashAvailableProjects.length || 1)
  ), [dashAvailableProjects.length, totalHoursValue]);

  const dataPointsValue = filteredData.length;

  const activeFilterCount = useMemo(() => (
    [dashYear, dashMonth, dashWeek].filter(Boolean).length +
    (dashSelectedDepts.size > 0 ? 1 : 0) +
    (dashSelectedProjects.size > 0 ? 1 : 0)
  ), [dashMonth, dashSelectedDepts.size, dashSelectedProjects.size, dashWeek, dashYear]);

  const overviewTimeframeLabel = useMemo(() => {
    if (dashYear && dashMonth && dashWeek) return `${dashYear}-${dashMonth} / W${dashWeek}`;
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

  const reportingDeptCount = Object.keys(reportingByDept).length;
  const approvalPendingCount = useMemo(() => approvalRecords.reduce((sum, row) => sum + row.count, 0), [approvalRecords]);
  const approvalPendingHours = useMemo(() => approvalRecords.reduce((sum, row) => sum + row.total_hours, 0), [approvalRecords]);

  const pageHighlights = useMemo(() => {
    if (activeTab === 'overview' || activeTab === 'project_analysis') {
      return [
        { label: uiText.periodRange, value: overviewTimeframeLabel },
        { label: uiText.visibleDepts, value: dashAvailableDepts.length },
        { label: uiText.visibleProjects, value: dashAvailableProjects.length }
      ];
    }

    if (activeTab === 'reporting') {
      return [
        { label: t.targetHours, value: `${targetHours}h` },
        { label: uiText.deptGroups, value: reportingDeptCount },
        { label: uiText.periodRange, value: filterWeek || filterMonth || filterYear || uiText.allPeriods }
      ];
    }

    return [
      { label: t.pendingCount, value: approvalPendingCount },
      { label: t.pendingHours, value: `${approvalPendingHours.toFixed(1)}h` },
      { label: uiText.periodRange, value: approvalMonth || approvalYear || uiText.allPeriods }
    ];
  }, [
    activeTab,
    approvalMonth,
    approvalPendingCount,
    approvalPendingHours,
    approvalYear,
    dashAvailableDepts.length,
    dashAvailableProjects.length,
    filterMonth,
    filterWeek,
    filterYear,
    overviewTimeframeLabel,
    reportingDeptCount,
    t.pendingCount,
    t.pendingHours,
    t.targetHours,
    targetHours,
    uiText.allPeriods,
    uiText.deptGroups,
    uiText.periodRange,
    uiText.visibleDepts,
    uiText.visibleProjects
  ]);

  const scheduleProjects = projectScheduleData.projects || [];

  const visibleScheduleProjects = useMemo(
    () => scheduleProjects.filter(project => scheduleSelectedProjects.has(project.project_name)),
    [scheduleProjects, scheduleSelectedProjects]
  );

  const scheduleChartOptions = useMemo(() => {
    const chartMap = new Map();
    scheduleProjects.forEach(project => {
      chartMap.set(project.project_name, buildProjectScheduleChartOption(project, lang, t, data));
    });
    return chartMap;
  }, [data, lang, scheduleProjects, t]);

  const toggleScheduleProject = (projectName) => {
    setScheduleSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectName)) {
        next.delete(projectName);
      } else {
        next.add(projectName);
      }
      return next;
    });
  };

  const trendChartOpt = useMemo(() => {
    const agg = dataHelper.aggregateProjectData(filteredData, effectiveDashGranularity);
    // The structure of `agg` from dataHelper.aggregateProjectData is expected to be:
    // { projects: [...], labels: [...], series: [...] }
    // The instruction provided `const projNames = Object.keys(agg); const periods = Array.from(new Set(projNames.flatMap(p => Object.keys(agg[p])))).sort();`
    // which suggests a different `agg` structure. Assuming the original `agg` structure is correct for ECharts.
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
  }, [effectiveDashGranularity, filteredData]);

  const rankingChartOpt = useMemo(() => {
    const grouped = dataHelper.groupByField(filteredData, 'project_name');
    const sorted = grouped.sort((a, b) => b.value - a.value).slice(0, 30);
    const topProjNames = new Set(sorted.map(i => i.name));

    // Calculate monthly average for these projects
    const projMonthlyData = {}; // { projName: Set of months }
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
        axisLabel: { 
          ...chartAxis,
          rotate: sorted.length > 5 ? 30 : 0,
          interval: 0
        }
      },
      yAxis: [
        { 
          type: 'value', 
          name: t.totalHours,
          axisLabel: chartAxis,
          splitLine: chartSplitLine
        },
        {
          type: 'value',
          name: t.avgMonthlyHours,
          axisLabel: { ...chartAxis, color: EDITORIAL_THEME.brass },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: t.totalHours,
          type: 'bar',
          data: sorted.map(i => i.value),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: EDITORIAL_THEME.accent
          },
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

  return (
    <div className={`app-shell ${isEmbed ? 'is-embed' : ''}`}>
      <div className="app-glow app-glow-one" aria-hidden="true" />
      <div className="app-glow app-glow-two" aria-hidden="true" />

      <header className="topbar-surface">
        <div className="topbar-main">
          <div className="brand-lockup">
            <div className="logo">
              <div className="logo-icon">
                <Calendar size={18} />
              </div>
              <div className="logo-copy">
                <span>AnxShowtime</span>
                <small>{uiText.workspace}</small>
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
      </header>

      <main className="main-content">
        <header className={`page-hero ${activeTab === 'overview' ? 'page-hero-overview' : ''}`}>
          <div className="page-intro-copy">
            <p className="page-eyebrow">{pageMeta.eyebrow}</p>
            <h1 className="page-title">{pageMeta.title}</h1>
            <p className="page-summary">{pageMeta.description}</p>

            {activeTab === 'overview' && (
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
            )}
          </div>

          <div className="page-hero-panel">
            <div className="hero-panel-header">
              <span>{uiText.currentView}</span>
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

        {activeTab === 'overview' && (
          <section className="stats-grid hero-stats-grid">
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
          </section>
        )}

        {activeTab === 'overview' && (
          <div className="reporting-tab section-shell">
            <div className="reporting-top-bar">
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
                  {isDashGranularityLocked && (
                    <span className="granularity-hint">{t.autoWeekly}</span>
                  )}
                </div>

                {/* Department Multi-select Dropdown */}
                <div className="filter-group dropdown-container">
                  <label>{t.filterDept}</label>
                  <button 
                    className="dropdown-button" 
                    onClick={() => { setDashDeptOpen(!dashDeptOpen); setDashProjOpen(false); }}
                  >
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
                            <button onClick={() => setDashSelectedDepts(new Set(dashAvailableDepts))}>{t.selectAll || '全选'}</button>
                            <button onClick={() => setDashSelectedDepts(new Set())}>{t.clearAll || '清空'}</button>
                          </div>
                        </div>
                        <div className="project-checkboxes">
                          {dashAvailableDepts.map(dept => (
                            <label key={dept} className={`project-chip ${dashSelectedDepts.has(dept) ? 'selected' : ''}`}>
                              <input type="checkbox" checked={dashSelectedDepts.has(dept)} onChange={() => toggleDashDept(dept)} />
                              <span className="chip-label">{dept}</span>
                            </label>
                          ))}
                          {dashAvailableDepts.length === 0 && <span className="text-muted empty-state-text">暂无部门数据</span>}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Project Multi-select Dropdown */}
                <div className="filter-group dropdown-container">
                  <label>{t.filterProject}</label>
                  <button 
                    className="dropdown-button" 
                    onClick={() => { setDashProjOpen(!dashProjOpen); setDashDeptOpen(false); }}
                  >
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
                            <button onClick={() => setDashSelectedProjects(new Set(dashAvailableProjects))}>{t.selectAll || '全选'}</button>
                            <button onClick={() => setDashSelectedProjects(new Set())}>{t.clearAll || '清空'}</button>
                          </div>
                        </div>
                        <div className="project-checkboxes">
                          {dashAvailableProjects.map(proj => (
                            <label key={proj} className={`project-chip ${dashSelectedProjects.has(proj) ? 'selected' : ''}`}>
                              <input type="checkbox" checked={dashSelectedProjects.has(proj)} onChange={() => toggleDashProject(proj)} />
                              <span className="chip-label">{proj}</span>
                            </label>
                          ))}
                          {dashAvailableProjects.length === 0 && <span className="text-muted empty-state-text">暂无项目数据</span>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'project_analysis' && (
          <div className="project-schedule-section section-shell">
            <div className="card project-schedule-shell elevated-module">
              <div className="card-heading-row">
                <div>
                  <h3>{t.scheduleMonitorTitle}</h3>
                  <p className="module-caption">{t.scheduleMonitorSubtitle}</p>
                </div>
                <div className="project-schedule-actions">
                  <label className="utility-upload schedule-upload-control">
                    <Upload size={18} />
                    <span>{t.uploadProjectSchedule}</span>
                    <input type="file" hidden onChange={handleProjectScheduleUpload} />
                  </label>
                  <div className="filter-group dropdown-container" ref={scheduleProjectPickerRef}>
                    <label>{t.filterScheduleProjects}</label>
                    <button
                      type="button"
                      className="dropdown-button"
                      onClick={() => setScheduleProjectPickerOpen(prev => !prev)}
                    >
                      {scheduleSelectedProjects.size === 0
                        ? t.allScheduleProjects
                        : (lang === 'zh' ? `已选 ${scheduleSelectedProjects.size} 个` : `${scheduleSelectedProjects.size} selected`)}
                      <ChevronDown size={16} />
                    </button>
                    {scheduleProjectPickerOpen && (
                      <div className="approval-project-panel">
                        <div className="project-panel-header">
                          <span className="filter-group-label">{t.filterScheduleProjects}</span>
                          <div className="project-panel-btns">
                            <button type="button" onClick={() => setScheduleSelectedProjects(new Set(scheduleProjects.map(project => project.project_name)))}>
                              {t.selectAll}
                            </button>
                            <button type="button" onClick={() => setScheduleSelectedProjects(new Set())}>
                              {t.clearAll}
                            </button>
                          </div>
                        </div>
                        <div className="project-checkboxes">
                          {scheduleProjects.map(project => (
                            <label key={project.project_name} className={`project-chip ${scheduleSelectedProjects.has(project.project_name) ? 'selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={scheduleSelectedProjects.has(project.project_name)}
                                onChange={() => toggleScheduleProject(project.project_name)}
                              />
                              <span className="chip-label">{project.project_name}</span>
                            </label>
                          ))}
                          {scheduleProjects.length === 0 && <span className="text-muted empty-state-text">{t.noScheduleData}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {scheduleProjects.length === 0 ? (
                <div className="project-schedule-empty">{t.noScheduleData}</div>
              ) : visibleScheduleProjects.length === 0 ? (
                <div className="project-schedule-empty">{t.filterScheduleProjects}</div>
              ) : (
                <div className="project-schedule-grid">
                  {visibleScheduleProjects.map(project => (
                    <article key={project.project_name} className="project-schedule-card">
                      <div className="project-schedule-card-header">
                        <div>
                          <h3>{project.project_name}</h3>
                          <p className="module-caption">{project.bu || '--'} / {project.status || '--'}</p>
                        </div>
                        <div className="project-meta-pills">
                          <span className="hero-meta-pill">
                            <span>{t.projectStatus}</span>
                            <strong>{project.status || '--'}</strong>
                          </span>
                          <span className="hero-meta-pill">
                            <span>{t.mappedProjects}</span>
                            <strong>{(project.mapped_timesheet_projects || []).join(', ') || '--'}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="project-cycle-grid">
                        <div className="hero-panel-stat">
                          <span>{t.plannedCycle}</span>
                          <strong>{formatScheduleNumber(project.cycle_summary?.planned_days)}</strong>
                        </div>
                        <div className="hero-panel-stat">
                          <span>{t.actualCycle}</span>
                          <strong>{formatScheduleNumber(project.cycle_summary?.actual_days)}</strong>
                        </div>
                        <div className="hero-panel-stat">
                          <span>{t.deltaCycle}</span>
                          <strong>{formatScheduleNumber(project.cycle_summary?.delta_days)}</strong>
                        </div>
                      </div>

                      <div className="project-schedule-legend" aria-label={t.milestoneProgress}>
                        <span className="project-schedule-legend-item">
                          <span className="project-schedule-legend-marker planned" aria-hidden="true" />
                          <span>{t.scheduleLegendPlanned}</span>
                        </span>
                        <span className="project-schedule-legend-item">
                          <span className="project-schedule-legend-marker actual" aria-hidden="true" />
                          <span>{t.scheduleLegendActual}</span>
                        </span>
                        <span className="project-schedule-legend-item">
                          <span className="project-schedule-legend-marker pending" aria-hidden="true" />
                          <span>{t.scheduleLegendPending}</span>
                        </span>
                      </div>

                      <ReactECharts
                        option={scheduleChartOptions.get(project.project_name)}
                        style={{ height: '560px' }}
                        notMerge={true}
                      />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="section-shell overview-grid">
            <div className="card chart-card chart-card-primary elevated-module">
              <div className="card-heading-row">
                <div>
                  <h3>{t.trendTitle}</h3>
                  <p className="module-caption">{pageMeta.description}</p>
                </div>
                <div className="module-kicker">{overviewTimeframeLabel}</div>
              </div>
              <ReactECharts option={trendChartOpt} style={{ height: '390px' }} notMerge={true} />
            </div>

            <div className="overview-secondary-grid">
              <div className="card chart-card section-card elevated-module">
                <div className="card-heading-row">
                  <div>
                    <h3>{t.rankingTitle}</h3>
                    <p className="module-caption">{uiText.topDept}: {topDepartment}</p>
                  </div>
                  <div className="module-kicker">{t.stats}</div>
                </div>
                <ReactECharts option={rankingChartOpt} style={{ height: '400px' }} notMerge={true} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reporting' && (
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
                    <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                      <option value="">{t.allWeeks}</option>
                      {(periodOptions.weeksByMonth[`${filterYear}-${filterMonth}`] || []).map(w => (
                        <option key={w.week} value={w.week}>{w.label}</option>
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
          </div>
        )}

        {activeTab === 'approval' && (
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
                {/* Approver single-select */}
                <div className="filter-group">
                  <label>{t.filterApprover}</label>
                  <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)}>
                    <option value="">{t.allApprovers}</option>
                    {availableApprovers.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Project Multi-select Dropdown (Approval Tab) */}
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
              <div className="card no-issues table-card">{t.noApprovalIssues}</div>
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
        )}
      </main>
    </div>
  );
};

export default App;
