import axios from 'axios';

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)
  || (import.meta.env.VITE_APP_URL as string | undefined);

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
    if (host === 'mail.arcbyte.co') return 'https://api.arcbyte.co/api';
    if (host.endsWith('.arcbyte.co') && host.startsWith('mail.')) {
      return `https://api.${host.slice('mail.'.length)}/api`;
    }
  } catch {
    return null;
  }
  return null;
};

const isLocalHost = () => {
  try {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
};

const API_URL = (() => {
  if (envApiUrl) {
    const cleaned = cleanEnvUrl(envApiUrl);
    if (/^https?:\/\//i.test(cleaned)) return normalizeBase(cleaned);
    if (cleaned.startsWith('/') && !isLocalHost()) return cleaned;
  }
  return inferApiBase() || '/api';
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
      
      // Only redirect if not already on a login page
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
