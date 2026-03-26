import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedMailRoute from './components/layout/ProtectedMailRoute';
import MailLogin from './pages/mail/MailLogin';
import MailApp from './pages/mail/MailApp';
import MailSecurity from './pages/mail/MailSecurity';
import ArcMailInfo from './pages/mail/ArcMailInfo';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/mail/login" element={<MailLogin />} />
          <Route path="/mail/*" element={<ProtectedMailRoute />}>
            <Route index element={<MailApp />} />
            <Route path="security" element={<MailSecurity />} />
          </Route>
          <Route path="/arcmail/info" element={<ArcMailInfo />} />
          <Route path="*" element={<Navigate to="/mail/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
