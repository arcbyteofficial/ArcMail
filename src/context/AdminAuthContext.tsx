import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api/adminClient';

type AdminUser = { username: string; role: 'ADMIN' };

type AdminAuthContextType = {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const readToken = () => sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || null;

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem('adminToken');
    localStorage.removeItem('adminToken');
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }
    setToken(t);
    try {
      const res = await adminApi.get('/admin/me');
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      const u =
        res.data && typeof res.data === 'object' && 'user' in res.data && (res.data as { user?: unknown }).user && typeof (res.data as { user?: unknown }).user === 'object'
          ? ((res.data as { user: unknown }).user as { username?: unknown; role?: unknown })
          : null;
      if (!ok || !u || typeof u.username !== 'string' || u.role !== 'ADMIN') {
        logout();
        setIsLoading(false);
        return;
      }
      setUser({ username: u.username, role: 'ADMIN' });
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await adminApi.post('/admin/login', { username, password });
        const nextToken =
          res.data && typeof res.data === 'object' && 'token' in res.data && typeof (res.data as { token?: unknown }).token === 'string'
            ? String((res.data as { token: string }).token)
            : '';
        if (!nextToken) return { ok: false, error: 'Login failed.' };
        localStorage.setItem('adminToken', nextToken);
        sessionStorage.removeItem('adminToken');
        setToken(nextToken);
        await refresh();
        return { ok: true };
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status : null;
        const data = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown } }).response?.data : null;
        const code =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
            ? String((data as { error: string }).error)
            : null;
        const message =
          data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
            ? String((data as { message: string }).message)
            : null;
        if (status === 429 || code === 'rate_limited') return { ok: false, error: 'Too many attempts. Try again later.' };
        if (status === 403 && code === 'admin_desktop_only') return { ok: false, error: message || 'Admin is available on desktop only.' };
        if (status === 501 && code === 'admin_unconfigured') {
          return { ok: false, error: 'Admin is not configured on this backend. Set ADMIN_USERNAME and ADMIN_PASSWORD on the API.' };
        }
        if (status === 401) return { ok: false, error: 'Invalid admin credentials.' };
        return { ok: false, error: 'Login failed.' };
      }
    },
    [refresh]
  );

  const value = useMemo<AdminAuthContextType>(
    () => ({
      isAuthenticated: Boolean(token && user),
      user,
      login,
      logout,
      refresh,
      isLoading,
    }),
    [token, user, login, logout, refresh, isLoading]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('AdminAuthProvider missing');
  return ctx;
};
