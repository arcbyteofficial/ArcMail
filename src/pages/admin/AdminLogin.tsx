import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
import AdminDesktopOnlyGate from '../../components/admin/AdminDesktopOnlyGate';
import { getAdminBaseUrl } from '../../api/adminClient';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLocalDev = useMemo(() => {
    try {
      const host = window.location.hostname;
      return import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1');
    } catch {
      return false;
    }
  }, []);
  const allowRemote = useMemo(() => {
    try {
      return (localStorage.getItem('arcmailAdminAllowRemoteApi') || '') === '1';
    } catch {
      return false;
    }
  }, []);
  const adminBase = isLocalDev ? getAdminBaseUrl() : '';

  return (
    <AdminDesktopOnlyGate>
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6 py-12 font-sans selection:bg-accent/30 selection:text-white">
        <div className="w-full max-w-md">
          <div className="w-full bg-[#111111]/60 backdrop-blur-sm border border-white/5 p-8 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.85)]">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <img src={arcByteLogo} alt="ArcByte" className="h-8 w-8 object-contain shrink-0" />
                <div className="flex flex-col">
                  <div className="text-2xl font-display font-bold tracking-tight">ArcMail Admin</div>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40 mt-1">
                    <ShieldCheck size={12} />
                    Operator controls
                  </div>
                </div>
              </div>
              <div className="text-sm text-white/40">Sign in to manage login access and 2FA recovery.</div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm font-mono flex items-center gap-2">
                <Lock size={14} />
                {error}
              </div>
            )}

            {isLocalDev && (
              <div className="mb-6 text-[11px] font-mono text-white/35 flex items-center justify-between gap-4">
                <div className="min-w-0 truncate">
                  <span className="text-white/55">Admin API</span>: {adminBase || '(none)'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem('arcmailAdminAllowRemoteApi', allowRemote ? '0' : '1');
                    } catch {
                      void 0;
                    }
                    window.location.reload();
                  }}
                  className="shrink-0 text-white/60 hover:text-white transition-colors"
                >
                  {allowRemote ? 'Use local API' : 'Use prod API'}
                </button>
              </div>
            )}

            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setBusy(true);
                try {
                  const res = await login(username.trim(), password);
                  if (!res.ok) {
                    setError(res.error || 'Login failed.');
                    return;
                  }
                  navigate('/admin', { replace: true });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="space-y-2">
                <div className="text-[11px] font-bold tracking-widest uppercase text-white/45">Username</div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={cn(
                    "w-full h-12 rounded-2xl border px-4 bg-transparent outline-none",
                    "border-white/10 text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/35 focus:border-[#1DB954]/35"
                  )}
                  placeholder="admin"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-bold tracking-widest uppercase text-white/45">Password</div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className={cn(
                    "w-full h-12 rounded-2xl border px-4 bg-transparent outline-none",
                    "border-white/10 text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/35 focus:border-[#1DB954]/35"
                  )}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                  "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                )}
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AdminDesktopOnlyGate>
  );
}
