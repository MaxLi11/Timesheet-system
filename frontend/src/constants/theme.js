// ── 视觉主题常量 ─────────────────────────────────────────────────────────────
// 所有颜色、阴影、图表公用样式都集中在这里，避免散落在组件里

export const EDITORIAL_THEME = {
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
  palette: ['#4d72ff', '#7aa6ff', '#ff8b4b', '#6fbfff', '#6b8dff', '#ffb36e'],
};

export const SCHEDULE_SERIES_COLORS = {
  planned: '#7aa6ff',
  actual: '#4d72ff',
  pending: '#ff8b4b',
};

// ── ECharts 公用样式片段 ──────────────────────────────────────────────────────

export const tooltipBase = {
  backgroundColor: EDITORIAL_THEME.cloud,
  borderColor: EDITORIAL_THEME.border,
  borderWidth: 1,
  padding: [12, 14],
  textStyle: {
    color: EDITORIAL_THEME.graphite,
    fontWeight: 600,
    fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
  },
  extraCssText: `box-shadow: ${EDITORIAL_THEME.tooltipShadow}; border-radius: 16px;`,
};

export const chartText = { color: EDITORIAL_THEME.slateSoft, fontWeight: 600 };
export const chartAxis = { color: EDITORIAL_THEME.slateSoft, fontWeight: 500 };
export const chartSplitLine = { lineStyle: { color: EDITORIAL_THEME.splitLine } };
