import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string } | null;
  login: (password: string, email?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [user, setUser] = useState<{ name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string } | null>(null);

  // Initialize auth state from local storage and validate token
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data) {
          setIsAuthenticated(true);
          setUser(res.data);
          // Update local storage with fresh data
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('userName', res.data.name);
          if (res.data.email) localStorage.setItem('userEmail', res.data.email);
          if (res.data.role) localStorage.setItem('userRole', res.data.role);
          if (res.data.id) localStorage.setItem('userId', res.data.id);
          if (res.data.clientId) localStorage.setItem('clientId', res.data.clientId);
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (password: string, email?: string): Promise<boolean> => {
    try {
      const path = window.location.pathname || '';
      const isMailLogin = path.startsWith('/mail');
      const endpoint = isMailLogin ? '/auth/mail-login' : '/auth/login';
      const res = await api.post(endpoint, { email, password });

      if (res.data && res.data.token) {
        const { token, user: userData } = res.data;
        
        setIsAuthenticated(true);
        setUser(userData);
        
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('token', token);
        localStorage.setItem('userName', userData.name);
        if (userData.email) localStorage.setItem('userEmail', userData.email);
        if (userData.role) localStorage.setItem('userRole', userData.role);
        if (userData.id) localStorage.setItem('userId', userData.id);
        if (userData.clientId) localStorage.setItem('clientId', userData.clientId);
        if (isMailLogin && res.data.csrfToken) {
          localStorage.setItem('mailCsrf', res.data.csrfToken);
        }
        if (isMailLogin && res.data.sessionId) {
          localStorage.setItem('mailSessionId', res.data.sessionId);
        }
        
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('userStatus');
      localStorage.removeItem('clientId');
      localStorage.removeItem('mailCsrf');
      localStorage.removeItem('mailSessionId');
      const path = window.location.pathname || '';
      // Prevent redirect loop if already on login page
      if (path.includes('/login')) return;
      
      const target = path.startsWith('/mail') ? '/mail/login' : '/admin/login';
      window.location.href = target;
    } catch {
      const path = window.location.pathname || '';
      const target = path.startsWith('/mail') ? '/mail/login' : '/admin/login';
      window.location.href = target;
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
