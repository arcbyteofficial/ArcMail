import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string } | null;
  login: (password: string, email?: string, rememberMe?: boolean) => Promise<boolean>;
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
      const target = path.startsWith('/mail') ? '/mail/login' : '/admin/login';
      window.location.href = target;
    } catch {
      const path = window.location.pathname || '';
      clearAuthStorage();
      const target = path.startsWith('/mail') ? '/mail/login' : '/admin/login';
      window.location.href = target;
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
        const res = await api.get('/auth/me');
        if (res.data) {
          setIsAuthenticated(true);
          setUser(res.data);
          storage.setItem('isAuthenticated', 'true');
          storage.setItem('userName', res.data.name);
          if (res.data.email) storage.setItem('userEmail', res.data.email);
          if (res.data.role) storage.setItem('userRole', res.data.role);
          if (res.data.id) storage.setItem('userId', res.data.id);
          if (res.data.clientId) storage.setItem('clientId', res.data.clientId);
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  const login = async (password: string, email?: string, rememberMe?: boolean): Promise<boolean> => {
    try {
      const path = window.location.pathname || '';
      const isMailLogin = path.startsWith('/mail');
      const endpoint = isMailLogin ? '/auth/mail-login' : '/auth/login';
      const res = await api.post(endpoint, { email, password, rememberMe: Boolean(rememberMe) });

      if (res.data && res.data.token) {
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
        if (isMailLogin && res.data.csrfToken) {
          storage.setItem('mailCsrf', res.data.csrfToken);
        }
        if (isMailLogin && res.data.sessionId) {
          storage.setItem('mailSessionId', res.data.sessionId);
        }
        
        return true;
      }
      return false;
    } catch {
      return false;
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
