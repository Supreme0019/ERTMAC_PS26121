// =============================================================================
// NWIS Frontend — Axios API Client
// =============================================================================

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: Attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nwis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: Handle Errors & Token Refresh ─────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('nwis_refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('nwis_token', data.data.accessToken);
          if (data.data.refreshToken) {
            localStorage.setItem('nwis_refresh_token', data.data.refreshToken);
          }
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem('nwis_token');
          localStorage.removeItem('nwis_refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// ── Wells ────────────────────────────────────────────────────────────────────
export const wellsAPI = {
  getAll: (params) => api.get('/wells', { params }),
  getById: (id) => api.get(`/wells/${id}`),
  create: (data) => api.post('/wells', data),
  update: (id, data) => api.patch(`/wells/${id}`, data),
  delete: (id) => api.delete(`/wells/${id}`),
  nearby: (params) => api.get('/wells/nearby', { params }),
  nearbyByWell: (id, params) => api.get(`/wells/${id}/nearby`, { params }),
  compare: (wellIds) => api.post('/wells/compare', { wellIds }),
  getHandoverReport: (id) => api.get(`/wells/${id}/handover`),
};

// ── Trajectory ───────────────────────────────────────────────────────────────
export const trajectoryAPI = {
  get: (wellId) => api.get(`/wells/${wellId}/trajectory`),
  add: (wellId, data) => api.post(`/wells/${wellId}/trajectory`, data),
};

// ── Formations ───────────────────────────────────────────────────────────────
export const formationsAPI = {
  getByWell: (wellId) => api.get(`/wells/${wellId}/formations`),
  getAll: (params) => api.get('/formations', { params }),
  assign: (wellId, data) => api.post(`/wells/${wellId}/formations`, data),
  getById: (id) => api.get(`/formations/${id}`),
  getWells: (id) => api.get(`/formations/${id}/wells`),
  create: (data) => api.post('/formations', data),
};

// ── Events ───────────────────────────────────────────────────────────────────
export const eventsAPI = {
  getByWell: (wellId, params) => api.get(`/wells/${wellId}/events`, { params }),
  getSummary: (wellId) => api.get(`/wells/${wellId}/events/summary`),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.patch(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  getMitigations: (eventId) => api.get(`/events/${eventId}/mitigations`),
  addMitigation: (data) => api.post('/events/mitigations', data),
};

// ── Parameters ───────────────────────────────────────────────────────────────
export const parametersAPI = {
  getByWell: (wellId) => api.get(`/wells/${wellId}/parameters`),
  add: (wellId, data) => api.post(`/wells/${wellId}/parameters`, data),
  addBatch: (wellId, data) => api.post(`/wells/${wellId}/parameters/batch`, data),
  getLatest: (wellId) => api.get(`/wells/${wellId}/parameters/latest`),
  getTrends: (wellId) => api.get(`/wells/${wellId}/parameters/trends`),
};

// ── Documents ────────────────────────────────────────────────────────────────
export const documentsAPI = {
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  getStatus: (id) => api.get(`/documents/${id}/status`),
  reprocess: (id) => api.post(`/documents/${id}/reprocess`),
  getChunks: (id) => api.get(`/documents/${id}/chunks`),
  getEntities: (id) => api.get(`/documents/${id}/entities`),
  getFileUrl: (idOrKey) => {
    const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
    return `${base}/documents/${encodeURIComponent(idOrKey)}/file`;
  },
};

// ── Search ───────────────────────────────────────────────────────────────────
export const searchAPI = {
  search: (data) => api.post('/search', data),
  autocomplete: (q, limit = 8) => api.get('/search/autocomplete', { params: { q, limit } }),
  vector: (data) => api.post('/search/vector', data),
};

// ── Assistant ────────────────────────────────────────────────────────────────
export const assistantAPI = {
  query: (data) => api.post('/assistant/query', data),
  getHistory: (sessionId) => api.get('/assistant/history', { params: { session_id: sessionId } }),
  clearHistory: (sessionId) => api.delete('/assistant/history', { params: { session_id: sessionId } }),
};

// ── Similarity ───────────────────────────────────────────────────────────────
export const similarityAPI = {
  findSimilar: (wellId, params) => api.get(`/similarity/${wellId}`, { params }),
};

// ── Risks ────────────────────────────────────────────────────────────────────
export const risksAPI = {
  evaluate: (data) => api.post('/risks/evaluate', data),
  getActive: (wellId) => api.get(`/risks/${wellId}/active`),
  getByWell: (wellId, params) => api.get(`/risks/${wellId}`, { params }),
};

// ── Alerts ───────────────────────────────────────────────────────────────────
export const alertsAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getByWell: (wellId) => api.get(`/alerts/${wellId}`),
  getById: (id) => api.get(`/alerts/item/${id}`),
  acknowledge: (id) => api.patch(`/alerts/${id}/acknowledge`),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
  feedback: (id, feedback) => api.patch(`/alerts/${id}/feedback`, { feedback }),
};

// ── Realtime ─────────────────────────────────────────────────────────────────
export const realtimeAPI = {
  getState: (wellId) => api.get(`/realtime/${wellId}/state`),
  startReplay: (wellId, speedMs = 3000) => api.post('/realtime/replay/start', { wellId, speedMs }),
  stopReplay: () => api.post('/realtime/replay/stop'),
  getReplayStatus: () => api.get('/realtime/replay/status'),
  uploadWitsml: (wellId, data, isXml = false) =>
    api.post(`/realtime/${wellId}/witsml`, data, {
      headers: isXml ? { 'Content-Type': 'application/xml' } : undefined,
    }),
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getWellDashboard: (wellId) => api.get(`/dashboard/${wellId}`),
  getOverview: (params) => api.get('/dashboard/overview', { params }),
};

// ── Analytics ────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getEvents: (params) => api.get('/analytics/events', { params }),
  getFormations: (params) => api.get('/analytics/formations', { params }),
  getRisks: (params) => api.get('/analytics/risks', { params }),
  getAlerts: (params) => api.get('/analytics/alerts', { params }),
  getNPT: (params) => api.get('/analytics/npt', { params }),
  getDrillingPerformance: (params) => api.get('/analytics/drilling-performance', { params }),
  backtest: (params) => api.get('/analytics/backtest', { params }),
  feedbackPrecision: () => api.get('/analytics/feedback-precision'),
};

// ── Compare ──────────────────────────────────────────────────────────────────
export const compareAPI = {
  compare: (data) => api.post('/compare', data),
};

// ── Planning ──────────────────────────────────────────────────────────────────
export const planningAPI = {
  getBlocks: () => api.get('/planning/blocks'),
  evaluate: (data) => api.post('/planning/evaluate', data),
  getFormationStats: (params) => api.get('/planning/formation-stats', { params }),
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get('/health'),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs: (params) => api.get('/audit', { params }),
};

// ── ML (Experimental Model Predictions) ──────────────────────────────────────
export const mlAPI = {
  predict: (wellId, params) => api.get(`/ml/risk/${wellId}`, { params }),
  getAIConfig: () => api.get('/ml/ai-config'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export default api;
