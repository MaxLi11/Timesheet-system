import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

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
export const aggregateProjectData = (data, periodType = 'monthly') => {
    const timeMap = {}; // { '2026-03': { 'ProjectA': 15.5, 'ProjectB': 8 } }
    const projects = new Set();

    data.forEach(item => {
        if (!item.start_date || !item.project_name) return; // robust check

        const d = dayjs(item.start_date);
        let timeKey = '';

        if (periodType === 'weekly') {
            timeKey = `${d.year()}-W${String(d.isoWeek()).padStart(2, '0')}`;
        } else if (periodType === 'quarterly') {
            const q = Math.ceil((d.month() + 1) / 3);
            timeKey = `${d.year()}-Q${q}`;
        } else {
            // default monthly
            timeKey = d.format('YYYY-MM');
        }

        if (!timeMap[timeKey]) timeMap[timeKey] = {};
        if (!timeMap[timeKey][item.project_name]) timeMap[timeKey][item.project_name] = 0;
        
        timeMap[timeKey][item.project_name] += (item.hours || 0);
        projects.add(item.project_name);
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
    const monthsByYear = {};   // { '2026': ['01','02',...] }
    const weeksByMonth = {};   // { '2026-01': [{week:'01', label:'第01周'}, ...] }

    entries.forEach(entry => {
        if (!entry.start_date) return;

        const d = dayjs(entry.start_date);
        const year = String(d.year());
        const monthNum = String(d.month() + 1).padStart(2, '0');
        const weekNum = String(d.isoWeek()).padStart(2, '0');
        const ymKey = `${year}-${monthNum}`;

        years.add(year);

        if (!monthsByYear[year]) monthsByYear[year] = new Set();
        monthsByYear[year].add(monthNum);

        if (!weeksByMonth[ymKey]) weeksByMonth[ymKey] = new Map();
        weeksByMonth[ymKey].set(weekNum, { week: weekNum, label: `第${weekNum}周` });
    });

    return {
        years: [...years].sort(),
        monthsByYear: Object.fromEntries(
            Object.entries(monthsByYear).map(([y, s]) => [y, [...s].sort()])
        ),
        weeksByMonth: Object.fromEntries(
            Object.entries(weeksByMonth).map(([m, map]) => [
                m,
                [...map.values()].sort((a, b) => a.week.localeCompare(b.week))
            ])
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

    const getMonthNum = (d) => String(d.month() + 1).padStart(2, '0');
    const getWeekNum = (d) => String(d.isoWeek());

    if (filterWeek) {
        // Week-level
        getPeriodKey = (d) => `${d.year()}-W${getWeekNum(d)}`;
        passesFilter = (d) => 
            String(d.year()) === filterYear && 
            getMonthNum(d) === filterMonth && 
            getWeekNum(d) === filterWeek;
    } else if (filterMonth) {
        // Month-level
        getPeriodKey = (d) => d.format('YYYY-MM');
        passesFilter = (d) => 
            String(d.year()) === filterYear && 
            getMonthNum(d) === filterMonth;
    } else {
        // Year-level
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

/**
 * Computes pending approval statistics from raw /approval-rate entries.
 * Groups by pending_approver, returning per-person counts and total hours.
 *
 * @param {Array}  entries          - Raw data from /approval-rate endpoint
 * @param {string} filterYear       - Required
 * @param {string} filterMonth      - Optional (e.g. '2026-03')
 * @param {Set}    selectedProjects - Optional Set of project names. Empty = all.
 * @param {string} selectedApprover - Optional: filter by specific pending_approver
 * @returns {Array} sorted by dept then pending_approver
 */
export const computeApprovalRate = (entries, filterYear, filterMonth, selectedProjects = new Set(), selectedApprover = '') => {
    if (!filterYear) return [];

    const map = {};
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        const year = String(d.year());
        const month = d.format('YYYY-MM');

        if (year !== filterYear) return;
        if (filterMonth && month !== filterMonth) return;
        // Project filter (selectedProjects empty = show all)
        if (selectedProjects.size > 0 && !selectedProjects.has(entry.project_name)) return;
        // Approver filter
        const approver = (entry.pending_approver || '').trim() || '（未知）';
        if (selectedApprover && approver !== selectedApprover) return;

        if (!map[approver]) {
            map[approver] = {
                pending_approver: approver,
                department: entry.department,
                count: 0,
                total_hours: 0
            };
        }
        map[approver].count += 1;
        map[approver].total_hours += entry.hours;
    });

    return Object.values(map)
        .map(r => ({ ...r, total_hours: parseFloat(r.total_hours.toFixed(2)) }))
        .sort((a, b) => a.department.localeCompare(b.department) || a.pending_approver.localeCompare(b.pending_approver));
};

/**
 * Extracts all distinct project names from approval-rate entries
 * filtered by year/month (but ignoring project/approver filters).
 */
export const getApprovalProjects = (entries, filterYear, filterMonth) => {
    const projects = new Set();
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        const year = String(d.year());
        const month = d.format('YYYY-MM');
        if (year !== filterYear) return;
        if (filterMonth && month !== filterMonth) return;
        if (entry.project_name) projects.add(entry.project_name);
    });
    return [...projects].sort();
};

/**
 * Extracts all distinct pending_approver names from approval-rate entries
 * filtered by year/month and optionally project.
 */
export const getApprovalApprovers = (entries, filterYear, filterMonth, selectedProjects = new Set()) => {
    const approvers = new Set();
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        const year = String(d.year());
        const month = d.format('YYYY-MM');
        if (year !== filterYear) return;
        if (filterMonth && month !== filterMonth) return;
        if (selectedProjects.size > 0 && !selectedProjects.has(entry.project_name)) return;
        const approver = (entry.pending_approver || '').trim();
        if (approver) approvers.add(approver);
    });
    return [...approvers].sort();
};
