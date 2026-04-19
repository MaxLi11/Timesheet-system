import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Upload, ChevronDown, Inbox } from 'lucide-react';
import { buildProjectScheduleChartOption, buildMilestoneIntervalChartOption } from '../../utils/chartBuilders';

export const ProjectAnalysisPanel = ({ 
  projectScheduleData, 
  handleProjectScheduleUpload, 
  t, 
  lang, 
  data, 
  pageMeta 
}) => {
  const [scheduleSelectedProjects, setScheduleSelectedProjects] = useState(new Set());
  const [scheduleProjectPickerOpen, setScheduleProjectPickerOpen] = useState(false);
  const [scheduleChartMode, setScheduleChartMode] = useState('monthly');
  const scheduleProjectPickerRef = useRef(null);

  const scheduleProjects = projectScheduleData.projects || [];

  // Sync selected projects when data loads
  useEffect(() => {
    if (scheduleProjects.length === 0) {
      setScheduleSelectedProjects(new Set());
      return;
    }
    setScheduleSelectedProjects(prev => {
      const allProjectNames = scheduleProjects.map(project => project.project_name);
      if (prev.size === 0) {
        return new Set(allProjectNames);
      }
      const validSelections = allProjectNames.filter(projectName => prev.has(projectName));
      return validSelections.length > 0 ? new Set(validSelections) : new Set(allProjectNames);
    });
  }, [projectScheduleData, scheduleProjects]);

  // Click outside to close picker
  useEffect(() => {
    if (!scheduleProjectPickerOpen) return;
    const handleDown = (event) => {
      if (scheduleProjectPickerRef.current?.contains(event.target)) return;
      setScheduleProjectPickerOpen(false);
    };
    document.addEventListener('pointerdown', handleDown);
    return () => document.removeEventListener('pointerdown', handleDown);
  }, [scheduleProjectPickerOpen]);

  const visibleScheduleProjects = useMemo(
    () => scheduleProjects.filter(project => scheduleSelectedProjects.has(project.project_name)),
    [scheduleProjects, scheduleSelectedProjects]
  );

  const scheduleChartOptions = useMemo(() => {
    const chartMap = new Map();
    scheduleProjects.forEach(project => {
      chartMap.set(project.project_name, buildProjectScheduleChartOption(project, lang, t, data));
    });
    return chartMap;
  }, [data, lang, scheduleProjects, t]);

  const milestoneChartOptions = useMemo(() => {
    const chartMap = new Map();
    scheduleProjects.forEach(project => {
      chartMap.set(project.project_name, buildMilestoneIntervalChartOption(project, lang, t));
    });
    return chartMap;
  }, [lang, scheduleProjects, t]);

  const toggleScheduleProject = (projectName) => {
    setScheduleSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectName)) next.delete(projectName);
      else next.add(projectName);
      return next;
    });
  };

  return (
    <>
      <header className="page-hero" style={{ gridTemplateColumns: '1fr' }}>
        <div className="page-intro-copy" style={{ overflow: 'visible', zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.88rem', width: '100%', position: 'relative', zIndex: 10 }}>
            {/* Header / Upload / Filter Row */}
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-end', gap: '0.78rem' }}>
              <label className="utility-upload schedule-upload-control" style={{ margin: 0, flexShrink: 0 }}>
                <Upload size={18} />
                <span>{t.uploadProjectSchedule}</span>
                <input type="file" hidden onChange={handleProjectScheduleUpload} />
              </label>
              
              <div className="filter-group dropdown-container" ref={scheduleProjectPickerRef} style={{ marginLeft: 0, flexShrink: 0 }}>
                <label>{t.filterScheduleProjects}</label>
                <button
                  type="button"
                  className="dropdown-button"
                  onClick={() => setScheduleProjectPickerOpen(prev => !prev)}
                >
                  {scheduleSelectedProjects.size === 0
                    ? t.allScheduleProjects
                    : (lang === 'zh' ? `已选 ${scheduleSelectedProjects.size} 个` : `${scheduleSelectedProjects.size} selected`)}
                  <ChevronDown size={16} />
                </button>
                {scheduleProjectPickerOpen && (
                  <div className="approval-project-panel">
                    <div className="project-panel-header">
                      <span className="filter-group-label">{t.filterScheduleProjects}</span>
                      <div className="project-panel-btns">
                        <button type="button" onClick={() => setScheduleSelectedProjects(new Set(scheduleProjects.map(p => p.project_name)))}>
                          {t.selectAll}
                        </button>
                        <button type="button" onClick={() => setScheduleSelectedProjects(new Set())}>
                          {t.clearAll}
                        </button>
                      </div>
                    </div>
                    <div className="project-checkboxes">
                      {scheduleProjects.map(project => (
                        <label key={project.project_name} className={`project-chip ${scheduleSelectedProjects.has(project.project_name) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={scheduleSelectedProjects.has(project.project_name)}
                            onChange={() => toggleScheduleProject(project.project_name)}
                          />
                          <span className="chip-label">{project.project_name}</span>
                        </label>
                      ))}
                      {scheduleProjects.length === 0 && <span className="text-muted empty-state-text">{t.noScheduleData}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Mode Toggle */}
            <div className="schedule-mode-toggle">
              <button
                type="button"
                className={scheduleChartMode === 'monthly' ? 'active' : ''}
                onClick={() => setScheduleChartMode('monthly')}
              >
                {t.chartModeMonthly}
              </button>
              <button
                type="button"
                className={scheduleChartMode === 'milestone' ? 'active' : ''}
                onClick={() => setScheduleChartMode('milestone')}
              >
                {t.chartModeMilestone}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="project-schedule-section section-shell">
        <div className="card project-schedule-shell elevated-module">
          {scheduleProjects.length === 0 ? (
            <div className="project-schedule-empty">
              <div className="empty-state-content">
                <Inbox size={46} strokeWidth={1.2} />
                <p>{t.noScheduleData}</p>
              </div>
            </div>
          ) : visibleScheduleProjects.length === 0 ? (
            <div className="project-schedule-empty">
              <div className="empty-state-content">
                <Inbox size={46} strokeWidth={1.2} />
                <p>{t.filterScheduleProjects}</p>
              </div>
            </div>
          ) : (
            <div className="project-schedule-grid">
              {visibleScheduleProjects.map(project => (
                <article key={project.project_name} className="project-schedule-card">
                  <div className="project-schedule-card-header">
                    <div>
                      <h3>{project.project_name}</h3>
                      <p className="module-caption">{project.bu || '--'} / {project.status || '--'}</p>
                    </div>
                    <div className="project-meta-pills">
                      <span className="hero-meta-pill">
                        <span>{t.projectStatus}</span>
                        <strong>{project.status || '--'}</strong>
                      </span>
                      <span className="hero-meta-pill">
                        <span>{t.mappedProjects}</span>
                        <strong>{(project.mapped_timesheet_projects || []).join(', ') || '--'}</strong>
                      </span>
                    </div>
                  </div>
                  <ReactECharts
                    option={scheduleChartMode === 'monthly'
                      ? scheduleChartOptions.get(project.project_name)
                      : milestoneChartOptions.get(project.project_name)}
                    style={{ height: '320px' }}
                    notMerge={true}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
