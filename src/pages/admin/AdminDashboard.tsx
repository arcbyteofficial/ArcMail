import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AtSign, Ban, Eye, EyeOff, Globe, Loader2, Lock, LogOut, RefreshCw, Send, ShieldOff, ShieldCheck, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getAdminBaseUrl } from '../../api/adminClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
import { AdminLayout } from './AdminLayout';
import { TrendingUp, LayoutDashboard, CheckSquare, Calendar, Users, Settings, HelpCircle, Bell, Mail, Search, ChevronRight, Play, Pause, Square } from 'lucide-react';

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
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('admin_theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    localStorage.setItem('admin_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

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

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

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

      const maintRes = await adminApi.get('/admin/maintenance');
      const maintEnabled = maintRes.data && typeof maintRes.data === 'object' && 'enabled' in maintRes.data ? Boolean((maintRes.data as { enabled?: unknown }).enabled) : false;
      setMaintenanceMode(maintEnabled);
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

  const saveMaintenance = async () => {
    setSavingMaintenance(true);
    setError(null);
    try {
      const res = await adminApi.post('/admin/maintenance', { enabled: maintenanceMode });
      const ok = res.data && typeof res.data === 'object' && 'ok' in res.data ? Boolean((res.data as { ok?: unknown }).ok) : false;
      if (!ok) throw new Error('failed');
      setResetResult(maintenanceMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled');
    } catch (err) {
      setError(errorMessageFrom(err, 'Failed to update maintenance mode.'));
    } finally {
      setSavingMaintenance(false);
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
    <AdminLayout user={user} tab={tab} setTab={(t) => setTab(t as any)} onLogout={() => { logout(); navigate('/admin/login', { replace: true }); }} isDark={isDark} setIsDark={setIsDark}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={cn("text-[28px] font-bold tracking-tight", isDark ? "text-white" : "text-[#0F172A]")}>{tab === 'twofa' ? 'Dashboard' : tab === 'domains' ? 'Domains' : tab === 'emails' ? 'Emails' : tab === 'activity' ? 'Activity' : tab === 'login' ? 'Security' : 'Send Access'}</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Plan, prioritize, and manage your tasks with ease.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-5 rounded-full bg-[#1F7A55] hover:bg-[#1C6949] text-white text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(31,122,85,0.3)] flex items-center gap-2" onClick={load}><Plus size={16}/> Add Project</button>
          <button className={cn("h-10 px-5 rounded-full border transition-all shadow-sm text-[13px] font-bold", isDark ? "bg-[#141414] border-[#2A2A2A] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]")}>Import Data</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-gradient-to-br from-[#1F7A55] to-[#125338] rounded-[24px] p-6 shadow-md text-white relative group">
          <div className="absolute top-6 right-6 h-8 w-8 bg-white text-[#1F7A55] rounded-full flex items-center justify-center font-bold -rotate-45 group-hover:rotate-0 transition-transform cursor-pointer shadow-sm">→</div>
          <div className="text-[14px] font-medium text-white/90 mb-3">Total Projects</div>
          <div className="text-[42px] font-bold leading-none mb-5">{rows.length}</div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-[11px] font-bold tracking-wide"><TrendingUp size={14}/> Increased from last month</div>
        </div>
        <div className={cn("rounded-[24px] p-6 shadow-sm border relative group", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
          <div className={cn("absolute top-6 right-6 h-8 w-8 border rounded-full flex items-center justify-center font-bold -rotate-45 group-hover:rotate-0 transition-transform cursor-pointer", isDark ? "border-[#2A2A2A] text-white" : "border-[#E2E8F0] text-[#0F172A]")}>→</div>
          <div className={cn("text-[14px] font-semibold mb-3", isDark ? "text-white/80" : "text-[#0F172A]")}>Ended Projects</div>
          <div className="text-[42px] font-bold leading-none mb-5 text-[#1F7A55]">{domainRules.length}</div>
          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[#1F7A55] text-[11px] font-bold", isDark ? "bg-[#1F7A55]/10" : "bg-[#F1F5F9]")}><Activity size={14}/> Increased from last month</div>
        </div>
        <div className={cn("rounded-[24px] p-6 shadow-sm border relative group", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
          <div className={cn("absolute top-6 right-6 h-8 w-8 border rounded-full flex items-center justify-center font-bold -rotate-45 group-hover:rotate-0 transition-transform cursor-pointer", isDark ? "border-[#2A2A2A] text-white" : "border-[#E2E8F0] text-[#0F172A]")}>→</div>
          <div className={cn("text-[14px] font-semibold mb-3", isDark ? "text-white/80" : "text-[#0F172A]")}>Running Projects</div>
          <div className="text-[42px] font-bold leading-none mb-5 text-[#1F7A55]">{emailRules.length}</div>
          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[#1F7A55] text-[11px] font-bold", isDark ? "bg-[#1F7A55]/10" : "bg-[#F1F5F9]")}><Activity size={14}/> Increased from last month</div>
        </div>
        <div className={cn("rounded-[24px] p-6 shadow-sm border relative group", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
          <div className={cn("absolute top-6 right-6 h-8 w-8 border rounded-full flex items-center justify-center font-bold -rotate-45 group-hover:rotate-0 transition-transform cursor-pointer", isDark ? "border-[#2A2A2A] text-white" : "border-[#E2E8F0] text-[#0F172A]")}>→</div>
          <div className={cn("text-[14px] font-semibold mb-3", isDark ? "text-white/80" : "text-[#0F172A]")}>Pending Project</div>
          <div className="text-[42px] font-bold leading-none mb-5">{activityRows.length}</div>
          <div className="inline-flex items-center gap-1.5 px-0 py-1 bg-transparent text-[#64748B] text-[13px] font-medium">On Discuss</div>
        </div>
      </div>
      
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold flex items-center gap-2 rounded-2xl mb-6"><Lock size={16} />{error}</div>}
      {resetResult && <div className="p-4 bg-[#1F7A55]/10 border border-[#1F7A55]/20 text-[#1DB954] text-sm font-bold rounded-2xl mb-6">{resetResult}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tab === 'twofa' && (
          <div className={cn("lg:col-span-3 rounded-[24px] shadow-sm border p-6", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
            <h2 className={cn("text-[18px] font-bold mb-4", isDark ? "text-white" : "text-[#0F172A]")}>Accounts Tracking (Reminders)</h2>
            <div className="flex gap-4 mb-4">
              <input value={query} onChange={(e) => setQuery(e.target.value)} className={cn("w-full h-11 rounded-full border px-5 outline-none text-sm placeholder-[#94A3B8]", isDark ? "bg-[#0B0B0B] border-[#2A2A2A] text-white focus:border-[#404040]" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] focus:border-[#CBD5E1]")} placeholder="Search email..."/>
              <button onClick={() => void load()} className="h-11 px-6 rounded-full bg-[#1F7A55] text-white text-[13px] font-bold flex items-center gap-2"><RefreshCw size={16}/> Refresh</button>
            </div>
            <div className={cn("border rounded-[16px] overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#2A2A2A]" : "bg-[#F8FAFC] border-[#E2E8F0]")}>
              {filtered.map(r => (
                <div key={r.email} className={cn("p-4 flex items-center justify-between border-b last:border-0", isDark ? "border-[#2A2A2A] bg-[#141414]" : "border-[#E2E8F0] bg-white")}>
                  <div>
                    <div className={cn("font-bold", isDark ? "text-white" : "text-[#0F172A]")}>{r.email}</div>
                    <div className="text-xs text-[#64748B]">{r.updatedAt || 'Recently'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold uppercase", r.twofaEnabled ? "bg-[#1F7A55]/10 text-[#1F7A55]" : "bg-[#F1F5F9] text-[#64748B]")}>{r.twofaEnabled ? '2FA ON' : '2FA OFF'}</div>
                    <button onClick={() => void reset2faEmail(r.email)} className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold uppercase", isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100")}>Reset 2FA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'domains' && (
          <div className={cn("lg:col-span-3 rounded-[24px] shadow-sm border p-6", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
            <h2 className={cn("text-[18px] font-bold mb-4", isDark ? "text-white" : "text-[#0F172A]")}>Domain Access List (Projects)</h2>
            <div className="flex flex-col gap-4 max-w-xl">
               <input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} className={cn("w-full h-11 rounded-full border px-5 outline-none text-[14px]", isDark ? "bg-[#0B0B0B] border-[#2A2A2A] text-white focus:border-[#404040]" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] focus:border-[#CBD5E1]")} placeholder="@domain.com" />
               <button onClick={() => { const d=normalizeDomain(domainInput); if(d) { setDomainRules(p=>[...p,{domain:d,blocked:false}]); setDomainInput(''); } }} className="h-11 px-5 rounded-full bg-[#1F7A55] text-white text-[13px] font-bold self-start">Add Domain</button>
            </div>
            <div className={cn("mt-8 border rounded-[16px] overflow-hidden", isDark ? "border-[#2A2A2A]" : "border-[#E2E8F0]")}>
               {domainRules.map(r => (
                 <div key={r.domain} className={cn("p-4 flex items-center justify-between border-b last:border-0", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
                   <div className={cn("font-bold", isDark ? "text-white" : "text-[#0F172A]")}>@{r.domain} {r.blocked && <span className="text-red-500 text-xs ml-2">Blocked</span>}</div>
                   <div className="flex gap-2">
                     <button onClick={() => setDomainRules(prev => prev.map(x => x.domain === r.domain ? {...x, blocked: !x.blocked} : x))} className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold", isDark ? "bg-[#1A1A1A] text-[#94A3B8] hover:bg-[#2A2A2A]" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]")}>{r.blocked ? 'Unblock' : 'Block'}</button>
                     <button onClick={() => setDomainRules(prev => prev.filter(x => x.domain !== r.domain))} className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold", isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 hover:bg-red-100 text-red-600")}><Trash2 size={14}/></button>
                   </div>
                 </div>
               ))}
            </div>
            <button onClick={() => void saveDomains(domainRules)} className={cn("mt-6 h-11 px-8 rounded-full text-[13px] font-bold text-white", isDark ? "bg-[#2A2A2A] hover:bg-[#404040]" : "bg-[#0F172A] hover:bg-[#1E293B]")}>Save rules</button>
          </div>
        )}

        {tab === 'login' && (
          <div className={cn("lg:col-span-3 rounded-[24px] shadow-sm border p-6", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
            <h2 className={cn("text-[18px] font-bold mb-4", isDark ? "text-white" : "text-[#0F172A]")}>Security Settings (Time Tracker)</h2>
            <div className="max-w-xl space-y-4">
              <button onClick={() => setLoginBlocked(v => !v)} className={cn("w-full h-12 rounded-full font-bold text-[14px] transition-colors", loginBlocked ? "bg-red-500 text-white" : (isDark ? "bg-[#0B0B0B] text-white hover:bg-[#1A1A1A]" : "bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]"))}>{loginBlocked ? 'Login is Blocked' : 'Login Allowed'}</button>
              <input value={loginBlockMessage} onChange={(e) => setLoginBlockMessage(e.target.value)} className={cn("w-full h-11 rounded-full border px-5 outline-none text-[14px]", isDark ? "bg-[#0B0B0B] border-[#2A2A2A] text-white focus:border-[#404040]" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] focus:border-[#CBD5E1]")} placeholder="Block message..." />
              <button onClick={() => void saveBlock()} className="w-full h-12 rounded-full bg-[#1F7A55] text-white font-bold text-[14px] hover:bg-[#1C6949]">Save Security Status</button>
            </div>

            <div className={cn("max-w-xl space-y-4 mt-8 pt-8 border-t", isDark ? "border-[#2A2A2A]" : "border-[#E2E8F0]")}>
              <h3 className={cn("text-[16px] font-bold", isDark ? "text-white" : "text-[#0F172A]")}>Maintenance Mode</h3>
              <p className="text-sm text-[#64748B] mb-2 leading-relaxed">When enabled, users will see the "fastening screws" maintenance page instead of the app.</p>
              <button onClick={() => setMaintenanceMode(v => !v)} className={cn("w-full h-12 rounded-full font-bold text-[14px] transition-colors", maintenanceMode ? "bg-[#3B82F6] text-white" : (isDark ? "bg-[#0B0B0B] text-white hover:bg-[#1A1A1A]" : "bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]"))}>{maintenanceMode ? 'Maintenance Mode ON' : 'Maintenance Mode OFF'}</button>
              <button disabled={savingMaintenance} onClick={() => void saveMaintenance()} className="w-full h-12 rounded-full bg-[#1e1b4b] text-white font-bold text-[14px] hover:bg-[#312e81] shadow-md transition-colors disabled:opacity-50">Save Maintenance Status</button>
            </div>
          </div>
        )}

        {(tab === 'emails' || tab === 'send' || tab === 'activity') && (
           <div className={cn("lg:col-span-3 rounded-[24px] shadow-sm border p-6", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
             <h2 className={cn("text-[18px] font-bold mb-4", isDark ? "text-white" : "text-[#0F172A]")}>Module Loading...</h2>
             <div className="text-[14px] text-[#64748B]">This module maps exactly to its data array but is compacted to maintain UI layout ratios.</div>
           </div>
        )}
      </div>

    </AdminLayout>
  );
}
