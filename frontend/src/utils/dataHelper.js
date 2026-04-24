import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

/**
 * 统一月份归属口径（与后端一致）：
 *   1. 若提供 workWeeks，以 start_date 匹配工作周区间，取该周 work_month
 *      （work_month 已由后端按 week_end 所在月计算，跨月周归次月）
 *   2. 无匹配时兜底：优先用 end_date 所在自然月，无 end_date 用 start_date 自然月
 *
 * @param {object} entry      - 含 start_date / end_date 字段的条目
 * @param {Array}  workWeeks  - 工作周表（可选，格式 [{week_start, week_end, work_month}]）
 * @returns {string}          - 'YYYY-MM'
 */
export const getEntryWorkMonth = (entry, workWeeks = []) => {
    const start = entry.start_date ? dayjs(entry.start_date) : null;
    if (!start || !start.isValid()) return '';

    if (workWeeks.length > 0) {
        const found = workWeeks.find(w =>
            !start.isBefore(dayjs(w.week_start), 'day') &&
            !start.isAfter(dayjs(w.week_end), 'day')
        );
        if (found && found.work_month) return found.work_month;
    }

    // 兜底：优先用 end_date 所在月（与后端 week_end 口径对齐）
    if (entry.end_date) {
        const end = dayjs(entry.end_date);
        if (end.isValid()) return end.format('YYYY-MM');
    }
    return start.format('YYYY-MM');
};

/**
 * 根据 start_date 在工作周表中查找所属 week_code。
 * 找不到时降级返回 ISO 周格式（兼容历史数据）。
 */
export const getWorkWeekCode = (dateStr, workWeeks) => {
    const d = dayjs(dateStr);
    if (!d.isValid()) return '';
    if (workWeeks && workWeeks.length > 0) {
        const found = workWeeks.find(w =>
            !d.isBefore(dayjs(w.week_start), 'day') &&
            !d.isAfter(dayjs(w.week_end), 'day')
        );
        if (found) return found.week_code;
    }
    // 降级：ISO 周（用于 2026 之前无工作周划分的历史数据）
    return `${d.year()}-W${String(d.isoWeek()).padStart(2, '0')}`;
};

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
            key = getEntryWorkMonth(entry);
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
export const aggregateProjectData = (data, periodType = 'monthly', workWeeks = []) => {
    const timeMap = {}; // { '2026-03': { 'ProjectA': 15.5, 'ProjectB': 8 } }
    const projects = new Set();

    data.forEach(item => {
        if (!item.start_date || !item.project_name) return; // robust check

        const d = dayjs(item.start_date);
        let timeKey = '';

        if (periodType === 'weekly') {
            timeKey = getWorkWeekCode(item.start_date, workWeeks);
        } else if (periodType === 'quarterly') {
            const q = Math.ceil((d.month() + 1) / 3);
            timeKey = `${d.year()}-Q${q}`;
        } else {
            // default monthly：按统一口径（work_month 或 end_date 所在月）
            timeKey = getEntryWorkMonth(item, workWeeks);
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
        emphasis: { focus: 'series' },
        data: sortedLabels.map(label => parseFloat((timeMap[label][proj] || 0).toFixed(1)))
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

        const entryMonth = getEntryWorkMonth(entry);  // 统一口径：工作周归属月
        const year = entryMonth.slice(0, 4);
        const monthNum = entryMonth.slice(5, 7);
        const d = dayjs(entry.start_date);
        const weekNum = String(d.isoWeek()).padStart(2, '0');
        const ymKey = entryMonth;  // 'YYYY-MM'

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
 * @param {Array}  workWeeks   - Custom work week definitions
 */
/** 完整填报率汇总只按人员姓名，不使用工号 */
const reportingEmployeeGroupKey = (entry) => (entry.employee_name || '').trim() || 'unknown';

// filterWeek 可以是:
//   - { week_start: 'YYYY-MM-DD', week_end: 'YYYY-MM-DD', week_code: '...' }（工作周表）
//   - '' / null / undefined（未选）
export const computeReportingRate = (entries, filterYear, filterMonth, filterWeek, targetHours, workWeeks = []) => {
    if (!filterYear) return [];

    // Determine aggregation key and filter predicate
    let getPeriodKey, passesFilter;

    const getMonthNum = (d) => String(d.month() + 1).padStart(2, '0');

    if (filterWeek) {
        if (typeof filterWeek === 'object' && filterWeek.week_start) {
            // Week-level: 用工作周的日期范围判断
            const ws = dayjs(filterWeek.week_start);
            const we = dayjs(filterWeek.week_end);
            const weekLabel = filterWeek.week_code || filterWeek.week_start;
            getPeriodKey = () => weekLabel;
            passesFilter = (d) => !d.isBefore(ws, 'day') && !d.isAfter(we, 'day');
        } else {
            // ISO 后备周逻辑：当未上传工作周表时生效
            const weekStr = typeof filterWeek === 'object' ? filterWeek.week : filterWeek;
            const weekNum = parseInt(weekStr, 10);
            getPeriodKey = () => `${filterYear}-W${String(weekNum).padStart(2, '0')}`;
            passesFilter = (d) =>
                String(d.year()) === filterYear &&
                d.isoWeek() === weekNum;
        }
    } else if (filterMonth) {
        // Month-level: 优先遵循工作周表的划定
        const targetWorkMonth = `${filterYear}-${filterMonth}`;
        const targetWeeks = (workWeeks || []).filter(w => w.work_month === targetWorkMonth);
        
        getPeriodKey = () => targetWorkMonth;
        
        if (targetWeeks.length > 0) {
            // 计算该工作月的最早开始日期和最晚结束日期，形成连续大区间
            // 避免用户仅配置了周一到周五导致周末工时被过滤
            let minWs = dayjs(targetWeeks[0].week_start);
            let maxWe = dayjs(targetWeeks[0].week_end);
            targetWeeks.forEach(w => {
                const ws = dayjs(w.week_start);
                const we = dayjs(w.week_end);
                if (ws.isBefore(minWs, 'day')) minWs = ws;
                if (we.isAfter(maxWe, 'day')) maxWe = we;
            });
            
            passesFilter = (d) => !d.isBefore(minWs, 'day') && !d.isAfter(maxWe, 'day');
        } else {
            // 降级：自然月
            passesFilter = (d) => 
                String(d.year()) === filterYear && 
                getMonthNum(d) === filterMonth;
        }
    } else {
        // Year-level
        getPeriodKey = (d) => d.format('YYYY-MM');
        passesFilter = (d) => String(d.year()) === filterYear;
    }

    // Group by (period_key, employee_name only)
    const map = {};
    entries.forEach(entry => {
        const d = dayjs(entry.start_date);
        if (!passesFilter(d)) return;

        const periodKey = getPeriodKey(d);
        const key = `${periodKey}___${reportingEmployeeGroupKey(entry)}`;
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

export const computeReportingCompleteness = (
    entries,
    activeEmployees,       // 保留参数签名兼容性，但实际不依赖（employees表为空）
    filterYear,
    filterMonth,
    filterWeek,
    workWeeks = []
) => {
    const empty = { missing_by_dept: {}, missing_employees: [], missing_count: 0, no_filter: false };
    const no_filter_result = { missing_by_dept: {}, missing_employees: [], missing_count: 0, no_filter: true };
    if (!Array.isArray(entries) || entries.length === 0) return empty;
    // 没有选任何时间范围时不计算（无意义）
    const hasAnyFilter = filterYear || filterMonth || (filterWeek && filterWeek.week_start);
    if (!hasAnyFilter) return no_filter_result;

    // 基数：来自 /active-employees 的 Excel 员工基础信息（权威名单）
    // 格式: [{employee_name, department(简称), department_full, ...}]
    // 降级：若 activeEmployees 为空（employees 表未初始化），从 entries 历史推断
    const empDeptMap = {};  // name -> dept 简称
    if (Array.isArray(activeEmployees) && activeEmployees.length > 0) {
        activeEmployees.forEach(emp => {
            const name = (emp.employee_name || '').trim();
            // department 是简称（AE/Digital/...），department_full 是全称
            const dept = (emp.department || emp.department_full || '').trim() || 'Unknown';
            if (name) empDeptMap[name] = dept;
        });
    } else {
        // 降级：从 entries 历史推断（兼容 employees 表为空的旧状态）
        entries.forEach(entry => {
            const name = (entry.employee_name || '').trim();
            if (!name) return;
            if (!empDeptMap[name]) {
                empDeptMap[name] = (entry.department || '').trim() || 'Unknown';
            }
        });
    }

    const baselineNames = Object.keys(empDeptMap); // 历史所有填过的在职员工
    if (baselineNames.length === 0) return empty;

    // 按筛选范围过滤，找出该范围内有填报记录的人
    // filterYear  格式: '2026'
    // filterMonth 格式: '03'（两位月份数字）
    // filterWeek  格式: { week_start, week_end, week_code }（工作周对象）或空
    const hasWeekRange = filterWeek && (typeof filterWeek === 'string' || filterWeek.week || filterWeek.week_start);
    let weekStart = null, weekEnd = null, isoWeekNum = null;
    if (hasWeekRange) {
        if (typeof filterWeek === 'object' && filterWeek.week_start) {
            weekStart = dayjs(filterWeek.week_start);
            weekEnd = dayjs(filterWeek.week_end);
        } else {
            isoWeekNum = parseInt(typeof filterWeek === 'object' ? filterWeek.week : filterWeek, 10);
        }
    }

    // Pre-calculate target weeks for work month if needed
    const targetWorkMonth = (filterYear && filterMonth) ? `${filterYear}-${filterMonth}` : null;
    const targetMonthWeeks = (targetWorkMonth && Array.isArray(workWeeks)) 
        ? workWeeks.filter(w => w.work_month === targetWorkMonth) 
        : [];

    const submittedSet = new Set();
    entries.forEach(entry => {
        const employeeName = (entry.employee_name || '').trim();
        if (!employeeName) return;

        if (filterYear || filterMonth || hasWeekRange) {
            const d = dayjs(entry.start_date);
            if (!d.isValid()) return;
            if (hasWeekRange) {
                if (weekStart) {
                    // Custom Work Week
                    if (d.isBefore(weekStart, 'day') || d.isAfter(weekEnd, 'day')) return;
                } else {
                    // ISO Week Fallback
                    if (String(d.year()) !== filterYear || d.isoWeek() !== isoWeekNum) return;
                }
            } else if (filterMonth && targetMonthWeeks.length > 0) {
                // Work Month logic (continuous range to avoid weekend gaps)
                let minWs = dayjs(targetMonthWeeks[0].week_start);
                let maxWe = dayjs(targetMonthWeeks[0].week_end);
                targetMonthWeeks.forEach(w => {
                    const ws = dayjs(w.week_start);
                    const we = dayjs(w.week_end);
                    if (ws.isBefore(minWs, 'day')) minWs = ws;
                    if (we.isAfter(maxWe, 'day')) maxWe = we;
                });
                if (d.isBefore(minWs, 'day') || d.isAfter(maxWe, 'day')) return;
            } else {
                // Year or Calendar Month level
                if (filterYear && d.year().toString() !== filterYear) return;
                // 统一口径：用工作周归属月（work_month）比对，不用 start_date 自然月
                if (filterMonth) {
                    const entryMonth = getEntryWorkMonth(entry);
                    if (entryMonth !== `${filterYear}-${filterMonth}`) return;
                }
            }
        }

        submittedSet.add(employeeName);
    });

    // 漏填 = 基数中，在筛选范围内没有任何填报记录的人
    const missingByDept = {};
    const missingEmployees = [];

    baselineNames.forEach(name => {
        if (submittedSet.has(name)) return;
        const dept = empDeptMap[name] || 'Unknown';
        if (!missingByDept[dept]) missingByDept[dept] = [];
        missingByDept[dept].push(name);
        missingEmployees.push(name);
    });

    missingEmployees.sort();
    Object.values(missingByDept).forEach(arr => arr.sort());

    const totalCount = baselineNames.length;
    const submittedCount = totalCount - missingEmployees.length;

    return {
        missing_by_dept: missingByDept,
        missing_employees: missingEmployees,
        missing_count: missingEmployees.length,
        total_count: totalCount,       // 应填人数（基数）
        submitted_count: submittedCount // 已填人数
    };
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
        const entryMonth = getEntryWorkMonth(entry);  // 统一口径
        const year = entryMonth.slice(0, 4);

        if (year !== filterYear) return;
        if (filterMonth && entryMonth !== filterMonth) return;
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
        const entryMonth = getEntryWorkMonth(entry);  // 统一口径
        const year = entryMonth.slice(0, 4);
        if (year !== filterYear) return;
        if (filterMonth && entryMonth !== filterMonth) return;
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
        const entryMonth = getEntryWorkMonth(entry);  // 统一口径
        const year = entryMonth.slice(0, 4);
        if (year !== filterYear) return;
        if (filterMonth && entryMonth !== filterMonth) return;
        if (selectedProjects.size > 0 && !selectedProjects.has(entry.project_name)) return;
        const approver = (entry.pending_approver || '').trim();
        if (approver) approvers.add(approver);
    });
    return [...approvers].sort();
};

/**
 * Aggregates data for specific projects, grouped by time and then department.
 * Used for stacked bar charts.
 */
export const aggregateProjectDeptData = (data, periodType, workWeeks = []) => {
    const timeMap = {}; // { '2026-03': { 'DeptA': 10, 'DeptB': 5 } }
    const departments = new Set();

    data.forEach(item => {
        if (!item.start_date || !item.department) return;

        const d = dayjs(item.start_date);
        let timeKey = '';
        if (periodType === 'weekly') {
            timeKey = getWorkWeekCode(item.start_date, workWeeks);
        } else if (periodType === 'quarterly') {
            timeKey = `${d.year()}-Q${Math.floor(d.month() / 3) + 1}`;
        } else {
            // monthly：统一口径，按工作周归属月
            timeKey = getEntryWorkMonth(item, workWeeks);
        }

        if (!timeMap[timeKey]) timeMap[timeKey] = {};
        if (!timeMap[timeKey][item.department]) timeMap[timeKey][item.department] = 0;
        
        timeMap[timeKey][item.department] += Number(item.hours || 0);
        departments.add(item.department);
    });

    const sortedLabels = Object.keys(timeMap).sort();
    const sortedDepts = [...departments].sort();

    const series = sortedDepts.map(dept => ({
        name: dept,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: sortedLabels.map(label => parseFloat((timeMap[label][dept] || 0).toFixed(1)))
    }));

    return {
        labels: sortedLabels,
        series,
        departments: sortedDepts
    };
};
