import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedMailRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-2 h-2 bg-[#6366f1] rounded-full animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'MAIL_USER') {
    return <Navigate to="/mail/login" replace />;
  }

  return <Outlet />;
}
