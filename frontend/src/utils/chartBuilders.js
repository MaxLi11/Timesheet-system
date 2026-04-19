import dayjs from 'dayjs';
import * as dataHelper from './dataHelper';
import {
  EDITORIAL_THEME,
  SCHEDULE_SERIES_COLORS,
  tooltipBase,
  chartText,
  chartAxis,
  chartSplitLine,
} from '../constants/theme';

export const formatScheduleNumber = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

export const buildScheduleDeltaLabel = (value, lang) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  const prefix = numeric > 0 ? '+' : '';
  return lang === 'zh' ? `${prefix}${numeric}天` : `${prefix}${numeric}d`;
};

export const buildIntervalLabel = (interval) => `${interval.from_milestone} -> ${interval.to_milestone}`;

export const formatScheduleMonthLabel = (value) => {
  if (!value) return '--';
  const [year, month] = String(value).split('-');
  if (!year || !month) return value;
  const monthNumber = Number(month);
  if (Number.isNaN(monthNumber)) return value;
  return `${year}.${monthNumber}`;
};

export const formatCompactScheduleDate = (value) => {
  if (!value) return '';
  const parsedValue = dayjs(value);
  if (!parsedValue.isValid()) return '';
  return dayjs(value).format('M.D');
};

export const buildScheduleMonthScale = (dateValues) => {
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

export const buildLegacyProjectScheduleChartOption = (project, lang, t) => {
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

export const buildProjectScheduleChartOption = (project, lang, t, timesheetEntries = []) => {
  const mappedProjects = project?.mapped_timesheet_projects || [];
  const scheduleProjectEntries = timesheetEntries.filter(entry => mappedProjects.includes(entry.project_name));
  const monthlyHours = dataHelper.aggregateProjectDeptData(scheduleProjectEntries, 'monthly');
  const hasMonthlyHours = monthlyHours.series.some(series =>
    series.data.some(value => Number(value || 0) > 0)
  );
  const departments = monthlyHours.departments || [];
  const labels = monthlyHours.labels || [];

  const series = departments.map(dept => {
    const s = monthlyHours.series.find(s => s.name === dept);
    return {
      name: dept,
      type: 'bar',
      stack: 'hours',
      barMaxWidth: 36,
      emphasis: { focus: 'series' },
      data: s ? s.data.map(v => Number(v || 0)) : labels.map(() => 0)
    };
  });

  return {
    color: EDITORIAL_THEME.palette,
    animationDuration: 450,
    legend: {
      show: hasMonthlyHours,
      data: departments,
      type: 'scroll',
      top: 6,
      left: 'center',
      itemGap: 14,
      textStyle: chartText
    },
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const month = params[0].name || '--';
        const total = params.reduce((s, p) => s + Number(p.value || 0), 0);
        let html = `<div style="font-weight:800; margin-bottom:6px;">${month}</div>`;
        params.filter(p => p.value > 0).forEach(p => {
          html += `<div style="display:flex; justify-content:space-between; gap:14px;"><span>${p.marker} ${p.seriesName}</span><strong>${formatScheduleNumber(p.value)}h</strong></div>`;
        });
        html += `<div style="border-top:1px solid #eee; margin-top:4px; padding-top:4px; display:flex; justify-content:space-between; gap:14px;"><span>${lang === 'zh' ? '合计' : 'Total'}</span><strong>${formatScheduleNumber(total)}h</strong></div>`;
        return html;
      }
    },
    grid: { left: 60, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { ...chartAxis, fontSize: 10.5 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: EDITORIAL_THEME.border } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...chartAxis, formatter: v => `${v}h` },
      splitLine: chartSplitLine
    },
    series,
    graphic: [
      ...(!hasMonthlyHours ? [{
        type: 'text',
        left: 'center',
        top: 'middle',
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

export const buildMilestoneIntervalChartOption = (project, lang, t) => {
  const milestones = project?.milestones || [];
  const intervals  = project?.intervals  || [];

  const deptTotals = new Map();
  intervals.forEach(iv =>
    (iv.department_shares || []).forEach(d => {
      deptTotals.set(d.department, (deptTotals.get(d.department) || 0) + d.hours);
    })
  );
  const departments = [...deptTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0]);

  const ivByFrom = new Map(intervals.map(iv => [iv.from_milestone, iv]));
  const hasAnyHours = intervals.some(iv => (iv.total_hours || 0) > 0);

  const yRows = [];
  const intervalIndexByRow = new Map();

  milestones.forEach((m, mi) => {
    const dateStr = m.actual_date
      ? dayjs(m.actual_date).format('YYYY/MM/DD')
      : (lang === 'zh' ? '待完成' : 'Pending');
    yRows.push(`MS|${m.name}|${dateStr}`);

    if (mi < milestones.length - 1) {
      const iv = ivByFrom.get(m.name);
      const rowIdx = yRows.length;
      yRows.push(`IV|${m.name}`);
      if (iv) intervalIndexByRow.set(rowIdx, iv);
    }
  });

  const series = departments.map((dept, idx) => ({
    name: dept,
    type: 'bar',
    stack: 'ms-hours',
    barMaxWidth: 28,
    barMinHeight: 1,
    itemStyle: {
      color: EDITORIAL_THEME.palette[idx % EDITORIAL_THEME.palette.length],
      borderRadius: [0, 4, 4, 0]
    },
    emphasis: { focus: 'series' },
    data: yRows.map((row, rowIdx) => {
      if (row.startsWith('MS|')) return 0;
      const iv = intervalIndexByRow.get(rowIdx);
      if (!iv) return 0;
      const share = (iv.department_shares || []).find(d => d.department === dept);
      return share ? Number(share.hours.toFixed(1)) : 0;
    })
  }));

  const tooltipFormatter = (params) => {
    if (!Array.isArray(params) || !params.length) return '';
    const rowIdx = params[0].dataIndex;
    const rowLabel = yRows[rowIdx] || '';
    if (rowLabel.startsWith('MS|')) return '';
    const iv = intervalIndexByRow.get(rowIdx);
    if (!iv) return '';
    const total = iv.total_hours || 0;
    let html = `<div style="font-weight:800;margin-bottom:4px;">${iv.from_milestone} → ${iv.to_milestone}</div>`;
    params.filter(p => Number(p.value) > 0).forEach(p => {
      html += `<div style="display:flex;justify-content:space-between;gap:14px;"><span>${p.marker} ${p.seriesName}</span><strong>${formatScheduleNumber(p.value)}h</strong></div>`;
    });
    if (total > 0) {
      html += `<div style="border-top:1px solid #eee;margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;gap:14px;"><span>${lang === 'zh' ? '区间合计' : 'Interval Total'}</span><strong>${formatScheduleNumber(total)}h</strong></div>`;
    } else {
      html += `<div style="color:#9aabc6;font-size:11px;margin-top:4px;">${lang === 'zh' ? '暂无 Close 工时' : 'No Close hours'}</div>`;
    }
    return html;
  };

  const rowCount = yRows.length;
  const maxVisibleRows = 12;
  const showScroll = rowCount > maxVisibleRows;

  return {
    color: EDITORIAL_THEME.palette,
    animationDuration: 450,
    legend: {
      show: hasAnyHours && departments.length > 0,
      data: departments,
      type: 'scroll',
      bottom: 6,
      left: 'center',
      itemGap: 14,
      textStyle: chartText
    },
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: tooltipFormatter
    },
    grid: { left: 176, right: showScroll ? 36 : 24, top: 16, bottom: 54 },
    dataZoom: showScroll ? [
      {
        type: 'slider',
        yAxisIndex: 0,
        show: true,
        right: 8,
        width: 12,
        startValue: 0,
        endValue: maxVisibleRows - 1,
        borderColor: 'transparent',
        fillerColor: 'rgba(77, 114, 255, 0.16)',
        backgroundColor: 'rgba(115, 138, 176, 0.06)',
        handleSize: '0%', // 隐藏手柄，仅拖拽滑块
        showDetail: false,
        showDataShadow: false,
        brushSelect: false
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true
      }
    ] : [],
    xAxis: {
      type: 'value',
      axisLabel: { ...chartAxis, formatter: v => `${v}h` },
      splitLine: chartSplitLine
    },
    yAxis: {
      type: 'category',
      data: yRows,
      inverse: true,
      barCategoryGap: '20%',
      axisLabel: {
        ...chartAxis,
        fontSize: 11,
        width: 166,
        overflow: 'truncate',
        interval: 0,
        formatter: (value) => {
          if (!value.startsWith('MS|')) return '';
          const [, name, date] = value.split('|');
          return `{nm|${name}}\n{dt|${date}}`;
        },
        rich: {
          nm: { fontSize: 11, fontWeight: 700, color: EDITORIAL_THEME.graphite, lineHeight: 16 },
          dt: { fontSize: 10, color: EDITORIAL_THEME.slateSoft, lineHeight: 14 }
        }
      },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(115,138,176,0.10)', type: 'dashed' }
      }
    },
    series,
    graphic: hasAnyHours ? [] : [{
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: t.scheduleHoursEmpty,
        fill: EDITORIAL_THEME.slateSoft,
        font: '600 12px "IBM Plex Sans","Noto Sans SC",sans-serif',
        textAlign: 'center'
      }
    }]
  };
};
