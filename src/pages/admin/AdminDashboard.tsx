import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtSign, Ban, Globe, Loader2, Lock, LogOut, Plus, RefreshCw, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getAdminBaseUrl } from '../../api/adminClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';

type AdminUserRow = { email: string; twofaEnabled: boolean; updatedAt?: string | null };
type DomainRule = { domain: string; blocked: boolean };
type EmailRule = { email: string; blocked: boolean };

export default function AdminDashboard() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'twofa' | 'domains' | 'emails'>('twofa');
  const isLocalDev = useMemo(() => {
    try {
      const host = window.location.hostname;
      return import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1');
    } catch {
      return false;
    }
  }, []);
  const adminBase = isLocalDev ? getAdminBaseUrl() : '';
  const allowRemote = useMemo(() => {
    try {
      return (localStorage.getItem('arcmailAdminAllowRemoteApi') || '') === '1';
    } catch {
      return false;
    }
  }, []);

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [targetEmail, setTargetEmail] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const [loginBlocked, setLoginBlocked] = useState(false);
  const [loginBlockMessage, setLoginBlockMessage] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  const [domainRules, setDomainRules] = useState<DomainRule[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);

  const [emailRules, setEmailRules] = useState<EmailRule[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const errorMessageFrom = (err: unknown, fallback: string) => {
    const status =
      err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown } }).response?.status : null;
    const data =
      err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown } }).response?.data : null;
    const code =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? String((data as { error: string }).error)
        : null;
    const message =
      data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? String((data as { message: string }).message)
        : null;
    if (status === 401) {
      logout();
      navigate('/admin/login', { replace: true });
      return 'Session expired.';
    }
    if (status === 403 && code === 'admin_desktop_only') return message || 'Admin is available on desktop only.';
    if (status === 403) return message || 'Forbidden.';
    if (status === 404) return 'Endpoint not found. Deploy the updated API.';
    if (!status && err && typeof err === 'object') return 'Network/CORS error. Check API URL and CORS settings.';
    return message || fallback;
  };

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

  const normalizeDomain = (value: string) => {
    const d = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/\.+$/, '');
    if (!d) return '';
    if (d.includes('/') || d.includes(' ') || d.includes(':')) return '';
    if (!d.includes('.')) return '';
    return d;
  };

  const normalizeEmail = (value: string) => {
    const e = String(value || '').trim().toLowerCase();
    if (!e) return '';
    if (!e.includes('@')) return '';
    if (e.includes(' ')) return '';
    return e;
  };

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true);
    try {
      const res = await adminApi.get('/admin/domain-policy');
      const list =
        res.data && typeof res.data === 'object' && 'domains' in res.data && Array.isArray((res.data as { domains?: unknown }).domains)
          ? ((res.data as { domains: unknown[] }).domains as unknown[])
          : [];
      const mapped: DomainRule[] = list
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const domain = 'domain' in d && typeof (d as { domain?: unknown }).domain === 'string' ? normalizeDomain(String((d as { domain: string }).domain)) : '';
          const blocked = 'blocked' in d && typeof (d as { blocked?: unknown }).blocked === 'boolean' ? Boolean((d as { blocked: boolean }).blocked) : false;
          if (!domain) return null;
          return { domain, blocked };
        })
        .filter(Boolean) as DomainRule[];
      setDomainRules(mapped);
    } catch {
      void 0;
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  const loadEmails = useCallback(async () => {
    setLoadingEmails(true);
    try {
      const res = await adminApi.get('/admin/email-policy');
      const list =
        res.data && typeof res.data === 'object' && 'emails' in res.data && Array.isArray((res.data as { emails?: unknown }).emails)
          ? ((res.data as { emails: unknown[] }).emails as unknown[])
          : [];
      const mapped: EmailRule[] = list
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const email = 'email' in e && typeof (e as { email?: unknown }).email === 'string' ? normalizeEmail(String((e as { email: string }).email)) : '';
          const blocked = 'blocked' in e && typeof (e as { blocked?: unknown }).blocked === 'boolean' ? Boolean((e as { blocked: boolean }).blocked) : false;
          if (!email) return null;
          return { email, blocked };
        })
        .filter(Boolean) as EmailRule[];
      setEmailRules(mapped);
    } catch {
      void 0;
    } finally {
      setLoadingEmails(false);
    }
  }, []);

  const saveDomains = async (next: DomainRule[]) => {
    setSavingDomains(true);
    setError(null);
    try {
      const res = await adminApi.post('/admin/domain-policy', { domains: next });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      const list =
        res.data && typeof res.data === 'object' && 'domains' in res.data && Array.isArray((res.data as { domains?: unknown }).domains)
          ? ((res.data as { domains: unknown[] }).domains as unknown[])
          : [];
      if (!ok) throw new Error('failed');
      const mapped: DomainRule[] = list
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const domain = 'domain' in d && typeof (d as { domain?: unknown }).domain === 'string' ? normalizeDomain(String((d as { domain: string }).domain)) : '';
          const blocked = 'blocked' in d && typeof (d as { blocked?: unknown }).blocked === 'boolean' ? Boolean((d as { blocked: boolean }).blocked) : false;
          if (!domain) return null;
          return { domain, blocked };
        })
        .filter(Boolean) as DomainRule[];
      setDomainRules(mapped);
      setResetResult('Domain rules updated');
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to update domain rules.'));
    } finally {
      setSavingDomains(false);
    }
  };

  const saveEmails = async (next: EmailRule[]) => {
    setSavingEmails(true);
    setError(null);
    try {
      const res = await adminApi.post('/admin/email-policy', { emails: next });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      const list =
        res.data && typeof res.data === 'object' && 'emails' in res.data && Array.isArray((res.data as { emails?: unknown }).emails)
          ? ((res.data as { emails: unknown[] }).emails as unknown[])
          : [];
      if (!ok) throw new Error('failed');
      const mapped: EmailRule[] = list
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const email = 'email' in e && typeof (e as { email?: unknown }).email === 'string' ? normalizeEmail(String((e as { email: string }).email)) : '';
          const blocked = 'blocked' in e && typeof (e as { blocked?: unknown }).blocked === 'boolean' ? Boolean((e as { blocked: boolean }).blocked) : false;
          if (!email) return null;
          return { email, blocked };
        })
        .filter(Boolean) as EmailRule[];
      setEmailRules(mapped);
      setResetResult('Email rules updated');
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to update email rules.'));
    } finally {
      setSavingEmails(false);
    }
  };

  useEffect(() => {
    void load();
    void loadBlock();
    void loadDomains();
    void loadEmails();
  }, [load, loadBlock, loadDomains, loadEmails]);

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
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to update login block.'));
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
        {isLocalDev && (
          <div className="text-[11px] font-mono text-white/35 flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-[#111111]/40 px-4 py-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-4">
            <div className="text-sm font-bold tracking-widest uppercase text-white/45 px-2">Navigation</div>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setTab('twofa')}
                className={cn(
                  "w-full h-11 rounded-2xl border px-3 text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                  tab === 'twofa'
                    ? "bg-white/10 border-white/15 text-white"
                    : "bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <ShieldCheck size={16} />
                Two-factor auth
              </button>
              <button
                onClick={() => setTab('domains')}
                className={cn(
                  "w-full h-11 rounded-2xl border px-3 text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                  tab === 'domains'
                    ? "bg-white/10 border-white/15 text-white"
                    : "bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <Globe size={16} />
                Domain access
              </button>
              <button
                onClick={() => setTab('emails')}
                className={cn(
                  "w-full h-11 rounded-2xl border px-3 text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                  tab === 'emails'
                    ? "bg-white/10 border-white/15 text-white"
                    : "bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <AtSign size={16} />
                Block emails
              </button>
            </div>
          </aside>

          <section className="space-y-6">
            {tab === 'twofa' && (
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
                </div>
              </div>
            )}

            {tab === 'domains' && (
              <div className="rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-6">
                <div className="text-sm font-bold tracking-widest uppercase text-white/45">Domain Access</div>
                <div className="text-sm text-white/45 mt-2">Only listed domains can sign in. You can block/unblock any listed domain.</div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B]/60 pl-11 pr-4 outline-none text-sm text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/30 focus:border-[#1DB954]/30"
                        placeholder="@arcbyte.co"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                        <Globe size={16} />
                      </div>
                    </div>
                    <button
                      disabled={savingDomains}
                      onClick={() => {
                        const domain = normalizeDomain(domainInput);
                        if (!domain) {
                          setError('Enter a valid domain like arcbyte.co');
                          return;
                        }
                        setError(null);
                        setResetResult(null);
                        setDomainInput('');
                        setDomainRules((prev) => {
                          const exists = prev.some((r) => r.domain === domain);
                          if (exists) return prev;
                          return [...prev, { domain, blocked: false }].sort((a, b) => a.domain.localeCompare(b.domain));
                        });
                      }}
                      className="h-11 px-4 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  <div className="border border-white/5 rounded-2xl overflow-hidden">
                    {loadingDomains ? (
                      <div className="p-4 text-sm text-white/40 flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Loading domains…
                      </div>
                    ) : domainRules.length === 0 ? (
                      <div className="p-4 text-sm text-white/40">No domains configured.</div>
                    ) : (
                      domainRules.map((r) => (
                        <div key={r.domain} className="p-3 flex items-center justify-between gap-3 bg-[#0B0B0B]/40 border-t border-white/5 first:border-t-0">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">@{r.domain}</div>
                            <div className="text-xs text-white/35">{r.blocked ? 'Blocked' : 'Allowed'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={savingDomains}
                              onClick={() =>
                                setDomainRules((prev) =>
                                  prev.map((x) => (x.domain === r.domain ? { ...x, blocked: !x.blocked } : x))
                                )
                              }
                              className={cn(
                                "h-9 px-3 rounded-2xl text-[11px] font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                                r.blocked ? "bg-white/5 text-white/80 border border-white/10 hover:bg-white/10" : "bg-[#FF5555] text-black hover:bg-[#FF6B6B]"
                              )}
                            >
                              <Ban size={14} />
                              {r.blocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              disabled={savingDomains}
                              onClick={() => setDomainRules((prev) => prev.filter((x) => x.domain !== r.domain))}
                              className="h-9 w-9 rounded-2xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                              aria-label={`Delete ${r.domain}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    disabled={savingDomains}
                    onClick={() => void saveDomains(domainRules)}
                    className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black text-xs font-bold tracking-widest uppercase hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingDomains ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Saving
                      </span>
                    ) : (
                      'Save domains'
                    )}
                  </button>
                </div>
              </div>
            )}

            {tab === 'emails' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-6">
                  <div className="text-sm font-bold tracking-widest uppercase text-white/45">Block Login</div>
                  <div className="text-sm text-white/45 mt-2">Stop new logins to ArcMail.</div>
                  <div className="mt-6 space-y-3">
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
                      {savingBlock ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          Saving
                        </span>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-[#111111]/60 backdrop-blur-sm p-6">
                  <div className="text-sm font-bold tracking-widest uppercase text-white/45">Block specific emails</div>
                  <div className="text-sm text-white/45 mt-2">Block sign-ins for individual mailboxes even if the domain is allowed.</div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B]/60 pl-11 pr-4 outline-none text-sm text-white placeholder-white/20 focus:ring-1 focus:ring-[#1DB954]/30 focus:border-[#1DB954]/30"
                          placeholder="user@arcbyte.co"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                          <AtSign size={16} />
                        </div>
                      </div>
                      <button
                        disabled={savingEmails}
                        onClick={() => {
                          const email = normalizeEmail(emailInput);
                          if (!email) {
                            setError('Enter a valid email like user@arcbyte.co');
                            return;
                          }
                          setError(null);
                          setResetResult(null);
                          setEmailInput('');
                          setEmailRules((prev) => {
                            const exists = prev.some((r) => r.email === email);
                            if (exists) return prev;
                            return [...prev, { email, blocked: true }].sort((a, b) => a.email.localeCompare(b.email));
                          });
                        }}
                        className="h-11 px-4 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>

                    <div className="border border-white/5 rounded-2xl overflow-hidden">
                      {loadingEmails ? (
                        <div className="p-4 text-sm text-white/40 flex items-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          Loading emails…
                        </div>
                      ) : emailRules.length === 0 ? (
                        <div className="p-4 text-sm text-white/40">No emails configured.</div>
                      ) : (
                        emailRules.map((r) => (
                          <div key={r.email} className="p-3 flex items-center justify-between gap-3 bg-[#0B0B0B]/40 border-t border-white/5 first:border-t-0">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{r.email}</div>
                              <div className="text-xs text-white/35">{r.blocked ? 'Blocked' : 'Allowed'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                disabled={savingEmails}
                                onClick={() => setEmailRules((prev) => prev.map((x) => (x.email === r.email ? { ...x, blocked: !x.blocked } : x)))}
                                className={cn(
                                  "h-9 px-3 rounded-2xl text-[11px] font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                                  r.blocked ? "bg-white/5 text-white/80 border border-white/10 hover:bg-white/10" : "bg-[#FF5555] text-black hover:bg-[#FF6B6B]"
                                )}
                              >
                                <Ban size={14} />
                                {r.blocked ? 'Unblock' : 'Block'}
                              </button>
                              <button
                                disabled={savingEmails}
                                onClick={() => setEmailRules((prev) => prev.filter((x) => x.email !== r.email))}
                                className="h-9 w-9 rounded-2xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                                aria-label={`Delete ${r.email}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      disabled={savingEmails}
                      onClick={() => void saveEmails(emailRules)}
                      className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black text-xs font-bold tracking-widest uppercase hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {savingEmails ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          Saving
                        </span>
                      ) : (
                        'Save emails'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
