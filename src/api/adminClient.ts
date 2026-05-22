import axios from 'axios';
import { api } from './client';

const normalizeBase = (base: string) => {
  const b = String(base || '').trim().replace(/\/+$/, '');
  return b.endsWith('/api') ? b : `${b}/api`;
};

const inferLocalApi = () => {
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:5050/api`;
  } catch {
    void 0;
  }
  return null;
};

export const getAdminBaseUrl = () => {
  const env = String((import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_ADMIN_API_URL || '').trim();
  if (env) return normalizeBase(env);

  try {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (import.meta.env.DEV && isLocal) {
      const v = localStorage.getItem('arcmailAdminAllowRemoteApi');
      const allowRemote = v === '1';
      if (!allowRemote) return inferLocalApi() || 'http://localhost:5050/api';
      const current = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
      return current ? current : '/api';
    }
  } catch {
    void 0;
  }

  const current = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  return current || '/api';
};

export const adminApi = axios.create({
  baseURL: getAdminBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

adminApi.interceptors.request.use(
  (config) => {
    config.baseURL = getAdminBaseUrl();
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);
