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

// ── Users ─────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/api/users'),
  create: (data: any) => api.post('/api/users', data),
  update: (id: string, data: any) => api.put(`/api/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/api/users/${id}`),
  hardDelete: (id: string) => api.delete(`/api/users/${id}/hard`),
};

// ── Audit ─────────────────────────────────────────────
export const auditApi = {
  getAll: (params?: any) => api.get('/api/audit-logs', { params }),
  exportCsv: () => api.get('/api/audit-logs/export', { responseType: 'blob' }),
};
