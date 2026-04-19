export const getTranslations = (lang) => {
  const t = {
    zh: {
      dashboard: '仪表盘', stats: '统计分析', activity: '活跃度',
      reporting: '完整填报率', approval: '审批完成率',
      title: '数字全景看板', subtitle: '实时的工时统计与分析', sync: '同步数据', filters: '筛选',
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
      allProjects: '全部项目',
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
      filterScheduleProjects: '选择项目（可多选）',
      chartModeMonthly: '月度工时',
      chartModeMilestone: '节点工时占比'
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
      allProjects: 'All Projects',
      rankingTitle: 'Project Hours Ranking', avgMonthlyHours: 'Avg. Monthly Hours',
      projectAnalysis: 'Project Analysis', deptContribution: 'Dept. Contribution',
      selectProjects: 'Select Projects (multi-select)',
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
      filterScheduleProjects: 'Select Projects (multi-select)',
      chartModeMonthly: 'Monthly Hours',
      chartModeMilestone: 'Milestone Hours'
    }
  }[lang] || {};

  t.scheduleMonitorSubtitle = lang === 'zh'
    ? '月度部门工时与项目节点进度条联动展示'
    : 'View monthly department hours with milestone progress bars in one chart.';
  t.monthlyHours = lang === 'zh' ? '月度部门工时' : 'Monthly Department Hours';
  t.milestoneProgress = lang === 'zh' ? '项目节点进度' : 'Milestone Progress';
  t.scheduleHoursEmpty = lang === 'zh'
    ? '当前项目暂时没有 Close 工时'
    : 'No Close hours are available for the current project yet.';
  t.customDataNav = lang === 'zh' ? '定制化数据' : 'Custom Data';
  t.customDataHeroTitle = lang === 'zh' ? '定制化数据导出' : 'Custom Data Export';
  t.customDataTitle = lang === 'zh' ? '每项目工时数据导出' : 'Project Hours Data Export';
  t.customDataSubtitle = lang === 'zh'
    ? '按 Project + Close 口径导出；月列按「工作周划分」归属 work_month（与后台一致），无划分表时退回自然月。'
    : 'Project + Close export; month columns use work-week rules (work_month), same as backend; calendar month if no work-week table.';
  t.exportCustomData = lang === 'zh' ? '导出每项目工时' : 'Export Project Hours';
  t.customDataScope = lang === 'zh'
    ? '导出全部 Close 项目行；仅列出有数据的 work_month 列（不补空月）。'
    : 'All Close project rows; only work_month columns that have data (no gap months).';
  t.customDataReuploadHint = lang === 'zh'
    ? '若历史工时尚未按新解析逻辑重传，“所属部门/职位” 可能为空。'
    : 'If historical timesheets have not been re-uploaded, full department and position may still be empty.';
  t.customDataProjects = lang === 'zh' ? '项目数' : 'Projects';
  t.customDataEmployees = lang === 'zh' ? '员工行数' : 'Employee Rows';
  t.customDataMonths = lang === 'zh' ? '月份列数' : 'Month Columns';
  t.uploadWorkWeek = lang === 'zh' ? '上传工作周划分' : 'Upload Work Week';
  t.workWeekUploadSuccess = lang === 'zh' ? '工作周划分上传成功，已处理周数：' : 'Work week upload success, weeks processed:';
  t.exportPersonMonthRatio = lang === 'zh' ? '导出人月占比' : 'Export Person-Month Ratio';
  t.personMonthRatioTitle = lang === 'zh' ? '人月占比导出' : 'Person-Month Ratio Export';
  t.personMonthRatioSubtitle = lang === 'zh'
    ? '按项目 + Close 口径，计算每位员工每月工时占比（需先上传工作周划分文件）。'
    : 'Per-project Close-scoped monthly ratio per employee. Requires work week file upload.';
  t.completenessTitle = lang === 'zh' ? '漏填检查' : 'Missing Submission Check';
  t.completenessBaseline = lang === 'zh' ? '基数人数' : 'Baseline Employees';
  t.completenessSubmitted = lang === 'zh' ? '本期已填报' : 'Submitted This Period';
  t.completenessMissing = lang === 'zh' ? '需补填人数' : 'Missing Employees';
  t.completenessRate = lang === 'zh' ? '完整性' : 'Completeness';
  t.completenessMissingList = lang === 'zh' ? '需补填员工（前50）' : 'Missing Employees (Top 50)';
  t.completenessNoMissing = lang === 'zh' ? '本期无补填对象。' : 'No missing employees in current period.';
  t.completenessMethodA = lang === 'zh' ? '方式A：员工基础信息在职人员' : 'Method A: Active Employees from HR Roster';
  t.completenessMethodADesc = lang === 'zh' ? '以员工基础信息表中所有在职人员为基数，检查本期是否填报工时。' : 'Checks whether all active employees in the HR roster have submitted hours this period.';
  t.completenessMethodB = lang === 'zh' ? '方式B：历史填报在职人员' : 'Method B: Historical Reporters Still Active';
  t.completenessMethodBDesc = lang === 'zh' ? '基于最新上传数据：对最近4周逐周检查，历史填报且在职人员中，任意一周未出现即判定为漏填。' : 'Based on latest upload data: check each of the latest 4 weeks, and mark an active historical filer as missing if absent in any week.';
  t.reportingGapCaption = lang === 'zh'
    ? '以下按「应填工时 vs 实际工时」汇总，仅按姓名；不含核准状态为「未提交 Not Submitted」的整行（与原先逻辑一致）。'
    : 'Target vs actual hours by employee name; excludes rows whose status is exactly “未提交 Not Submitted” (original rule).';
  t.vanishedUploadTitle = lang === 'zh' ? '本次上传表中未出现的人员' : 'Missing from latest upload file';
  t.vanishedUploadSubtitle = lang === 'zh'
    ? '相对上一份上传：曾有工时记录，但本文件里完全没有该人员任何一行（按姓名；限在职）。与上方「应填对比」不是同一规则。'
    : 'Had rows before the last replace, but absent from the new file (by name; active employees only). Different from the hour-gap section above.';
  t.vanishedUploadEmpty = lang === 'zh' ? '无此类人员。' : 'None.';
  t.vanishedUploadList = lang === 'zh' ? '名单（前40）' : 'Names (first 40)';
  t.vanishedUploadCount = lang === 'zh' ? '人数' : 'Count';

  return t;
};

export const getUiText = (lang) => {
  return {
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
  }[lang] || {};
};
