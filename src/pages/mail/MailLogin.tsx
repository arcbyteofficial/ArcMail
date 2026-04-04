import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Lock, ArrowRight, Loader2, ShieldCheck, X, User, Phone, BadgeCheck, Mail, Check, Copy, QrCode, KeyRound, Eye, EyeOff } from 'lucide-react';
import logo from '../../assets/arcbyte.co Logo_white_transparent.png';
import orionGalaxy from '../../assets/orion_galaxy.png';
import loginImg from '../../assets/login.png';
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
  const [showComingSoon, setShowComingSoon] = useState(false);
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
  const [showPassword, setShowPassword] = useState(false);
  const [apiInfo, setApiInfo] = useState<string>('');
  const [healthInfo, setHealthInfo] = useState<string>('');
  const [showLanding, setShowLanding] = useState(true);
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
    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = isMobile ? (showLanding ? '#111111' : '#0A0A0A') : '#0B0C0A';
    return () => {
      document.body.style.backgroundColor = prevBg;
    };
  }, [isMobile, showLanding]);

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
    isMobile ? showLanding ? (
      <motion.div 
        key="landing"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
        transition={{ duration: 0.4 }}
        className="min-h-[100dvh] w-full bg-[#111111] flex flex-col font-sans overflow-hidden inset-0 fixed z-[100]"
      >
        
        {/* Top Illustration Area */}
        <motion.div 
           initial={{ y: -40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
           className="relative w-full h-[60%] flex items-end justify-center px-4 pt-12"
        >
          {/* Abstract background elements mimicking the doodles */}
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-[15%] right-[15%] w-8 h-8 rounded-full border border-[#F3D66A] border-dashed opacity-50" />
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 1 }} className="absolute top-[30%] left-[10%] w-12 h-4 rounded-full bg-white/10 blur-sm" />
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 1 }} className="absolute top-[40%] right-[10%] w-16 h-6 rounded-full bg-white/10 blur-sm" />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[50%] left-[20%] text-white text-2xl rotate-12">✧</motion.div>
          
          <motion.img
            initial={{ y: 20 }} animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            src={loginImg}
            alt="Hero Illustration"
            className="w-full h-full object-contain object-bottom scale-[1.05]"
          />
        </motion.div>

        {/* Content Section */}
        <div className="flex-1 px-8 flex flex-col justify-end pb-12 z-20 relative">
          
          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="mb-[42px] w-full text-left">
             <h2 className="text-[38px] font-medium text-white leading-[1.1] tracking-tight">
               <span className="relative inline-block">
                  Organize Smarter.
                  {/* Yellow arc underline */}
                  <motion.svg initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.8, ease: "easeInOut" }} className="absolute -bottom-2 left-0 w-[110%] h-[12px] transform -rotate-1" viewBox="0 0 100 20" preserveAspectRatio="none">
                     <motion.path d="M 0 15 Q 50 0 100 10" fill="transparent" stroke="#F3D66A" strokeWidth="4" strokeLinecap="round" />
                  </motion.svg>
               </span>
               <br />
               Work Faster
             </h2>
          </motion.div>

          {/* Buttons */}
          <div className="flex flex-col gap-[18px] w-full relative z-30">
            <motion.button 
               whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
               className="w-full h-[64px] rounded-[32px] bg-[#1DB954] active:scale-[0.98] transition-colors flex items-center justify-center gap-3 text-black font-bold text-[17px] shadow-[0_8px_30px_rgba(29,185,84,0.3)]"
               onClick={() => {
                   setShowComingSoon(true);
                   setTimeout(() => setShowComingSoon(false), 2000);
               }}
            >
              <img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-6 h-6 brightness-0" />
              Continue with Google
            </motion.button>

            <motion.button 
               whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
               className="w-full h-[64px] rounded-[32px] bg-[#000000] active:scale-[0.98] transition-colors flex items-center justify-center gap-3 text-white font-medium text-[17px] border border-white/5 shadow-lg"
               onClick={() => setShowLanding(false)}
            >
              <img src={logo} alt="ArcMail" className="w-5 h-5 object-contain brightness-0 invert" />
              Continue with ArcMail
            </motion.button>
          </div>
          
          <AnimatePresence>
            {showComingSoon && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: -45, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-[170px] bg-white text-black px-4 py-1.5 rounded-full font-bold text-[12px] shadow-[0_8px_25px_rgba(255,255,255,0.2)] z-[40] whitespace-nowrap"
              >
                Coming soon!
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    ) : (
      <motion.div 
        key="auth-form"
        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-[100dvh] bg-[#0A0A0A] text-white flex flex-col font-sans relative"
      >
        
        {/* Top Header Section */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="pt-14 px-6 pb-28 flex-shrink-0">
          <button 
            type="button" 
            onClick={() => {
              if (step !== 'login') {
                setStep('login');
                setOtp('');
                setError('');
                setUseBackup(false);
              } else if (isMobile) {
                setShowLanding(true);
              } else {
                navigate(-1);
              }
            }} 
            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-8 hover:bg-white/5 active:scale-95 transition-all"
          >
             <ArrowRight size={18} className="rotate-180 text-white shadow-sm" />
          </button>
          
          <motion.h1 initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }} className="text-[28px] font-bold leading-tight tracking-tight text-white mb-2">
            Go ahead and set up<br/>your account
          </motion.h1>
          <motion.p initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }} className="text-[13px] text-white/50">
            Sign in-up to enjoy the best managing experience
          </motion.p>
        </motion.div>

        {/* White Form Card Sheet */}
        <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="flex-1 bg-white rounded-t-[36px] w-full mt-[-60px] px-6 pt-8 pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col relative z-20">
          
          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-50 text-[13px] text-red-600 px-4 py-3 text-center font-medium">
              {error}
            </div>
          )}

          {step === 'otp' || step === 'setup' ? (
            <div className="flex flex-col items-center pt-4">
              <div className="w-16 h-16 rounded-full bg-[#ECF3ED] flex items-center justify-center mb-6">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                  <Check size={16} strokeWidth={4} />
                </div>
              </div>
              
              <h2 className="text-[22px] font-bold text-black mb-2">
                Verify your account
              </h2>
              <p className="text-[13px] text-center text-gray-500 mb-8 max-w-[280px]">
                Enter the {useBackup ? 'backup' : '5 digits verification'} code we have sent you
              </p>

              <form onSubmit={step === 'otp' ? handleVerify2fa : handleConfirmSetup} className="w-full">
                {useBackup ? (
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full h-14 bg-[#F7F7F7] border border-gray-200 rounded-[16px] px-4 text-center tracking-widest text-black font-bold outline-none focus:border-black"
                    placeholder="XXXX-XXXX-XXXX"
                    autoFocus
                  />
                ) : (
                  <div className="flex justify-center mb-4 w-full text-black">
                     <SixDigitCodeInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                  </div>
                )}
                
                {step === 'otp' && (
                  <button type="button" onClick={() => { setUseBackup(!useBackup); setOtp(''); }} className="w-full text-center text-[12px] text-black font-bold mt-2 mb-6 hover:underline">
                    {useBackup ? 'Use authenticator code' : 'Use backup code instead'}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-full bg-[#202020] hover:bg-[#111111] transition-all text-white font-bold text-[14px] mt-4 flex justify-center items-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] shadow-black/30"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Verify Account'}
                </button>
              </form>
            </div>
          ) : step === 'backupCodes' ? (
             <div className="flex flex-col pt-4 w-full text-black">
                <div className="w-16 h-16 rounded-full bg-[#ECF3ED] flex items-center justify-center mb-6 self-center">
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                    <Check size={16} strokeWidth={4} />
                  </div>
                </div>
                <h2 className="text-[22px] font-bold mb-2">Backup Codes</h2>
                <p className="text-[13px] text-gray-500 mb-6">Save these offline. You will only see these once.</p>
                <div className="bg-[#F7F7F7] border border-gray-200 rounded-[16px] p-6 text-center font-mono text-sm leading-8 text-black mb-6 whitespace-pre-wrap">
                  {(backupCodes || []).join('\n')}
                </div>
                <button
                  type="button"
                  onClick={() => downloadBackupCodes(backupCodes || [], email)}
                  className="w-full h-14 rounded-full border border-gray-300 text-gray-700 font-bold text-[14px] mb-3 hover:bg-gray-50 transition-all font-sans"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full h-14 rounded-full bg-[#202020] hover:bg-[#111111] text-white font-bold text-[14px] transition-all"
                >
                  Complete Setup
                </button>
             </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Form container */}
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                
                {/* Visual Segments */}
                <div className="w-full h-12 bg-[#F7F7F7] rounded-full p-1 flex items-center mb-6">
                  <div className="w-1/2 h-full bg-white rounded-full flex justify-center items-center text-[13px] font-bold text-black shadow-sm">
                    Login
                  </div>
                  <button type="button" className="w-1/2 h-full rounded-full flex justify-center items-center text-[13px] font-semibold text-gray-400 active:scale-95 transition-transform" onClick={(e) => { e.preventDefault(); }}>
                    Register
                  </button>
                </div>

                {/* Email Field */}
                <div className="w-full h-[64px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex items-center px-4 bg-white relative">
                  <Mail size={18} className="text-black shrink-0" />
                  <div className="ml-3 flex-1 h-full flex flex-col justify-center">
                    <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Email Address</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none placeholder:text-gray-400 placeholder:font-normal autofill-light"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="w-full h-[64px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex items-center px-4 bg-white relative">
                  <Lock size={18} className="text-black shrink-0" />
                  <div className="ml-3 flex-1 h-full flex flex-col justify-center">
                    <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Password</label>
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent text-[14px] font-bold text-black border-none outline-none placeholder:tracking-widest placeholder:text-gray-400 autofill-light"
                      placeholder="•••••••••"
                      required
                    />
                  </div>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 -mr-2 text-gray-400 hover:text-black transition-colors focus:outline-none" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                  </button>
                </div>

                <div className="flex items-center justify-between px-1 mt-3 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-black">
                     <span className="relative">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="peer sr-only" />
                        <span className="block w-4 h-4 rounded-[4px] border border-gray-300 bg-white peer-checked:bg-black peer-checked:border-black transition-all" />
                        <Check size={12} strokeWidth={3} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </span>
                      Remember me
                  </label>
                  <button type="button" onClick={() => setForgotOpen(true)} className="text-[12px] font-bold text-black hover:text-[#333333] transition-colors">
                     Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] rounded-full bg-[#202020] hover:bg-[#111111] transition-colors text-white font-bold text-[14px] flex justify-center items-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] shadow-black/30"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Login'}
                </button>
                
                <div className="flex items-center justify-center my-6">
                  <div className="h-[1px] flex-1 bg-gray-100"></div>
                  <span className="px-3 text-[11px] font-bold text-black">Or login with</span>
                  <div className="h-[1px] flex-1 bg-gray-100"></div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                   <button type="button" className="h-[52px] rounded-full border border-gray-200 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 active:scale-95 transition-all text-[13px] font-bold text-black">
                      <img src="https://img.icons8.com/color/48/google-logo.png" className="w-[18px] h-[18px]" alt="Google" />
                      Google
                   </button>
                   <button type="button" className="h-[52px] rounded-full border border-gray-200 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 active:scale-95 transition-all text-[13px] font-bold text-black">
                      <img src="https://img.icons8.com/ios-filled/50/000000/github.png" className="w-[18px] h-[18px]" alt="GitHub" />
                      GitHub
                   </button>
                </div>

              </form>
            </div>
          )}

          {/* Forgot password nested view over the white sheet */}
          <AnimatePresence>
            {forgotOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-x-0 bottom-0 top-0 bg-white z-[60] rounded-t-[36px] overflow-auto px-6 py-8"
              >
                 <div className="flex justify-between items-center mb-6 text-black">
                   <h2 className="text-[22px] font-bold">Resync Access</h2>
                   <button onClick={() => setForgotOpen(false)} className="text-black font-bold text-xs p-2 uppercase tracking-widest"><ArrowRight size={18} className="rotate-180"/></button>
                 </div>
                 
                 {fpError && (
                   <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-[13px] text-red-600 px-4 py-3 text-center font-medium">
                     {fpError}
                   </div>
                 )}

                 {fpSubmitted ? (
                   <div className="text-center pt-10 text-black">
                     <div className="w-16 h-16 mx-auto rounded-full bg-[#ECF3ED] flex items-center justify-center mb-4">
                        <Check size={24} strokeWidth={3} className="text-black" />
                     </div>
                     <p className="font-bold text-[18px] mb-2">Request Made</p>
                     <p className="text-sm text-gray-500">Our team will be in touch shortly via alternative channels.</p>
                   </div>
                 ) : (
                    <form onSubmit={submitForgot} className="space-y-4 text-black pb-10">
                       <div className="w-full h-[60px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex flex-col justify-center px-4 bg-white">
                         <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Full Name</label>
                         <input value={fpFullName} onChange={(e) => setFpFullName(e.target.value)} required placeholder="John Doe" className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none" />
                       </div>
                       <div className="w-full h-[60px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex flex-col justify-center px-4 bg-white">
                         <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Employee ID</label>
                         <input value={fpEmployeeIdSuffix} onChange={(e) => setFpEmployeeIdSuffix(e.target.value)} required placeholder="Eg. 00871" className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none" />
                       </div>
                       <div className="w-full h-[60px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex flex-col justify-center px-4 bg-white">
                         <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Primary Phone</label>
                         <input value={fpPhone} onChange={(e) => setFpPhone(e.target.value)} required placeholder="9876543210" className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none" />
                       </div>
                       <div className="w-full h-[60px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex flex-col justify-center px-4 bg-white">
                         <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">ArcMail Domain</label>
                         <input value={fpCompanyUser} onChange={(e) => setFpCompanyUser(e.target.value)} required placeholder="john.doe" className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none" />
                       </div>
                       <div className="w-full h-[60px] rounded-[16px] border border-gray-200 focus-within:border-black transition-colors flex flex-col justify-center px-4 bg-white">
                         <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Alternate Phone</label>
                         <input value={fpAltPhone} onChange={(e) => setFpAltPhone(e.target.value)} required placeholder="9876543210" className="w-full bg-transparent text-[13px] font-bold text-black border-none outline-none" />
                       </div>
                       
                       <button type="submit" disabled={fpSending} className="w-full h-[52px] rounded-full bg-[#202020] text-white font-bold text-[14px] mt-6 flex justify-center items-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] shadow-black/30">
                         {fpSending ? <Loader2 size={18} className="animate-spin" /> : 'Request Reset'}
                       </button>
                    </form>
                 )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    ) : (
    <div className="min-h-screen bg-[#0B0C0A] text-white font-sans flex relative overflow-hidden selection:bg-[#90AC8F]/30 selection:text-white">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] hidden lg:block" 
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* LEFT PANEL - FORM */}
      <div className="flex-1 lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-[12%] relative z-10 overflow-y-auto">
        <div className="max-w-md w-full mx-auto lg:mx-0 py-12">
          
          <div className="flex items-center gap-3 mb-16 opacity-90 transition-opacity hover:opacity-100">
            <img src={logo} alt="ArcByte" className="w-5 h-5 object-contain filter brightness-0 invert opacity-80" />
            <span className="font-semibold text-sm tracking-widest text-white/90">ArcMail</span>
          </div>

          <h1 className="text-3xl sm:text-[40px] font-medium leading-[1.1] tracking-tight mb-[60px] text-white/95">
            We're watching the darkness so you don't have to
          </h1>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200 flex items-center gap-2">
              <Lock size={14} /> {error}
            </div>
          )}

          {step === 'backupCodes' ? (
            <div className="space-y-6">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Backup codes</div>
              <div className="text-[13px] text-white/50 leading-relaxed font-medium">
                Save these codes offline. Each code works once if you lose access to your authenticator.
              </div>
              <div className="p-5 rounded-2xl bg-[#131513] border border-white/5 text-white/80 font-mono text-sm whitespace-pre-wrap leading-[1.8]">
                {(backupCodes || []).join('\n')}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadBackupCodes(backupCodes || [], email)}
                  className="h-[52px] rounded-[16px] border border-white/10 text-[12px] font-semibold tracking-wide text-white/70 hover:bg-white/5 transition-all"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="h-[52px] rounded-[16px] bg-[#90AC8F] hover:bg-[#A1BEA0] text-black font-semibold text-[13px] transition-all shadow-[0_0_20px_rgba(144,172,143,0.15)] flex items-center justify-center gap-2 group"
                >
                  <span>Continue</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={step === 'otp' ? handleVerify2fa : step === 'setup' ? handleConfirmSetup : handleSubmit} className="space-y-[22px]">
              {step === 'otp' ? (
                <>
                  <div className="group">
                    <label className="block text-[11px] font-semibold tracking-wide text-white/40 mb-2 group-focus-within:text-[#90AC8F] transition-colors">
                      {useBackup ? 'Backup code' : '6-digit code'}
                    </label>
                    {useBackup ? (
                      <input
                        inputMode="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full h-[52px] bg-[#131513] border border-transparent rounded-[16px] px-4 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#90AC8F]/50 focus:bg-[#1A1C1A] transition-all font-medium tracking-widest text-center"
                        placeholder="XXXX-XXXX-XXXX"
                        autoFocus
                        required
                      />
                    ) : (
                      <SixDigitCodeInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                    )}
                    <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-white/40">
                      <button type="button" onClick={() => { setUseBackup((v) => !v); setOtp(''); }} className="hover:text-white transition-colors">
                        {useBackup ? 'Use authenticator code' : 'Use backup code'}
                      </button>
                      {!useBackup && <span>Refresh in {secondsLeft}s</span>}
                    </div>
                  </div>
                </>
              ) : step === 'setup' ? (
                <>
                  <div className="text-[13px] text-white/50 leading-relaxed font-medium mb-2">
                    Install an Authenticator. Scan the QR code below. Enter the 6‑digit code to finish.
                  </div>
                  <div className="rounded-2xl bg-[#131513] p-6 flex flex-col items-center justify-center gap-4">
                    <div className="bg-white p-2 rounded-xl">
                      {qrDataUrl ? <img src={qrDataUrl} alt="2FA QR" className="w-32 h-32" /> : null}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wide text-white/40 mb-2">Manual key</label>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(manualKey)}
                      className="w-full h-11 rounded-[12px] bg-[#131513] px-4 text-left font-mono text-[11px] tracking-widest text-white/70 hover:bg-[#1A1C1A] transition-colors"
                    >
                      {manualKey}
                    </button>
                  </div>
                  <div className="group">
                    <label className="block text-[11px] font-semibold tracking-wide text-white/40 mb-2 group-focus-within:text-[#90AC8F] transition-colors">
                      Verification code
                    </label>
                    <SixDigitCodeInput value={otp} onChange={setOtp} disabled={isLoading} autoFocus />
                  </div>
                </>
              ) : (
                <>
                  <div className="group">
                    <label className="block text-[11px] font-semibold tracking-wide text-white/50 mb-2 group-focus-within:text-[#90AC8F] transition-colors">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-[54px] bg-[#171917]/80 rounded-[12px] px-4 text-[13px] text-white placeholder-white/20 focus:outline-none focus:bg-[#1C1F1C] border border-transparent focus:border-[#526351]/50 transition-all font-medium mail-login-autofill"
                      placeholder="Your email"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="group">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-semibold tracking-wide text-white/50 group-focus-within:text-[#90AC8F] transition-colors">
                        Password
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
                        className="text-[10px] font-semibold tracking-wide text-white/30 hover:text-[#90AC8F] transition-colors uppercase"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-[54px] bg-[#171917]/80 rounded-[12px] px-4 pr-12 text-[13px] text-white placeholder-white/20 focus:outline-none focus:bg-[#1C1F1C] border border-transparent focus:border-[#526351]/50 transition-all font-medium tracking-widest mail-login-autofill"
                        placeholder="••••••••••"
                        autoComplete="current-password"
                        required
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors focus:outline-none"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    </div>

                    <div className="flex items-center justify-start mt-[-2px]">
                      <label className="flex items-center gap-3 cursor-pointer group text-[10.5px] font-bold text-[#72859B] hover:text-[#899DB3] transition-colors uppercase tracking-[0.08em]">
                        <span className="relative">
                          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="peer sr-only" />
                          <span className="block w-[15px] h-[15px] rounded-[5px] border border-white/10 bg-transparent peer-checked:bg-[#90AC8F] peer-checked:border-[#90AC8F] transition-all group-hover:border-white/20" />
                          <Check size={10} strokeWidth={3} className="absolute inset-0 m-auto text-[#0B0C0A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                        </span>
                        Remember me
                      </label>
                    </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[54px] rounded-[12px] bg-[#AEC9AD] hover:bg-[#C2DDBE] text-[#1A2518] font-bold tracking-wide text-[13px] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : step === 'otp' ? 'Verify' : step === 'setup' ? 'Verify & Enable' : 'Continue with email'}
              </button>

            </form>
          )}

          {import.meta.env.DEV && isLocal && (
            <div className="mt-14 pt-8 border-t border-white/5 text-[10px] font-mono text-white/30 flex flex-col items-center gap-2 text-center opacity-50 hover:opacity-100 transition-opacity">
              <div className="min-w-0 w-full truncate">
                <span className="text-white/50">API:</span> {apiInfo || '(none)'} {healthInfo ? `· ${healthInfo}` : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('arcmailAllowRemoteApi', allowRemote ? '0' : '1');
                  } catch { void 0; }
                  window.location.reload();
                }}
                className="hover:text-white transition-colors"
              >
                {allowRemote ? 'Use local API' : 'Use prod API'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - DOME GRAPHIC */}
      <div className="hidden lg:flex w-1/2 items-center justify-end p-10 relative z-10 pointer-events-none">
        
        {/* Dome Container mapped exactly to right edge */}
        <div className="w-[88%] max-w-[700px] h-full max-h-[90vh] relative">
          
          {/* Main Visual Mask */}
          <div className="absolute inset-0 rounded-t-full overflow-hidden bg-black/40 border-t border-l border-r border-[#2C362B] shadow-[0_0_120px_rgba(0,0,0,0.8)]">
             <img src={orionGalaxy} alt="Galaxy observation" className="w-full h-full object-cover object-[center_35%] mix-blend-screen opacity-90 scale-105" />
             
             {/* Gradient fade at the bottom connecting it to the ground */}
             <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0B0C0A] via-[#0B0C0A]/80 to-transparent" />
          </div>

          {/* Overlay Lines (Outer Frame) */}
          <div className="absolute inset-x-0 top-[60%] h-[1px] bg-white/[0.2]" />
          <div className="absolute inset-y-0 left-[38%] w-[1px] bg-white/[0.2]" />
          
          {/* Outer dotted arch paths */}
          <svg className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M -10,120 Q 38,-30 110,30" fill="none" stroke="white" strokeWidth="0.15" strokeDasharray="1 2"/>
             <path d="M 50,110 C 38,40 10,20 110,60" fill="none" stroke="white" strokeWidth="0.1" strokeDasharray="0.5 1"/>
          </svg>

          {/* Crosshair Center Reticle */}
          <div className="absolute left-[38%] top-[60%] -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/[0.3] backdrop-blur-[2px] bg-white/[0.02]" />
          
          {/* Telemetry text */}
          <div className="absolute left-[38%] top-[60%] translate-x-4 translate-y-3 font-mono text-[9px] text-[#AEC9AD]/70 tracking-widest leading-relaxed">
            satellite::tng3rzgx102<br/>
            status:    200%<br/>
            group:     -13
          </div>

        </div>
      </div>

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
