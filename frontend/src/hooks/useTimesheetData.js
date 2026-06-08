import { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');

export const useTimesheetData = (t) => {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('checking'); // 'checking', 'connected', 'error'
  const [reportingData, setReportingData] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [vanishedAfterUpload, setVanishedAfterUpload] = useState({ names: [], updated_at: null });
  const [workWeeks, setWorkWeeks] = useState([]);
  const [approvalData, setApprovalData] = useState([]);
  const [projectScheduleData, setProjectScheduleData] = useState({ projects: [] });
  const [uploadAuditReport, setUploadAuditReport] = useState(null);

  const checkConnection = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ping`);
      if (res.ok) setStatus('connected');
      else setStatus('error');
    } catch {
      // ignore
    }
  };

  const fetchReportingData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reporting-rate`);
      if (!res.ok) return;
      const json = await res.json();
      setReportingData(json);
    } catch (err) {
      console.error('Failed to fetch reporting data:', err);
    }
  }, []);

  const fetchActiveEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/active-employees`);
      if (!res.ok) return;
      const json = await res.json();
      setActiveEmployees(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('Failed to fetch active employees:', err);
    }
  }, []);

  const fetchWorkWeeks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/work-weeks`);
      if (!res.ok) return;
      const json = await res.json();
      setWorkWeeks(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('Failed to fetch work weeks:', err);
    }
  }, []);

  const fetchVanishedAfterUpload = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vanished-after-upload`);
      if (!res.ok) return;
      const json = await res.json();
      setVanishedAfterUpload({
        names: Array.isArray(json.names) ? json.names : [],
        updated_at: json.updated_at || null
      });
    } catch (err) {
      console.error('Failed to fetch vanished-after-upload:', err);
    }
  }, []);

  const fetchApprovalData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/approval-rate`);
      if (!res.ok) return;
      const json = await res.json();
      setApprovalData(json);
    } catch (err) {
      console.error('Failed to fetch approval data:', err);
    }
  }, []);

  const fetchProjectScheduleData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/project-schedule-analysis`);
      if (!res.ok) return;
      const json = await res.json();
      setProjectScheduleData(json);
    } catch (err) {
      console.error('Failed to fetch project schedule data:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stats`);
      if (!res.ok) throw new Error('Backend responded with error');
      const json = await res.json();
      setData(json);
      setStatus('connected');
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    checkConnection();
    fetchData();
    fetchReportingData();
    fetchActiveEmployees();
    fetchVanishedAfterUpload();
    fetchApprovalData();
    fetchProjectScheduleData();
    fetchWorkWeeks();
    const interval = setInterval(() => {
        checkConnection();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchReportingData, fetchActiveEmployees, fetchVanishedAfterUpload, fetchApprovalData, fetchProjectScheduleData, fetchWorkWeeks]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      const vc = result.vanished_count ?? 0;
      setUploadAuditReport({
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        rowsProcessed: result.rows_processed ?? 0,
        employeesProcessed: result.employees_processed ?? 0,
        vanishedCount: vc,
        vanishedEmployees: Array.isArray(result.vanished_employees) ? result.vanished_employees : [],
        audit: result.audit || {},
      });
      fetchData();
      fetchReportingData();
      fetchActiveEmployees();
      fetchVanishedAfterUpload();
      fetchApprovalData();
      fetchProjectScheduleData();
      fetchWorkWeeks();
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleWorkWeekUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload-work-week`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      alert(`${t.workWeekUploadSuccess} ${result.weeks_processed}`);
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleProjectScheduleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload-project-schedule`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || result.message || 'Upload failed');
      alert(`${t.scheduleUploadSuccess} ${result.projects_processed} / ${result.milestones_processed}`);
      fetchProjectScheduleData();
    } catch (err) {
      alert(`${t.uploadFailed}: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  return {
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
    handleProjectScheduleUpload,
    uploadAuditReport,
    clearUploadAuditReport: () => setUploadAuditReport(null),
    refreshProjectScheduleData: fetchProjectScheduleData
  };
};
