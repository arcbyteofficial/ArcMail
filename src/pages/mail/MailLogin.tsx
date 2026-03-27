import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Lock, ArrowRight, Loader2, ShieldCheck, X, User, Phone, BadgeCheck, Mail } from 'lucide-react';
import logo from '../../assets/arcbyte.co Logo_white_transparent.png';

const MailLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpSubmitted, setFpSubmitted] = useState(false);
  const [fpFullName, setFpFullName] = useState('');
  const [fpEmployeeIdSuffix, setFpEmployeeIdSuffix] = useState('');
  const [fpPhone, setFpPhone] = useState('');
  const [fpCompanyUser, setFpCompanyUser] = useState('');
  const [fpAltPhone, setFpAltPhone] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSending, setFpSending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(password, email, rememberMe);
      if (result.ok) {
        navigate('/');
      } else {
        setError(result.error || 'Sign in failed. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
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

      <header className="relative z-20 p-6 md:p-12 flex justify-between items-start">
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
              ArcMail for Operators
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
              <span className="text-white/15">For Operators.</span>
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
            className="w-full bg-[#111111]/60 backdrop-blur-sm border border-white/5 p-8 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.85)] rounded-2xl"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-display font-bold mb-2">ArcMail Login</h2>
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

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
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
              </div>

              <div className="flex items-center justify-between text-xs text-white/40">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="appearance-none w-4 h-4 rounded border border-white/15 bg-[#141414] checked:bg-accent checked:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                  />
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent hover:bg-accent/90 text-black h-12 font-semibold tracking-[0.18em] text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_18px_rgba(99,102,241,0.45)] hover:shadow-[0_0_26px_rgba(99,102,241,0.75)] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>ENTER ARCMAIL</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </main>

      <footer className="relative z-20 md:hidden px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6">
        <div className="w-full max-w-md mx-auto">
          <div className="relative">
            <div className="absolute -inset-4 bg-[#1DB954]/12 blur-3xl rounded-full" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0B0B0B]/75 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.65)] overflow-hidden">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/80 to-transparent" />
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1DB954]/12 border border-[#1DB954]/25 flex items-center justify-center shrink-0">
                    <img src={logo} alt="ArcMail" className="w-5 h-5 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold tracking-tight text-white/90">ArcMail</div>
                    <div className="text-[12px] font-medium tracking-tight text-white/60 truncate mt-0.5">
                      Operator‑grade messaging
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="px-3 h-7 rounded-full bg-[#121212] border border-[#1F1F1F] text-[11px] font-semibold text-white/70 flex items-center">
                    Powered by ArcByte Co
                  </span>
                </div>
              </div>
              <div className="px-5 pb-4 flex items-center justify-between text-[11px] font-medium text-white/45">
                <div className="flex items-center gap-2">
                  <Lock size={10} />
                  <span>Secure sign‑in</span>
                </div>
                <span>&copy; {new Date().getFullYear()} ArcByte Co</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

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
  );
};

export default MailLogin;
