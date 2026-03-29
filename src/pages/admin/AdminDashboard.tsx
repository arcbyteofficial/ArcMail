import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, LogOut, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';

type AdminUserRow = { email: string; twofaEnabled: boolean; updatedAt?: string | null };

export default function AdminDashboard() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [targetEmail, setTargetEmail] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const [loginBlocked, setLoginBlocked] = useState(false);
  const [loginBlockMessage, setLoginBlockMessage] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const load = useCallback(async () => {
    setLoadingRows(true);
    setError(null);
    try {
      const res = await adminApi.get('/admin/users');
      const list =
        res.data && typeof res.data === 'object' && 'users' in res.data && Array.isArray((res.data as { users?: unknown }).users)
          ? ((res.data as { users: unknown[] }).users as unknown[])
          : [];
      const mapped: AdminUserRow[] = list
        .map((u) => {
          if (!u || typeof u !== 'object') return null;
          const email = 'email' in u && typeof (u as { email?: unknown }).email === 'string' ? String((u as { email: string }).email) : '';
          const twofaEnabled =
            'twofaEnabled' in u && typeof (u as { twofaEnabled?: unknown }).twofaEnabled === 'boolean'
              ? Boolean((u as { twofaEnabled: boolean }).twofaEnabled)
              : false;
          const updatedAt =
            'updatedAt' in u && (typeof (u as { updatedAt?: unknown }).updatedAt === 'string' || (u as { updatedAt?: unknown }).updatedAt === null)
              ? ((u as { updatedAt?: string | null }).updatedAt ?? null)
              : null;
          if (!email) return null;
          return { email, twofaEnabled, updatedAt };
        })
        .filter(Boolean) as AdminUserRow[];
      setRows(mapped);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown } }).response?.status : null;
      if (status === 401) {
        logout();
        navigate('/admin/login', { replace: true });
        return;
      }
      setError('Failed to load users.');
    } finally {
      setLoadingRows(false);
    }
  }, [logout, navigate]);

  const loadBlock = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/login-block');
      const blocked =
        res.data && typeof res.data === 'object' && 'blocked' in res.data && typeof (res.data as { blocked?: unknown }).blocked === 'boolean'
          ? Boolean((res.data as { blocked: boolean }).blocked)
          : false;
      const message =
        res.data && typeof res.data === 'object' && 'message' in res.data && typeof (res.data as { message?: unknown }).message === 'string'
          ? String((res.data as { message: string }).message)
          : '';
      setLoginBlocked(blocked);
      setLoginBlockMessage(message);
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    void load();
    void loadBlock();
  }, [load, loadBlock]);

  const reset2faEmail = async (email: string) => {
    setBusy(true);
    setError(null);
    setResetResult(null);
    try {
      const res = await adminApi.post('/admin/reset-2fa-email', { email });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      if (!ok) throw new Error('failed');
      setResetResult(`Reset 2FA for ${email}`);
      setTargetEmail('');
      await load();
    } catch {
      setError('Failed to reset 2FA.');
    } finally {
      setBusy(false);
    }
  };

  const reset2faAll = async () => {
    setBusy(true);
    setError(null);
    setResetResult(null);
    try {
      const res = await adminApi.post('/admin/reset-2fa-all', {});
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      if (!ok) throw new Error('failed');
      setResetResult('Reset 2FA for all users');
      await load();
    } catch {
      setError('Failed to reset 2FA for all.');
    } finally {
      setBusy(false);
    }
  };

  const bootstrapDb = async () => {
    setBusy(true);
    setError(null);
    setResetResult(null);
    try {
      const res = await adminApi.post('/admin/bootstrap', {});
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      const tables =
        res.data && typeof res.data === 'object' && 'tables' in res.data && Array.isArray((res.data as { tables?: unknown }).tables)
          ? ((res.data as { tables: unknown[] }).tables.filter((t) => typeof t === 'string') as string[])
          : [];
      if (!ok) throw new Error('failed');
      setResetResult(tables.length ? `DB ready: ${tables.join(', ')}` : 'DB bootstrap complete.');
      await load();
    } catch {
      setError('Failed to bootstrap DB.');
    } finally {
      setBusy(false);
    }
  };

  const saveBlock = async () => {
    setSavingBlock(true);
    setError(null);
    try {
      const res = await adminApi.post('/admin/login-block', { blocked: loginBlocked, message: loginBlockMessage });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      if (!ok) throw new Error('failed');
      setResetResult(loginBlocked ? 'Login blocked' : 'Login unblocked');
    } catch {
      setError('Failed to update login block.');
    } finally {
      setSavingBlock(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-accent/30 selection:text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0A0A0A]/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={arcByteLogo} alt="ArcByte" className="h-8 w-8 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight truncate">ArcMail Admin</div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-white/35 truncate">
                {user?.username || 'admin'}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/admin/login', { replace: true });
            }}
            className="h-10 px-4 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm font-mono flex items-center gap-2 rounded-2xl">
            <Lock size={14} />
            {error}
          </div>
        )}
        {resetResult && (
          <div className="p-4 bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#B8F7CF] text-sm font-mono rounded-2xl">
            {resetResult}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-bold tracking-widest uppercase text-white/45">Registered Emails</div>
              <button
                onClick={() => void load()}
                className="h-10 px-4 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                disabled={loadingRows}
              >
                {loadingRows ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>

            <div className="mt-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B]/60 px-4 outline-none text-sm text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/30 focus:border-[#1DB954]/30"
                placeholder="Search email…"
              />
            </div>

            <div className="mt-4 divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-white/40">No users found.</div>
              ) : (
                filtered.slice(0, 200).map((r) => (
                  <div key={r.email} className="p-4 flex items-center justify-between gap-4 bg-[#0B0B0B]/40">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.email}</div>
                      <div className="text-xs text-white/35">{r.updatedAt ? `Updated ${new Date(r.updatedAt).toLocaleString()}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-9 px-3 rounded-2xl border text-[11px] font-bold tracking-widest uppercase flex items-center gap-2",
                          r.twofaEnabled ? "border-[#1DB954]/30 bg-[#1DB954]/10 text-[#B8F7CF]" : "border-white/10 bg-white/5 text-white/55"
                        )}
                      >
                        {r.twofaEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                        {r.twofaEnabled ? '2FA ON' : '2FA OFF'}
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => void reset2faEmail(r.email)}
                        className="h-9 px-3 rounded-2xl bg-[#FF5555] text-black text-[11px] font-bold tracking-widest uppercase hover:bg-[#FF6B6B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Reset 2FA
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-6 space-y-6">
            <div>
              <div className="text-sm font-bold tracking-widest uppercase text-white/45">Reset 2FA</div>
              <div className="text-sm text-white/45 mt-2">Reset a single mailbox 2FA or wipe all.</div>
              <div className="mt-4 space-y-3">
                <input
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B]/60 px-4 outline-none text-sm text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/30 focus:border-[#1DB954]/30"
                  placeholder="user@arcbyte.co"
                />
                <button
                  disabled={busy || !targetEmail.trim()}
                  onClick={() => void reset2faEmail(targetEmail.trim())}
                  className="w-full h-11 rounded-2xl bg-[#FF5555] text-black text-xs font-bold tracking-widest uppercase hover:bg-[#FF6B6B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Reset email 2FA
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    const ok = window.confirm('Reset 2FA for ALL users? This will log out everyone.');
                    if (ok) void reset2faAll();
                  }}
                  className="w-full h-11 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Reset all 2FA
                </button>
                <button
                  disabled={busy}
                  onClick={() => void bootstrapDb()}
                  className="w-full h-11 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Bootstrap DB
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div>
              <div className="text-sm font-bold tracking-widest uppercase text-white/45">Block Login</div>
              <div className="text-sm text-white/45 mt-2">Stop new logins to ArcMail.</div>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setLoginBlocked((v) => !v)}
                  className={cn(
                    "w-full h-11 rounded-2xl border text-xs font-bold tracking-widest uppercase transition-colors",
                    loginBlocked ? "bg-[#FF5555] text-black border-transparent hover:bg-[#FF6B6B]" : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                  )}
                >
                  {loginBlocked ? 'Login blocked' : 'Login allowed'}
                </button>
                <input
                  value={loginBlockMessage}
                  onChange={(e) => setLoginBlockMessage(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B]/60 px-4 outline-none text-sm text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/30 focus:border-[#1DB954]/30"
                  placeholder="Optional message shown on login…"
                />
                <button
                  disabled={savingBlock}
                  onClick={() => void saveBlock()}
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black text-xs font-bold tracking-widest uppercase hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingBlock ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} />Saving</span> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
