import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import MaintenancePage from '../../pages/public/MaintenancePage';

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const location = useLocation();

  // If the user is on the admin site, they must be allowed through regardless.
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/arcmail/app');

  useEffect(() => {
    let mounted = true;
    let timer: number;

    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        if (!mounted) return;
        const config = res.data;
        if (config && config.maintenance && typeof config.maintenance.enabled === 'boolean') {
          setMaintenanceMode(config.maintenance.enabled);
        } else {
          setMaintenanceMode(false);
        }
      } catch (err) {
        // Fallback to false if the backend is physically unreachable to allow standard connection error handling
      } finally {
        if (mounted) setChecking(false);
      }
    };

    // Check immediately on mount, then poll every 60 seconds
    void checkHealth();
    timer = window.setInterval(checkHealth, 60000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Prevents flashing the app behind the maintenance page while the initial API call resolves
  if (checking) {
    return <div className="fixed inset-0 bg-[#f8fafc]" />;
  }

  if (maintenanceMode) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}
