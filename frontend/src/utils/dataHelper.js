import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

/**
 * Aggregates raw time entries based on a period (weekly, monthly, quarterly, yearly)
 */
export const aggregateData = (entries, period = 'monthly') => {
    const groups = {};

    entries.forEach(entry => {
        const date = dayjs(entry.start_date);
        let key = '';

        if (period === 'weekly') {
            key = `${date.year()}-W${date.week()}`;
        } else if (period === 'monthly') {
            key = date.format('YYYY-MM');
        } else if (period === 'quarterly') {
            key = `${date.year()}-Q${date.quarter()}`;
        } else {
            key = date.format('YYYY');
        }

        if (!groups[key]) groups[key] = 0;
        groups[key] += entry.hours;
    });

    return {
        labels: Object.keys(groups).sort(),
        values: Object.keys(groups).sort().map(k => groups[k])
    };
};

/**
 * Groups data by Department or Project for comparisons
 */
export const groupByField = (entries, field = 'department') => {
    const groups = {};
    entries.forEach(entry => {
        const key = entry[field] || 'Unknown';
        if (!groups[key]) groups[key] = 0;
        groups[key] += entry.hours;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
};

/**
 * Prepares data for use in ECharts Heatmap (Day of week vs Week of year)
 */
export const prepareHeatmapData = (entries) => {
    // Basic implementation: Mapping hours to days
    const dataMap = {};
    entries.forEach(entry => {
        const d = dayjs(entry.start_date).format('YYYY-MM-DD');
        if (!dataMap[d]) dataMap[d] = 0;
        dataMap[d] += entry.hours;
    });
    return Object.entries(dataMap).map(([date, hours]) => [date, hours]);
};

/**
 * Aggregates data for multiple projects across a time period
 */
export const aggregateProjectData = (entries, period = 'monthly') => {
    const timeMap = {}; // { timeKey: { projectA: hours, projectB: hours } }
    const projects = new Set();

    entries.forEach(entry => {
        const date = dayjs(entry.start_date);
        let key = '';

        if (period === 'weekly') {
            key = `${date.year()}-W${date.week()}`;
        } else if (period === 'monthly') {
            key = date.format('YYYY-MM');
        } else if (period === 'quarterly') {
            key = `${date.year()}-Q${date.quarter()}`;
        } else {
            key = date.format('YYYY');
        }

        const projName = entry.project_name || 'Unknown';
        projects.add(projName);

        if (!timeMap[key]) timeMap[key] = {};
        if (!timeMap[key][projName]) timeMap[key][projName] = 0;
        timeMap[key][projName] += entry.hours;
    });

    const sortedLabels = Object.keys(timeMap).sort();
    const sortedProjects = [...projects].sort();

    const series = sortedProjects.map(proj => ({
        name: proj,
        type: 'line',
        smooth: true,
        data: sortedLabels.map(label => (timeMap[label][proj] || 0).toFixed(1))
    }));

    return {
        labels: sortedLabels,
        series,
        projects: sortedProjects
    };
};

/**
 * Extracts available years, months (for a given year), and weeks (for a given year+month)
 * from raw reporting entries.
 */
export const getReportingPeriodOptions = (entries) => {
    const years = new Set();
    const monthsByYear = {};   // { '2026': Set(['2026-01', ...]) }
    const weeksByYearMonth = {}; // { '2026-01': Set(['2026-W01', ...]) }

    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        const year = String(d.year());
        const month = d.format('YYYY-MM');
        const week = `${d.year()}-W${String(d.week()).padStart(2, '0')}`;

        years.add(year);

        if (!monthsByYear[year]) monthsByYear[year] = new Set();
        monthsByYear[year].add(month);

        if (!weeksByYearMonth[month]) weeksByYearMonth[month] = new Set();
        weeksByYearMonth[month].add(week);
    });

    return {
        years: [...years].sort(),
        monthsByYear: Object.fromEntries(
            Object.entries(monthsByYear).map(([y, s]) => [y, [...s].sort()])
        ),
        weeksByYearMonth: Object.fromEntries(
            Object.entries(weeksByYearMonth).map(([m, s]) => [m, [...s].sort()])
        )
    };
};

/**
 * Computes per-employee actual vs target hours with hierarchical filtering.
 * Returns only records where gap != 0.
 * @param {Array} entries - Raw time entries from /reporting-rate
 * @param {string} filterYear  - Required: '2026'
 * @param {string} filterMonth - Optional: '2026-03' (for monthly view)
 * @param {string} filterWeek  - Optional: '2026-W10' (for weekly view within month)
 * @param {number} targetHours - User-provided target
 */
export const computeReportingRate = (entries, filterYear, filterMonth, filterWeek, targetHours) => {
    if (!filterYear) return [];

    // Determine aggregation key and filter predicate
    let getPeriodKey, passesFilter;

    if (filterWeek) {
        // Week-level: only entries within the selected week
        getPeriodKey = (d) => `${d.year()}-W${String(d.week()).padStart(2, '0')}`;
        passesFilter = (d) => {
            const week = `${d.year()}-W${String(d.week()).padStart(2, '0')}`;
            return week === filterWeek;
        };
    } else if (filterMonth) {
        // Month-level: only entries within the selected month
        getPeriodKey = (d) => d.format('YYYY-MM');
        passesFilter = (d) => d.format('YYYY-MM') === filterMonth;
    } else {
        // Year-level: all entries within the selected year, aggregated by month
        getPeriodKey = (d) => d.format('YYYY-MM');
        passesFilter = (d) => String(d.year()) === filterYear;
    }

    // Group by (period_key, employee_id)
    const map = {};
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        if (!passesFilter(d)) return;

        const periodKey = getPeriodKey(d);
        const key = `${periodKey}___${entry.employee_id}`;
        if (!map[key]) {
            map[key] = {
                period_key: periodKey,
                department: entry.department,
                employee_name: entry.employee_name,
                employee_id: entry.employee_id,
                actual_hours: 0
            };
        }
        map[key].actual_hours += entry.hours;
    });

    return Object.values(map)
        .map(r => ({
            ...r,
            actual_hours: parseFloat(r.actual_hours.toFixed(2)),
            gap: parseFloat((targetHours - r.actual_hours).toFixed(2))
        }))
        .filter(r => r.gap !== 0)
        .sort((a, b) => a.period_key.localeCompare(b.period_key) || a.department.localeCompare(b.department));
};

/**
 * Groups computeReportingRate results by department.
 */
export const groupReportingByDept = (records) => {
    const groups = {};
    records.forEach(r => {
        if (!groups[r.department]) groups[r.department] = { totalGap: 0, employees: [] };
        groups[r.department].totalGap += r.gap;
        groups[r.department].employees.push(r);
    });
    Object.values(groups).forEach(g => { g.totalGap = parseFloat(g.totalGap.toFixed(2)); });
    return groups;
};
