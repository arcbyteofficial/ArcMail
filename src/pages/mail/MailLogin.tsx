import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, ArrowRight, Loader2, ShieldCheck, Mail } from 'lucide-react';
import logo from '../../assets/arcbyte.co Logo_white_transparent.png';

const MailLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(password, email);
      if (success) {
        navigate('/mail');
      } else {
        setError('Invalid mailbox credentials.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
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

      <header className="relative z-20 p-8 md:p-12 flex justify-between items-start">
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
              Internal Mail
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
        <div className="w-full lg:w-3/5 mb-16 lg:mb-0 lg:pr-24">
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
              Mail
              <br />
              <span className="text-white/15">for operators.</span>
            </h1>

            <p className="text-lg text-white/45 max-w-xl font-light leading-relaxed">
              Sign in with your ArcByte mailbox to enter a focused, low-latency workspace for
              conversations that move work forward.
            </p>
          </motion.div>
        </div>

        <div className="w-full lg:w-2/5 max-w-md">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#111111]/60 backdrop-blur-sm border border-white/5 p-8 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.85)]"
          >
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 mb-4">
                <Mail size={12} className="text-accent" />
                <span>ArcByte Mail</span>
              </div>
              <h2 className="text-2xl font-display font-bold mb-2">Authenticate mailbox</h2>
              <p className="text-sm text-white/40">
                Use your Hostinger mailbox credentials. Access is audited and encrypted at rest.
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
                    Mailbox
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

              <div className="flex items-center justify-end text-xs text-white/40">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
                  Internal use only
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent hover:bg-accent/90 text-white h-12 font-semibold tracking-[0.18em] text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_18px_rgba(99,102,241,0.45)] hover:shadow-[0_0_26px_rgba(99,102,241,0.75)] disabled:opacity-50 disabled:cursor-not-allowed group"
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

      <footer className="relative z-20 p-8 md:p-12 flex justify-between items-end text-[10px] uppercase tracking-widest text-white/25 font-mono">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Lock size={10} />
            <span>Encrypted server‑side authentication</span>
          </div>
          <span>Sessions monitored for anomalous activity</span>
        </div>
        <div>&copy; {new Date().getFullYear()} ArcByte Inc.</div>
      </footer>
    </div>
  );
};

export default MailLogin;
