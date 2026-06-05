import dayjs from "dayjs";

/** 与 backend `_resolve_entry_work_month` 一致：日期落在某周 [week_start, week_end] 则用 work_month，否则自然月。 */
export const resolveWorkMonthKey = (dateStr, workWeeks = []) => {
  const d = dayjs(dateStr);
  if (!d.isValid()) return "";
  if (workWeeks && workWeeks.length > 0) {
    const found = workWeeks.find(
      (w) =>
        !d.isBefore(dayjs(w.week_start), "day") &&
        !d.isAfter(dayjs(w.week_end), "day")
    );
    if (found && found.work_month) return String(found.work_month).trim();
  }
  return d.format("YYYY-MM");
};
const BASE_HEADERS = ["BU", "项目", "员工", "部门简称", "所属部门", "职位"];
const SHEET_NAME = "每项目工时";

const compareText = (left, right) => String(left || "").localeCompare(String(right || ""));

const formatMonthKey = (value) => {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
};

const buildContinuousMonths = (startMonth, endMonth) => {
  if (!startMonth || !endMonth) return [];

  const months = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(5, 7));
  const endYear = Number(endMonth.slice(0, 4));
  const endMonthNumber = Number(endMonth.slice(5, 7));

  while (year < endYear || (year === endYear && month <= endMonthNumber)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }

  return months;
};

const normalizeNumber = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const rounded = Number(numeric.toFixed(2));
  return Number.isInteger(rounded) ? rounded : rounded;
};

const buildGroupKey = (entry) => {
  const projectName = String(entry.project_name || "").trim();
  const employeeId = String(entry.employee_id || "").trim();
  const employeeName = String(entry.employee_name || "").trim();
  return employeeId ? `${projectName}__${employeeId}` : `${projectName}__name__${employeeName}`;
};

export const buildCustomProjectHoursFilename = (now = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "每项目工时_Close口径_",
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "_",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    ".xlsx",
  ].join("");
};

export const buildCustomProjectHoursExport = (entries = [], workWeeks = [], now = new Date()) => {
  const filteredEntries = entries.filter((entry) => {
    if (!entry || entry.category !== "Project") return false;
    if (entry.current_node && String(entry.current_node).trim().toLowerCase() !== "close") return false;
    return Boolean(entry.project_name && entry.employee_name && resolveWorkMonthKey(entry.start_date, workWeeks));
  });

  const monthKeys = filteredEntries
    .map((entry) => resolveWorkMonthKey(entry.start_date, workWeeks))
    .filter(Boolean)
    .sort(compareText);
  // Only include months that actually have data (no gap-filling with zeros)
  const continuousMonths = [...new Set(monthKeys)].sort(compareText);

  const groups = new Map();
  filteredEntries.forEach((entry) => {
    const groupKey = buildGroupKey(entry);
    const monthKey = resolveWorkMonthKey(entry.start_date, workWeeks);
    const existingGroup = groups.get(groupKey) || {
      project_name: String(entry.project_name || "").trim(),
      employee_name: String(entry.employee_name || "").trim(),
      bu: String(entry.bu || "").trim(),
      department_full: String(entry.department_full || "").trim(),
      department: String(entry.department || "").trim(),
      position: String(entry.position || "").trim(),
      monthHours: new Map(),
    };

    if (!existingGroup.bu && entry.bu) {
      existingGroup.bu = String(entry.bu).trim();
    }
    if (!existingGroup.department_full && entry.department_full) {
      existingGroup.department_full = String(entry.department_full).trim();
    }
    if (!existingGroup.department && entry.department) {
      existingGroup.department = String(entry.department).trim();
    }
    if (!existingGroup.position && entry.position) {
      existingGroup.position = String(entry.position).trim();
    }

    existingGroup.monthHours.set(
      monthKey,
      normalizeNumber((existingGroup.monthHours.get(monthKey) || 0) + Number(entry.hours || 0))
    );
    groups.set(groupKey, existingGroup);
  });

  const sortedGroups = [...groups.values()].sort(
    (left, right) =>
      compareText(left.project_name, right.project_name) ||
      compareText(left.employee_name, right.employee_name)
  );

  const rows = sortedGroups.map((group) => {
    const monthValues = continuousMonths.map((monthKey) => {
      const val = group.monthHours.get(monthKey);
      return val !== undefined ? normalizeNumber(val) : null; // null = blank cell
    });
    const totalHours = normalizeNumber(
      [...group.monthHours.values()].reduce((sum, value) => sum + Number(value || 0), 0)
    );
    return [
      group.bu,
      group.project_name,
      group.employee_name,
      group.department,
      group.department_full,
      group.position,
      ...monthValues,
      totalHours,
    ];
  });

  return {
    headers: [...BASE_HEADERS, ...continuousMonths, "总计"],
    rows,
    sheetName: SHEET_NAME,
    filename: buildCustomProjectHoursFilename(now),
    projectCount: new Set(sortedGroups.map((group) => group.project_name)).size,
    employeeCount: sortedGroups.length,
    monthCount: continuousMonths.length,
  };
};
