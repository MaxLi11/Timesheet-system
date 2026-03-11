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
