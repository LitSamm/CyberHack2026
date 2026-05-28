import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aromos_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('aromos_token');
      localStorage.removeItem('aromos_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
};

// ── Dashboard ─────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/api/dashboard/stats'),
  getRecentActivity: () => api.get('/api/dashboard/recent-activity'),
  getNotifications: () => api.get('/api/dashboard/notifications'),
};

// ── Users ─────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/api/users'),
  create: (data: any) => api.post('/api/users', data),
  update: (id: string, data: any) => api.put(`/api/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/api/users/${id}`),
};

// ── Suppliers ─────────────────────────────────────────
export const suppliersApi = {
  getAll: () => api.get('/api/suppliers'),
  create: (data: any) => api.post('/api/suppliers', data),
  update: (id: string, data: any) => api.put(`/api/suppliers/${id}`, data),
};

// ── Materials ─────────────────────────────────────────
export const materialsApi = {
  getAll: (params?: any) => api.get('/api/materials', { params }),
  getById: (id: string) => api.get(`/api/materials/${id}`),
  create: (data: any) => api.post('/api/materials', data),
  update: (id: string, data: any) => api.put(`/api/materials/${id}`, data),
};

// ── Lots ──────────────────────────────────────────────
export const lotsApi = {
  getAll: (params?: any) => api.get('/api/lots', { params }),
  getById: (id: string) => api.get(`/api/lots/${id}`),
  create: (data: any) => api.post('/api/lots', data),
  update: (id: string, data: any) => api.put(`/api/lots/${id}`, data),
};

// ── QC ────────────────────────────────────────────────
export const qcApi = {
  getAll: (params?: any) => api.get('/api/qc', { params }),
  submit: (data: any) => api.post('/api/qc', data),
  update: (id: string, data: any) => api.put(`/api/qc/${id}`, data),
  getPending24h: () => api.get('/api/qc/alerts/pending-24h'),
};

// ── PPIC ──────────────────────────────────────────────
export const ppicApi = {
  getSchedules: (params?: any) => api.get('/api/ppic/schedules', { params }),
  createSchedule: (data: any) => api.post('/api/ppic/schedules', data),
  updateSchedule: (id: string, data: any) => api.put(`/api/ppic/schedules/${id}`, data),
  deleteSchedule: (id: string) => api.delete(`/api/ppic/schedules/${id}`),
};

// ── Warehouse ─────────────────────────────────────────
export const warehouseApi = {
  getSlots: (params?: any) => api.get('/api/warehouse/slots', { params }),
  updateSlot: (id: string, data: any) => api.put(`/api/warehouse/slots/${id}`, data),
  getStats: () => api.get('/api/warehouse/stats'),
};

// ── Dispatch ──────────────────────────────────────────
export const dispatchApi = {
  getAll: (params?: any) => api.get('/api/dispatch', { params }),
  create: (data: any) => api.post('/api/dispatch', data),
  update: (id: string, data: any) => api.put(`/api/dispatch/${id}`, data),
};

// ── Audit ─────────────────────────────────────────────
export const auditApi = {
  getAll: (params?: any) => api.get('/api/audit-logs', { params }),
  exportCsv: () => api.get('/api/audit-logs/export', { responseType: 'blob' }),
};

// ── Search ────────────────────────────────────────────
export const searchApi = {
  search: (q: string) => api.get('/api/search', { params: { q } }),
};
