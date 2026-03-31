import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Lock, ArrowRight, Loader2, ShieldCheck, X, User, Phone, BadgeCheck, Mail, Check, Copy, QrCode, KeyRound } from 'lucide-react';
import logo from '../../assets/arcbyte.co Logo_white_transparent.png';

const SixDigitCodeInput = ({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    return Array.from({ length: 6 }).map((_, i) => clean[i] || '');
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => refs.current[0]?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

  const setAt = (index: number, char: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    const arr = clean.split('');
    while (arr.length < 6) arr.push('');
    arr[index] = char;
    const next = arr.join('').replace(/\D/g, '').slice(0, 6);
    onChange(next);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    const next = text.replace(/\D/g, '').slice(0, 6);
    if (!next) return;
    e.preventDefault();
    onChange(next);
    const idx = Math.min(next.length, 6) - 1;
    refs.current[Math.max(0, idx)]?.focus();
  };

  return (
    <div className="w-full max-w-[340px] mx-auto grid grid-cols-6 gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            const char = v ? v[v.length - 1] : '';
            setAt(i, char);
            if (char && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              if (digits[i]) {
                setAt(i, '');
                return;
              }
              if (i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, '');
              }
            }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
          }}
          className="w-full h-12 sm:h-14 text-center text-base sm:text-lg font-mono bg-[#141414] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all duration-200 rounded-xl"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

const MobileSixDigitBoxesInput = ({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const digits = useMemo(() => {
    const clean = String(value || '').replace(/\D/g, '').slice(0, 6);
    return Array.from({ length: 6 }).map((_, i) => clean[i] || '');
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

  const handleChange = (nextRaw: string) => {
    const next = String(nextRaw || '').replace(/\D/g, '').slice(0, 6);
    onChange(next);
  };

  const activeIndex = Math.min(digits.filter(Boolean).length, 5);

  return (
    <div
      className="w-full flex items-center justify-center gap-3"
      onClick={() => inputRef.current?.focus()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.focus();
      }}
    >
      <input
        ref={inputRef}
        value={String(value || '').replace(/\D/g, '').slice(0, 6)}
        onChange={(e) => handleChange(e.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        autoComplete="one-time-code"
        className="absolute opacity-0 pointer-events-none w-1 h-1"
      />
      {digits.map((d, i) => {
        const filled = Boolean(d);
        const active = !disabled && !filled && i === activeIndex;
        return (
          <div
            key={i}
            className={[
              'w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-semibold border transition-colors',
              filled ? 'bg-[#0F0F0F] border-white/10 text-white' : 'bg-[#0F0F0F] border-white/10 text-white/35',
              active ? 'ring-2 ring-[#1DB954]/55 border-[#1DB954]/55' : '',
            ].join(' ')}
          >
            {filled ? d : ''}
          </div>
        );
      })}
    </div>
  );
};

const MailLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<'login' | 'otp' | 'setup' | 'backupCodes'>('login');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [otp, setOtp] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [, setTick] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialSoon, setSocialSoon] = useState<string>('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpSubmitted, setFpSubmitted] = useState(false);
  const [fpFullName, setFpFullName] = useState('');
  const [fpEmployeeIdSuffix, setFpEmployeeIdSuffix] = useState('');
  const [fpPhone, setFpPhone] = useState('');
  const [fpCompanyUser, setFpCompanyUser] = useState('');
  const [fpAltPhone, setFpAltPhone] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSending, setFpSending] = useState(false);
  const { login, verify2FA, confirm2FASetup } = useAuth();
  const navigate = useNavigate();
  const [apiInfo, setApiInfo] = useState<string>('');
  const [healthInfo, setHealthInfo] = useState<string>('');
  const isMobile = useMemo(() => {
    try {
      return window.matchMedia('(max-width: 768px)').matches;
    } catch {
      return false;
    }
  }, []);
  const isLocal = (() => {
    try {
      const host = window.location.hostname;
      return host === 'localhost' || host === '127.0.0.1';
    } catch {
      return false;
    }
  })();
  const allowRemote = (() => {
    try {
      return (localStorage.getItem('arcmailAllowRemoteApi') || '') === '1';
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const base = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
    setApiInfo(base);
    if (!base) return;
    void api
      .get('/health')
      .then((r) => {
        const a =
          r.data && typeof r.data === 'object' && 'auth' in r.data && r.data.auth && typeof r.data.auth === 'object'
            ? (r.data.auth as { require2FAOnLogin?: unknown; storage?: unknown; nodeEnv?: unknown })
            : null;
        const require2FA = a && typeof a.require2FAOnLogin === 'boolean' ? a.require2FAOnLogin : null;
        const storage = a && typeof a.storage === 'string' ? a.storage : '';
        const nodeEnv = a && typeof a.nodeEnv === 'string' ? a.nodeEnv : '';
        setHealthInfo(
          [nodeEnv ? `env=${nodeEnv}` : null, storage ? `store=${storage}` : null, require2FA === null ? null : `require2FA=${require2FA}`]
            .filter(Boolean)
            .join(' ')
        );
      })
      .catch(() => setHealthInfo(''));
  }, []);

  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
  useEffect(() => {
    if (step !== 'otp' && step !== 'setup') return;
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(password, email, rememberMe);
      if (result.ok) {
        navigate('/');
      } else if (result.require2FA && typeof result.preAuthToken === 'string' && result.preAuthToken) {
        setStep('otp');
        setPreAuthToken(result.preAuthToken);
        setOtp('');
        setUseBackup(false);
      } else if (result.require2FASetup && typeof result.preAuthToken === 'string' && result.preAuthToken) {
        setStep('setup');
        setPreAuthToken(result.preAuthToken);
        setQrDataUrl(typeof result.qrDataUrl === 'string' ? result.qrDataUrl : '');
        setManualKey(typeof result.manualKey === 'string' ? result.manualKey : '');
        setOtp('');
        setUseBackup(false);
      } else {
        setError(result.error || 'Sign in failed. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const code = otp.trim();
      if (!code) {
        setError(useBackup ? 'Enter a backup code.' : 'Enter the 6-digit code.');
        return;
      }
      const res = await verify2FA(preAuthToken, useBackup ? { backupCode: code } : { token: code });
      if (!res.ok) {
        setError(res.error || 'Invalid code. Try again.');
        return;
      }
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const code = otp.trim();
      if (!code) {
        setError('Enter the 6-digit code.');
        return;
      }
      const res = await confirm2FASetup({ preAuthToken, token: code, logoutAllSessions: true });
      if (!res.ok) {
        try {
          const retry = await login(password, email, rememberMe);
          if (retry.ok) {
            navigate('/');
            return;
          }
          if (retry.require2FA && typeof retry.preAuthToken === 'string' && retry.preAuthToken) {
            setStep('otp');
            setPreAuthToken(retry.preAuthToken);
            setOtp('');
            setUseBackup(false);
            setError('');
            return;
          }
        } catch {
          void 0;
        }
        setError(res.error || 'Failed to enable 2FA. Try again.');
        return;
      }
      if (res.backupCodes && res.backupCodes.length) {
        setBackupCodes(res.backupCodes);
        setStep('backupCodes');
        return;
      }
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForgot = () => {
    setFpSubmitted(false);
    setFpFullName('');
    setFpEmployeeIdSuffix('');
    setFpPhone('');
    setFpCompanyUser('');
    setFpAltPhone('');
    setFpError('');
  };

  const closeForgot = () => {
    setForgotOpen(false);
    resetForgot();
  };

  const downloadBackupCodes = (codes: string[], subjectEmail: string) => {
    const safeEmail = String(subjectEmail || 'account').replace(/[^a-z0-9@._-]+/gi, '_');
    const lines = [
      'ArcMail Backup Codes',
      `Email: ${safeEmail}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      ...codes,
      '',
      'Keep these codes safe. Each code can be used once to sign in if you lose access to your authenticator.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcmail-backup-codes-${safeEmail}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (!fpFullName.trim()) return setFpError('Enter your full name.');
    if (!fpEmployeeIdSuffix.trim()) return setFpError('Enter your Employee / Intern ID.');
    if (!/^\d+$/.test(fpEmployeeIdSuffix.trim())) return setFpError('Employee / Intern ID must be numbers only.');
    if (!/^[6-9]\d{9}$/.test(fpPhone.trim())) return setFpError('Enter a valid Indian phone number (10 digits).');
    if (!fpCompanyUser.trim()) return setFpError('Enter your issued company mail ID.');
    if (!/^[a-zA-Z0-9._-]+$/.test(fpCompanyUser.trim())) return setFpError('Company mail ID can only contain letters, numbers, dot, underscore, and hyphen.');
    if (!/^[6-9]\d{9}$/.test(fpAltPhone.trim())) return setFpError('Enter a valid Indian phone number (10 digits).');
    setFpSending(true);
    try {
      const employeeId = `ARC${fpEmployeeIdSuffix.trim()}`;
      const companyEmail = `${fpCompanyUser.trim()}@arcbyte.co`.toLowerCase();
      await api.post('/auth/forgot-password', {
        fullName: fpFullName.trim(),
        employeeId,
        phone: fpPhone.trim(),
        companyEmail,
        altPhone: fpAltPhone.trim(),
      });
      setFpSubmitted(true);
      window.setTimeout(() => closeForgot(), 1400);
    } catch (err) {
      const response =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response
          : undefined;
      const status = response && typeof response.status === 'number' ? response.status : null;
      const data = response?.data as unknown;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      const detailCode =
        data && typeof data === 'object' && 'code' in data && typeof (data as { code?: unknown }).code === 'string'
          ? String((data as { code: string }).code)
          : null;
      if (!response) setFpError('Connection error. Please try again.');
      else if (status === 429 || errorCode === 'rate_limited') setFpError('Too many requests. Try again later.');
      else if (status === 501 || errorCode === 'forgot_password_unconfigured') setFpError('Reset requests are not configured yet.');
      else if (status === 400) setFpError('Please check your details and try again.');
      else if (status === 502 && errorCode === 'smtp_error') setFpError(`Mail service error${detailCode ? ` (${detailCode})` : ''}. Try again later.`);
      else setFpError('Failed to submit request. Try again.');
    } finally {
      setFpSending(false);
    }
  };

  return (
    isMobile ? (
      <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col items-center justify-center px-6 py-10">
        <main className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-10" />
          {step === 'login' && (
            <>
              <div className="flex items-center justify-center mb-8">
                <img src={logo} alt="ArcByte" className="h-10 w-auto object-contain opacity-95" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold tracking-tight text-white">Welcome Back</div>
                <div className="text-sm text-white/45 mt-1">Login to access your account</div>
              </div>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/55 mb-2">Email</label>
                  <div className="h-12 rounded-2xl bg-[#121212] border border-white/10 flex items-center gap-3 px-4">
                    <Mail size={18} className="text-white/35" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mail-login-autofill flex-1 bg-transparent outline-none text-sm font-medium text-white placeholder:text-white/30"
                      placeholder="name@arcbyte.co"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/55 mb-2">Password</label>
                  <div className="h-12 rounded-2xl bg-[#121212] border border-white/10 flex items-center gap-3 px-4">
                    <Lock size={18} className="text-white/35" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mail-login-autofill flex-1 bg-transparent outline-none text-sm font-medium text-white placeholder:text-white/30"
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors text-xs text-white/55">
                    <span className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="block w-4 h-4 rounded border border-white/15 bg-[#121212] peer-checked:bg-[#1DB954] peer-checked:border-[#1DB954] peer-focus-visible:ring-2 peer-focus-visible:ring-[#1DB954]/30 transition-all" />
                      <Check size={12} className="absolute inset-0 m-auto text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </span>
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setFpError('');
                      setFpSubmitted(false);
                      setFpFullName('');
                      setFpEmployeeIdSuffix('');
                      setFpPhone('');
                      setFpCompanyUser(() => {
                        const v = String(email || '').trim();
                        const lower = v.toLowerCase();
                        if (lower.endsWith('@arcbyte.co')) return lower.replace(/@arcbyte\.co$/i, '');
                        return '';
                      });
                      setFpAltPhone('');
                    }}
                    className="text-xs font-semibold text-white/55 hover:text-white transition-colors"
                  >
                    Forget password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full h-12 rounded-2xl bg-[#1DB954] hover:bg-[#1ED760] text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading…' : 'Log In'}
                </button>

                <div className="pt-2">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <div className="text-[11px] font-semibold text-white/35">Or Sign In With</div>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSocialSoon('Google sign-in is coming soon.');
                        window.setTimeout(() => setSocialSoon(''), 1800);
                      }}
                      disabled={isLoading}
                      className="h-11 rounded-2xl border border-white/10 bg-[#121212] text-white/80 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <img
                        src="https://img.icons8.com/fluency/48/google-logo.png"
                        alt="Google"
                        className="w-6 h-6"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-sm font-semibold">Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSocialSoon('GitHub sign-in is coming soon.');
                        window.setTimeout(() => setSocialSoon(''), 1800);
                      }}
                      disabled={isLoading}
                      className="h-11 rounded-2xl border border-white/10 bg-[#121212] text-white/80 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <img
                        src="https://img.icons8.com/ios-filled/50/github.png"
                        alt="GitHub"
                        className="w-6 h-6 invert"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-sm font-semibold">GitHub</span>
                    </button>
                  </div>
                  <AnimatePresence>
                    {socialSoon ? (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 text-center"
                      >
                        {socialSoon}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {import.meta.env.DEV && isLocal && (
                  <div className="pt-4 text-[11px] text-white/35 flex flex-col items-center gap-2 text-center">
                    <div className="min-w-0 w-full truncate">
                      <span className="text-white/55">API</span>: {apiInfo || '(none)'} {healthInfo ? `· ${healthInfo}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem('arcmailAllowRemoteApi', allowRemote ? '0' : '1');
                          const keys = [
                            'token',
                            'isAuthenticated',
                            'userRole',
                            'userName',
                            'userEmail',
                            'userId',
                            'userStatus',
                            'clientId',
                            'mailCsrf',
                            'mailSessionId',
                            'mailAccounts',
                            'activeMailAccountId',
                          ];
                          keys.forEach((k) => {
                            localStorage.removeItem(k);
                            sessionStorage.removeItem(k);
                          });
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
              </form>
            </>
          )}

          {step === 'otp' && (
            <form
              onSubmit={handleVerify2fa}
              className="fixed inset-0 z-[70] bg-[#121212] text-white flex flex-col"
            >
              <div className="px-6 pt-6 flex items-center justify-center relative">
                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setOtp('');
                    setUseBackup(false);
                    setError('');
                  }}
                  className="absolute left-6 w-10 h-10 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center text-white/60"
                  title="Back"
                  disabled={isLoading}
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
                <div className="flex items-center gap-2 text-base font-semibold text-white/80">
                  <img
                    src="https://img.icons8.com/fluency/96/google-authenticator.png"
                    alt="Google Authenticator"
                    className="w-5 h-5"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span>Two Factor Authentication</span>
                </div>
              </div>

              <div className="px-6 pt-8 flex-1">
                <div className="text-xl font-bold text-white">Code Verification</div>
                <div className="text-sm text-white/45 mt-1">
                  Enter the code from your authenticator app.
                </div>

                {!useBackup && (
                  <>
                    <input
                      value={String(otp || '').replace(/\D/g, '').slice(0, 6)}
                      onChange={(e) => setOtp(String(e.target.value || '').replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      className="absolute opacity-0 pointer-events-none w-1 h-1"
                    />

                    <div className="mt-8 flex items-center justify-center gap-3">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const clean = String(otp || '').replace(/\D/g, '').slice(0, 6);
                        const activeIndex = Math.min(clean.length, 5);
                        const ch = clean[i] || '';
                        const isActive = !isLoading && !ch && i === activeIndex;
                        return (
                          <div
                            key={i}
                            className={[
                              'w-11 h-12 rounded-xl bg-[#0F0F0F] text-white flex items-center justify-center text-lg font-semibold border',
                              isActive ? 'border-[#1DB954]' : 'border-white/10',
                            ].join(' ')}
                          >
                            {ch}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 text-xs text-white/40 text-center">
                      Refresh code in {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                    </div>
                  </>
                )}

                {useBackup && (
                  <div className="mt-6">
                    <input
                      inputMode="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full h-12 rounded-2xl bg-[#121212] border border-white/10 px-4 text-sm text-white placeholder:text-white/30"
                      placeholder="XXXX-XXXX-XXXX"
                      autoFocus
                      required
                    />
                  </div>
                )}

                <div className="mt-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackup((v) => !v);
                      setOtp('');
                    }}
                    className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {useBackup ? 'Use authenticator code' : 'Use backup code'}
                  </button>
                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (!useBackup && String(otp || '').replace(/\D/g, '').length !== 6) || (useBackup && !String(otp || '').trim())}
                  className={[
                    'mt-8 w-full h-12 rounded-full font-semibold text-sm transition-colors',
                    isLoading || (!useBackup && String(otp || '').replace(/\D/g, '').length !== 6) || (useBackup && !String(otp || '').trim())
                      ? 'bg-white/10 text-white/35'
                      : 'bg-[#1DB954] hover:bg-[#1ED760] text-black',
                  ].join(' ')}
                >
                  {isLoading ? 'Verifying…' : 'Verify'}
                </button>
              </div>

              {!useBackup && (
                <div className="px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <div className="rounded-[28px] bg-[#0F0F0F] px-7 py-7">
                    <div className="grid grid-cols-3 gap-x-10 gap-y-5 justify-items-center">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (isLoading) return;
                            const clean = String(otp || '').replace(/\D/g, '').slice(0, 6);
                            if (clean.length >= 6) return;
                            setOtp(`${clean}${n}`);
                          }}
                          className="w-14 h-14 rounded-full border border-white/15 text-white/90 text-lg font-semibold active:scale-95 transition-transform"
                        >
                          {n}
                        </button>
                      ))}
                      <div className="w-14 h-14" />
                      <button
                        type="button"
                        onClick={() => {
                          if (isLoading) return;
                          const clean = String(otp || '').replace(/\D/g, '').slice(0, 6);
                          if (clean.length >= 6) return;
                          setOtp(`${clean}0`);
                        }}
                        className="w-14 h-14 rounded-full border border-white/15 text-white/90 text-lg font-semibold active:scale-95 transition-transform"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isLoading) return;
                          const clean = String(otp || '').replace(/\D/g, '').slice(0, 6);
                          setOtp(clean.slice(0, -1));
                        }}
                        className="w-14 h-14 rounded-full border border-white/15 text-white/80 text-xl font-semibold active:scale-95 transition-transform flex items-center justify-center"
                        aria-label="Backspace"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          {step === 'setup' && (
            <form onSubmit={handleConfirmSetup} className="w-full sm:max-w-md lg:max-w-lg mx-auto">
              <div className="rounded-[28px] border border-white/10 bg-[#121212] shadow-[0_22px_70px_rgba(0,0,0,0.55)] overflow-hidden">
                <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-white">Setup authenticator app</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('login');
                      setOtp('');
                      setUseBackup(false);
                      setError('');
                    }}
                    className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    title="Close"
                    disabled={isLoading}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <QrCode size={18} className="text-white/70" />
                      </div>
                      <div className="text-base font-semibold text-white/85">Scan QR code</div>
                    </div>
                    <div className="mt-2 text-sm text-white/45 leading-relaxed">
                      Scan the QR code below or manually enter the secret key into your authenticator app.
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#0F0F0F] p-4 flex flex-col items-center gap-4">
                      <div className="w-[140px] h-[140px] rounded-2xl bg-white p-2 shrink-0 flex items-center justify-center">
                        {qrDataUrl ? <img src={qrDataUrl} alt="2FA QR" className="w-full h-full object-contain" /> : null}
                      </div>
                      <div className="w-full">
                        <div className="text-sm font-semibold text-white/80">Can’t scan? Enter code manually:</div>
                        <div className="mt-2 h-10 rounded-xl bg-[#121212] border border-white/10 px-3 flex items-center">
                          <div className="text-xs font-mono text-white/80 truncate w-full">{manualKey || ''}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!manualKey) return;
                            void navigator.clipboard?.writeText(manualKey);
                          }}
                          disabled={!manualKey}
                          className="mt-3 h-10 w-full px-4 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/8 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Copy size={16} className="text-white/70" />
                          <span className="text-sm font-semibold">Copy code</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <KeyRound size={18} className="text-white/70" />
                      </div>
                      <div className="text-base font-semibold text-white/85">Enter verification code</div>
                    </div>
                    <div className="mt-2 text-sm text-white/45">Enter the 6-digit code on your authenticator app.</div>

                    <div className="mt-4">
                      <MobileSixDigitBoxesInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                      <div className="mt-3 text-xs text-white/45 text-right">Refresh in {secondsLeft}s</div>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('login');
                        setOtp('');
                        setUseBackup(false);
                        setError('');
                      }}
                      disabled={isLoading}
                      className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/75 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 rounded-2xl bg-[#1DB954] hover:bg-[#1ED760] text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {step === 'backupCodes' && (
            <div className="pt-4">
              <div className="text-center">
                <div className="text-xl font-bold">Backup codes</div>
                <div className="text-sm text-white/45 mt-1">Save these codes somewhere safe.</div>
              </div>
              <div className="mt-6 p-4 rounded-3xl bg-[#121212] border border-white/10 text-white/80 font-mono text-sm whitespace-pre-wrap">
                {(backupCodes || []).join('\n')}
              </div>
              <button
                type="button"
                onClick={() => downloadBackupCodes(backupCodes || [], email)}
                className="mt-5 w-full h-12 rounded-2xl bg-[#121212] border border-white/10 text-white/70 font-semibold text-sm"
              >
                Download codes
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-3 w-full h-12 rounded-2xl bg-[#1DB954] hover:bg-[#1ED760] text-black font-semibold text-sm"
              >
                Continue
              </button>
            </div>
          )}
        </main>

        <AnimatePresence>
          {forgotOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
                onClick={closeForgot}
              />
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="fixed inset-0 z-[90] flex justify-center items-start px-4 pt-[10vh] pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              >
                <div className="w-full max-w-md">
                  <div className="rounded-3xl p-[1px] bg-gradient-to-b from-black/10 via-black/5 to-transparent shadow-[0_28px_90px_rgba(0,0,0,0.25)]">
                    <div className="rounded-3xl border border-white/10 bg-[#0B0B0B]/90 backdrop-blur-xl overflow-hidden">
                      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
                      <div className="px-6 pt-6 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#1DB954] flex items-center justify-center shrink-0">
                              <Lock size={16} className="text-black" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-lg font-bold tracking-tight text-white/90">Forgot password</div>
                              <div className="text-sm text-white/55 mt-0.5">Send a reset request to IT.</div>
                            </div>
                          </div>
                          <button type="button" onClick={closeForgot} className="p-2 rounded-full text-white/55 hover:text-white hover:bg-white/5 transition-colors">
                            <X size={18} />
                          </button>
                        </div>
                      </div>

                      <form onSubmit={submitForgot} className="px-6 pb-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {fpError && (
                          <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {fpError}
                          </div>
                        )}
                        {fpSubmitted ? (
                          <div className="rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 px-4 py-4 text-sm text-white/80 flex items-start gap-3">
                            <BadgeCheck size={18} className="text-[#1DB954] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="font-semibold text-white/90">Request submitted</div>
                              <div className="text-white/55 mt-0.5">You’ll be contacted shortly.</div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">Full name</label>
                              <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                  <User size={16} strokeWidth={2.2} />
                                </div>
                                <input
                                  value={fpFullName}
                                  onChange={(e) => setFpFullName(e.target.value)}
                                  className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/20 text-base"
                                  placeholder="Your full name"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">Employee / Intern ID</label>
                              <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                  <ShieldCheck size={16} strokeWidth={2.2} />
                                </div>
                                <div className="px-2.5 h-8 rounded-xl bg-[#0F0F0F] border border-white/10 text-white/80 text-sm font-bold tracking-wide flex items-center">
                                  ARC
                                </div>
                                <input
                                  value={fpEmployeeIdSuffix}
                                  onChange={(e) => setFpEmployeeIdSuffix(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                  className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/20 text-base"
                                  placeholder="12345"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">Phone number</label>
                              <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                  <Phone size={16} strokeWidth={2.2} />
                                </div>
                                <div className="px-2.5 h-8 rounded-xl bg-[#0F0F0F] border border-white/10 text-white/80 text-sm font-bold tracking-wide flex items-center">
                                  +91
                                </div>
                                <input
                                  value={fpPhone}
                                  onChange={(e) => setFpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                  className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/20 text-base"
                                  placeholder="9876543210"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={10}
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">Issued company mail ID</label>
                              <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all min-w-0 overflow-hidden">
                                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                  <Mail size={16} strokeWidth={2.2} />
                                </div>
                                <input
                                  value={fpCompanyUser}
                                  onChange={(e) => setFpCompanyUser(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64))}
                                  className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/20 text-base"
                                  placeholder="your.name"
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  required
                                />
                                <div className="px-2.5 h-8 rounded-xl bg-[#0F0F0F] border border-white/10 text-white/70 text-sm font-bold tracking-wide flex items-center">
                                  @arcbyte.co
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">Alternate phone number (optional)</label>
                              <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                  <Phone size={16} strokeWidth={2.2} />
                                </div>
                                <div className="px-2.5 h-8 rounded-xl bg-[#0F0F0F] border border-white/10 text-white/80 text-sm font-bold tracking-wide flex items-center">
                                  +91
                                </div>
                                <input
                                  value={fpAltPhone}
                                  onChange={(e) => setFpAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                  className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/20 text-base"
                                  placeholder="9876543210"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={10}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-6 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={closeForgot}
                            className="flex-1 h-12 rounded-2xl border border-white/10 bg-[#121212] text-white/75 font-semibold text-sm"
                            disabled={fpSending}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={fpSending || fpSubmitted}
                            className="flex-1 h-12 rounded-2xl bg-[#1DB954] hover:bg-[#1ED760] text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {fpSending ? 'Sending…' : 'Submit'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    ) : (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col relative overflow-hidden font-sans selection:bg-accent/30 selection:text-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#171717] via-[#0A0A0A] to-[#050505] opacity-50" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <header className="relative z-20 hidden md:flex p-6 md:p-12 justify-between items-start">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex items-center gap-3"
        >
          <img src={logo} alt="ArcByte" className="w-8 h-8 object-contain rounded-none" />
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-tight">ArcByte</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
              ArcMail for Enterprises
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="hidden md:flex items-center gap-2 text-white/30 text-xs font-mono uppercase tracking-widest"
        >
          <ShieldCheck size={12} />
          <span>Operator‑grade messaging</span>
        </motion.div>
      </header>

      <main className="flex-1 relative z-10 flex flex-col lg:flex-row items-center justify-center w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="hidden lg:block w-full lg:w-3/5 mb-16 lg:mb-0 lg:pr-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-8 text-white/40">
              <div className="w-12 h-[1px] bg-accent" />
              <span className="text-xs font-mono uppercase tracking-[0.2em]">
                Internal communications
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-[0.9] tracking-tighter text-white mb-8">
              ArcMail
              <br />
              <span className="text-white/15">For Enterprises.</span>
            </h1>

            <p className="text-lg text-white/45 max-w-xl font-light leading-relaxed">
              Sign in with your ArcMail Login Credentials to enter a focused, low-latency workspace
              for conversations that move work forward.
            </p>
          </motion.div>
        </div>

        <div className="w-full lg:w-2/5 max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full bg-[#111111]/60 backdrop-blur-sm border border-white/5 p-8 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.85)]"
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <img src={logo} alt="ArcByte" className="h-8 w-8 object-contain shrink-0" />
                <h2 className="text-2xl font-display font-bold">ArcMail Login</h2>
              </div>
              <p className="text-sm text-white/40">
                Use your ArcMail Login Credentials. Access is audited and encrypted at rest.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono flex items-center gap-2">
                <Lock size={14} />
                {error}
              </div>
            )}

            {import.meta.env.DEV && isLocal && (
              <div className="mb-6 text-[11px] font-mono text-white/35 flex items-center justify-between gap-4">
                <div className="min-w-0 truncate">
                  <span className="text-white/55">API</span>: {apiInfo || '(none)'} {healthInfo ? `· ${healthInfo}` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem('arcmailAllowRemoteApi', allowRemote ? '0' : '1');
                      const keys = [
                        'token',
                        'isAuthenticated',
                        'userRole',
                        'userName',
                        'userEmail',
                        'userId',
                        'userStatus',
                        'clientId',
                        'mailCsrf',
                        'mailSessionId',
                        'mailAccounts',
                        'activeMailAccountId',
                      ];
                      keys.forEach((k) => {
                        localStorage.removeItem(k);
                        sessionStorage.removeItem(k);
                      });
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

            {step === 'backupCodes' ? (
              <div className="space-y-6">
                <div className="text-xs font-mono uppercase tracking-widest text-white/40">Backup codes</div>
                <div className="text-sm text-white/45 leading-relaxed">
                  Save these codes in a password manager or offline. Each code works once if you lose access to Google Authenticator.
                </div>
                <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 text-white/80 font-mono text-sm whitespace-pre-wrap">
                  {(backupCodes || []).join('\n')}
                </div>
                <button
                  type="button"
                  onClick={() => downloadBackupCodes(backupCodes || [], email)}
                  className="w-full h-11 rounded-2xl border border-white/10 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Download codes
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full bg-accent hover:bg-accent/90 text-black h-12 font-semibold tracking-[0.18em] text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_18px_rgba(99,102,241,0.45)] hover:shadow-[0_0_26px_rgba(99,102,241,0.75)] disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span>CONTINUE</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
            <form onSubmit={step === 'otp' ? handleVerify2fa : step === 'setup' ? handleConfirmSetup : handleSubmit} className="space-y-8">
              <div className="space-y-6">
                {step === 'otp' ? (
                  <>
                    <div className="text-xs font-mono uppercase tracking-widest text-white/40">
                      Two-factor authentication
                    </div>
                    <div className="group">
                      <label className="block text-xs font-mono uppercase tracking-widest text-white/40 mb-2 group-focus-within:text-accent transition-colors">
                        {useBackup ? 'Backup code' : '6-digit code'}
                      </label>
                      {useBackup ? (
                        <input
                          inputMode="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full bg-[#141414] border border-white/10 px-4 py-4 text-base text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all duration-300 rounded-xl"
                          placeholder="XXXX-XXXX-XXXX"
                          autoFocus
                          required
                        />
                      ) : (
                        <SixDigitCodeInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                      )}
                      <div className="mt-3 flex items-center justify-between text-xs text-white/35">
                        <button type="button" onClick={() => { setUseBackup((v) => !v); setOtp(''); }} className="hover:text-white transition-colors">
                          {useBackup ? 'Use authenticator code' : 'Use backup code'}
                        </button>
                        {!useBackup && <span>Refresh in {secondsLeft}s</span>}
                      </div>
                    </div>
                  </>
                ) : step === 'setup' ? (
                  <>
                    <div className="text-xs font-mono uppercase tracking-widest text-white/40">
                      Set up two-factor authentication
                    </div>
                    <div className="text-sm text-white/45 leading-relaxed">
                      Install Google Authenticator from the App Store / Play Store, then open the app → tap <span className="text-white/70 font-semibold">+</span> → <span className="text-white/70 font-semibold">Scan a QR code</span>. Enter the 6‑digit code below to finish.
                    </div>
                    <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 flex items-center justify-center">
                      {qrDataUrl ? <img src={qrDataUrl} alt="2FA QR" className="w-44 h-44" /> : null}
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">Manual key</div>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(manualKey)}
                        className="w-full rounded-2xl bg-[#141414] border border-white/10 px-4 py-3 text-left font-mono text-xs break-all text-white/80 hover:border-white/15 transition-colors"
                      >
                        {manualKey}
                      </button>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-mono uppercase tracking-widest text-white/40 mb-2 group-focus-within:text-accent transition-colors">
                        6-digit code
                      </label>
                      <SixDigitCodeInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                      <div className="mt-3 flex items-center justify-end text-xs text-white/35">
                        <span>Refresh in {secondsLeft}s</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="group">
                      <label className="block text-xs font-mono uppercase tracking-widest text-white/40 mb-2 group-focus-within:text-accent transition-colors">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#141414] border border-white/5 px-4 py-4 text-base text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all duration-300 rounded-sm"
                        placeholder="name@arcbyte.co"
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-mono uppercase tracking-widest text-white/40 mb-2 group-focus-within:text-accent transition-colors">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#141414] border border-white/5 px-4 py-4 text-base text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all duration-300 rounded-sm"
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              {step === 'login' && (
              <div className="flex items-center justify-between text-xs text-white/40">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                  <span className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="block w-4 h-4 rounded border border-white/15 bg-[#141414] peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 transition-all" />
                    <Check size={12} className="absolute inset-0 m-auto text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </span>
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(true);
                    setFpError('');
                    setFpSubmitted(false);
                    setFpFullName('');
                    setFpEmployeeIdSuffix('');
                    setFpPhone('');
                    setFpCompanyUser(() => {
                      const v = String(email || '').trim();
                      const lower = v.toLowerCase();
                      if (lower.endsWith('@arcbyte.co')) return lower.replace(/@arcbyte\.co$/i, '');
                      return '';
                    });
                    setFpAltPhone('');
                  }}
                  className="text-[11px] font-semibold text-white/55 hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent hover:bg-accent/90 text-black h-12 font-semibold tracking-[0.18em] text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_18px_rgba(99,102,241,0.45)] hover:shadow-[0_0_26px_rgba(99,102,241,0.75)] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>{step === 'otp' ? 'VERIFY' : step === 'setup' ? 'VERIFY & ENABLE' : 'ENTER ARCMAIL'}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
            )}
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
        {forgotOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
              onClick={closeForgot}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed inset-0 z-[90] flex justify-center items-start px-4 pt-[10vh] pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            >
              <div className="w-full max-w-md">
                <div className="rounded-3xl p-[1px] bg-gradient-to-b from-white/12 via-white/10 to-transparent shadow-[0_28px_90px_rgba(0,0,0,0.8)]">
                  <div className="rounded-3xl border border-white/10 bg-[#0B0B0B]/90 backdrop-blur-xl overflow-hidden">
                    <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
                    <div className="px-6 pt-6 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#1DB954] flex items-center justify-center shrink-0">
                          <Lock size={16} className="text-black" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-lg font-bold tracking-tight text-white/95">Forgot password</div>
                            <div className="text-sm text-white/55 mt-0.5">Send a reset request to IT.</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={closeForgot}
                          className="p-2 rounded-full text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={submitForgot} className="px-6 pb-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {fpError && (
                    <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {fpError}
                    </div>
                  )}
                  {fpSubmitted ? (
                    <div className="rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 px-4 py-4 text-sm text-white/80 flex items-start gap-3">
                      <BadgeCheck size={18} className="text-[#1DB954] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-white/90">Request submitted</div>
                        <div className="text-white/55 mt-0.5">You’ll be contacted shortly.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">
                          Full name
                        </label>
                        <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                          <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                            <User size={16} strokeWidth={2.2} />
                          </div>
                          <input
                            value={fpFullName}
                            onChange={(e) => setFpFullName(e.target.value)}
                            className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-white/20 text-base"
                            placeholder="Your full name"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">
                          Employee / Intern ID
                        </label>
                        <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                          <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                            <ShieldCheck size={16} strokeWidth={2.2} />
                          </div>
                          <div className="px-2.5 h-8 rounded-xl bg-[#0B0B0B] border border-white/10 text-white/80 text-sm font-bold tracking-wide flex items-center">
                            ARC
                          </div>
                          <input
                            value={fpEmployeeIdSuffix}
                            onChange={(e) => setFpEmployeeIdSuffix(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-white/20 text-base"
                            placeholder="12345"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">
                          Phone number
                        </label>
                        <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                          <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                            <Phone size={16} strokeWidth={2.2} />
                          </div>
                          <div className="px-2.5 h-8 rounded-xl bg-[#151515] border border-white/10 text-white/75 text-sm font-bold tracking-wide flex items-center">
                            +91
                          </div>
                          <input
                            value={fpPhone}
                            onChange={(e) => setFpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-white/20 text-base"
                            placeholder="9876543210"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">
                          Issued company mail ID
                        </label>
                        <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all min-w-0 overflow-hidden">
                          <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                            <Mail size={16} strokeWidth={2.2} />
                          </div>
                          <input
                            value={fpCompanyUser}
                            onChange={(e) => setFpCompanyUser(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64))}
                            className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-white/20 text-base"
                            placeholder="your.name"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            required
                          />
                          <span className="shrink-0 px-2.5 h-8 rounded-xl bg-[#151515] border border-white/10 text-white/60 text-sm font-semibold flex items-center">
                            @arcbyte.co
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-white/60 mb-2">
                          Confirm phone number
                        </label>
                        <div className="group flex items-center gap-3 bg-[#111111] border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25 transition-all">
                          <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                            <Phone size={16} strokeWidth={2.2} />
                          </div>
                          <div className="px-2.5 h-8 rounded-xl bg-[#151515] border border-white/10 text-white/75 text-sm font-bold tracking-wide flex items-center">
                            +91
                          </div>
                          <input
                            value={fpAltPhone}
                            onChange={(e) => setFpAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-white/20 text-base"
                            placeholder="9876543210"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={fpSending}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black font-bold tracking-[0.14em] text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {fpSending ? <Loader2 className="animate-spin" size={18} /> : 'Submit request'}
                      </button>
                    </div>
                  )}
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    )
  );
};

export default MailLogin;
