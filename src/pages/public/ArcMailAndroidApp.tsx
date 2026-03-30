import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Check, Globe, Lock, Mail, Moon, Shield, Sun, Users, Zap } from 'lucide-react';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
import arcMailPreview from '../../assets/arcmail.png';
import heroImg1 from '../../assets/1.jpeg';
import heroImg2 from '../../assets/2.jpeg';
import heroImg3 from '../../assets/3.jpeg';

type ThemeMode = 'dark' | 'light';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const ANDROID_ICON_URL =
  'https://img.icons8.com/external-tal-revivo-shadow-tal-revivo/96/external-android-operating-system-bot-isolated-on-a-white-background-development-shadow-tal-revivo.png';
const ANDROID_ICON_ALT = 'external-android-operating-system-bot-isolated-on-a-white-background-development-shadow-tal-revivo';

const getAndroidDownloadUrl = () => {
  const v = String(import.meta.env.VITE_ARCMAIL_ANDROID_APP_URL || import.meta.env.VITE_ARCMAIL_ANDROID_APK_URL || '').trim();
  return v || '';
};

const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-[1280px] mx-auto w-full px-5 sm:px-8">{children}</div>
);

const Section = ({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => (
  <section id={id} className={className}>
    <Container>{children}</Container>
  </section>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#B8FF2C] text-black text-[11px] font-semibold tracking-wide">
    {children}
  </div>
);

const PhoneMock = ({
  tint = 'green',
  className = '',
  float = false,
  src,
}: {
  tint?: 'green' | 'dark';
  className?: string;
  float?: boolean;
  src?: string;
}) => {
  const overlay =
    tint === 'green'
      ? 'bg-[#B8FF2C]/85 mix-blend-multiply'
      : 'bg-black/25 mix-blend-multiply';
  const applyOverlay = !src;

  const inner = (
    <div className={['relative rounded-[34px] bg-black shadow-[0_40px_120px_rgba(0,0,0,0.35)]', className].join(' ')}>
      <div className="absolute inset-0 rounded-[34px] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      <div className="relative p-[10px]">
        <div className="rounded-[26px] overflow-hidden bg-black">
          <div className="relative">
            <img src={src || arcMailPreview} alt="ArcMail preview" className="w-full h-auto block opacity-95" />
            {applyOverlay ? <div className={['absolute inset-0', overlay].join(' ')} /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </div>
        </div>
        <div className="absolute left-1/2 top-[14px] -translate-x-1/2 h-6 w-24 rounded-full bg-black/90 border border-white/10" />
      </div>
    </div>
  );

  if (!float) return inner;

  return (
    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}>
      {inner}
    </motion.div>
  );
};

const HandSilhouette = () => (
  <svg viewBox="0 0 520 520" className="w-full h-auto" aria-hidden="true">
    <path
      fill="currentColor"
      d="M172 482c-20 0-36-16-36-36V290c0-18 13-33 30-36l66-12V122c0-20 16-36 36-36s36 16 36 36v98l10-2V92c0-20 16-36 36-36s36 16 36 36v114l10-2V112c0-20 16-36 36-36s36 16 36 36v118l9-2c22-5 44 9 49 31 5 22-9 44-31 49l-70 16v124c0 20-16 36-36 36H172z"
    />
  </svg>
);

const FloatingDownloadNow = ({ downloadUrl, disabled, mode }: { downloadUrl: string; disabled: boolean; mode: ThemeMode }) => (
  <motion.div
    className="fixed left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50"
    animate={{ y: [0, -6, 0] }}
    transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
    style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
  >
    <motion.a
      href={disabled ? undefined : downloadUrl}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={[
        'h-12 px-5 rounded-full inline-flex items-center gap-3 text-[13px] font-semibold border backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.18)]',
        disabled
          ? mode === 'dark'
            ? 'bg-black/50 border-white/10 text-white/35 cursor-not-allowed'
            : 'bg-white/70 border-black/10 text-black/35 cursor-not-allowed'
          : mode === 'dark'
            ? 'bg-black/60 border-white/15 text-white hover:bg-black/70'
            : 'bg-white/85 border-black/15 text-black hover:bg-white',
      ].join(' ')}
    >
      <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
      Download now
      <ArrowRight size={16} className={mode === 'dark' ? 'text-white/70' : 'text-black/70'} />
    </motion.a>
  </motion.div>
);

export default function ArcMailAndroidApp() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const v = String(localStorage.getItem('arcmail_app_theme') || '').trim();
      return v === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const downloadUrl = getAndroidDownloadUrl();
  const downloadDisabled = !downloadUrl;
  const isDark = mode === 'dark';

  useEffect(() => {
    try {
      localStorage.setItem('arcmail_app_theme', mode);
    } catch {
      return;
    }
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ArcMail App';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

  const heroMotion = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, staggerChildren: 0.08 } },
  };

  const heroItem = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <div
      className={cx(
        'min-h-screen transition-colors duration-300 overflow-x-hidden',
        isDark ? 'bg-[#050505] text-white' : 'bg-[#DCE4EA] text-black',
      )}
    >
      <div
        className={cx('fixed inset-0 pointer-events-none', isDark ? 'opacity-[0.12]' : 'opacity-[0.06]')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27400%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E\")",
          backgroundSize: '420px 420px',
        }}
      />

      <FloatingDownloadNow downloadUrl={downloadUrl} disabled={downloadDisabled} mode={mode} />

      <div className="relative py-10">
        <div className="w-full px-4 sm:px-0 sm:w-[92%] md:w-[86%] lg:w-[70%] mx-auto">
          <div
            className={cx(
              'w-full rounded-[34px] border shadow-[0_30px_90px_rgba(0,0,0,0.10)] overflow-hidden transition-colors duration-300',
              isDark ? 'bg-[#0B0B0B] border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.55)]' : 'bg-white border-black/10',
            )}
          >
            <motion.div
              className="px-6 sm:px-10 py-5 flex items-center justify-between gap-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    'h-10 w-10 rounded-2xl border flex items-center justify-center',
                    isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white',
                  )}
                >
                  <img src={arcByteLogo} alt="ArcByte" className="h-6 w-6 object-contain" />
                </div>
                <div className="text-sm font-semibold tracking-tight">ArcMail</div>
              </div>

              <div className={cx('hidden md:flex items-center gap-6 text-[12px]', isDark ? 'text-white/65' : 'text-black/60')}>
                <a href="#how" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  How it works
                </a>
                <a href="#features" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Features
                </a>
                <a href="#security" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Security
                </a>
                <a href="#admin" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Admin
                </a>
                <a href="#teams" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Teams
                </a>
                <a href="#trust" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Trust
                </a>
                <a href="#faq" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  FAQ
                </a>
                <a href="/login" className={cx('transition-colors', isDark ? 'hover:text-white' : 'hover:text-black')}>
                  Open Web
                </a>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode(isDark ? 'light' : 'dark')}
                  className={cx(
                    'h-10 w-10 rounded-full border inline-flex items-center justify-center transition-colors',
                    isDark ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-black/15 bg-white hover:bg-black/5',
                  )}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={isDark ? 'Light mode' : 'Dark mode'}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDark ? (
                      <motion.span
                        key="sun"
                        initial={{ opacity: 0, rotate: -25, scale: 0.85 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 25, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Sun size={16} className="text-white/80" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="moon"
                        initial={{ opacity: 0, rotate: 25, scale: 0.85 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: -25, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Moon size={16} className="text-black/70" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <a
                  href={downloadDisabled ? undefined : downloadUrl}
                  onClick={(e) => {
                    if (downloadDisabled) e.preventDefault();
                  }}
                  className={[
                    'h-10 px-4 rounded-full border text-[12px] font-medium inline-flex items-center gap-2 transition-colors',
                    downloadDisabled
                      ? isDark
                        ? 'border-white/10 text-white/30 cursor-not-allowed'
                        : 'border-black/10 text-black/30 cursor-not-allowed'
                      : isDark
                        ? 'border-white/15 text-white hover:bg-white/10'
                        : 'border-black/20 text-black hover:bg-black/5',
                  ].join(' ')}
                >
                  <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span> <span>APK</span>
                </a>
              </div>
            </motion.div>

            <div className="px-6 sm:px-10 pb-10 pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7">
                  <motion.div variants={heroMotion} initial="hidden" animate="show">
                    <motion.div variants={heroItem} className="text-[clamp(52px,7vw,90px)] font-extrabold tracking-tight leading-[0.95]">
                      Enterprise email
                      <br />
                      made simple
                    </motion.div>

                    <motion.div variants={heroItem} className="mt-7">
                      <div className={cx('text-[15px] leading-[1.85] max-w-[66ch]', isDark ? 'text-white/70' : 'text-black/70')}>
                        ArcMail is a premium inbox for teams: fast navigation, clean threading, and a compose experience designed to disappear. Built
                        for shared inboxes and enterprise environments where clarity matters.
                      </div>

                      <div
                        className={cx(
                          'mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 pt-6 border-t',
                          isDark ? 'border-white/10' : 'border-black/10',
                        )}
                      >
                        {[
                          'Clean conversation threading',
                          'Fast search + shortcuts',
                          'Admin: access + block login',
                          'Activity view for accountability',
                        ].map((t) => (
                          <motion.div
                            key={t}
                            variants={heroItem}
                            className={cx('flex items-start gap-3 text-[13px] leading-relaxed', isDark ? 'text-white/65' : 'text-black/65')}
                          >
                            <div
                              className="h-6 w-6 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[1px]"
                            >
                              <Check size={14} className="text-black" />
                            </div>
                            <div className="min-w-0">{t}</div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={heroItem} className="mt-7 flex flex-wrap items-center gap-3">
                      <motion.a
                        href={downloadDisabled ? undefined : downloadUrl}
                        onClick={(e) => {
                          if (downloadDisabled) e.preventDefault();
                        }}
                        whileHover={downloadDisabled ? undefined : { y: -1 }}
                        whileTap={downloadDisabled ? undefined : { scale: 0.98 }}
                        className={[
                          'h-11 px-4 sm:px-6 rounded-full inline-flex items-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap flex-none',
                          downloadDisabled
                            ? isDark
                              ? 'bg-white/10 text-white/30 cursor-not-allowed'
                              : 'bg-black/10 text-black/30 cursor-not-allowed'
                            : isDark
                              ? 'bg-white text-black hover:opacity-90'
                              : 'bg-black text-white hover:opacity-95',
                        ].join(' ')}
                      >
                        <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
                        Download APK
                      </motion.a>
                      <motion.a
                        href="/login"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className={cx(
                          'h-11 px-4 sm:px-6 rounded-full inline-flex items-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] font-semibold border transition-colors whitespace-nowrap flex-none',
                          isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/20 text-black hover:bg-black/5',
                        )}
                      >
                        <Globe size={16} className={isDark ? 'text-white/75' : 'text-black/70'} />
                        Open Web
                      </motion.a>
                    </motion.div>

                    <motion.div variants={heroItem} className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                      Android-ready <span className="mx-2">•</span> APK install <span className="mx-2">•</span> 2FA-friendly{' '}
                      <span className="mx-2">•</span> Enterprise controls
                    </motion.div>

                    <motion.div variants={heroItem} className={cx('mt-6 flex items-center gap-4 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                      <div>Available now</div>
                      <div className="flex items-center gap-2">
                        <div
                          className={cx(
                            'h-10 w-10 rounded-full border flex items-center justify-center',
                            isDark ? 'border-white/15 bg-white/5' : 'border-black/15 bg-white/90',
                          )}
                          aria-label="Android"
                          title="Android"
                        >
                          <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
                        </div>
                        <div
                          className={cx(
                            'h-10 w-10 rounded-full border flex items-center justify-center',
                            isDark ? 'border-white/15 bg-white/5' : 'border-black/15 bg-white/90',
                          )}
                          aria-label="Web"
                          title="Web"
                        >
                          <Globe size={16} className={isDark ? 'text-white/75' : 'text-black/70'} />
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="lg:col-span-5 flex justify-center lg:justify-end">
                  <div className="relative w-full max-w-[280px] sm:max-w-[340px]">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <PhoneMock tint="dark" float className="rotate-[-6deg]" src={heroImg1} />
                    </motion.div>
                    <div className="absolute right-[-4px] sm:right-[-10px] top-[34px] sm:top-[42px] w-[62%] sm:w-[68%]">
                      <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <PhoneMock tint="dark" className="rotate-[7deg]" src={heroImg2} />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section id="overview" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                An inbox that
                <br />
                stays calm.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[62ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                ArcMail is built for teams that live in email: support queues, shared inboxes, escalations, approvals, and customer conversations.
                It’s fast when you need speed—and readable when you need context.
              </div>
              <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Android <span className="mx-2">•</span> Web <span className="mx-2">•</span> Thread-first <span className="mx-2">•</span>{' '}
                Admin controls <span className="mx-2">•</span> Activity visibility
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  {
                    t: 'Faster navigation',
                    d: 'Move between threads, search results, and actions without the UI slowing you down.',
                  },
                  {
                    t: 'Readable threading',
                    d: 'Conversation context stays intact, even across long reply chains.',
                  },
                  {
                    t: 'Team-ready workflows',
                    d: 'Designed for shared inboxes where multiple people touch the same threads.',
                  },
                  {
                    t: 'Security-friendly sign-in',
                    d: 'Encourages stronger authentication patterns and consistent access flows.',
                  },
                  {
                    t: 'Admin dashboard controls',
                    d: 'Send access, revoke access, and block logins when policy requires it.',
                  },
                  {
                    t: 'Login/logout activity',
                    d: 'Review account activity to support accountability and incident response.',
                  },
                ].map((x) => (
                  <div key={x.t} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>—</div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold tracking-tight leading-snug">{x.t}</div>
                        <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[74ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x.d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="security" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Security,
                <br />
                without friction.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[62ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                ArcMail is designed for enterprise environments where access needs to be controlled and activity needs to be visible. Stronger
                sign-in practices are encouraged, while the UI stays calm and predictable for everyday use.
              </div>
              <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                TLS in transit <span className="mx-2">•</span> 2FA-friendly <span className="mx-2">•</span> Access controls{' '}
                <span className="mx-2">•</span> Activity visibility <span className="mx-2">•</span> Block login
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  {
                    t: 'Transport protection',
                    d: 'ArcMail is built to operate over secure connections (TLS) to protect sign-in and inbox traffic in transit.',
                  },
                  {
                    t: '2FA-ready sign-in',
                    d: 'Works with accounts that have two-factor authentication enabled and encourages stronger sign-in habits for teams.',
                  },
                  {
                    t: 'Controlled access issuance',
                    d: 'Admins can issue access via the dashboard so onboarding stays consistent and policy-friendly across the team.',
                  },
                  {
                    t: 'Block login controls',
                    d: 'Disable access quickly when a device is lost, an account is compromised, or policy requires immediate revocation.',
                  },
                  {
                    t: 'Activity visibility',
                    d: 'Review login/logout events to support accountability and faster incident response.',
                  },
                  {
                    t: 'Calm-by-default UI',
                    d: 'Predictable actions and readable threading reduce mistakes when teams are moving quickly.',
                  },
                ].map((x, idx) => (
                  <div key={x.t} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold tracking-tight leading-snug">{x.t}</div>
                        <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[74ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                          {x.d}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="admin" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Admin tools
                <br />
                that scale.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[62ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                ArcMail keeps the day-to-day UI simple for users while giving administrators the controls they need to manage access and visibility.
              </div>
              <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Send access <span className="mx-2">•</span> Block login <span className="mx-2">•</span> Activity view{' '}
                <span className="mx-2">•</span> Enterprise rollout
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  {
                    t: 'Send access',
                    d: 'Issue access emails from the admin dashboard with a clean, premium template for onboarding.',
                  },
                  {
                    t: 'Block login',
                    d: 'Disable sign-in for an account when access should be revoked or temporarily paused.',
                  },
                  {
                    t: 'Activity view',
                    d: 'See login/logout events to understand usage and support investigations when something goes wrong.',
                  },
                  {
                    t: 'Policy-friendly onboarding',
                    d: 'Keep onboarding consistent across Android devices while maintaining admin visibility and controls.',
                  },
                  {
                    t: 'Clear ownership',
                    d: 'Separate everyday inbox usage from administrative actions, so teams stay fast and admins stay in control.',
                  },
                ].map((x) => (
                  <div key={x.t} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                        —
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold tracking-tight leading-snug">{x.t}</div>
                        <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[74ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                          {x.d}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="how" className="py-10 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-tight">How it works</div>
            <div className={cx('mt-3 max-w-[70ch] mx-auto leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
              Three steps. No friction. Download the APK, install it, and sign in. Admins can issue access, block logins, and review activity.
            </div>
          </div>
        </FadeIn>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[520px_520px] justify-center gap-14 items-center">
          <FadeIn delay={0.05}>
            <div className="relative w-full">
              <div
                className={cx(
                  'absolute -left-6 sm:-left-12 -bottom-10 sm:-bottom-14 w-[420px] sm:w-[560px] max-w-[140%]',
                  isDark ? 'text-white/10' : 'text-black/10',
                )}
              >
                <HandSilhouette />
              </div>
              <div className="relative w-full max-w-[300px] sm:max-w-[420px] mx-auto">
                <PhoneMock tint="dark" className="rotate-[-4deg] scale-[0.92] sm:scale-100 origin-bottom" src={heroImg1} />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="w-full">
              <div className="w-full max-w-[460px] space-y-8">
                <div>
                  <div className="text-[18px] font-semibold tracking-tight">A clean inbox in minutes.</div>
                  <div className={cx('mt-2 text-[13px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
                    ArcMail installs like a standard APK and signs in with your existing credentials. No migrations, no complicated setup—just a
                    faster, calmer email experience.
                  </div>
                </div>

                <div className="space-y-10">
                  {[
                    {
                      n: '01',
                      t: 'Download APK',
                      d: 'Get the latest Android build from this page. If your organization provides a link, use that.',
                      notes: ['Prefer official links shared by your admin team.', 'Keep the APK in your Downloads folder for easy access.'],
                    },
                    {
                      n: '02',
                      t: 'Install',
                      d: 'Android will ask you to allow installs from your browser or files app. Approve, then follow the prompts.',
                      notes: ['You can disable the permission again after installing.', 'If blocked by policy, ask your admin to approve installs.'],
                    },
                    {
                      n: '03',
                      t: 'Sign in',
                      d: 'Sign in with your ArcMail account. For teams, enabling 2FA is recommended for stronger protection.',
                      notes: ['Admins can revoke access or block logins at any time.', 'You can also use ArcMail on the web from the same account.'],
                    },
                  ].map((s) => (
                    <div key={s.n} className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>{s.n}</div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold tracking-tight leading-snug">{s.t}</div>
                        <div className={cx('mt-2 text-[13px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>{s.d}</div>
                        <div className="mt-3 space-y-2">
                          {s.notes.map((x) => (
                            <div key={x} className={cx('flex items-start gap-3 text-[12px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
                              <div className="h-5 w-5 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[1px]">
                                <Check size={12} className="text-black" />
                              </div>
                              <div className="min-w-0">{x}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={cx('mt-10 pt-8 border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                  <div className="flex items-end justify-between gap-6">
                    <div className="text-[14px] font-semibold tracking-tight">Setup notes</div>
                    <div className={cx('text-[12px]', isDark ? 'text-white/45' : 'text-black/45')}>Common fixes</div>
                  </div>
                  <div className="mt-6 space-y-5">
                    {[
                      'If the download button is disabled, your admin must set the APK URL in the environment.',
                      'If installs are blocked, your device policy may restrict side-loading. Ask IT to approve ArcMail.',
                      'For best results, sign in with 2FA enabled and keep your device updated.',
                    ].map((x, idx) => (
                      <div key={x} className="flex items-start gap-4">
                        <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className={cx('text-[12px] leading-relaxed max-w-[70ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>
      <Section id="workflows" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Workflows
                <br />
                that ship.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[62ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                ArcMail is optimized for the real work inside email: triage, response, follow-ups, and staying aligned when multiple people share a
                queue.
              </div>
              <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Support <span className="mx-2">•</span> Sales <span className="mx-2">•</span> Operations <span className="mx-2">•</span>{' '}
                Escalations <span className="mx-2">•</span> Approvals
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  {
                    n: '01',
                    t: 'Triage first',
                    d: 'Scan, sort, and decide. Keep context visible while you choose the next action.',
                  },
                  {
                    n: '02',
                    t: 'Reply with intent',
                    d: 'Compose stays clean and focused so you can ship the response quickly.',
                  },
                  {
                    n: '03',
                    t: 'Follow up reliably',
                    d: 'Treat your inbox like a queue: keep threads readable and actions predictable.',
                  },
                  {
                    n: '04',
                    t: 'Escalate cleanly',
                    d: 'When something needs attention, keep the full thread context intact.',
                  },
                  {
                    n: '05',
                    t: 'Close the loop',
                    d: 'Finish the thread, keep it documented, and move on—without UI clutter.',
                  },
                ].map((x) => (
                  <div key={x.n} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>{x.n}</div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold tracking-tight leading-snug">{x.t}</div>
                        <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[74ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x.d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>


      <Section id="features" className="py-10 sm:py-16">
        <FadeIn>
          <div className={cx('rounded-[34px] bg-[#0A0A0A] text-white border overflow-hidden', isDark ? 'border-white/10' : 'border-black/10')}>
            <div className="p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
              <div className="lg:col-span-5">
                <div className="text-[clamp(30px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-tight">
                  Inbox guidance
                  <br />
                  every moment
                </div>
                <div className="mt-4 text-white/65 leading-relaxed max-w-[52ch]">
                  Built for fast triage and calm execution. ArcMail keeps your inbox readable, your actions predictable, and your day moving—whether
                  you’re on Android or the web.
                </div>
                <div className="mt-7 space-y-3">
                  {[
                    'Navigate threads without losing context.',
                    'Search instantly and jump to the exact message.',
                    'Keep sign-in secure with 2FA-friendly flows.',
                    'Give admins visibility with login/logout activity.',
                  ].map((x) => (
                    <div key={x} className="flex items-start gap-3 text-[13px] text-white/65 leading-relaxed">
                      <div className="h-6 w-6 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[2px]">
                        <Check size={14} className="text-black" />
                      </div>
                      <div className="min-w-0">{x}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="border-t border-white/10 pt-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {[
                      {
                        icon: <Zap size={18} className="text-black" />,
                        t: 'Fast',
                        d: 'Snap‑to‑action navigation.',
                        extra: 'Triage quickly with fewer taps and less scrolling.',
                        meta: 'Shortcuts • Triage',
                      },
                      {
                        icon: <Check size={18} className="text-black" />,
                        t: 'Threading',
                        d: 'Clean conversations that stay readable.',
                        extra: 'Follow context across replies without UI noise.',
                        meta: 'Readable • Context',
                      },
                      {
                        icon: <Shield size={18} className="text-black" />,
                        t: 'Secure',
                        d: 'TLS + 2FA support.',
                        extra: 'Built for teams with admin-grade access controls.',
                        meta: '2FA • Controls',
                      },
                    ].map((x) => (
                      <div key={x.t} className="sm:border-l sm:border-white/10 sm:pl-8 first:sm:border-l-0 first:sm:pl-0">
                        <div className="h-10 w-10 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center">
                          {x.icon}
                        </div>
                        <div className="mt-5 text-[16px] font-semibold tracking-tight text-white">{x.t}</div>
                        <div className="mt-2 text-[13px] text-white/70 leading-relaxed">{x.d}</div>
                        <div className="mt-3 text-[12px] text-white/55 leading-relaxed">{x.extra}</div>
                        <div className="mt-5 text-[12px] text-white/50">{x.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="rollout" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Rollout
                <br />
                checklist.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[62ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                A clean rollout keeps teams productive. Use this as a simple playbook when rolling ArcMail out to a group.
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  'Share the APK download link internally and confirm the install policy for Android devices.',
                  'Verify sign-in flows with a test account before inviting the full team.',
                  'Encourage 2FA for accounts that handle sensitive inboxes.',
                  'Define who can issue access emails and who can block logins.',
                  'Check the Activity view after launch to confirm logins and spot issues early.',
                  'Document your support path: who to contact for access and troubleshooting.',
                ].map((x, idx) => (
                  <div key={x} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className={cx('text-[13px] leading-relaxed max-w-[74ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="teams" className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Built for
                <br />
                real teams.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[56ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                ArcMail keeps day-to-day email simple while giving administrators the controls they need: access, visibility, and policy-friendly
                sign-in.
              </div>
              <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Android + Web <span className="mx-2">•</span> Thread-first workflow <span className="mx-2">•</span> 2FA-ready sign-in{' '}
                <span className="mx-2">•</span> Admin activity <span className="mx-2">•</span> Block-login controls
              </div>

              <div className="mt-7 space-y-4 max-w-[60ch]">
                <div className={cx('text-[13px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
                  This is an inbox that behaves the same in the middle of a quiet morning and the middle of an incident. Threads stay readable,
                  actions stay predictable, and teams move faster with less coordination overhead.
                </div>
                <div className={cx('border-l-2 pl-4 text-[13px] leading-relaxed', isDark ? 'border-white/10 text-white/60' : 'border-black/10 text-black/60')}>
                  “Calm UI, clear threading, and admin visibility—without turning email into a tool you have to manage.”
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                {[
                  {
                    icon: <Mail size={16} className="text-black" />,
                    t: 'Compose that disappears',
                    d: 'Write, send, and keep moving. The interface stays out of the way so the work gets done.',
                  },
                  {
                    icon: <Users size={16} className="text-black" />,
                    t: 'Designed for shared inboxes',
                    d: 'Triage, assign, and stay aligned across threads with a workflow that doesn’t fight your team.',
                  },
                  {
                    icon: <Shield size={16} className="text-black" />,
                    t: 'Security-first defaults',
                    d: 'Support stronger sign-in habits with 2FA-friendly flows and consistent authentication patterns.',
                  },
                  {
                    icon: <Lock size={16} className="text-black" />,
                    t: 'Admin-grade access',
                    d: 'Send access, revoke it, block logins, and review activity when accountability matters.',
                  },
                ].map((x) => (
                  <div key={x.t} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                    <div className="flex items-start gap-4">
                      <div
                        className={cx(
                          'h-10 w-10 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none',
                        )}
                      >
                        {x.icon}
                      </div>
                      <div className="min-w-0">
                        <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[70ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x.d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Plan for every
                <br />
                milestone.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[56ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                Keep teams aligned with a calm inbox: labels, filters, and a flow that stays fast even at enterprise scale. ArcMail helps you turn
                noisy threads into clear decisions—without adding process overhead.
              </div>

              <div className="mt-6 space-y-3 max-w-[62ch]">
                {[
                  'Stay consistent across Android + Web with the same thread-first workflow.',
                  'Organize with labels and filters that remain predictable as volume grows.',
                  'Keep stakeholders aligned with clean threading and quick context.',
                  'Give admins the controls: access, block login, and activity visibility.',
                ].map((x) => (
                  <div key={x} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[2px]">
                      <Check size={14} className="text-black" />
                    </div>
                    <div className={cx('text-[13px] leading-relaxed', isDark ? 'text-white/65' : 'text-black/65')}>{x}</div>
                  </div>
                ))}
              </div>

              <div className={cx('mt-7 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Onboarding <span className="mx-2">•</span> Triage <span className="mx-2">•</span> Approvals <span className="mx-2">•</span>{' '}
                Escalations <span className="mx-2">•</span> Follow‑ups
              </div>

              <div className={cx('mt-7 pt-7 border-t max-w-[720px]', isDark ? 'border-white/10' : 'border-black/10')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  {[
                    { k: 'Shared inbox ready', v: 'Teams' },
                    { k: 'Multi-surface', v: 'Android + Web' },
                    { k: 'Security', v: '2FA-friendly' },
                  ].map((x) => (
                    <div key={x.k} className={cx('sm:border-l sm:pl-6 first:sm:border-l-0 first:sm:pl-0', isDark ? 'sm:border-white/10' : 'sm:border-black/10')}>
                      <div className={cx('text-[11px] uppercase tracking-wide', isDark ? 'text-white/45' : 'text-black/45')}>{x.k}</div>
                      <div className={cx('mt-2 text-[14px] font-semibold tracking-tight', isDark ? 'text-white' : 'text-black')}>{x.v}</div>
                      <div className={cx('mt-2 text-[12px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
                        {x.k === 'Shared inbox ready'
                          ? 'Designed for team workflows and shared ownership.'
                          : x.k === 'Multi-surface'
                            ? 'Stay consistent between desk and mobile.'
                            : 'Encourage stronger sign-in with 2FA.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <a
                  href="#"
                  className="h-10 px-5 rounded-full inline-flex items-center gap-2 text-[12px] font-semibold bg-[#B8FF2C] text-black"
                >
                  Contact Sales
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="w-full max-w-[420px]">
                <PhoneMock tint="dark" float src={heroImg2} />
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="py-10 sm:py-16">
        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 flex justify-center lg:justify-start">
              <div className="w-full max-w-[420px]">
                <PhoneMock tint="dark" float src={heroImg3} />
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                Expert guidance,
                <br />
                straight to the point.
              </div>
              <div className={cx('mt-4 leading-relaxed max-w-[56ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                Search quickly, triage with intent, and ship replies without the UI getting in the way. ArcMail is designed around actions—so you
                spend less time managing email, and more time finishing work.
              </div>

              <div className="mt-6 space-y-3 max-w-[62ch]">
                {[
                  'Jump from search to the exact message in a thread, instantly.',
                  'Keep replies clean with a compose experience built for speed.',
                  'Move through your day with fewer taps and predictable actions.',
                  'Stay readable at scale: calm UI, clear threading, no clutter.',
                ].map((x) => (
                  <div key={x} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[2px]">
                      <Check size={14} className="text-black" />
                    </div>
                    <div className={cx('text-[13px] leading-relaxed', isDark ? 'text-white/65' : 'text-black/65')}>{x}</div>
                  </div>
                ))}
              </div>

              <div className={cx('mt-7 text-[12px]', isDark ? 'text-white/55' : 'text-black/55')}>
                Search <span className="mx-2">•</span> Triage <span className="mx-2">•</span> Shortcuts <span className="mx-2">•</span> Thread
                actions <span className="mx-2">•</span> Compose
              </div>

              <div className={cx('mt-8 pt-8 border-t max-w-[760px]', isDark ? 'border-white/10' : 'border-black/10')}>
                <div className="flex items-end justify-between gap-6">
                  <div className="text-[14px] font-semibold tracking-tight">Quick wins</div>
                  <div className={cx('text-[12px]', isDark ? 'text-white/45' : 'text-black/45')}>Small habits, big speed</div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-14">
                  {[
                    'Use search as your launcher: query, open, reply, done.',
                    'Keep threads readable: act from the top, keep context.',
                    'Triage first, then compose: fewer switches, more flow.',
                    'Use Android for speed, then finish on the web when needed.',
                  ].map((x, idx) => (
                    <div key={x} className={cx('py-5 border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                      <div className="flex items-start gap-4">
                        <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className={cx('text-[12px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>{x}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <a
                  href="#"
                  className="h-10 px-5 rounded-full inline-flex items-center gap-2 text-[12px] font-semibold bg-[#B8FF2C] text-black"
                >
                  Explore ArcMail
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section id="trust" className="py-10 sm:py-16">
        <FadeIn>
          <div
            className={cx(
              'rounded-[34px] border overflow-hidden',
              isDark ? 'bg-[#0B0B0B] border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.55)]' : 'bg-white border-black/10 shadow-[0_30px_90px_rgba(0,0,0,0.08)]',
            )}
          >
            <div className="p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5">
                <div className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-tight leading-[1.05]">
                  Trust &amp;
                  <br />
                  control.
                </div>
                <div className={cx('mt-4 leading-relaxed max-w-[56ch]', isDark ? 'text-white/60' : 'text-black/60')}>
                  Built for enterprise environments with clear access flows, admin visibility, and a UI that stays calm under pressure.
                </div>
                <div className="mt-7 space-y-3">
                  {[
                    'Block logins instantly from the admin dashboard.',
                    'Review login/logout activity for accountability.',
                    'Keep access emails clear, minimal, and secure.',
                    'Encourage stronger sign-in with optional 2FA.',
                  ].map((x) => (
                    <div key={x} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#B8FF2C] text-black flex items-center justify-center flex-none mt-[2px]">
                        <Check size={14} />
                      </div>
                      <div className={cx('text-[13px] leading-relaxed', isDark ? 'text-white/70' : 'text-black/70')}>{x}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className={cx('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                  {[
                    {
                    icon: <Lock size={16} className="text-black" />,
                      t: 'Access controls',
                      d: 'Centralize who can sign in and when—without forcing teams into a heavy process.',
                    },
                    {
                    icon: <Activity size={16} className="text-black" />,
                      t: 'Audit visibility',
                      d: 'See sign-ins and sign-outs to understand what happened, when it happened, and who was affected.',
                    },
                    {
                    icon: <Shield size={16} className="text-black" />,
                      t: 'Secure-by-default',
                      d: 'Support strong authentication practices with predictable sign-in flows that teams can follow.',
                    },
                    {
                    icon: <Globe size={16} className="text-black" />,
                      t: 'Multi-surface',
                      d: 'Use Android on the go and Web at your desk with a consistent workflow across devices.',
                    },
                  ].map((x) => (
                    <div key={x.t} className={cx('py-7 border-b', isDark ? 'border-white/10' : 'border-black/10')}>
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none">
                          {x.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[16px] font-semibold tracking-tight leading-snug">{x.t}</div>
                          <div className={cx('mt-2 text-[13px] leading-relaxed max-w-[72ch]', isDark ? 'text-white/60' : 'text-black/60')}>{x.d}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={cx('mt-6 text-[12px]', isDark ? 'text-white/50' : 'text-black/50')}>
                  Access <span className="mx-2">•</span> Visibility <span className="mx-2">•</span> Accountability{' '}
                  <span className="mx-2">•</span> Security <span className="mx-2">•</span> Android + Web
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="py-10 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-tight">What They Said</div>
            <div className={cx('mt-8 max-w-[70ch] mx-auto leading-relaxed', isDark ? 'text-white/70' : 'text-black/70')}>
              “ArcMail is the first inbox that feels fast again. The UI stays calm, threading stays readable, and the flow never gets in the way.”
            </div>
            <div className={cx('mt-6 text-sm', isDark ? 'text-white/50' : 'text-black/50')}>IT Administrator</div>
          </div>
        </FadeIn>
      </Section>

      <Section id="faq" className="py-10 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-tight">FAQ</div>
            <div className={cx('mt-3 max-w-[70ch] mx-auto leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>
              Quick answers to the most common questions about ArcMail for Android.
            </div>
          </div>
        </FadeIn>

        <div className="mt-10 max-w-[980px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14">
            {[
              {
                q: 'How do I install the APK?',
                a: 'Download the APK, then allow installs from your browser or file manager when prompted.',
              },
              {
                q: 'Is there a web version?',
                a: 'Yes. Use ArcMail on the web from the “Open Web” link at the top of this page.',
              },
              {
                q: 'Can admins block a user from logging in?',
                a: 'Yes. Use the admin dashboard Block login tab to disable access for a specific account.',
              },
              {
                q: 'Where can I see login activity?',
                a: 'Admins can open the Activity tab to review login/logout events.',
              },
              {
                q: 'Does ArcMail support 2FA?',
                a: 'ArcMail supports accounts with 2FA enabled and encourages stronger sign-in practices for teams.',
              },
              {
                q: 'What if the download button is disabled?',
                a: 'The download URL is configured via environment variables. If it’s missing, ask your admin to set it up.',
              },
            ].map((x, idx) => (
              <div key={x.q} className={cx('py-7 border-t', isDark ? 'border-white/10' : 'border-black/10')}>
                <div className="flex items-start gap-4">
                  <div className={cx('text-[11px] font-semibold w-8 flex-none pt-[2px]', isDark ? 'text-white/40' : 'text-black/40')}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold tracking-tight leading-snug">{x.q}</div>
                    <div className={cx('mt-2 text-[13px] leading-relaxed', isDark ? 'text-white/60' : 'text-black/60')}>{x.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="pb-28 sm:pb-16">
        <FadeIn>
          <div className="w-full px-4 sm:px-0 sm:w-[92%] md:w-[86%] lg:w-[70%] mx-auto">
            <div className={cx('w-full rounded-[34px] bg-[#0A0A0A] text-white border overflow-hidden', isDark ? 'border-white/10' : 'border-black/10')}>
              <div className="w-full p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-6">
                <Pill>
                  <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
                  Download now
                </Pill>
                <div className="mt-7 text-[clamp(30px,4.6vw,56px)] font-extrabold tracking-tight leading-[1.02]">
                  Make Mail Moves.
                </div>
                <div className="mt-4 text-white/65 leading-relaxed max-w-[60ch]">
                  Download ArcMail for Android and experience a clean, focused inbox designed for speed.
                </div>
                <div className="mt-5 text-white/60 leading-relaxed max-w-[62ch] text-[13px]">
                  From triage to reply, ArcMail keeps everything readable and predictable. Use Android for quick actions, then continue on the web
                  with the same account and the same thread-first workflow.
                </div>

                <div className="mt-7 space-y-3">
                  {[
                    'Fast navigation, shortcuts, and search as your launcher.',
                    'Clean threading that stays readable under pressure.',
                    'Admin-grade access: send access, block logins, and revoke when needed.',
                    'Activity visibility: review login/logout events for accountability.',
                    'Android + Web: consistent experience across devices.',
                  ].map((x) => (
                    <div key={x} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#B8FF2C] border border-black/10 text-black flex items-center justify-center flex-none mt-[2px]">
                        <Check size={14} className="text-black" />
                      </div>
                      <div className="text-[13px] text-white/65 leading-relaxed">{x}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 text-[12px] text-white/55">
                  APK install <span className="mx-2">•</span> Android-ready <span className="mx-2">•</span> Web companion{' '}
                  <span className="mx-2">•</span> 2FA-friendly <span className="mx-2">•</span> Enterprise controls
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 max-w-[760px]">
                  <div className="flex items-end justify-between gap-6">
                    <div className="text-[14px] font-semibold tracking-tight text-white">Install in minutes</div>
                    <div className="text-[12px] text-white/50">Three steps. Same account.</div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {[
                      { n: '01', t: 'Download', d: 'Grab the latest APK from this page.' },
                      { n: '02', t: 'Install', d: 'Allow installs when Android prompts you.' },
                      { n: '03', t: 'Sign in', d: 'Use your ArcMail account. 2FA recommended.' },
                    ].map((s) => (
                      <div key={s.n} className="sm:border-l sm:border-white/10 sm:pl-6 first:sm:border-l-0 first:sm:pl-0">
                        <div className="text-[11px] font-semibold text-white/45">{s.n}</div>
                        <div className="mt-2 text-[14px] font-semibold tracking-tight text-white">{s.t}</div>
                        <div className="mt-2 text-[12px] text-white/60 leading-relaxed">{s.d}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-[12px] text-white/50 leading-relaxed">
                    If installs are restricted by device policy, ask your admin team to approve ArcMail for your organization.
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href={downloadDisabled ? undefined : downloadUrl}
                    onClick={(e) => {
                      if (downloadDisabled) e.preventDefault();
                    }}
                    className={[
                      'h-11 px-4 sm:px-6 rounded-2xl inline-flex items-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap flex-none',
                      downloadDisabled ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-[#B8FF2C] text-black hover:opacity-95',
                    ].join(' ')}
                  >
                    <img src={ANDROID_ICON_URL} alt={ANDROID_ICON_ALT} className="h-4 w-4" />
                    Download APK
                    <ArrowRight size={16} />
                  </a>
                  <a
                    href="/login"
                    className="h-11 px-4 sm:px-6 rounded-2xl inline-flex items-center gap-2 text-[12px] sm:text-[13px] font-semibold border border-white/20 text-white/80 hover:bg-white/5 whitespace-nowrap flex-none"
                  >
                    <Globe size={16} />
                    Open Web
                  </a>
                </div>
              </div>
              <div className="lg:col-span-6 flex justify-center lg:justify-end">
                <div className="w-full max-w-[420px]">
                  <PhoneMock tint="dark" float src={heroImg1} />
                </div>
              </div>
            </div>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.75, delay }}
    >
      {children}
    </motion.div>
  );
}
