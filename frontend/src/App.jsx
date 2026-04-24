import React, { useState, useMemo, lazy, Suspense } from 'react';
import { LayoutDashboard, BarChart3, Calendar, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { getTranslations, getUiText } from './i18n/translations';
import { useTimesheetData } from './hooks/useTimesheetData';
import { Header } from './components/layout/Header';

// Route-level code splitting: each panel is only downloaded when first visited
const OverviewPanel       = lazy(() => import('./components/dashboard/OverviewPanel').then(m => ({ default: m.OverviewPanel })));
const ProjectAnalysisPanel = lazy(() => import('./components/dashboard/ProjectAnalysisPanel').then(m => ({ default: m.ProjectAnalysisPanel })));
const CustomDataPanel     = lazy(() => import('./components/dashboard/CustomDataPanel').then(m => ({ default: m.CustomDataPanel })));
const ReportingPanel      = lazy(() => import('./components/dashboard/ReportingPanel').then(m => ({ default: m.ReportingPanel })));
const ApprovalPanel       = lazy(() => import('./components/dashboard/ApprovalPanel').then(m => ({ default: m.ApprovalPanel })));

// Simple skeleton shown while a panel chunk is loading
const PanelSkeleton = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40vh',
    color: 'var(--color-slate-soft, #7687a5)',
    fontSize: '0.9rem',
    letterSpacing: '0.04em',
    opacity: 0.7,
  }}>
    <span style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
    Loading…
  </div>
);

const App = () => {
  const isEmbed = useMemo(() => new URLSearchParams(window.location.search).get('embed') === 'true', []);
  const [activeTab, setActiveTab] = useState('overview');
  const [lang, setLang] = useState('zh');
  
  const t = useMemo(() => getTranslations(lang), [lang]);
  const uiText = useMemo(() => getUiText(lang), [lang]);

  const {
    data,
    status,
    reportingData,
    activeEmployees,
    vanishedAfterUpload,
    workWeeks,
    setWorkWeeks,
    approvalData,
    projectScheduleData,
    handleFileUpload,
    handleWorkWeekUpload,
    handleProjectScheduleUpload
  } = useTimesheetData(t);

  const pageMeta = useMemo(() => {
    const metaByTab = {
      overview:          { eyebrow: t.dashboard,       title: t.title,                description: t.subtitle },
      project_analysis:  { eyebrow: t.projectAnalysis, title: t.scheduleMonitorTitle,  description: t.scheduleMonitorSubtitle },
      custom_data:       { eyebrow: t.customDataNav,   title: t.customDataTitle,        description: t.customDataSubtitle },
      reporting:         { eyebrow: t.reporting,       title: t.reportingTitle,         description: t.reportingSubtitle },
      approval:          { eyebrow: t.approval,        title: t.approvalTitle,          description: t.approvalSubtitle },
    };
    return metaByTab[activeTab] || metaByTab.overview;
  }, [activeTab, t]);

  const navItems = useMemo(() => ([
    { id: 'overview',          label: t.dashboard,       icon: LayoutDashboard },
    { id: 'project_analysis',  label: t.projectAnalysis, icon: BarChart3 },
    { id: 'custom_data',       label: t.customDataNav,   icon: Calendar },
    { id: 'reporting',         label: t.reporting,       icon: ClipboardCheck },
    { id: 'approval',          label: t.approval,        icon: CheckCircle2 },
  ]), [t]);

  const statusLabel = status === 'connected' ? t.connected : status === 'error' ? t.disconnected : t.checking;

  return (
    <div className={`app-shell ${isEmbed ? 'is-embed' : ''}`}>
      <div className="app-glow app-glow-one" aria-hidden="true" />
      <div className="app-glow app-glow-two" aria-hidden="true" />

      <Header
        status={status}
        statusLabel={statusLabel}
        t={t}
        uiText={uiText}
        lang={lang}
        setLang={setLang}
        handleFileUpload={handleFileUpload}
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main-content">
        <Suspense fallback={<PanelSkeleton />}>
          {activeTab === 'overview' && (
            <OverviewPanel
              data={data}
              workWeeks={workWeeks}
              t={t}
              uiText={uiText}
              pageMeta={pageMeta}
              statusLabel={statusLabel}
            />
          )}

          {activeTab === 'project_analysis' && (
            <ProjectAnalysisPanel
              projectScheduleData={projectScheduleData}
              handleProjectScheduleUpload={handleProjectScheduleUpload}
              t={t}
              lang={lang}
              data={data}
              pageMeta={pageMeta}
            />
          )}

          {activeTab === 'custom_data' && (
            <CustomDataPanel
              data={data}
              workWeeks={workWeeks}
              setWorkWeeks={setWorkWeeks}
              handleWorkWeekUpload={handleWorkWeekUpload}
              t={t}
              lang={lang}
            />
          )}

          {activeTab === 'reporting' && (
            <ReportingPanel
              reportingData={reportingData}
              activeEmployees={activeEmployees}
              workWeeks={workWeeks}
              t={t}
              lang={lang}
              uiText={uiText}
              pageMeta={pageMeta}
            />
          )}

          {activeTab === 'approval' && (
            <ApprovalPanel
              approvalData={approvalData}
              workWeeks={workWeeks}
              t={t}
              uiText={uiText}
              pageMeta={pageMeta}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
};

export default App;

