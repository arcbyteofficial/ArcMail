import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string } | null;
  login: (password: string, email?: string, rememberMe?: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEYS = [
  'isAuthenticated',
  'token',
  'userRole',
  'userName',
  'userEmail',
  'userId',
  'userStatus',
  'clientId',
  'mailCsrf',
  'mailSessionId',
] as const;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [user, setUser] = useState<{ name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string } | null>(null);

  const clearAuthStorage = useCallback(() => {
    AUTH_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      clearAuthStorage();
      const path = window.location.pathname || '';
      if (path.includes('/login')) return;
      window.location.href = '/login';
    } catch {
      const path = window.location.pathname || '';
      clearAuthStorage();
      window.location.href = path.includes('/login') ? '/login' : '/login';
    }
  }, [clearAuthStorage]);

  // Initialize auth state from local storage and validate token
  useEffect(() => {
    const initializeAuth = async () => {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
        const storedName = storage.getItem('userName');
        const storedEmail = storage.getItem('userEmail');
        const storedRole = storage.getItem('userRole');
        if (storedRole) {
          setIsAuthenticated(true);
          setUser({
            name: storedName || '',
            email: storedEmail || undefined,
            role: storedRole || undefined,
            status: storage.getItem('userStatus') || undefined,
            id: storage.getItem('userId') || undefined,
            clientId: storage.getItem('clientId') || undefined,
          });
        }
        const res = await api.get('/auth/me');
        if (res.data && typeof res.data === 'object' && 'name' in res.data) {
          setIsAuthenticated(true);
          setUser(res.data);
          storage.setItem('isAuthenticated', 'true');
          storage.setItem('userName', res.data.name);
          if (res.data.email) storage.setItem('userEmail', res.data.email);
          if (res.data.role) storage.setItem('userRole', res.data.role);
          if (res.data.id) storage.setItem('userId', res.data.id);
          if (res.data.clientId) storage.setItem('clientId', res.data.clientId);
        }
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: unknown } }).response?.status
            : null;
        if (status === 401 || status === 403) logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  const login = async (password: string, email?: string, rememberMe?: boolean): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await api.post('/auth/mail-login', { email, password, rememberMe: Boolean(rememberMe) });

      if (res.data && typeof res.data === 'object' && 'token' in res.data && (res.data as { token?: unknown }).token) {
        const { token, user: userData } = res.data;
        
        setIsAuthenticated(true);
        setUser(userData);

        const storage = rememberMe ? localStorage : sessionStorage;
        const other = rememberMe ? sessionStorage : localStorage;

        AUTH_KEYS.forEach((k) => other.removeItem(k));

        storage.setItem('isAuthenticated', 'true');
        storage.setItem('token', token);
        storage.setItem('userName', userData.name);
        if (userData.email) storage.setItem('userEmail', userData.email);
        if (userData.role) storage.setItem('userRole', userData.role);
        if (userData.id) storage.setItem('userId', userData.id);
        if (userData.clientId) storage.setItem('clientId', userData.clientId);
        if (res.data.csrfToken) {
          storage.setItem('mailCsrf', res.data.csrfToken);
        }
        if (res.data.sessionId) {
          storage.setItem('mailSessionId', res.data.sessionId);
        }
        
        return { ok: true };
      }
      const contentType =
        res.headers && typeof res.headers === 'object' && 'content-type' in res.headers
          ? String((res.headers as { 'content-type'?: unknown })['content-type'] || '')
          : '';
      if (typeof res.data === 'string' || contentType.includes('text/html')) {
        return {
          ok: false,
          error:
            'API is misconfigured. Rebuild the frontend with VITE_API_URL=https://api.arcbyte.co (or https://api.arcbyte.co/api).',
        };
      }
      return { ok: false, error: 'Sign in failed. Please try again.' };
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status
          : null;
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null;
      const detailCode =
        data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : null;

      if (status === 401) return { ok: false, error: 'Invalid mailbox credentials.' };
      if (errorCode === 'imap_tls_error') {
        return {
          ok: false,
          error: `Mail server TLS blocked${detailCode ? ` (${detailCode})` : ''}.`,
        };
      }
      if (errorCode === 'imap_unreachable') return { ok: false, error: 'Mail server unavailable. Try again.' };
      if (status === 502) return { ok: false, error: 'Mail server error. Try again.' };
      if (status === 404) {
        return {
          ok: false,
          error:
            'API endpoint not found. Confirm VITE_API_URL points to https://api.arcbyte.co (or https://api.arcbyte.co/api).',
        };
      }
      return { ok: false, error: 'Connection error. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
