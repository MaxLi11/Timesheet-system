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
 * Computes per-employee, per-period actual vs target hours.
 * Returns only records where gap != 0.
 * @param {Array} entries - Raw time entries from /reporting-rate
 * @param {string} period - 'weekly' | 'monthly'
 * @param {number} targetHours - User-provided target per period
 * @returns {Array} { period_key, department, employee_name, employee_id, actual_hours, gap }
 */
export const computeReportingRate = (entries, period, targetHours) => {
    // Group by (period_key, employee_id)
    const map = {};
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        const periodKey = period === 'weekly'
            ? `${d.year()}-W${String(d.week()).padStart(2, '0')}`
            : d.format('YYYY-MM');

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

    // Compute gap and filter out zeros
    return Object.values(map)
        .map(r => ({ ...r, actual_hours: parseFloat(r.actual_hours.toFixed(2)), gap: parseFloat((targetHours - r.actual_hours).toFixed(2)) }))
        .filter(r => r.gap !== 0)
        .sort((a, b) => a.period_key.localeCompare(b.period_key) || a.department.localeCompare(b.department));
};

/**
 * Groups computeReportingRate results by department.
 * @param {Array} records - Output of computeReportingRate
 * @returns {Object} { dept: [records] }
 */
export const groupReportingByDept = (records) => {
    const groups = {};
    records.forEach(r => {
        if (!groups[r.department]) groups[r.department] = { totalGap: 0, employees: [] };
        groups[r.department].totalGap += r.gap;
        groups[r.department].employees.push(r);
    });
    // Round summary gaps
    Object.values(groups).forEach(g => { g.totalGap = parseFloat(g.totalGap.toFixed(2)); });
    return groups;
};
