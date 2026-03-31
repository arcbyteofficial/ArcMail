import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AtSign, Ban, Eye, EyeOff, Globe, Loader2, Lock, LogOut, RefreshCw, Send, ShieldOff, ShieldCheck, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getAdminBaseUrl } from '../../api/adminClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';

type AdminUserRow = { email: string; twofaEnabled: boolean; updatedAt?: string | null };
type DomainRule = { domain: string; blocked: boolean };
type EmailRule = { email: string; blocked: boolean };
type AuditEventRow = {
  id: string;
  createdAt?: string | null;
  eventType: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
};

export default function AdminDashboard() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'twofa' | 'domains' | 'login' | 'emails' | 'send' | 'activity'>('twofa');
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

  const [sendFullName, setSendFullName] = useState('');
  const [sendArcMailEmail, setSendArcMailEmail] = useState('');
  const [sendToEmail, setSendToEmail] = useState('');
  const [sendingAccess, setSendingAccess] = useState(false);
  const [sendIncludePassword, setSendIncludePassword] = useState(false);
  const [sendPassword, setSendPassword] = useState('');
  const [sendShowPassword, setSendShowPassword] = useState(false);

  const [activityEmail, setActivityEmail] = useState('');
  const [activityRows, setActivityRows] = useState<AuditEventRow[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const errorMessageFrom = useCallback((err: unknown, fallback: string) => {
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
  }, [logout, navigate]);

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

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    setError(null);
    try {
      const res = await adminApi.get('/admin/activity', {
        params: {
          email: activityEmail.trim() ? activityEmail.trim() : undefined,
          limit: 200,
          offset: 0,
        },
      });
      const list =
        res.data && typeof res.data === 'object' && 'events' in res.data && Array.isArray((res.data as { events?: unknown }).events)
          ? ((res.data as { events: unknown[] }).events as unknown[])
          : [];
      const mapped: AuditEventRow[] = list
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const id = 'id' in e && (typeof (e as { id?: unknown }).id === 'string' || typeof (e as { id?: unknown }).id === 'number') ? String((e as { id: string | number }).id) : '';
          const createdAt =
            'createdAt' in e && (typeof (e as { createdAt?: unknown }).createdAt === 'string' || (e as { createdAt?: unknown }).createdAt === null)
              ? ((e as { createdAt?: string | null }).createdAt ?? null)
              : null;
          const eventType = 'eventType' in e && typeof (e as { eventType?: unknown }).eventType === 'string' ? String((e as { eventType: string }).eventType) : '';
          const email = 'email' in e && typeof (e as { email?: unknown }).email === 'string' ? String((e as { email: string }).email) : '';
          const ip =
            'ip' in e && (typeof (e as { ip?: unknown }).ip === 'string' || (e as { ip?: unknown }).ip === null)
              ? ((e as { ip?: string | null }).ip ?? null)
              : null;
          const userAgent =
            'userAgent' in e && (typeof (e as { userAgent?: unknown }).userAgent === 'string' || (e as { userAgent?: unknown }).userAgent === null)
              ? ((e as { userAgent?: string | null }).userAgent ?? null)
              : null;
          if (!id || !email || !eventType) return null;
          return { id, createdAt, eventType, email, ip, userAgent };
        })
        .filter(Boolean) as AuditEventRow[];
      setActivityRows(mapped);
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to load activity.'));
    } finally {
      setLoadingActivity(false);
    }
  }, [activityEmail, errorMessageFrom]);

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

  useEffect(() => {
    if (tab !== 'activity') return;
    void loadActivity();
  }, [tab, loadActivity]);

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

  const sendAccessEmail = async () => {
    const arcMailEmail = String(sendArcMailEmail || '').trim().toLowerCase();
    const toEmail = String(sendToEmail || '').trim().toLowerCase();
    if (!arcMailEmail || !arcMailEmail.includes('@')) {
      setError('Enter a valid ArcMail email.');
      return;
    }
    if (!toEmail || !toEmail.includes('@')) {
      setError('Enter a valid delivery email.');
      return;
    }
    if (sendIncludePassword && !sendPassword) {
      setError('Enter a password or disable the password option.');
      return;
    }
    setSendingAccess(true);
    setError(null);
    setResetResult(null);
    try {
      const res = await adminApi.post('/admin/send-access-email', {
        fullName: sendFullName.trim(),
        arcMailEmail,
        toEmail,
        includePassword: sendIncludePassword,
        password: sendIncludePassword ? sendPassword : undefined,
      });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      if (!ok) throw new Error('failed');
      setResetResult(`Sent access email for ${arcMailEmail}`);
      setSendFullName('');
      setSendArcMailEmail('');
      setSendToEmail('');
      setSendPassword('');
      setSendIncludePassword(false);
      setSendShowPassword(false);
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to send email.'));
    } finally {
      setSendingAccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white font-sans">
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
          <aside className="rounded-[28px] border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)] p-5 lg:sticky lg:top-6 self-start lg:max-h-[calc(100vh-3rem)] overflow-auto">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#7C6CF6]/20 flex items-center justify-center overflow-hidden">
                <img src={arcByteLogo} alt="ArcByte" className="h-6 w-6 object-contain" />
              </div>
              <div className="text-[16px] font-bold tracking-tight">Admin</div>
            </div>
            <div className="mt-6 text-[12px] font-semibold tracking-widest uppercase text-white/45 px-1">Overview</div>
            <div className="mt-2 space-y-1.5">
              <button onClick={() => setTab('twofa')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'twofa' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <ShieldCheck size={18} />
                Dashboard
              </button>
              <button onClick={() => setTab('domains')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'domains' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <Globe size={18} />
                Domains
              </button>
              <button onClick={() => setTab('emails')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'emails' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <AtSign size={18} />
                Emails
              </button>
              <button onClick={() => setTab('send')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'send' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <Send size={18} />
                Send Access
              </button>
              <button onClick={() => setTab('login')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'login' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <Lock size={18} />
                Block Login
              </button>
              <button onClick={() => setTab('activity')} className={cn("w-full h-11 rounded-2xl px-3 text-[14px] font-semibold flex items-center gap-3 transition-colors", tab === 'activity' ? "bg-[#7C6CF6]/20 text-[#C4B5FD]" : "hover:bg-white/5 text-white/70 hover:text-white")}>
                <Activity size={18} />
                Activity
              </button>
            </div>
            <div className="mt-6 rounded-2xl bg-[#0F0F0F] p-4 border border-white/10">
              <div className="text-[12px] text-white/50">Signed in</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#7C6CF6]/20 text-[#C4B5FD] flex items-center justify-center text-[12px] font-bold">
                  {(user?.username || 'A')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/85 leading-none truncate">{user?.username || 'admin'}</div>
                  <div className="text-[11px] text-white/45 leading-none truncate">Administrator</div>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-xl">
                  <input className="w-full h-11 rounded-full bg-[#0B0B0B] border border-white/10 pl-5 pr-28 outline-none text-sm text-white placeholder-white/25" placeholder="Search..." />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center justify-center">⌕</div>
                    <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center justify-center">•</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (tab === 'twofa') void load();
                      else if (tab === 'domains') void loadDomains();
                      else if (tab === 'emails') void loadEmails();
                      else if (tab === 'activity') void loadActivity();
                      else if (tab === 'login') void loadBlock();
                    }}
                    className="h-11 px-4 rounded-full border border-white/10 bg-white/5 text-[12px] font-semibold text-white/80 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/admin/login', { replace: true });
                    }}
                    className="h-11 px-4 rounded-full bg-[#7C6CF6] text-white text-[12px] font-semibold hover:bg-[#6b5af0] transition-colors inline-flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 px-4 py-3">
                  <div className="text-[12px] text-white/50">This month</div>
                  <div className="mt-1 text-[24px] font-bold tracking-tight text-white">132</div>
                </div>
                <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 px-4 py-3">
                  <div className="text-[12px] text-white/50">Average weight</div>
                  <div className="mt-1 text-[24px] font-bold tracking-tight text-white">32 lbs</div>
                </div>
                <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 px-4 py-3">
                  <div className="text-[12px] text-white/50">Average distance</div>
                  <div className="mt-1 text-[24px] font-bold tracking-tight text-white">872 mi</div>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[28px] font-bold tracking-tight text-white/90">Dashboard</div>
                <div className="text-[13px] text-white/45 mt-1">Plan, prioritize, and manage ArcMail access.</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (tab === 'twofa') void load();
                    else if (tab === 'domains') void loadDomains();
                    else if (tab === 'emails') void loadEmails();
                    else if (tab === 'activity') void loadActivity();
                    else if (tab === 'login') void loadBlock();
                  }}
                  className="h-11 px-5 rounded-full bg-[#1F7A55] text-white text-[12px] font-semibold hover:bg-[#176344] transition-colors inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    logout();
                    navigate('/admin/login', { replace: true });
                  }}
                  className="h-11 px-5 rounded-full border border-white/10 bg-white/5 text-[12px] font-semibold text-white/80 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>

            {isLocalDev && (
              <div className="text-[12px] text-white/55 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111111] px-4 py-3">
                <div className="min-w-0 truncate">
                  <span className="text-white/70 font-semibold">Admin API</span>: {adminBase || '(none)'}
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
                  className="shrink-0 text-[#C4B5FD] hover:text-[#E9D5FF] font-semibold transition-colors"
                >
                  {allowRemote ? 'Use local API' : 'Use prod API'}
                </button>
              </div>
            )}
            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2 rounded-2xl"><Lock size={14} />{error}</div>}
            {resetResult && <div className="p-4 bg-[#7C6CF6]/10 border border-[#7C6CF6]/20 text-[#E9D5FF] text-sm rounded-2xl">{resetResult}</div>}
            {tab === 'twofa' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 rounded-[28px] border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)] p-6 self-start">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[13px] font-semibold tracking-widest uppercase text-white/45">Registered Emails</div>
                    <button
                      onClick={() => void load()}
                      className="h-10 px-4 rounded-full border border-white/10 bg-white/5 text-[12px] font-semibold text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
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
                      className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B] px-4 outline-none text-sm text-white placeholder-white/25 focus:ring-1 focus:ring-[#7C6CF6]/25 focus:border-[#7C6CF6]/25"
                      placeholder="Search email…"
                    />
                  </div>

                  <div className="mt-4 divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden bg-[#0F0F0F]">
                    {filtered.length === 0 ? (
                      <div className="p-4 text-sm text-white/45">No users found.</div>
                    ) : (
                      filtered.slice(0, 200).map((r) => (
                        <div key={r.email} className="p-4 flex items-center justify-between gap-4 bg-[#0F0F0F]">
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-white/85">{r.email}</div>
                            <div className="text-xs text-white/40">{r.updatedAt ? `Updated ${new Date(r.updatedAt).toLocaleString()}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-9 px-3 rounded-2xl border text-[11px] font-bold tracking-widest uppercase flex items-center gap-2",
                                r.twofaEnabled
                                  ? "border-[#1DB954]/25 bg-[#1DB954]/10 text-[#B8F7CF]"
                                  : "border-white/10 bg-white/5 text-white/55"
                              )}
                            >
                              {r.twofaEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                              {r.twofaEnabled ? '2FA ON' : '2FA OFF'}
                            </div>
                            <button
                              disabled={busy}
                              onClick={() => void reset2faEmail(r.email)}
                              className="h-9 px-3 rounded-2xl bg-[#EF4444] text-white text-[11px] font-bold tracking-widest uppercase hover:bg-[#DC2626] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Reset 2FA
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)] p-6 space-y-6 self-start">
                  <div>
                    <div className="text-[13px] font-semibold tracking-widest uppercase text-white/45">Reset 2FA</div>
                    <div className="text-sm text-white/45 mt-2">Reset a single mailbox 2FA or wipe all.</div>
                    <div className="mt-4 space-y-3">
                      <input
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B] px-4 outline-none text-sm text-white placeholder-white/25 focus:ring-1 focus:ring-[#7C6CF6]/25 focus:border-[#7C6CF6]/25"
                        placeholder="user@arcbyte.co"
                      />
                      <button
                        disabled={busy || !targetEmail.trim()}
                        onClick={() => void reset2faEmail(targetEmail.trim())}
                        className="w-full h-11 rounded-2xl bg-[#EF4444] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#DC2626] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Reset email 2FA
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm('Reset 2FA for ALL users? This will log out everyone.');
                          if (ok) void reset2faAll();
                        }}
                        className="w-full h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold tracking-widest uppercase text-white/70 hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Reset all 2FA
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void bootstrapDb()}
                        className="w-full h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold tracking-widest uppercase text-white/70 hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Bootstrap DB
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'login' && (
              <div className="rounded-[28px] border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)] p-6">
                <div className="text-[13px] font-semibold tracking-widest uppercase text-white/45">Block Login</div>
                <div className="text-sm text-white/45 mt-2">Stop new logins to ArcMail.</div>
                <div className="mt-6 space-y-3 w-full max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={() => setLoginBlocked((v) => !v)}
                    className={cn(
                      "w-full h-11 rounded-2xl border text-xs font-bold tracking-widest uppercase transition-colors",
                      loginBlocked ? "bg-[#EF4444] text-white border-transparent hover:bg-[#DC2626]" : "bg-[#0B0B0B] text-white/70 border-white/10 hover:bg-white/5"
                    )}
                  >
                    {loginBlocked ? 'Login blocked' : 'Login allowed'}
                  </button>
                  <input
                    value={loginBlockMessage}
                    onChange={(e) => setLoginBlockMessage(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-white/10 bg-[#0B0B0B] px-4 outline-none text-sm text-white placeholder-white/25 focus:ring-1 focus:ring-[#7C6CF6]/25 focus:border-[#7C6CF6]/25"
                    placeholder="Optional message shown on login…"
                  />
                  <button
                    disabled={savingBlock}
                    onClick={() => void saveBlock()}
                    className="w-full h-11 rounded-2xl bg-[#7C6CF6] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#6b5af0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            )}

            {tab === 'domains' && (
              <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] p-6">
                <div className="text-[13px] font-semibold tracking-widest uppercase text-black/45">Domain Access</div>
                <div className="text-sm text-black/50 mt-2">Only listed domains can sign in. You can block/unblock any listed domain.</div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] pl-11 pr-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                        placeholder="@arcbyte.co"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35">
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
                      className="h-11 px-4 rounded-2xl border border-black/10 bg-white text-xs font-bold tracking-widest uppercase text-black/65 hover:bg-black/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  <div className="border border-black/5 rounded-2xl overflow-hidden bg-white">
                    {loadingDomains ? (
                      <div className="p-4 text-sm text-black/45 flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Loading domains…
                      </div>
                    ) : domainRules.length === 0 ? (
                      <div className="p-4 text-sm text-black/45">No domains configured.</div>
                    ) : (
                      domainRules.map((r) => (
                        <div key={r.domain} className="p-3 flex items-center justify-between gap-3 bg-white border-t border-black/5 first:border-t-0">
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-black/85">@{r.domain}</div>
                            <div className="text-xs text-black/40">{r.blocked ? 'Blocked' : 'Allowed'}</div>
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
                                r.blocked
                                  ? "bg-[#F6F7F9] text-black/70 border border-black/10 hover:bg-black/5"
                                  : "bg-[#EF4444] text-white hover:bg-[#DC2626]"
                              )}
                            >
                              <Ban size={14} />
                              {r.blocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              disabled={savingDomains}
                              onClick={() => setDomainRules((prev) => prev.filter((x) => x.domain !== r.domain))}
                              className="h-9 w-9 rounded-2xl border border-black/10 text-black/60 hover:bg-black/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
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
                    className="w-full h-11 rounded-2xl bg-[#1F7A55] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#176344] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] p-6">
                <div className="text-[13px] font-semibold tracking-widest uppercase text-black/45">Block specific emails</div>
                <div className="text-sm text-black/50 mt-2">Block sign-ins for individual mailboxes even if the domain is allowed.</div>

                <div className="mt-6 space-y-3 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] pl-11 pr-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                        placeholder="user@arcbyte.co"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35">
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
                      className="h-11 px-4 rounded-2xl border border-black/10 bg-white text-xs font-bold tracking-widest uppercase text-black/65 hover:bg-black/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  <div className="border border-black/5 rounded-2xl overflow-hidden bg-white">
                    {loadingEmails ? (
                      <div className="p-4 text-sm text-black/45 flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Loading emails…
                      </div>
                    ) : emailRules.length === 0 ? (
                      <div className="p-4 text-sm text-black/45">No emails configured.</div>
                    ) : (
                      emailRules.map((r) => (
                        <div key={r.email} className="p-3 flex items-center justify-between gap-3 bg-white border-t border-black/5 first:border-t-0">
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-black/85">{r.email}</div>
                            <div className="text-xs text-black/40">{r.blocked ? 'Blocked' : 'Allowed'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={savingEmails}
                              onClick={() => setEmailRules((prev) => prev.map((x) => (x.email === r.email ? { ...x, blocked: !x.blocked } : x)))}
                              className={cn(
                                "h-9 px-3 rounded-2xl text-[11px] font-bold tracking-widest uppercase transition-colors flex items-center gap-2",
                                r.blocked
                                  ? "bg-[#F6F7F9] text-black/70 border border-black/10 hover:bg-black/5"
                                  : "bg-[#EF4444] text-white hover:bg-[#DC2626]"
                              )}
                            >
                              <Ban size={14} />
                              {r.blocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              disabled={savingEmails}
                              onClick={() => setEmailRules((prev) => prev.filter((x) => x.email !== r.email))}
                              className="h-9 w-9 rounded-2xl border border-black/10 text-black/60 hover:bg-black/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
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
                    className="w-full h-11 rounded-2xl bg-[#1F7A55] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#176344] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            )}

            {tab === 'send' && (
              <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] p-6">
                <div className="text-[13px] font-semibold tracking-widest uppercase text-black/45">Send ArcMail Access</div>
                <div className="text-sm text-black/50 mt-2">
                  Sends an onboarding email containing the ArcMail username and login link.
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-black/45">Full name (optional)</div>
                    <input
                      value={sendFullName}
                      onChange={(e) => setSendFullName(e.target.value)}
                      className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] px-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-black/45">ArcMail username</div>
                    <input
                      value={sendArcMailEmail}
                      onChange={(e) => setSendArcMailEmail(e.target.value)}
                      className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] px-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                      placeholder="user@arcbyte.co"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-black/45">Send to</div>
                    <input
                      value={sendToEmail}
                      onChange={(e) => setSendToEmail(e.target.value)}
                      className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] px-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                      placeholder="personal@email.com"
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSendIncludePassword((v) => !v)}
                      className={cn(
                        "h-11 px-4 rounded-2xl border text-xs font-bold tracking-widest uppercase transition-colors",
                        sendIncludePassword
                          ? "bg-[#EF4444] text-white border-transparent hover:bg-[#DC2626]"
                          : "bg-white border-black/10 text-black/65 hover:bg-black/5"
                      )}
                    >
                      {sendIncludePassword ? 'Password included' : 'Add password'}
                    </button>
                  </div>
                  {sendIncludePassword && (
                    <div className="relative">
                      <input
                        value={sendPassword}
                        onChange={(e) => setSendPassword(e.target.value)}
                        type={sendShowPassword ? 'text' : 'password'}
                        className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] pl-4 pr-12 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                        placeholder="Password"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setSendShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-2xl border border-black/10 text-black/60 hover:bg-black/5 transition-colors flex items-center justify-center"
                        aria-label={sendShowPassword ? 'Hide password' : 'Show password'}
                      >
                        {sendShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-end">
                  <button
                    disabled={sendingAccess}
                    onClick={() => void sendAccessEmail()}
                    className="h-11 px-5 rounded-2xl bg-[#1F7A55] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#176344] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {sendingAccess ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Sending
                      </span>
                    ) : (
                      <>
                        <Send size={14} />
                        Send email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {tab === 'activity' && (
              <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold tracking-widest uppercase text-black/45">User Activity</div>
                    <div className="text-sm text-black/50 mt-2">Login and logout events.</div>
                  </div>
                  <button
                    onClick={() => void loadActivity()}
                    className="h-10 px-4 rounded-full border border-black/10 bg-white text-[12px] font-semibold text-black/70 hover:bg-black/5 transition-colors flex items-center gap-2"
                    disabled={loadingActivity}
                  >
                    {loadingActivity ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    Refresh
                  </button>
                </div>

                <div className="mt-5 flex items-center gap-2 max-w-xl">
                  <input
                    value={activityEmail}
                    onChange={(e) => setActivityEmail(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-black/10 bg-[#F6F7F9] px-4 outline-none text-sm text-black placeholder-black/35 focus:ring-1 focus:ring-[#1F7A55]/25 focus:border-[#1F7A55]/25"
                    placeholder="Filter by email (optional)…"
                  />
                  <button
                    onClick={() => void loadActivity()}
                    className="h-11 px-4 rounded-2xl bg-[#1F7A55] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#176344] transition-colors"
                  >
                    Apply
                  </button>
                </div>

                <div className="mt-5 border border-black/5 rounded-2xl overflow-hidden bg-white">
                  {loadingActivity ? (
                    <div className="p-4 text-sm text-black/45 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} />
                      Loading activity…
                    </div>
                  ) : activityRows.length === 0 ? (
                    <div className="p-4 text-sm text-black/45">No activity yet.</div>
                  ) : (
                    activityRows.map((r) => (
                      <div key={r.id} className="p-4 flex items-center justify-between gap-4 bg-white border-t border-black/5 first:border-t-0">
                        <div className="min-w-0">
                          <div className="font-semibold truncate text-black/85">{r.email}</div>
                          <div className="text-xs text-black/45">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                            {r.ip ? ` · ${r.ip}` : ''}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "h-9 px-3 rounded-2xl border text-[11px] font-bold tracking-widest uppercase flex items-center gap-2",
                            r.eventType === 'login'
                              ? "border-[#1F7A55]/20 bg-[#1F7A55]/10 text-[#176344]"
                              : "border-black/10 bg-black/5 text-black/65"
                          )}
                        >
                          <Activity size={14} />
                          {r.eventType}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
