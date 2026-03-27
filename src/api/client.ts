import axios from 'axios';
const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const normalizedApiUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '';
const API_URL = normalizedApiUrl
  ? normalizedApiUrl.endsWith('/api')
    ? normalizedApiUrl
    : `${normalizedApiUrl}/api`
  : '/api';

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
