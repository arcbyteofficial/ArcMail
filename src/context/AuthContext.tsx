import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

type AuthUser = { name: string; email?: string; role?: string; id?: string; status?: string; clientId?: string };

type StoredAccount = {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarDataUrl?: string;
  role?: string;
  idp?: string;
  userId?: string;
  status?: string;
  clientId?: string;
  token: string;
  csrfToken?: string;
  sessionId?: string;
  createdAt: number;
  lastUsedAt: number;
};

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  accounts: { id: string; email: string; name: string; avatarDataUrl?: string }[];
  activeAccountId: string | null;
  login: (
    password: string,
    email?: string,
    rememberMe?: boolean
  ) => Promise<{
    ok: boolean;
    error?: string;
    require2FA?: boolean;
    require2FASetup?: boolean;
    preAuthToken?: string;
    qrDataUrl?: string;
    manualKey?: string;
  }>;
  verify2FA: (preAuthToken: string, params: { token?: string; backupCode?: string }) => Promise<{ ok: boolean; error?: string }>;
  confirm2FASetup: (params: { preAuthToken: string; token: string; logoutAllSessions?: boolean }) => Promise<{ ok: boolean; error?: string; backupCodes?: string[] }>;
  addAccount: (
    password: string,
    email: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    require2FA?: boolean;
    require2FASetup?: boolean;
    preAuthToken?: string;
    qrDataUrl?: string;
    manualKey?: string;
  }>;
  verify2FAAddAccount: (preAuthToken: string, params: { token?: string; backupCode?: string }) => Promise<{ ok: boolean; error?: string }>;
  confirm2FASetupAddAccount: (params: { preAuthToken: string; token: string }) => Promise<{ ok: boolean; error?: string; backupCodes?: string[] }>;
  switchAccount: (accountId: string) => void;
  logoutAccount: (accountId: string) => void;
  updateAccountProfile: (
    accountId: string,
    updates: { displayName?: string; avatarDataUrl?: string | null }
  ) => Promise<{ ok: boolean; error?: string }>;
  setActiveAuthToken: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_KEYS = [
  'isAuthenticated',
  'token',
  'userRole',
  'userName',
  'userEmail',
  'userId',
  'userStatus',
  'clientId',
  'mailCsrf',
  'mailSessionId',
] as const;

const MULTI_KEYS = ['mailAccounts', 'activeMailAccountId'] as const;
const PROFILE_KEY = 'mailAccountProfiles';

const accountIdFromEmail = (email: string) => String(email || '').trim().toLowerCase();

type StoredProfile = { displayName?: string; avatarDataUrl?: string };

const safeParseProfiles = (raw: string | null): Record<string, StoredProfile> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, StoredProfile> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const pv = v as Record<string, unknown>;
      const displayName = typeof pv.displayName === 'string' ? pv.displayName : undefined;
      const avatarDataUrl = typeof pv.avatarDataUrl === 'string' ? pv.avatarDataUrl : undefined;
      const safeAvatar =
        avatarDataUrl &&
        ((avatarDataUrl.startsWith('data:image/') && avatarDataUrl.length <= 350_000) ||
          (/^https?:\/\//i.test(avatarDataUrl) && avatarDataUrl.length <= 5000))
          ? avatarDataUrl
          : undefined;
      out[k] = {
        displayName: displayName && displayName.trim() ? displayName.trim() : undefined,
        avatarDataUrl: safeAvatar,
      };
    }
    return out;
  } catch {
    return {};
  }
};

const writeProfiles = (profiles: Record<string, StoredProfile>) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  } catch {
    return;
  }
};

const safeParseAccounts = (raw: string | null): StoredAccount[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a === 'object')
      .map((a) => a as Partial<StoredAccount>)
      .filter((a) => typeof a.id === 'string' && typeof a.email === 'string' && typeof a.name === 'string' && typeof a.token === 'string')
      .map((a) => ({
        id: a.id!,
        email: a.email!,
        name: a.name!,
        displayName: typeof a.displayName === 'string' ? a.displayName : undefined,
        avatarDataUrl: typeof a.avatarDataUrl === 'string' ? a.avatarDataUrl : undefined,
        role: a.role,
        status: a.status,
        userId: a.userId,
        clientId: a.clientId,
        token: a.token!,
        csrfToken: a.csrfToken,
        sessionId: a.sessionId,
        createdAt: typeof a.createdAt === 'number' ? a.createdAt : Date.now(),
        lastUsedAt: typeof a.lastUsedAt === 'number' ? a.lastUsedAt : Date.now(),
      }));
  } catch {
    return [];
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountsRaw, setAccountsRaw] = useState<StoredAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const clearAuthStorage = useCallback(() => {
    LEGACY_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    MULTI_KEYS.forEach((k) => localStorage.removeItem(k));
  }, []);

  const persistAccounts = useCallback((next: StoredAccount[], nextActiveId: string | null) => {
    const sanitized = next
      .filter((a) => a && typeof a.id === 'string' && typeof a.email === 'string' && typeof a.name === 'string' && typeof a.token === 'string')
      .map((a) => ({ ...a }));
    localStorage.setItem('mailAccounts', JSON.stringify(sanitized));
    if (nextActiveId) localStorage.setItem('activeMailAccountId', nextActiveId);
    else localStorage.removeItem('activeMailAccountId');
    setAccountsRaw(sanitized);
    setActiveAccountId(nextActiveId);
  }, []);

  const syncLegacyFromAccount = useCallback((account: StoredAccount | null) => {
    LEGACY_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    if (!account) return;

    const displayName = (account.displayName || account.name || account.email).trim();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('token', account.token);
    localStorage.setItem('userName', displayName);
    localStorage.setItem('userEmail', account.email);
    if (account.role) localStorage.setItem('userRole', account.role);
    if (account.userId) localStorage.setItem('userId', account.userId);
    if (account.status) localStorage.setItem('userStatus', account.status);
    if (account.clientId) localStorage.setItem('clientId', account.clientId);
    if (account.csrfToken) localStorage.setItem('mailCsrf', account.csrfToken);
    if (account.sessionId) localStorage.setItem('mailSessionId', account.sessionId);
  }, []);

  const applyProfileToLocal = useCallback(
    (accountId: string, profile: { displayName?: string | null; avatarDataUrl?: string | null }) => {
      const displayName = typeof profile.displayName === 'string' ? profile.displayName : '';
      const avatarDataUrl = typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : null;
      const safeAvatar =
        avatarDataUrl &&
        ((avatarDataUrl.startsWith('data:image/') && avatarDataUrl.length <= 350_000) ||
          (/^https?:\/\//i.test(avatarDataUrl) && avatarDataUrl.length <= 5000))
          ? avatarDataUrl
          : undefined;

      const profiles = safeParseProfiles(localStorage.getItem(PROFILE_KEY));
      profiles[accountId] = {
        displayName: displayName && displayName.trim() ? displayName.trim() : undefined,
        avatarDataUrl: safeAvatar,
      };
      writeProfiles(profiles);

      const existing = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const next = existing.map((a) => {
        if (a.id !== accountId) return a;
        return {
          ...a,
          displayName: profiles[accountId]?.displayName,
          avatarDataUrl: profiles[accountId]?.avatarDataUrl,
        };
      });
      const activeId = localStorage.getItem('activeMailAccountId') || null;
      persistAccounts(next, activeId);

      if (activeId && activeId === accountId) {
        const active = next.find((a) => a.id === accountId) || null;
        syncLegacyFromAccount(active);
        setIsAuthenticated(Boolean(active));
        setUser(
          active
            ? {
                name: (active.displayName || active.name || active.email).trim(),
                email: active.email,
                role: active.role,
                status: active.status,
                id: active.userId,
                clientId: active.clientId,
              }
            : null
        );
      }
    },
    [persistAccounts, syncLegacyFromAccount]
  );

  const upsertAccount = useCallback(
    (account: StoredAccount, options?: { setActive?: boolean }) => {
      const setActive = options?.setActive ?? true;
      const existing = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const prev = existing.find((a) => a.id === account.id);
      const profiles = safeParseProfiles(localStorage.getItem(PROFILE_KEY));
      const profile = profiles[account.id] || {};
      const merged: StoredAccount = {
        ...account,
        displayName:
          typeof prev?.displayName === 'string'
            ? prev.displayName
            : typeof profile.displayName === 'string'
              ? profile.displayName
              : account.displayName,
        avatarDataUrl:
          typeof prev?.avatarDataUrl === 'string'
            ? prev.avatarDataUrl
            : typeof profile.avatarDataUrl === 'string'
              ? profile.avatarDataUrl
              : account.avatarDataUrl,
      };
      const next = existing.filter((a) => a.id !== account.id);
      next.unshift(merged);
      const nextActive = setActive ? merged.id : (localStorage.getItem('activeMailAccountId') || null);
      persistAccounts(next, nextActive);
      if (setActive) {
        syncLegacyFromAccount(merged);
        setIsAuthenticated(true);
        const displayName = (merged.displayName || merged.name || merged.email).trim();
        setUser({
          name: displayName,
          email: merged.email,
          role: merged.role,
          status: merged.status,
          id: merged.userId,
          clientId: merged.clientId,
        });
      }
    },
    [persistAccounts, syncLegacyFromAccount]
  );

  const removeAccount = useCallback(
    (accountId: string) => {
      const existing = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const next = existing.filter((a) => a.id !== accountId);
      const currentActive = localStorage.getItem('activeMailAccountId') || null;
      if (currentActive === accountId) {
        const nextActive = next[0]?.id || null;
        persistAccounts(next, nextActive);
        if (nextActive) {
          const activeAcc = next.find((a) => a.id === nextActive) || null;
          syncLegacyFromAccount(activeAcc);
          setIsAuthenticated(true);
          setUser(
            activeAcc
              ? {
                  name: (activeAcc.displayName || activeAcc.name || activeAcc.email).trim(),
                  email: activeAcc.email,
                  role: activeAcc.role,
                  status: activeAcc.status,
                  id: activeAcc.userId,
                  clientId: activeAcc.clientId,
                }
              : null
          );
        } else {
          setIsAuthenticated(false);
          setUser(null);
          syncLegacyFromAccount(null);
        }
      } else {
        persistAccounts(next, currentActive);
      }
    },
    [persistAccounts, syncLegacyFromAccount]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      clearAuthStorage();
      const path = window.location.pathname || '';
      if (path.includes('/login')) return;
      window.location.href = '/login';
    } catch {
      const path = window.location.pathname || '';
      clearAuthStorage();
      window.location.href = path.includes('/login') ? '/login' : '/login';
    }
  }, [clearAuthStorage]);

  useEffect(() => {
    const initializeAuth = async () => {
      const existingAccounts = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const profiles = safeParseProfiles(localStorage.getItem(PROFILE_KEY));

      const legacyToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      const legacyEmail = sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail');
      const legacyName = sessionStorage.getItem('userName') || localStorage.getItem('userName');
      const legacyRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
      const legacyStatus = sessionStorage.getItem('userStatus') || localStorage.getItem('userStatus');
      const legacyUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
      const legacyClientId = sessionStorage.getItem('clientId') || localStorage.getItem('clientId');
      const legacyCsrf = sessionStorage.getItem('mailCsrf') || localStorage.getItem('mailCsrf');
      const legacySessionId = sessionStorage.getItem('mailSessionId') || localStorage.getItem('mailSessionId');

      let accounts = existingAccounts;
      if (accounts.length === 0 && legacyToken && legacyEmail) {
        const id = accountIdFromEmail(legacyEmail);
        const profile = profiles[id] || {};
        accounts = [
          {
            id,
            email: legacyEmail,
            name: legacyName || legacyEmail,
            displayName: typeof profile.displayName === 'string' ? profile.displayName : undefined,
            avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : undefined,
            role: legacyRole || undefined,
            status: legacyStatus || undefined,
            userId: legacyUserId || undefined,
            clientId: legacyClientId || undefined,
            token: legacyToken,
            csrfToken: legacyCsrf || undefined,
            sessionId: legacySessionId || undefined,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
          },
        ];
        persistAccounts(accounts, id);
      } else {
        const hydrated = accounts.map((a) => {
          const profile = profiles[a.id] || {};
          return {
            ...a,
            displayName: typeof a.displayName === 'string' ? a.displayName : typeof profile.displayName === 'string' ? profile.displayName : undefined,
            avatarDataUrl: typeof a.avatarDataUrl === 'string' ? a.avatarDataUrl : typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : undefined,
          };
        });
        persistAccounts(hydrated, localStorage.getItem('activeMailAccountId') || hydrated[0]?.id || null);
        accounts = hydrated;
      }

      const activeId = localStorage.getItem('activeMailAccountId') || accounts[0]?.id || null;
      const active = activeId ? accounts.find((a) => a.id === activeId) || accounts[0] : null;
      if (!active) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      syncLegacyFromAccount(active);
      setIsAuthenticated(true);
      setUser({
        name: (active.displayName || active.name || active.email).trim(),
        email: active.email,
        role: active.role,
        status: active.status,
        id: active.userId,
        clientId: active.clientId,
      });

      try {
        const res = await api.get('/auth/me');
        const data = res.data as unknown;
        if (data && typeof data === 'object' && 'name' in data) {
          const u = data as AuthUser;
          const updated: StoredAccount = {
            ...active,
            name: u.name || active.name,
            email: u.email || active.email,
            role: u.role || active.role,
            status: u.status || active.status,
            userId: u.id || active.userId,
            clientId: u.clientId || active.clientId,
            lastUsedAt: Date.now(),
          };
          upsertAccount(updated, { setActive: true });
        }
        try {
          const p = await api.get('/account/profile');
          const profile =
            p.data && typeof p.data === 'object' && 'profile' in p.data && p.data.profile && typeof p.data.profile === 'object'
              ? (p.data.profile as { displayName?: unknown; avatarDataUrl?: unknown })
              : null;
          if (profile) {
            const serverHasProfile = Boolean(
              (typeof profile.displayName === 'string' && profile.displayName.trim()) ||
                (typeof profile.avatarDataUrl === 'string' && profile.avatarDataUrl.trim())
            );
            if (serverHasProfile) {
              applyProfileToLocal(active.id, {
                displayName: typeof profile.displayName === 'string' ? profile.displayName : null,
                avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : null,
              });
            }
          }
        } catch {
          void 0;
        }
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: unknown } }).response?.status
            : null;
        if (status === 401 || status === 403) {
          removeAccount(active.id);
          const remaining = safeParseAccounts(localStorage.getItem('mailAccounts'));
          if (remaining.length === 0) logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [applyProfileToLocal, logout, persistAccounts, removeAccount, syncLegacyFromAccount, upsertAccount]);

  const consumeAuthResponse = useCallback(
    async (
      data: unknown,
      fallbackEmail?: string,
      options?: { setActive?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
    if (data && typeof data === 'object' && 'token' in data && (data as { token?: unknown }).token) {
      const setActive = options?.setActive ?? true;
      const d = data as { token: string; csrfToken?: unknown; sessionId?: unknown; user?: unknown };
      const userData = d.user && typeof d.user === 'object' ? (d.user as { email?: unknown; name?: unknown; role?: unknown; status?: unknown; id?: unknown; clientId?: unknown }) : {};
      const emailValue = String(userData.email || fallbackEmail || '').trim();
      const id = accountIdFromEmail(emailValue);
      const next: StoredAccount = {
        id,
        email: emailValue,
        name: String(userData.name || emailValue),
        role: typeof userData.role === 'string' ? userData.role : undefined,
        status: typeof userData.status === 'string' ? userData.status : undefined,
        userId: typeof userData.id === 'string' ? userData.id : undefined,
        clientId: typeof userData.clientId === 'string' ? userData.clientId : undefined,
        token: String(d.token),
        csrfToken: typeof d.csrfToken === 'string' ? d.csrfToken : undefined,
        sessionId: typeof d.sessionId === 'string' ? d.sessionId : undefined,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };
      upsertAccount(next, { setActive });
      if (setActive) {
        try {
          const p = await api.get('/account/profile');
          const profile =
            p.data && typeof p.data === 'object' && 'profile' in p.data && p.data.profile && typeof p.data.profile === 'object'
              ? (p.data.profile as { displayName?: unknown; avatarDataUrl?: unknown })
              : null;
          if (profile) {
            const serverHasProfile = Boolean(
              (typeof profile.displayName === 'string' && profile.displayName.trim()) ||
                (typeof profile.avatarDataUrl === 'string' && profile.avatarDataUrl.trim())
            );
            if (serverHasProfile) {
              applyProfileToLocal(id, {
                displayName: typeof profile.displayName === 'string' ? profile.displayName : null,
                avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : null,
              });
            }
          }
        } catch {
          void 0;
        }
      }
      return { ok: true };
    }
    return { ok: false, error: 'Sign in failed. Please try again.' };
    },
    [applyProfileToLocal, upsertAccount]
  );

  const login = useCallback(async (password: string, email?: string, rememberMe?: boolean): Promise<{ ok: boolean; error?: string; require2FA?: boolean; require2FASetup?: boolean; preAuthToken?: string; qrDataUrl?: string; manualKey?: string }> => {
    try {
      const payload = { email, password, rememberMe: Boolean(rememberMe) };
      const postWithFallback = async () => {
        try {
          return await api.post('/auth/login', payload);
        } catch (err) {
          const status =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { status?: unknown } }).response?.status
              : null;
          if (status === 404) return await api.post('/auth/mail-login', payload);
          throw err;
        }
      };

      const res = await postWithFallback();
      const contentType =
        res.headers && typeof res.headers === 'object' && 'content-type' in res.headers
          ? String((res.headers as { 'content-type'?: unknown })['content-type'] || '')
          : '';
      if (typeof res.data === 'string' || contentType.includes('text/html')) {
        return {
          ok: false,
          error:
            'API is misconfigured. Rebuild the frontend with VITE_API_URL=https://api.arcmail.arcbyte.co (or https://api.arcmail.arcbyte.co/api).',
        };
      }
      if (res.data && typeof res.data === 'object' && 'require2FA' in res.data && (res.data as { require2FA?: unknown }).require2FA) {
        const preAuthToken = (res.data as { preAuthToken?: unknown }).preAuthToken;
        if (typeof preAuthToken === 'string' && preAuthToken) return { ok: false, require2FA: true, preAuthToken };
        return { ok: false, error: '2FA required but preauth token missing.' };
      }
      if (res.data && typeof res.data === 'object' && 'require2FASetup' in res.data && (res.data as { require2FASetup?: unknown }).require2FASetup) {
        const preAuthToken = (res.data as { preAuthToken?: unknown }).preAuthToken;
        const qrDataUrl = (res.data as { qrDataUrl?: unknown }).qrDataUrl;
        const manualKey = (res.data as { manualKey?: unknown }).manualKey;
        if (typeof preAuthToken === 'string' && preAuthToken && typeof qrDataUrl === 'string' && qrDataUrl && typeof manualKey === 'string' && manualKey) {
          return { ok: false, require2FASetup: true, preAuthToken, qrDataUrl, manualKey };
        }
        return { ok: false, error: '2FA setup required but setup details missing.' };
      }
      const applied = await consumeAuthResponse(res.data, email);
      return applied;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status
          : null;
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null;
      const detailCode =
        data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : null;
      const serverMessage =
        data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
          ? String((data as { message: string }).message)
          : null;

      if (status === 401) return { ok: false, error: 'Invalid mailbox credentials.' };
      if (status === 403 && errorCode === 'login_blocked') {
        return { ok: false, error: serverMessage || 'Login is temporarily disabled.' };
      }
      if (status === 403 && errorCode === 'domain_blocked') {
        return { ok: false, error: serverMessage || 'Sign-in domain is blocked.' };
      }
      if (status === 403 && errorCode === 'email_blocked') {
        return { ok: false, error: serverMessage || 'Sign-in for this email is blocked.' };
      }
      if (errorCode === 'imap_tls_error') {
        return {
          ok: false,
          error: `Mail server TLS blocked${detailCode ? ` (${detailCode})` : ''}.`,
        };
      }
      if (errorCode === 'imap_unreachable') return { ok: false, error: 'Mail server unavailable. Try again.' };
      if (status === 502) return { ok: false, error: 'Mail server error. Try again.' };
      if (status === 404) {
        const base = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
        return {
          ok: false,
          error:
            `API endpoint not found. Your backend may be on an older version (missing /api/auth/login). Current baseURL: ${base || '(empty)'}`,
        };
      }
      return { ok: false, error: 'Connection error. Please try again.' };
    }
  }, [consumeAuthResponse]);

  const verify2FA = useCallback(async (preAuthToken: string, params: { token?: string; backupCode?: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await api.post('/auth/verify-2fa', { preAuthToken, token: params.token, backupCode: params.backupCode });
      const applied = await consumeAuthResponse(res.data);
      return applied;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status
          : null;
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      const serverMessage =
        data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
          ? String((data as { message: string }).message)
          : null;
      if (status === 404) return { ok: false, error: '2FA is not available on the backend yet. Deploy the updated API.' };
      if (status === 403 && errorCode === 'login_blocked') return { ok: false, error: serverMessage || 'Login is temporarily disabled.' };
      if (status === 403 && errorCode === 'domain_blocked') return { ok: false, error: serverMessage || 'Sign-in domain is blocked.' };
      if (status === 403 && errorCode === 'email_blocked') return { ok: false, error: serverMessage || 'Sign-in for this email is blocked.' };
      if (status === 401 && errorCode === 'invalid_2fa_code') return { ok: false, error: 'Invalid code. Try again.' };
      if (status === 401 && errorCode === 'preauth_expired') return { ok: false, error: 'Code session expired. Sign in again.' };
      if (status === 429 && errorCode === 'twofa_locked') return { ok: false, error: 'Too many attempts. Try again later.' };
      return { ok: false, error: 'Verification failed. Try again.' };
    }
  }, [consumeAuthResponse]);

  const confirm2FASetup = useCallback(async (params: { preAuthToken: string; token: string; logoutAllSessions?: boolean }): Promise<{ ok: boolean; error?: string; backupCodes?: string[] }> => {
    try {
      const res = await api.post('/auth/confirm-2fa-preauth', {
        preAuthToken: params.preAuthToken,
        token: params.token,
        logoutAllSessions: params.logoutAllSessions !== undefined ? Boolean(params.logoutAllSessions) : true,
      });
      const codes =
        res.data && typeof res.data === 'object' && 'backupCodes' in res.data && Array.isArray((res.data as { backupCodes?: unknown }).backupCodes)
          ? ((res.data as { backupCodes: unknown[] }).backupCodes.filter((c) => typeof c === 'string') as string[])
          : [];
      const applied = await consumeAuthResponse(res.data);
      if (!applied.ok) return { ok: false, error: applied.error || 'Sign in failed. Please try again.' };
      return { ok: true, backupCodes: codes.length ? codes : undefined };
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status
          : null;
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      const serverMessage =
        data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
          ? String((data as { message: string }).message)
          : null;
      if (status === 401 && errorCode === 'invalid_2fa_code') return { ok: false, error: 'Invalid code. Try again.' };
      if (status === 403 && errorCode === 'login_blocked') return { ok: false, error: serverMessage || 'Login is temporarily disabled.' };
      if (status === 403 && errorCode === 'domain_blocked') return { ok: false, error: serverMessage || 'Sign-in domain is blocked.' };
      if (status === 403 && errorCode === 'email_blocked') return { ok: false, error: serverMessage || 'Sign-in for this email is blocked.' };
      if (status === 429 && errorCode === 'twofa_locked') return { ok: false, error: 'Too many attempts. Try again later.' };
      if (status === 401 && errorCode === 'preauth_expired') return { ok: false, error: 'Setup session expired. Sign in again.' };
      return { ok: false, error: 'Failed to enable 2FA. Try again.' };
    }
  }, [consumeAuthResponse]);

  const addAccount = useCallback(
    async (password: string, email: string): Promise<{ ok: boolean; error?: string; require2FA?: boolean; require2FASetup?: boolean; preAuthToken?: string; qrDataUrl?: string; manualKey?: string }> => {
      try {
        const payload = { email, password, rememberMe: true };
        const postWithFallback = async () => {
          try {
            return await api.post('/auth/login', payload);
          } catch (err) {
            const status =
              err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { status?: unknown } }).response?.status
                : null;
            if (status === 404) return await api.post('/auth/mail-login', payload);
            throw err;
          }
        };
        const res = await postWithFallback();
        if (res.data && typeof res.data === 'object' && 'require2FA' in res.data && (res.data as { require2FA?: unknown }).require2FA) {
          const preAuthToken = (res.data as { preAuthToken?: unknown }).preAuthToken;
          if (typeof preAuthToken === 'string' && preAuthToken) return { ok: false, require2FA: true, preAuthToken };
          return { ok: false, error: '2FA required but preauth token missing.' };
        }
        if (res.data && typeof res.data === 'object' && 'require2FASetup' in res.data && (res.data as { require2FASetup?: unknown }).require2FASetup) {
          const preAuthToken = (res.data as { preAuthToken?: unknown }).preAuthToken;
          const qrDataUrl = (res.data as { qrDataUrl?: unknown }).qrDataUrl;
          const manualKey = (res.data as { manualKey?: unknown }).manualKey;
          if (typeof preAuthToken === 'string' && preAuthToken && typeof qrDataUrl === 'string' && qrDataUrl && typeof manualKey === 'string' && manualKey) {
            return { ok: false, require2FASetup: true, preAuthToken, qrDataUrl, manualKey };
          }
          return { ok: false, error: '2FA setup required but setup details missing.' };
        }
        const applied = await consumeAuthResponse(res.data, email, { setActive: false });
        return applied;
      } catch {
        return { ok: false, error: 'Sign in failed. Please try again.' };
      }
    },
    [consumeAuthResponse]
  );

  const verify2FAAddAccount = useCallback(async (preAuthToken: string, params: { token?: string; backupCode?: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await api.post('/auth/verify-2fa', { preAuthToken, token: params.token, backupCode: params.backupCode });
      const applied = await consumeAuthResponse(res.data, undefined, { setActive: false });
      return applied;
    } catch {
      return { ok: false, error: 'Verification failed. Try again.' };
    }
  }, [consumeAuthResponse]);

  const confirm2FASetupAddAccount = useCallback(async (params: { preAuthToken: string; token: string }): Promise<{ ok: boolean; error?: string; backupCodes?: string[] }> => {
    try {
      const res = await api.post('/auth/confirm-2fa-preauth', { preAuthToken: params.preAuthToken, token: params.token, logoutAllSessions: true });
      const codes =
        res.data && typeof res.data === 'object' && 'backupCodes' in res.data && Array.isArray((res.data as { backupCodes?: unknown }).backupCodes)
          ? ((res.data as { backupCodes: unknown[] }).backupCodes.filter((c) => typeof c === 'string') as string[])
          : [];
      const applied = await consumeAuthResponse(res.data, undefined, { setActive: false });
      if (!applied.ok) return { ok: false, error: applied.error || 'Sign in failed. Please try again.' };
      return { ok: true, backupCodes: codes.length ? codes : undefined };
    } catch {
      return { ok: false, error: 'Failed to enable 2FA. Try again.' };
    }
  }, [consumeAuthResponse]);

  const setActiveAuthToken = useCallback(
    (token: string) => {
      const activeId = localStorage.getItem('activeMailAccountId') || null;
      if (!activeId) return;
      const existing = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const target = existing.find((a) => a.id === activeId) || null;
      if (!target) return;
      const updated = { ...target, token: String(token), lastUsedAt: Date.now() };
      const next = [updated, ...existing.filter((a) => a.id !== activeId)];
      persistAccounts(next, activeId);
      syncLegacyFromAccount(updated);
      setIsAuthenticated(true);
      setUser({
        name: (updated.displayName || updated.name || updated.email).trim(),
        email: updated.email,
        role: updated.role,
        status: updated.status,
        id: updated.userId,
        clientId: updated.clientId,
      });
    },
    [persistAccounts, syncLegacyFromAccount]
  );

  const switchAccount = useCallback(
    (accountId: string) => {
      const accounts = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const target = accounts.find((a) => a.id === accountId) || null;
      if (!target) return;
      const updated = { ...target, lastUsedAt: Date.now() };
      const next = [updated, ...accounts.filter((a) => a.id !== accountId)];
      persistAccounts(next, accountId);
      syncLegacyFromAccount(updated);
      setIsAuthenticated(true);
      const displayName = (updated.displayName || updated.name || updated.email).trim();
      setUser({
        name: displayName,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        id: updated.userId,
        clientId: updated.clientId,
      });
    },
    [persistAccounts, syncLegacyFromAccount]
  );

  const logoutAccount = useCallback(
    (accountId: string) => {
      removeAccount(accountId);
      const remaining = safeParseAccounts(localStorage.getItem('mailAccounts'));
      if (remaining.length === 0) logout();
    },
    [logout, removeAccount]
  );

  const accounts = useMemo(
    () => accountsRaw.map((a) => ({ id: a.id, email: a.email, name: (a.displayName || a.name || a.email).trim(), avatarDataUrl: a.avatarDataUrl })),
    [accountsRaw]
  );

  const updateAccountProfile = useCallback(
    async (accountId: string, updates: { displayName?: string; avatarDataUrl?: string | null }) => {
      const existing = safeParseAccounts(localStorage.getItem('mailAccounts'));
      const next = existing.map((a) => {
        if (a.id !== accountId) return a;
        const displayName = typeof updates.displayName === 'string' ? updates.displayName : a.displayName;
        const avatarDataUrl =
          updates.avatarDataUrl === null ? undefined : typeof updates.avatarDataUrl === 'string' ? updates.avatarDataUrl : a.avatarDataUrl;
        return {
          ...a,
          displayName: displayName && displayName.trim() ? displayName.trim() : undefined,
          avatarDataUrl,
          lastUsedAt: Date.now(),
        };
      });
      const activeId = localStorage.getItem('activeMailAccountId') || null;
      persistAccounts(next, activeId);

      const profiles = safeParseProfiles(localStorage.getItem(PROFILE_KEY));
      const prev = profiles[accountId] || {};
      const displayName = typeof updates.displayName === 'string' ? updates.displayName : prev.displayName;
      const avatarDataUrl =
        updates.avatarDataUrl === null ? undefined : typeof updates.avatarDataUrl === 'string' ? updates.avatarDataUrl : prev.avatarDataUrl;
      const safeAvatar =
        avatarDataUrl &&
        ((avatarDataUrl.startsWith('data:image/') && avatarDataUrl.length <= 350_000) ||
          (/^https?:\/\//i.test(avatarDataUrl) && avatarDataUrl.length <= 5000))
          ? avatarDataUrl
          : undefined;
      profiles[accountId] = {
        displayName: displayName && displayName.trim() ? displayName.trim() : undefined,
        avatarDataUrl: safeAvatar,
      };
      writeProfiles(profiles);

      if (activeId && activeId === accountId) {
        const active = next.find((a) => a.id === accountId) || null;
        syncLegacyFromAccount(active);
        setIsAuthenticated(Boolean(active));
        setUser(
          active
            ? {
                name: (active.displayName || active.name || active.email).trim(),
                email: active.email,
                role: active.role,
                status: active.status,
                id: active.userId,
                clientId: active.clientId,
              }
            : null
        );
      }

      const activeForRequest = localStorage.getItem('activeMailAccountId') || null;
      if (activeForRequest && activeForRequest === accountId) {
        const payload: { displayName?: string; avatarDataUrl?: string | null } = {};
        if (typeof updates.displayName === 'string') payload.displayName = updates.displayName;
        if (updates.avatarDataUrl !== undefined) payload.avatarDataUrl = updates.avatarDataUrl;
        try {
          const res = await api.put('/account/profile', payload);
          const persisted =
            res.data && typeof res.data === 'object' && 'persisted' in res.data && typeof (res.data as { persisted?: unknown }).persisted === 'boolean'
              ? Boolean((res.data as { persisted: boolean }).persisted)
              : true;
          const p =
            res.data && typeof res.data === 'object' && 'profile' in res.data && res.data.profile && typeof res.data.profile === 'object'
              ? (res.data.profile as { displayName?: unknown; avatarDataUrl?: unknown })
              : null;
          if (!persisted) return { ok: false, error: 'Save did not persist on the server. Check object storage configuration.' };
          if (p) {
            applyProfileToLocal(accountId, {
              displayName: typeof p.displayName === 'string' ? p.displayName : null,
              avatarDataUrl: typeof p.avatarDataUrl === 'string' ? p.avatarDataUrl : null,
            });
          }
          return { ok: true };
        } catch (err) {
          const status =
            err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown } }).response?.status : null;
          const data =
            err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown } }).response?.data : null;
          const code =
            data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
              ? String((data as { error: string }).error)
              : null;
          if (status === 501 && code === 'storage_unconfigured') return { ok: false, error: 'Object storage is not configured on the server.' };
          if (status === 502 && code === 'storage_upload_failed') return { ok: false, error: 'Image upload failed. Please try again.' };
          if (status === 400 && code === 'image_too_large') return { ok: false, error: 'Image is too large. Use a smaller image.' };
          if (status === 400 && code === 'invalid_avatar') return { ok: false, error: 'Invalid image. Please select a valid image file.' };
          return { ok: false, error: 'Save failed. Please try again.' };
        }
      }
      return { ok: true };
    },
    [applyProfileToLocal, persistAccounts, syncLegacyFromAccount]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!activeAccountId) return;
    const accountId = activeAccountId;

    let stopped = false;
    const syncOnce = async () => {
      try {
        const p = await api.get('/account/profile');
        const profile =
          p.data && typeof p.data === 'object' && 'profile' in p.data && p.data.profile && typeof p.data.profile === 'object'
            ? (p.data.profile as { displayName?: unknown; avatarDataUrl?: unknown })
            : null;
        if (!profile) return;
        const serverHasProfile = Boolean(
          (typeof profile.displayName === 'string' && profile.displayName.trim()) ||
            (typeof profile.avatarDataUrl === 'string' && profile.avatarDataUrl.trim())
        );
        if (!serverHasProfile) return;
        if (stopped) return;
        applyProfileToLocal(accountId, {
          displayName: typeof profile.displayName === 'string' ? profile.displayName : null,
          avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : null,
        });
      } catch {
        return;
      }
    };

    void syncOnce();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncOnce();
    };
    window.addEventListener('focus', syncOnce);
    document.addEventListener('visibilitychange', onVisible);
    const intervalId = window.setInterval(() => void syncOnce(), 30_000);
    return () => {
      stopped = true;
      window.removeEventListener('focus', syncOnce);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(intervalId);
    };
  }, [activeAccountId, applyProfileToLocal, isAuthenticated, isLoading]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, accounts, activeAccountId, login, verify2FA, confirm2FASetup, addAccount, verify2FAAddAccount, confirm2FASetupAddAccount, switchAccount, logoutAccount, updateAccountProfile, setActiveAuthToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
