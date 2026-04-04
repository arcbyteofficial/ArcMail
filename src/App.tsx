import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import ProtectedMailRoute from './components/layout/ProtectedMailRoute';
import ProtectedAdminRoute from './components/layout/ProtectedAdminRoute';
import MailLogin from './pages/mail/MailLogin';
import MailApp from './pages/mail/MailApp';
import MailSecurity from './pages/mail/MailSecurity';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ArcMailAndroidApp from './pages/public/ArcMailAndroidApp.tsx';
import MaintenanceGate from './components/layout/MaintenanceGate';

export default function App() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key || '').toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (ctrlOrMeta && key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (ctrlOrMeta && key === 'i') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (ctrlOrMeta && e.shiftKey && key === 'i') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', onContextMenu, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, { capture: true } as AddEventListenerOptions);
      document.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions);
    };
  }, []);

  return (
    <AuthProvider>
      <AdminAuthProvider>
        <Router>
          <MaintenanceGate>
            <Routes>
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<ProtectedAdminRoute />}>
                <Route index element={<AdminDashboard />} />
              </Route>
              <Route path="/arcmail/app" element={<ArcMailAndroidApp />} />
              <Route path="/arcmail/app/*" element={<Navigate to="/arcmail/app" replace />} />
              <Route path="/login" element={<MailLogin />} />
              <Route path="/mail/login" element={<Navigate to="/login" replace />} />
              <Route path="/" element={<ProtectedMailRoute />}>
                <Route index element={<MailApp />} />
                <Route path="security" element={<MailSecurity />} />
              </Route>
              <Route path="/mail/*" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </MaintenanceGate>
        </Router>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
