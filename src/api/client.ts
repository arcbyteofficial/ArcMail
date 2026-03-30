import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;

const cleanEnvUrl = (value: string) => {
  const trimmed = value.trim();
  return trimmed.replace(/^['"`]+/, '').replace(/['"`]+$/, '');
};

const normalizeBase = (base: string) => {
  const b = cleanEnvUrl(base).replace(/\/+$/, '');
  return b.endsWith('/api') ? b : `${b}/api`;
};

const inferApiBase = () => {
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const backendHost = host;
      return `http://${backendHost}:5050/api`;
    }
    return 'https://api.arcbyte.co/api';
  } catch {
    return null;
  }
};

const API_URL = (() => {
  if (envApiUrl) {
    const cleaned = cleanEnvUrl(envApiUrl);
    if (/^https?:\/\//i.test(cleaned)) return normalizeBase(cleaned);
    if (cleaned.startsWith('/')) return cleaned;
  }
  return inferApiBase() || 'https://api.arcbyte.co/api';
})();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const mailCsrf = sessionStorage.getItem('mailCsrf') || localStorage.getItem('mailCsrf');
    if (mailCsrf) {
      config.headers['x-csrf-token'] = mailCsrf;
    }
    const mailSessionId = sessionStorage.getItem('mailSessionId') || localStorage.getItem('mailSessionId');
    if (mailSessionId) {
      config.headers['x-mail-session'] = mailSessionId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear storage and redirect to login if unauthorized
      const keys = [
        'token',
        'isAuthenticated',
        'userRole',
        'userName',
        'userEmail',
        'userId',
        'userStatus',
        'clientId',
        'mailCsrf',
        'mailSessionId',
      ];
      keys.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });

      try {
        const raw = localStorage.getItem('mailAccounts');
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        const hasAccounts = Array.isArray(parsed) && parsed.length > 0;
        if (!hasAccounts && !window.location.pathname.includes('login')) {
          window.location.href = '/login';
        }
      } catch {
        if (!window.location.pathname.includes('login')) window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
