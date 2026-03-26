import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedMailRoute from './components/layout/ProtectedMailRoute';
import MailLogin from './pages/mail/MailLogin';
import MailApp from './pages/mail/MailApp';
import MailSecurity from './pages/mail/MailSecurity';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<MailLogin />} />
          <Route path="/mail/login" element={<Navigate to="/login" replace />} />
          <Route path="/" element={<ProtectedMailRoute />}>
            <Route index element={<MailApp />} />
            <Route path="security" element={<MailSecurity />} />
          </Route>
          <Route path="/mail/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
