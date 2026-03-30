import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  FileText,
  Send,
  AlertTriangle,
  Trash2,
  Pencil,
  Search,
  Star,
  Archive,
  ArrowLeft,
  Reply,
  Forward,
  LogOut,
  Plus,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  UserRound,
  ImagePlus,
  Filter,
  Clock,
  X,
  Check,
  Mic,
  ChevronRight,
  MoreVertical,
  PanelLeftClose,
  Settings,
  Moon,
  Sun,
  Globe,
  Smartphone,
  MessageSquare,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { cn } from '../../utils/cn';
import { RichTextEditor } from '../../components/editor/RichTextEditor';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
import arcByteLogoPng from '../../assets/arcbyte.co_logo.png';
import { LANGUAGES, type Language, translations } from './translations';

// --- Theme Context ---
const ThemeContext = React.createContext({ isDark: true, toggleTheme: () => {} });
const useTheme = () => React.useContext(ThemeContext);

// --- Language Context ---
const LanguageContext = React.createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});
const useLanguage = () => React.useContext(LanguageContext);

const AIContext = React.createContext<{ aiEnabled: boolean; toggleAi: () => void }>({ aiEnabled: true, toggleAi: () => {} });
const useAI = () => React.useContext(AIContext);

// --- Types ---

type MailFolder = 'inbox' | 'drafts' | 'sent' | 'spam' | 'trash';

const MAIL_FOLDER_IMAP_PATH: Record<MailFolder, string> = {
  inbox: 'INBOX',
  drafts: 'Drafts',
  sent: 'Sent',
  spam: 'Spam',
  trash: 'Trash',
};

type EmailAIExtractedData = {
  deadlines: string[];
  tasks: string[];
  important: string[];
};

type EmailAI = {
  summary: string | null;
  label: string | null;
  priority: number | null;
  extractedData: EmailAIExtractedData | null;
} | null;

type MailThreadSummary = {
  id: string;
  folder: MailFolder;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  timestamp: string;
  unread: boolean;
  starred?: boolean;
  tags?: string[];
  from?: { name?: string; address: string } | null;
  to?: { name?: string; address: string }[] | null;
  lastMessageAt?: string;
  ai?: EmailAI;
};

type MailThreadMessage = {
  id: string;
  subject: string;
  fromName?: string;
  fromAddress?: string;
  to: { name?: string; address: string }[];
  cc: { name?: string; address: string }[];
  bcc: { name?: string; address: string }[];
  date: string;
  text?: string;
  html?: string;
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    part: string;
  }[];
  flags: {
    seen: boolean;
    flagged: boolean;
    answered: boolean;
  };
};

type MailThreadDetail = {
  id: string;
  subject: string;
  folder: MailFolder;
  messages: MailThreadMessage[];
  ai?: EmailAI;
};

type ComposeDraft = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  showCcBcc?: boolean;
};

type SpeechRecognitionEventResult = { transcript: string };
type SpeechRecognitionEvent = { results: ArrayLike<{ 0: SpeechRecognitionEventResult }> };
interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

type ViewportState = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

const SENT_LOCAL_KEY = 'arcmail.pendingSent';
const readPendingSent = (): MailThreadSummary[] => {
  try {
    const raw = localStorage.getItem(SENT_LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((t) => ({
      id: String(t.id || `local-sent-${Date.now()}`),
      folder: 'sent',
      sender: String(t.sender || 'Me'),
      senderEmail: String(t.senderEmail || ''),
      subject: String(t.subject || '(no subject)'),
      snippet: String(t.snippet || ''),
      timestamp: String(t.timestamp || new Date().toISOString()),
      unread: false,
      from: t.from && t.from.address ? { name: t.from.name, address: t.from.address } : undefined,
      lastMessageAt: String(t.lastMessageAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
};
const writePendingSent = (items: MailThreadSummary[]) => {
  try {
    localStorage.setItem(SENT_LOCAL_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};
const clearPendingSent = () => {
  try {
    localStorage.removeItem(SENT_LOCAL_KEY);
  } catch {
    /* ignore */
  }
};
// --- Hooks ---

const useViewport = (): ViewportState => {
  const [width, setWidth] = useState<number>(() => window.innerWidth || 1440);

  useEffect(() => {
    const handle = () => setWidth(window.innerWidth || 1440);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  const isMobile = width < 768;
  const isDesktop = width >= 1280;

  return { isMobile, isTablet: false, isDesktop };
};

// --- Components ---

const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
  count,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  collapsed?: boolean;
  count?: number;
}) => {
  const { isDark } = useTheme();
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 mx-2 w-[calc(100%-16px)] rounded-xl transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        active
          ? (isDark ? 'bg-[#1A1A1A] text-white shadow-lg shadow-black/20' : 'bg-white text-black shadow-md shadow-black/5')
          : (isDark ? 'text-[#B3B3B3] hover:text-white hover:bg-[#121212]' : 'text-[#5E5E5E] hover:text-black hover:bg-[#EAEAEA]')
      )}
    >
      {/* Active Glow Background */}
      {active && (
         <div className={cn("absolute inset-0 rounded-xl bg-gradient-to-r to-transparent opacity-100 pointer-events-none", isDark ? "from-[#1DB954]/5" : "from-[#1DB954]/10")} />
      )}

      {/* Icon Container */}
      <div className={cn(
          "relative flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-active:scale-95",
          active ? "text-[#1DB954]" : "text-current"
      )}>
          <Icon
            size={collapsed ? 24 : 20}
            strokeWidth={active ? 2.5 : 2}
            className="relative z-10"
          />
          {/* Icon Glow */}
          {active && <div className="absolute inset-0 bg-[#1DB954]/30 blur-lg rounded-full opacity-60" />} 
      </div>

      {!collapsed && (
        <>
          <span className={cn(
              "text-[14px] flex-1 text-left truncate transition-all duration-200",
              active 
                ? (isDark ? "font-bold text-white tracking-wide translate-x-1" : "font-bold text-black tracking-wide translate-x-1") 
                : (isDark ? "font-medium text-[#B3B3B3] group-hover:text-white group-hover:translate-x-1" : "font-medium text-[#5E5E5E] group-hover:text-black group-hover:translate-x-1")
          )}>
            {label}
          </span>
          {count !== undefined && (
            <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center transition-colors",
                active 
                  ? "bg-[#1DB954] text-black shadow-[0_0_10px_rgba(29,185,84,0.4)]" 
                  : (isDark ? "bg-[#282828] text-[#787878] group-hover:text-white group-hover:bg-[#333]" : "bg-[#E0E0E0] text-[#737373] group-hover:text-black group-hover:bg-[#D4D4D4]")
            )}>
              {count}
            </span>
          )}
        </>
      )}
      
      {/* Active Left Pill */}
      {active && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#1DB954] rounded-r-full shadow-[0_0_12px_#1DB954]" />
      )}
    </button>
  );
};

const MailSidebar = ({
  accounts,
  activeAccountId,
  activeEmail,
  activeFolder,
  onFolderChange,
  onCompose,
  collapsed,
  setCollapsed,
  onLogoutCurrent,
  onLogoutAll,
  onAddAccount,
  onVerify2FAAddAccount,
  onConfirm2FASetupAddAccount,
  onSwitchAccount,
  onLogoutAccount,
  onUpdateAccountProfile,
  isMobile,
  folderCounts,
  folderUnreadCounts,
}: {
  accounts: { id: string; email: string; name: string; avatarDataUrl?: string }[];
  activeAccountId: string | null;
  activeEmail: string;
  activeFolder: MailFolder;
  onFolderChange: (f: MailFolder) => void;
  onCompose: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onLogoutCurrent: () => void;
  onLogoutAll: () => void;
  onAddAccount: (
    email: string,
    password: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    require2FA?: boolean;
    require2FASetup?: boolean;
    preAuthToken?: string;
    qrDataUrl?: string;
    manualKey?: string;
  }>;
  onVerify2FAAddAccount: (preAuthToken: string, params: { token?: string; backupCode?: string }) => Promise<{ ok: boolean; error?: string }>;
  onConfirm2FASetupAddAccount: (params: { preAuthToken: string; token: string }) => Promise<{ ok: boolean; error?: string; backupCodes?: string[] }>;
  onSwitchAccount: (accountId: string) => void;
  onLogoutAccount: (accountId: string) => void;
  onUpdateAccountProfile: (accountId: string, updates: { displayName?: string; avatarDataUrl?: string | null }) => void;
  isMobile: boolean;
  folderCounts?: Partial<Record<MailFolder, number>>;
  folderUnreadCounts?: Partial<Record<MailFolder, number>>;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addShowPassword, setAddShowPassword] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addStep, setAddStep] = useState<'form' | 'otp' | 'setup' | 'backupCodes'>('form');
  const [addPreAuthToken, setAddPreAuthToken] = useState('');
  const [addQrDataUrl, setAddQrDataUrl] = useState('');
  const [addManualKey, setAddManualKey] = useState('');
  const [addOtp, setAddOtp] = useState('');
  const [addUseBackup, setAddUseBackup] = useState(false);
  const [addBackupCodes, setAddBackupCodes] = useState<string[] | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAccountId, setProfileAccountId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; email: string } | null>(null);
  const activeInitial = (activeEmail || '?')[0]?.toUpperCase() || '?';
  const activeAccount = useMemo(() => accounts.find((a) => a.id === activeAccountId) || null, [accounts, activeAccountId]);
  const resetAddFlow = () => {
    setAddStep('form');
    setAddPreAuthToken('');
    setAddQrDataUrl('');
    setAddManualKey('');
    setAddOtp('');
    setAddUseBackup(false);
    setAddBackupCodes(null);
    setAddError(null);
    setAddBusy(false);
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full z-20',
        isDark ? 'bg-[#0B0B0B]' : 'bg-[#F6F6F6] border-r border-[#E5E5E5]',
        'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'w-[72px]' : 'w-[240px]',
        isMobile && 'w-full absolute inset-0 z-50'
      )}
    >
      {/* Header */}
      <div className={cn("h-16 flex items-center px-6 pt-4 pb-2", collapsed && "justify-center px-0")}>
        {!collapsed ? (
          <div className="flex items-center gap-3 cursor-pointer group">
             {/* Logo Filter for Light Mode */}
             <img src={arcByteLogo} alt="ArcMail" className={cn("h-8 w-auto object-contain", !isDark && "brightness-0")} />
             <span className={cn("font-bold text-lg tracking-tight transition-colors", isDark ? "text-white group-hover:text-[#1DB954]" : "text-black group-hover:text-[#1DB954]")}>ArcMail</span>
          </div>
        ) : (
          <div className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform">
             <img src={arcByteLogo} alt="A" className={cn("h-8 w-auto object-contain", !isDark && "brightness-0")} />
          </div>
        )}
        
        {!collapsed && (
           <button 
             onClick={() => setCollapsed(true)} 
             className={cn(
               "ml-auto p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 group",
               isDark ? "text-[#787878] hover:text-white hover:bg-[#1A1A1A]" : "text-[#949494] hover:text-black hover:bg-[#E0E0E0]"
             )}
             title="Collapse sidebar"
           >
             <PanelLeftClose size={20} strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform" />
           </button>
        )}
      </div>

      {/* Compose */}
      <div className="px-4 py-4">
        <button
          onClick={onCompose}
          className={cn(
            'flex items-center gap-3 w-full h-12 rounded-full transition-all duration-200 group',
            collapsed 
              ? (isDark ? 'w-12 h-12 justify-center bg-[#1A1A1A] hover:bg-[#282828] text-white p-0 mx-auto' : 'w-12 h-12 justify-center bg-white hover:bg-[#EAEAEA] text-black p-0 mx-auto border border-[#E5E5E5]')
              : (isDark ? 'bg-white hover:bg-[#F0F0F0] hover:scale-[1.02] text-black px-4 shadow-lg shadow-white/5' : 'bg-black hover:bg-[#333] hover:scale-[1.02] text-white px-4 shadow-lg shadow-black/10')
          )}
        >
          <Pencil size={20} strokeWidth={2.5} className={collapsed ? (isDark ? "text-white" : "text-black") : (isDark ? "text-black" : "text-white")} />
          {!collapsed && <span className="font-bold text-[14px]">{t('compose')}</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        <div className="space-y-1">
          <SidebarItem
            icon={Inbox}
            label={t('inbox')}
            active={activeFolder === 'inbox'}
            onClick={() => onFolderChange('inbox')}
            collapsed={collapsed}
            count={folderUnreadCounts?.inbox ?? 0}
          />
          <SidebarItem
            icon={Star}
            label={t('starred')}
            active={false}
            onClick={() => {}}
            collapsed={collapsed}
          />
          <SidebarItem
            icon={Send}
            label={t('sent')}
            active={activeFolder === 'sent'}
            onClick={() => onFolderChange('sent')}
            collapsed={collapsed}
            count={folderCounts?.sent ?? 0}
          />
          <SidebarItem
            icon={FileText}
            label={t('drafts')}
            active={activeFolder === 'drafts'}
            onClick={() => onFolderChange('drafts')}
            collapsed={collapsed}
            count={folderCounts?.drafts ?? 0}
          />
        </div>
        
        {!collapsed && (
          <div className="px-5 py-3 mt-4 mb-2 flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
             <div className={cn("h-[1px] w-4", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />
             <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em] font-mono", isDark ? "text-[#5E5E5E]" : "text-[#949494]")}>{t('library')}</span>
             <div className={cn("h-[1px] flex-1", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />
          </div>
        )}
        
        <div className="space-y-1">
          <SidebarItem
            icon={AlertTriangle}
            label={t('spam')}
            active={activeFolder === 'spam'}
            onClick={() => onFolderChange('spam')}
            collapsed={collapsed}
            count={folderCounts?.spam ?? 0}
          />
          <SidebarItem
            icon={Trash2}
            label={t('trash')}
            active={activeFolder === 'trash'}
            onClick={() => onFolderChange('trash')}
            collapsed={collapsed}
            count={folderCounts?.trash ?? 0}
          />
        </div>
      </nav>

      {/* Profile */}
      <div className={cn("p-4 mt-auto border-t", isDark ? "border-[#1A1A1A]" : "border-[#E5E5E5]")}>
        <div className="relative">
          <AnimatePresence>
            {accountMenuOpen && !collapsed && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60]"
                  onClick={() => setAccountMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className={cn(
                    "absolute left-0 right-0 bottom-[calc(100%+12px)] z-[70] rounded-2xl border shadow-2xl overflow-hidden",
                    isDark ? "bg-[#0B0B0B] border-[#282828]" : "bg-white border-[#E5E5E5]"
                  )}
                >
                  <div className={cn("px-4 py-3 text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                    Accounts
                  </div>
                  <div className="px-2 pb-2">
                    {accounts.map((a) => {
                      const active = a.id === activeAccountId;
                      return (
                        <div key={a.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-2", active && (isDark ? "bg-[#181818]" : "bg-[#F6F6F6]"))}>
                          <button
                            onClick={() => {
                              onSwitchAccount(a.id);
                              setAccountMenuOpen(false);
                            }}
                            className="flex-1 min-w-0 flex items-center gap-3 text-left"
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px] shrink-0">
                              <div className={cn("w-full h-full rounded-full flex items-center justify-center overflow-hidden", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                                {a.avatarDataUrl ? (
                                  <img src={a.avatarDataUrl} alt={a.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className={cn("font-bold text-[12px]", isDark ? "text-white" : "text-black")}>{(a.email || '?')[0].toUpperCase()}</span>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className={cn("text-[13px] font-bold truncate", isDark ? "text-white" : "text-black")}>{a.name || a.email}</div>
                              <div className={cn("text-[12px] truncate", isDark ? "text-[#787878]" : "text-[#949494]")}>{a.email}</div>
                            </div>
                          </button>
                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              onClick={() => {
                                setProfileAccountId(a.id);
                                setProfileName(a.name || '');
                                setProfileError(null);
                                setProfileOpen(true);
                                setAccountMenuOpen(false);
                              }}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                                isDark ? "text-white/45 hover:text-white hover:bg-[#1A1A1A]" : "text-black/45 hover:text-black hover:bg-[#F0F0F0]"
                              )}
                              title="Edit profile"
                            >
                              <Pencil size={14} />
                            </button>
                            {active && (
                              <div className={cn("px-2.5 h-7 rounded-full flex items-center justify-center border text-[10px] font-bold tracking-widest uppercase", isDark ? "bg-[#121212] border-[#282828] text-[#1DB954]" : "bg-white border-[#E5E5E5] text-[#1DB954]")}>
                                Active
                              </div>
                            )}
                            {!active && (
                              <button
                                onClick={() => {
                                  setRemoveConfirm({ id: a.id, email: a.email });
                                  setAccountMenuOpen(false);
                                }}
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                                  isDark ? "text-white/45 hover:text-[#FF5555] hover:bg-[#1A1A1A]" : "text-black/45 hover:text-[#FF5555] hover:bg-[#F0F0F0]"
                                )}
                                title={t('sign_out')}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => {
                        setAddEmail('');
                        setAddPassword('');
                        setAddError(null);
                        setAddAccountOpen(true);
                        setAccountMenuOpen(false);
                      }}
                      className={cn(
                        "mt-2 w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl font-bold text-[12px] transition-colors border",
                        isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]"
                      )}
                    >
                      <Plus size={16} />
                      Add account
                    </button>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onLogoutAll();
                      }}
                      className={cn(
                        "mt-2 w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl font-bold text-[12px] transition-colors",
                        "bg-[#FF5555] hover:bg-[#FF6B6B] text-black"
                      )}
                    >
                      <LogOut size={16} />
                      Log out all
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {profileOpen && profileAccountId && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
                  onClick={() => setProfileOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="fixed inset-x-4 top-[12vh] z-[90] flex justify-center"
                >
                  <div className="w-full max-w-md">
                    <div
                      className={cn(
                        "rounded-3xl p-[1px] shadow-[0_28px_90px_rgba(0,0,0,0.75)]",
                        isDark ? "bg-gradient-to-b from-white/14 via-white/10 to-transparent" : "bg-gradient-to-b from-black/12 via-black/10 to-transparent"
                      )}
                    >
                      <div className={cn("rounded-3xl border backdrop-blur-xl overflow-hidden", isDark ? "bg-[#0B0B0B]/92 border-[#282828]" : "bg-white/92 border-[#E5E5E5]")}>
                        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
                        <div className="px-6 pt-6 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                <UserRound size={18} strokeWidth={2.4} />
                              </div>
                              <div className="min-w-0">
                                <div className={cn("text-lg font-bold tracking-tight", isDark ? "text-white" : "text-black")}>Account</div>
                                <div className={cn("text-sm mt-0.5", isDark ? "text-white/55" : "text-black/55")}>Edit name & profile photo.</div>
                              </div>
                            </div>
                            <button
                              onClick={() => setProfileOpen(false)}
                              className={cn("p-2 rounded-full transition-colors", isDark ? "text-white/55 hover:text-white hover:bg-[#1A1A1A]" : "text-black/55 hover:text-black hover:bg-[#F0F0F0]")}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="px-6 pb-6">
                          {profileError && (
                            <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                              {profileError}
                            </div>
                          )}

                          <div className="flex items-center gap-4 mb-5">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px] shrink-0">
                              <div className={cn("w-full h-full rounded-full overflow-hidden flex items-center justify-center", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                                {accounts.find((a) => a.id === profileAccountId)?.avatarDataUrl ? (
                                  <img src={accounts.find((a) => a.id === profileAccountId)?.avatarDataUrl} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className={cn("font-bold text-xl", isDark ? "text-white" : "text-black")}>
                                    {(accounts.find((a) => a.id === profileAccountId)?.email || '?')[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={cn("text-[12px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                                {accounts.find((a) => a.id === profileAccountId)?.email || ''}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <label
                                  className={cn(
                                    "px-3 h-9 rounded-xl font-bold text-[12px] flex items-center gap-2 cursor-pointer border transition-colors",
                                    isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]"
                                  )}
                                >
                                  <ImagePlus size={16} />
                                  Change
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = '';
                                      setProfileError(null);
                                      if (!file) return;
                                      if (!file.type.startsWith('image/')) {
                                        setProfileError('Choose an image file.');
                                        return;
                                      }
                                      if (file.size > 200_000) {
                                        setProfileError('Image is too large. Use a smaller image.');
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        const result = typeof reader.result === 'string' ? reader.result : '';
                                        if (!result) return;
                                        onUpdateAccountProfile(profileAccountId, { avatarDataUrl: result });
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>
                                <button
                                  onClick={() => onUpdateAccountProfile(profileAccountId, { avatarDataUrl: null })}
                                  className={cn(
                                    "px-3 h-9 rounded-xl font-bold text-[12px] flex items-center gap-2 transition-colors border",
                                    isDark ? "bg-transparent border-[#282828] text-white/70 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                                  )}
                                >
                                  <Trash2 size={16} />
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className={cn("text-[11px] font-bold tracking-widest uppercase mb-2", isDark ? "text-white/45" : "text-black/45")}>Display name</div>
                            <div
                              className={cn(
                                "group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all",
                                isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20"
                              )}
                            >
                              <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                <UserRound size={16} strokeWidth={2.2} />
                              </div>
                              <input
                                value={profileName}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setProfileName(v);
                                  onUpdateAccountProfile(profileAccountId, { displayName: v });
                                }}
                                className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                                placeholder="Your name"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                              onClick={() => {
                                const fallback = accounts.find((a) => a.id === profileAccountId)?.email?.split('@')[0] || '';
                                setProfileName(fallback);
                                onUpdateAccountProfile(profileAccountId, { displayName: fallback });
                              }}
                              className={cn(
                                "px-4 h-10 rounded-xl font-bold text-[12px] border transition-colors",
                                isDark ? "bg-transparent border-[#282828] text-white/70 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                              )}
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setProfileOpen(false)}
                              className={cn("px-4 h-10 rounded-xl font-bold text-[12px] transition-colors", "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black")}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {removeConfirm && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
                  onClick={() => setRemoveConfirm(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="fixed inset-0 z-[90] flex items-center justify-center px-4"
                >
                  <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
                    <div className="h-[2px] bg-gradient-to-r from-transparent via-[#FF5555]/85 to-transparent" />
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0", isDark ? "bg-[#121212] border-[#282828]" : "bg-[#F7F7F7] border-[#E5E5E5]")}>
                          <AlertTriangle size={18} className="text-[#FF5555]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-bold tracking-tight">Remove account?</div>
                          <div className={cn("text-sm mt-1", isDark ? "text-white/55" : "text-black/55")}>
                            This logs out {removeConfirm.email}.
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6 flex items-center gap-3">
                      <button
                        onClick={() => setRemoveConfirm(null)}
                        className={cn(
                          "flex-1 h-11 rounded-2xl font-bold text-[12px] border transition-colors",
                          isDark ? "bg-transparent border-[#282828] text-white/75 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                        )}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onLogoutAccount(removeConfirm.id);
                          setRemoveConfirm(null);
                        }}
                        className="flex-1 h-11 rounded-2xl font-bold text-[12px] bg-[#FF5555] hover:bg-[#FF6B6B] text-black transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {addAccountOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
                  onClick={() => setAddAccountOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="fixed inset-x-4 top-[12vh] z-[90] flex justify-center"
                >
                  <div className="w-full max-w-md">
                    <div className={cn(
                      "rounded-3xl p-[1px] shadow-[0_28px_90px_rgba(0,0,0,0.75)]",
                      isDark ? "bg-gradient-to-b from-white/14 via-white/10 to-transparent" : "bg-gradient-to-b from-black/12 via-black/10 to-transparent"
                    )}>
                      <div className={cn("rounded-3xl border backdrop-blur-xl overflow-hidden", isDark ? "bg-[#0B0B0B]/92 border-[#282828]" : "bg-white/92 border-[#E5E5E5]")}>
                        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
                        <div className="px-6 pt-6 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                <Plus size={18} strokeWidth={2.4} />
                              </div>
                              <div className="min-w-0">
                                <div className={cn("text-lg font-bold tracking-tight", isDark ? "text-white" : "text-black")}>Add account</div>
                                <div className={cn("text-sm mt-0.5", isDark ? "text-white/55" : "text-black/55")}>
                                  Keep multiple inboxes signed in and switch instantly.
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setAddAccountOpen(false);
                                resetAddFlow();
                              }}
                              className={cn("p-2 rounded-full transition-colors", isDark ? "text-white/55 hover:text-white hover:bg-[#1A1A1A]" : "text-black/55 hover:text-black hover:bg-[#F0F0F0]")}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="px-6 pb-6">
                          {addError && (
                            <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                              {addError}
                            </div>
                          )}

                          {addStep === 'backupCodes' ? (
                            <div className="space-y-4">
                              <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                                Backup codes
                              </div>
                              <div className={cn("rounded-2xl border p-4 font-mono text-xs whitespace-pre-wrap", isDark ? "bg-[#111111] border-white/10 text-white/80" : "bg-white border-black/10 text-black/80")}>
                                {(addBackupCodes || []).join('\n')}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddEmail('');
                                  setAddPassword('');
                                  setAddAccountOpen(false);
                                  resetAddFlow();
                                }}
                                className={cn(
                                  "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                                  "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99]"
                                )}
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <form
                              onSubmit={async (evt) => {
                                evt.preventDefault();
                                setAddError(null);
                                if (addStep === 'form') {
                                  const e = addEmail.trim();
                                  const p = addPassword;
                                  if (!e || !p) return setAddError('Enter email and password.');
                                  setAddBusy(true);
                                  try {
                                    const res = await onAddAccount(e, p);
                                    if (res.require2FASetup && res.preAuthToken && res.qrDataUrl && res.manualKey) {
                                      setAddStep('setup');
                                      setAddPreAuthToken(res.preAuthToken);
                                      setAddQrDataUrl(res.qrDataUrl);
                                      setAddManualKey(res.manualKey);
                                      setAddOtp('');
                                      setAddUseBackup(false);
                                      return;
                                    }
                                    if (res.require2FA && res.preAuthToken) {
                                      setAddStep('otp');
                                      setAddPreAuthToken(res.preAuthToken);
                                      setAddOtp('');
                                      setAddUseBackup(false);
                                      return;
                                    }
                                    if (!res.ok) return setAddError(res.error || 'Sign in failed.');
                                    setAddAccountOpen(false);
                                    resetAddFlow();
                                  } finally {
                                    setAddBusy(false);
                                  }
                                  return;
                                }

                                if (addStep === 'setup') {
                                  const code = addOtp.trim();
                                  if (!code) return setAddError('Enter the 6-digit code.');
                                  setAddBusy(true);
                                  try {
                                    const res = await onConfirm2FASetupAddAccount({ preAuthToken: addPreAuthToken, token: code });
                                    if (!res.ok) {
                                      const retry = await onAddAccount(addEmail.trim(), addPassword);
                                      if (retry.require2FA && retry.preAuthToken) {
                                        setAddStep('otp');
                                        setAddPreAuthToken(retry.preAuthToken);
                                        setAddOtp('');
                                        setAddUseBackup(false);
                                        return;
                                      }
                                      if (!retry.ok) return setAddError(res.error || retry.error || 'Sign in failed.');
                                      setAddAccountOpen(false);
                                      resetAddFlow();
                                      return;
                                    }
                                    if (res.backupCodes && res.backupCodes.length) {
                                      setAddBackupCodes(res.backupCodes);
                                      setAddStep('backupCodes');
                                      return;
                                    }
                                    setAddAccountOpen(false);
                                    resetAddFlow();
                                  } finally {
                                    setAddBusy(false);
                                  }
                                  return;
                                }

                                if (addStep === 'otp') {
                                  const code = addOtp.trim();
                                  if (!code) return setAddError(addUseBackup ? 'Enter a backup code.' : 'Enter the 6-digit code.');
                                  setAddBusy(true);
                                  try {
                                    const res = await onVerify2FAAddAccount(addPreAuthToken, addUseBackup ? { backupCode: code } : { token: code });
                                    if (!res.ok) return setAddError(res.error || 'Sign in failed.');
                                    setAddAccountOpen(false);
                                    resetAddFlow();
                                  } finally {
                                    setAddBusy(false);
                                  }
                                }
                              }}
                              className="space-y-4"
                            >
                              {addStep === 'form' && (
                                <>
                                  <div>
                                    <div className={cn("text-[11px] font-bold tracking-widest uppercase mb-2", isDark ? "text-white/45" : "text-black/45")}>Email</div>
                                    <div className={cn(
                                      "group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all",
                                      isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20"
                                    )}>
                                      <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                        <Mail size={16} strokeWidth={2.2} />
                                      </div>
                                      <input
                                        value={addEmail}
                                        onChange={(e) => setAddEmail(e.target.value)}
                                        className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                                        placeholder="name@mail.arcbyte.co"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className={cn("text-[11px] font-bold tracking-widest uppercase mb-2", isDark ? "text-white/45" : "text-black/45")}>Password</div>
                                    <div className={cn(
                                      "group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all",
                                      isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20"
                                    )}>
                                      <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                                        <KeyRound size={16} strokeWidth={2.2} />
                                      </div>
                                      <input
                                        value={addPassword}
                                        onChange={(e) => setAddPassword(e.target.value)}
                                        type={addShowPassword ? "text" : "password"}
                                        className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                                        placeholder="Mailbox password"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setAddShowPassword((v) => !v)}
                                        className={cn(
                                          "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                                          isDark ? "text-white/55 hover:text-white hover:bg-white/5" : "text-black/55 hover:text-black hover:bg-black/5"
                                        )}
                                      >
                                        {addShowPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}

                              {addStep === 'setup' && (
                                <>
                                  <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                                    Set up two-factor authentication
                                  </div>
                                  <div className={cn("rounded-2xl border p-4 flex items-center justify-center", isDark ? "bg-[#111111] border-white/10" : "bg-[#F9F9F9] border-black/10")}>
                                    {addQrDataUrl ? <img src={addQrDataUrl} alt="2FA QR" className="w-44 h-44" /> : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void navigator.clipboard?.writeText(addManualKey)}
                                    className={cn("w-full rounded-2xl border px-4 py-3 text-left font-mono text-xs break-all transition-colors", isDark ? "bg-[#111111] border-white/10 hover:bg-[#1A1A1A] text-white/80" : "bg-white border-black/10 hover:bg-[#F6F6F6] text-black/80")}
                                  >
                                    {addManualKey}
                                  </button>
                                  <SixDigitCodeInput value={addOtp} onChange={setAddOtp} disabled={addBusy} autoFocus />
                                </>
                              )}

                              {addStep === 'otp' && (
                                <>
                                  <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                                    Two-factor authentication
                                  </div>
                                  {addUseBackup ? (
                                    <input
                                      value={addOtp}
                                      onChange={(e) => setAddOtp(e.target.value)}
                                      inputMode="text"
                                      className={cn("w-full h-12 rounded-2xl border px-4 bg-transparent outline-none", isDark ? "border-white/10 text-white placeholder-white/20" : "border-black/10 text-black placeholder-black/30")}
                                      placeholder="XXXX-XXXX-XXXX"
                                    />
                                  ) : (
                                    <SixDigitCodeInput value={addOtp} onChange={setAddOtp} disabled={addBusy} autoFocus />
                                  )}
                                  <div className={cn("flex items-center justify-between text-xs", isDark ? "text-white/35" : "text-black/45")}>
                                    <button type="button" onClick={() => { setAddUseBackup((v) => !v); setAddOtp(''); }} className={cn("transition-colors", isDark ? "hover:text-white" : "hover:text-black")}>
                                      {addUseBackup ? 'Use authenticator code' : 'Use backup code'}
                                    </button>
                                  </div>
                                </>
                              )}

                              <button
                                type="submit"
                                disabled={addBusy}
                                className={cn(
                                  "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                                  "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                                )}
                              >
                                {addBusy ? (
                                  <Loader2 className="animate-spin" size={18} />
                                ) : addStep === 'setup' ? (
                                  'Verify & enable'
                                ) : addStep === 'otp' ? (
                                  'Verify'
                                ) : (
                                  'Add account'
                                )}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div
            onClick={() => {
              if (collapsed) return;
              setAccountMenuOpen((v) => !v);
            }}
            className={cn(
              "relative flex items-center gap-3 w-full p-3 rounded-2xl transition-all duration-300 group cursor-pointer overflow-hidden",
              collapsed ? "justify-center p-0 bg-transparent cursor-default" : (isDark ? "bg-[#181818] border border-[#282828] hover:bg-[#1A1A1A]" : "bg-white border border-[#E5E5E5] shadow-sm hover:bg-[#F6F6F6]")
            )}
          >
           
           {/* Avatar */}
           <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px]">
                 <div className={cn("w-full h-full rounded-full flex items-center justify-center overflow-hidden", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                    {activeAccount?.avatarDataUrl ? (
                      <img src={activeAccount.avatarDataUrl} alt={activeEmail} className="w-full h-full object-cover" />
                    ) : (
                      <span className={cn("font-bold", isDark ? "text-white" : "text-black")}>{activeInitial}</span>
                    )}
                 </div>
              </div>
              <div className={cn("absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#1DB954] border-2 rounded-full z-10", isDark ? "border-[#121212]" : "border-white")} />
           </div>

           {!collapsed && (
             <>
               <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[14px] font-bold truncate", isDark ? "text-white" : "text-black")}>
                      {activeAccount?.name || activeEmail.split('@')[0]}
                    </span>
                  </div>
                  <div className={cn("text-[12px] truncate", isDark ? "text-[#787878]" : "text-[#949494]")}>{activeEmail}</div>
               </div>
               
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onLogoutCurrent();
                 }}
                 className={cn(
                   "p-2 rounded-full transition-colors relative z-10",
                   isDark ? "text-[#5E5E5E] hover:text-[#FF5555] hover:bg-[#282828]" : "text-[#949494] hover:text-[#FF5555] hover:bg-[#F0F0F0]"
                 )}
                 title={t('sign_out')}
               >
                 <LogOut size={16} />
               </button>
             </>
           )}
          </div>
        </div>
      </div>
    </aside>
  );
};

const MailListItem = ({
  thread,
  selected,
  onClick,
}: {
  thread: MailThreadSummary;
  selected: boolean;
  onClick: () => void;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const isExternal = (() => {
    const domainOf = (addr: string) => {
      const at = addr.lastIndexOf('@');
      return at >= 0 ? addr.slice(at + 1).toLowerCase() : '';
    };
    const isArcbyte = (addr: string) => {
      const d = domainOf(addr);
      return d === 'arcbyte.co' || d.endsWith('.arcbyte.co');
    };
    if (thread.folder === 'sent') {
      const tos = Array.isArray(thread.to) ? thread.to : [];
      return tos.some((a) => a && typeof a.address === 'string' && a.address && !isArcbyte(a.address));
    }
    return Boolean(thread.senderEmail && !isArcbyte(thread.senderEmail));
  })();

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 border-b', 
        isDark ? 'border-[#1A1A1A]' : 'border-[#E5E5E5]',
        selected 
          ? (isDark ? 'bg-[#282828]' : 'bg-[#F0F0F0]')
          : (isDark ? 'hover:bg-[#181818] bg-transparent' : 'hover:bg-[#F9F9F9] bg-transparent')
      )}
    >
      {/* Selection Line */}
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1DB954] shadow-[0_0_8px_rgba(29,185,84,0.4)]" />
      )}

      {/* Avatar */}
      <div className="shrink-0 relative">
         <div className={cn(
           "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md",
           thread.unread 
             ? (isDark ? "bg-white text-black" : "bg-black text-white")
             : (isDark ? "bg-[#282828] text-[#B3B3B3]" : "bg-[#E0E0E0] text-[#5E5E5E]")
         )}>
            {thread.sender[0].toUpperCase()}
         </div>
         {thread.unread && (
           <div className={cn("absolute -top-1 -right-1 w-3 h-3 bg-[#1DB954] rounded-full border-2", isDark ? "border-[#121212]" : "border-white")} />
         )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
         <div className="flex items-center justify-between mb-0.5">
            <span className={cn(
              "text-[15px] truncate pr-2",
              thread.unread 
                ? (isDark ? "text-white font-bold" : "text-black font-bold")
                : (isDark ? "text-[#B3B3B3] font-medium" : "text-[#5E5E5E] font-medium")
            )}>
              {thread.sender}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {isExternal && (
                <span className="px-2 h-5 rounded-full text-[10px] font-bold tracking-wide bg-[#FFB86B] text-black flex items-center">
                  {t('external')}
                </span>
              )}
              <span className={cn(
                "text-[12px] shrink-0",
                thread.unread ? "text-[#1DB954] font-medium" : (isDark ? "text-[#5E5E5E]" : "text-[#949494]")
              )}>
                {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
         </div>
         
         <div className={cn(
           "text-[14px] truncate mb-0.5",
           thread.unread 
             ? (isDark ? "text-white font-medium" : "text-black font-medium")
             : (isDark ? "text-[#B3B3B3]" : "text-[#5E5E5E]")
         )}>
           {thread.subject}
         </div>
         
         <div className={cn("text-[13px] truncate flex items-center gap-2", isDark ? "text-[#787878]" : "text-[#949494]")}>
           <span className="truncate">{thread.snippet}</span>
           {thread.folder === 'inbox' && thread.unread && (
             <span className={cn("text-[11px] font-semibold shrink-0", isDark ? "text-[#1DB954]" : "text-[#0B6B2B]")}>
               {t('reply_badge')}
             </span>
           )}
         </div>
      </div>

      {/* Hover Actions */}
      <div className="hidden group-hover:flex items-center gap-1 pl-2">
         <button className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#E0E0E0]")} title={t('archive')}>
           <Archive size={16} />
         </button>
         <button className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-[#FF5555] hover:bg-[#282828]" : "text-[#949494] hover:text-[#FF5555] hover:bg-[#E0E0E0]")} title={t('delete')}>
           <Trash2 size={16} />
         </button>
      </div>
    </div>
  );
};

const ReadingPane = ({
  thread,
  loading,
  onBack,
  showBack,
  onReply,
  onForward,
  isMobile,
  onCompose,
}: {
  thread: MailThreadDetail | null;
  loading: boolean;
  onBack?: () => void;
  showBack: boolean;
  onReply?: () => void;
  onForward?: () => void;
  isMobile: boolean;
  onCompose?: () => void;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [replySnoozeUntil, setReplySnoozeUntil] = useState<number>(0);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  const openAttachment = useCallback(
    async (messageId: string, attachment: MailThreadMessage['attachments'][number], folder: MailFolder) => {
      setAttachmentError(null);
      setAttachmentBusyId(`${messageId}:${attachment.id}`);
      try {
        const res = await api.get(`/mail/threads/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`, {
          params: { folder: MAIL_FOLDER_IMAP_PATH[folder], filename: attachment.filename, size: String(attachment.size) },
          responseType: 'blob',
        });
        const blob = res.data as Blob;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename || `attachment-${attachment.id}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } catch (err) {
        const parseErrorBlob = async (b: Blob) => {
          try {
            const txt = await b.text();
            return JSON.parse(txt) as { code?: string; error?: string };
          } catch {
            return null;
          }
        };
        const response =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: unknown; data?: unknown } }).response
            : undefined;
        const status = response && typeof response.status === 'number' ? response.status : null;
        const data = response?.data;

        if (status === 401) {
          setAttachmentError('Session expired. Please sign in again.');
          return;
        }
        if (status === 404) {
          const base = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
          setAttachmentError(`Attachment not found.${base ? ` (baseURL: ${base})` : ''}`);
          return;
        }
        if (status === 502) {
          if (data instanceof Blob) {
            const parsed = await parseErrorBlob(data);
            if (parsed) {
              setAttachmentError(`Failed to open attachment.${parsed.code ? ` (${parsed.code})` : ''}`);
              return;
            }
          }
          setAttachmentError('Failed to open attachment. Mail server error.');
          return;
        }
        if (data instanceof Blob) {
          const parsed = await parseErrorBlob(data);
          if (parsed) {
            setAttachmentError(`Failed to open attachment.${parsed.error ? ` (${parsed.error})` : ''}${parsed.code ? ` (${parsed.code})` : ''}`);
            return;
          }
        }
        setAttachmentError('Failed to open attachment.');
      } finally {
        setAttachmentBusyId(null);
      }
    },
    []
  );

  const threadId = thread?.id;
  useEffect(() => {
    if (!threadId) return;
    const key = `replyReminderSnoozeUntil:${threadId}`;
    const v = Number(localStorage.getItem(key) || 0);
    setReplySnoozeUntil(Number.isFinite(v) ? v : 0);
  }, [threadId]);

  if (loading) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", isDark ? "bg-[#121212]" : "bg-white")}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#1DB954]/30 border-t-[#1DB954] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className={cn("flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden", isDark ? "bg-[#121212]" : "bg-white")}>
        {/* Background Pattern */}
        {isDark && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1DB954]/5 via-[#121212] to-[#121212] pointer-events-none" />}
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex flex-col items-center"
        >
           {/* Hero Icon */}
           <div className="relative group mb-10">
              <div className="absolute -inset-8 bg-[#1DB954]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className={cn(
                "relative w-40 h-40 rounded-[2.5rem] flex items-center justify-center shadow-2xl border group-hover:scale-105 transition-all duration-500",
                isDark 
                  ? "bg-gradient-to-br from-[#1A1A1A] to-[#0F0F0F] border-[#282828] group-hover:border-[#1DB954]/50 shadow-[0_20px_60px_rgba(0,0,0,0.5)]" 
                  : "bg-white border-[#E5E5E5] group-hover:border-[#1DB954]/50 shadow-[0_20px_40px_rgba(0,0,0,0.1)]"
              )}>
                  <div className={cn("absolute inset-0 rounded-[2.5rem] pointer-events-none", isDark ? "bg-gradient-to-br from-white/5 to-transparent" : "")} />
                  <Inbox size={64} strokeWidth={1} className={cn("transition-colors duration-500 drop-shadow-2xl", isDark ? "text-[#5E5E5E] group-hover:text-[#1DB954]" : "text-[#949494] group-hover:text-[#1DB954]")} />
                  
                  {/* Floating Elements */}

              </div>
           </div>
        
           <h2 className={cn("text-4xl font-bold mb-4 tracking-tight text-center", isDark ? "text-white" : "text-black")}>{t('inbox_ready')}</h2>
           <p className={cn("text-center max-w-md text-lg leading-relaxed mb-10", isDark ? "text-[#787878]" : "text-[#5E5E5E]")}>
             {t('select_conversation')}
           </p>

           {/* Quick Actions */}
           <div className="flex items-center gap-4">
              <button
                onClick={onCompose}
                className="flex items-center gap-3 px-6 py-3 bg-[#1DB954] hover:bg-[#1ED760] text-black rounded-full font-bold transition-transform hover:scale-105 active:scale-95 shadow-[0_8px_20px_rgba(29,185,84,0.3)]"
              >
                 <Pencil size={18} strokeWidth={2.5} />
                 <span>{t('compose_new')}</span>
              </button>
              <div className={cn("flex items-center gap-3 px-6 py-3 border rounded-full", isDark ? "bg-[#1A1A1A] border-[#282828] text-[#B3B3B3]" : "bg-white border-[#E5E5E5] text-[#5E5E5E]")}>
                 <span className="font-mono text-sm">{t('press')}</span>
                 <kbd className={cn("h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded border font-mono text-xs font-bold", isDark ? "bg-[#282828] border-[#333] text-white" : "bg-[#F0F0F0] border-[#E0E0E0] text-black")}>C</kbd>
              </div>
           </div>
        </motion.div>
      </div>
    );
  }

  const domainOf = (addr: string) => {
    const at = addr.lastIndexOf('@');
    return at >= 0 ? addr.slice(at + 1).toLowerCase() : '';
  };
  const isArcbyteAddress = (addr: string) => {
    const d = domainOf(addr);
    return d === 'arcbyte.co' || d.endsWith('.arcbyte.co');
  };
  const threadIsExternal = (() => {
    if (!thread) return false;
    if (thread.folder === 'sent') {
      for (const m of thread.messages) {
        for (const a of [...m.to, ...m.cc, ...m.bcc]) {
          if (a && typeof a.address === 'string' && a.address && !isArcbyteAddress(a.address)) return true;
        }
      }
      return false;
    }
    for (const m of thread.messages) {
      if (m.fromAddress && !isArcbyteAddress(m.fromAddress)) return true;
    }
    return false;
  })();

  return (
    <div className={cn("flex-1 flex flex-col h-full relative overflow-hidden", isDark ? "bg-[#121212]" : "bg-white")}>
      {/* Spotify Gradient Overlay */}
      {isDark && (
        <div
          className={cn(
            "absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b to-transparent pointer-events-none z-0",
            threadIsExternal ? "from-[#FFB86B]/10 via-[#FFB86B]/[0.02]" : "from-[#1DB954]/10 via-[#1DB954]/[0.02]"
          )}
        />
      )}
      
      {/* Toolbar */}
      <div className={cn(
        "h-16 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-xl sticky top-0 z-10",
        isDark ? "border-[#282828] bg-[#121212]/80" : "border-[#E5E5E5] bg-white/80"
      )}>
        <div className="flex items-center gap-4">
          {showBack && (
            <button onClick={onBack} className={cn("p-2 -ml-2 rounded-full", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")}>
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onReply}
              className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")}
              title={t('reply')}
            >
              <Reply size={18} />
            </button>
            <button
              onClick={onForward}
              className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")}
              title={t('forward')}
            >
              <Forward size={18} />
            </button>
            <button className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")} title={t('archive')}>
              <Archive size={18} />
            </button>
            <button className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-[#FF5555] hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-[#FF5555] hover:bg-[#F0F0F0]")} title={t('delete')}>
              <Trash2 size={18} />
            </button>
            <button className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")} title={t('mark_unread')}>
              <Clock size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <span className={cn("text-xs mr-2", isDark ? "text-[#5E5E5E]" : "text-[#949494]")}>{t('conversation')}</span>
           <button className={cn("p-2 rounded-full", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")}>
             <MoreVertical size={18} />
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 relative z-10">
        <div className={cn("pb-20", isMobile ? "max-w-none mx-0" : "max-w-3xl mx-auto")}>
          {/* Subject */}
          <div className="flex items-start justify-between gap-4 mb-6 md:mb-8">
             <h1 className={cn(isMobile ? "text-[22px]" : "text-[28px]", "font-bold leading-tight", isDark ? "text-white" : "text-black")}>
               {thread.subject}
             </h1>
             <button className={cn("shrink-0 p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-[#1DB954] hover:bg-[#282828]" : "text-[#5E5E5E] hover:text-[#1DB954] hover:bg-[#F0F0F0]")}>
               <Star size={20} />
             </button>
          </div>

          {thread.folder === 'inbox' && thread.messages.some(m => !m.flags.seen) && Date.now() > replySnoozeUntil && (
            <div
              className={cn(
                "mb-6 rounded-full px-5 py-3 flex items-center justify-between gap-4 border",
                isDark ? "bg-[#121212] border-[#1F1F1F] text-white" : "bg-white border-[#E5E5E5] text-black"
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t('reply_reminder')}</div>
                <div className={cn("text-xs truncate max-w-[480px]", isDark ? "text-white/50" : "text-black/50")}>
                  {t('reply_reminder_desc', { count: '1' })}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                <button
                  onClick={() => {
                    const until = Date.now() + 30 * 60 * 1000;
                    localStorage.setItem(`replyReminderSnoozeUntil:${thread.id}`, String(until));
                    setReplySnoozeUntil(until);
                  }}
                  className={cn(
                    "px-4 h-9 rounded-full text-xs font-semibold transition-colors whitespace-nowrap",
                    isDark ? "bg-transparent text-white/80 border border-[#2A2A2A] hover:bg-[#1A1A1A]" : "bg-transparent text-black/70 border border-[#E5E5E5] hover:bg-[#F7F7F7]"
                  )}
                >
                  {t('remind_later')}
                </button>
                <button
                  onClick={onReply}
                  className="px-4 h-9 rounded-full text-xs font-semibold bg-[#1DB954] hover:bg-[#1ED760] text-black whitespace-nowrap"
                >
                  {t('reply_now')}
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-8">
            {thread.messages.map((msg, idx) => {
               const isLast = idx === thread.messages.length - 1;
               const senderInitial = (msg.fromName || msg.fromAddress || '?')[0].toUpperCase();
               const isExpanded = expandedMsgId === msg.id;
               const isExternal = (() => {
                 const domainOf = (addr: string) => {
                   const at = addr.lastIndexOf('@');
                   return at >= 0 ? addr.slice(at + 1).toLowerCase() : '';
                 };
                 const isArcbyte = (addr: string) => {
                   const d = domainOf(addr);
                   return d === 'arcbyte.co' || d.endsWith('.arcbyte.co');
                 };
                 if (thread.folder === 'sent') {
                   const all = [...msg.to, ...msg.cc, ...msg.bcc];
                   return all.some((a) => a && typeof a.address === 'string' && a.address && !isArcbyte(a.address));
                 }
                 return Boolean(msg.fromAddress && !isArcbyte(msg.fromAddress));
               })();
               
               return (
                 <div key={msg.id} className={cn("group transition-all duration-300", !isLast && "opacity-60 hover:opacity-100")}>
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border", isDark ? "bg-gradient-to-b from-[#333] to-[#181818] text-white border-[#282828]" : "bg-gradient-to-b from-[#F5F5F5] to-white text-black border-[#E5E5E5]")}>
                            {senderInitial}
                          </div>
                          <div>
                             <div className="flex items-baseline justify-between gap-3">
                               <div className="min-w-0 flex items-center gap-2">
                                 <span className={cn("text-[15px] font-bold truncate", isDark ? "text-white" : "text-black")}>
                                   {msg.fromName || msg.fromAddress}
                                 </span>
                                 {isExternal && (
                                   <span
                                     className="px-2 h-5 rounded-full text-[10px] font-bold tracking-wide bg-[#FFB86B] text-black shrink-0 flex items-center"
                                   >
                                     {t('external')}
                                   </span>
                                 )}
                                 <button
                                   onClick={() => setExpandedMsgId((prev) => (prev === msg.id ? null : msg.id))}
                                   className={cn(
                                     "p-1.5 rounded-full transition-colors shrink-0",
                                     isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]"
                                   )}
                                   aria-expanded={isExpanded}
                                 >
                                   <ChevronRight size={16} className={cn("transition-transform", isExpanded && "rotate-90")} />
                                 </button>
                               </div>
                               <span className={cn("text-[12px] shrink-0", isDark ? "text-[#787878]" : "text-[#949494]")}>
                                 {new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                               </span>
                             </div>
                             <AnimatePresence initial={false}>
                               {isExpanded && (
                                 <motion.div
                                   initial={{ opacity: 0, y: -4 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -4 }}
                                   className={cn(
                                     "mt-2 w-full max-w-full rounded-xl border px-4 py-3 text-[12px] leading-relaxed overflow-hidden",
                                     isDark ? "bg-[#181818] border-[#282828] text-[#EAEAEA]" : "bg-white border-[#E5E5E5] text-[#121212]"
                                   )}
                                 >
                                   <div className={cn("flex gap-2 min-w-0", isDark ? "text-white/70" : "text-black/70")}>
                                     <span className="shrink-0 font-semibold">From:</span>
                                     <span className="min-w-0 break-words break-all whitespace-normal">
                                       {msg.fromName ? `${msg.fromName} <${msg.fromAddress || ''}>` : (msg.fromAddress || '')}
                                     </span>
                                   </div>
                                   <div className={cn("flex gap-2 mt-1 min-w-0", isDark ? "text-white/70" : "text-black/70")}>
                                     <span className="shrink-0 font-semibold">To:</span>
                                     <span className="min-w-0 break-words break-all whitespace-normal">{msg.to.map(t => t.name || t.address).join(', ')}</span>
                                   </div>
                                   {msg.cc.length > 0 && (
                                     <div className={cn("flex gap-2 mt-1 min-w-0", isDark ? "text-white/70" : "text-black/70")}>
                                       <span className="shrink-0 font-semibold">Cc:</span>
                                       <span className="min-w-0 break-words break-all whitespace-normal">{msg.cc.map(t => t.name || t.address).join(', ')}</span>
                                     </div>
                                   )}
                                   {msg.bcc.length > 0 && (
                                     <div className={cn("flex gap-2 mt-1 min-w-0", isDark ? "text-white/70" : "text-black/70")}>
                                       <span className="shrink-0 font-semibold">Bcc:</span>
                                       <span className="min-w-0 break-words break-all whitespace-normal">{msg.bcc.map(t => t.name || t.address).join(', ')}</span>
                                     </div>
                                   )}
                                 </motion.div>
                               )}
                             </AnimatePresence>
                          </div>
                       </div>
                       
                    </div>
                    
                    <div className={cn(isMobile ? "pl-0" : "pl-14")}>
                       {msg.html ? (
                         <EmailHtmlFrame html={msg.html} isDark={isDark} />
                       ) : (
                         <div className={cn("text-[15px] leading-relaxed space-y-4 font-sans whitespace-pre-wrap", isDark ? "text-[#EAEAEA]" : "text-[#121212]")}>
                           {msg.text || ''}
                         </div>
                       )}
                       
                       {attachmentError && (
                         <div className={cn("mt-4 px-4 py-3 rounded-xl border text-sm font-medium", isDark ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700")}>
                           {attachmentError}
                         </div>
                       )}

                       {msg.attachments.length > 0 && (
                         <div className="mt-6 flex flex-wrap gap-3">
                           {msg.attachments.map(att => (
                             <div
                               key={att.id}
                               onClick={() => openAttachment(msg.id, att, thread.folder)}
                               className={cn(
                               "flex items-center gap-3 p-3 pr-4 rounded-xl border transition-all cursor-pointer group/att",
                               isDark ? "bg-[#181818] border-[#282828] hover:bg-[#222] hover:border-[#333]" : "bg-white border-[#E5E5E5] hover:bg-[#F9F9F9] hover:border-[#D4D4D4]"
                             )}
                             >
                               <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isDark ? "bg-[#282828]" : "bg-[#F0F0F0]")}>
                                  <FileText size={20} className={cn("group-hover/att:text-[#1DB954]", isDark ? "text-[#B3B3B3]" : "text-[#5E5E5E]")} />
                               </div>
                               <div className="flex flex-col">
                                 <span className={cn("text-[13px] font-medium truncate max-w-[150px]", isDark ? "text-white" : "text-black")}>{att.filename}</span>
                                 <span className={cn("text-[11px]", isDark ? "text-[#787878]" : "text-[#949494]")}>{(att.size / 1024).toFixed(1)} KB</span>
                               </div>
                               {attachmentBusyId === `${msg.id}:${att.id}` && (
                                 <span className="ml-2 w-4 h-4 border-2 border-[#1DB954]/30 border-t-[#1DB954] rounded-full animate-spin" />
                               )}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
               );
            })}
          </div>

          <div
            className={cn(
              "mt-10 pt-8 border-t flex items-center gap-3 w-full",
              isMobile ? "justify-center" : "justify-start",
              isDark ? "border-[#282828]" : "border-[#E5E5E5]"
            )}
          >
            <button
              onClick={onReply}
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all hover:scale-105 active:scale-95",
                isMobile && "px-4 flex-1 max-w-[180px]",
                isDark ? "bg-[#1A1A1A] text-white hover:bg-[#222] border border-[#282828]" : "bg-white text-black hover:bg-[#F9F9F9] border border-[#E5E5E5]"
              )}
            >
              <Reply size={16} strokeWidth={2.5} />
              <span>{t('reply')}</span>
            </button>
            <button
              onClick={onForward}
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all hover:scale-105 active:scale-95",
                isMobile && "px-4 flex-1 max-w-[180px]",
                isDark ? "bg-[#1A1A1A] text-white hover:bg-[#222] border border-[#282828]" : "bg-white text-black hover:bg-[#F9F9F9] border border-[#E5E5E5]"
              )}
            >
              <Forward size={16} strokeWidth={2.5} />
              <span>{t('forward')}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

const EmailHtmlFrame = ({ html, isDark }: { html: string; isDark: boolean }) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [heightPx, setHeightPx] = useState<number>(520);

  const computeHeight = useCallback(() => {
    const el = frameRef.current;
    const doc = el?.contentDocument;
    const body = doc?.body;
    if (!el || !doc || !body) return;
    const next = Math.max(240, Math.min(900, body.scrollHeight + 16));
    setHeightPx(next);
  }, []);

  const srcDoc = useMemo(() => {
    const isArcbyteEmail = /data-arcbyte-email/i.test(html);
    const shouldInvert = isDark && !isArcbyteEmail;
    const baseBg = shouldInvert ? '#EDEDED' : isDark ? '#121212' : '#ffffff';
    const baseText = shouldInvert ? '#121212' : isDark ? '#EDEDED' : '#121212';
    const baseBorder = shouldInvert ? '#e5e5e5' : '#2a2a2a';
    const arcbyteForcedThemeCss = isArcbyteEmail
      ? isDark
        ? `
          [data-arcbyte-email].bg { background:#121212 !important; }
          [data-arcbyte-email] .pill { background:#0F0F0F !important; border-color: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.72) !important; }
          [data-arcbyte-email] .card { background:#0B0B0B !important; border-color: rgba(255,255,255,0.10) !important; }
          [data-arcbyte-email] .chip { background:#111111 !important; border-color: rgba(255,255,255,0.08) !important; }
          [data-arcbyte-email] .chipTitle { color: rgba(255,255,255,0.50) !important; }
          [data-arcbyte-email] .title { color:#FFFFFF !important; }
          [data-arcbyte-email] .muted { color: rgba(255,255,255,0.62) !important; }
          [data-arcbyte-email] .label { color: rgba(255,255,255,0.55) !important; }
          [data-arcbyte-email] .value { color:#FFFFFF !important; }
          [data-arcbyte-email] .tableHeader { background:#0F0F0F !important; color: rgba(255,255,255,0.55) !important; }
          [data-arcbyte-email] .tableCell { background:#0B0B0B !important; }
          [data-arcbyte-email] .fineprint { color: rgba(255,255,255,0.40) !important; }
          [data-arcbyte-email] .brand { color: rgba(255,255,255,0.28) !important; }
        `
        : `
          [data-arcbyte-email].bg { background:#F4F5F7 !important; }
          [data-arcbyte-email] .pill { background:#FFFFFF !important; border-color: rgba(0,0,0,0.10) !important; color: rgba(0,0,0,0.60) !important; }
          [data-arcbyte-email] .card { background:#FFFFFF !important; border-color: rgba(0,0,0,0.12) !important; }
          [data-arcbyte-email] .chip { background:#F7F8FA !important; border-color: rgba(0,0,0,0.08) !important; }
          [data-arcbyte-email] .chipTitle { color: rgba(0,0,0,0.55) !important; }
          [data-arcbyte-email] .title { color:#0B0B0B !important; }
          [data-arcbyte-email] .muted { color: rgba(0,0,0,0.62) !important; }
          [data-arcbyte-email] .label { color: rgba(0,0,0,0.55) !important; }
          [data-arcbyte-email] .value { color:#0B0B0B !important; }
          [data-arcbyte-email] .tableHeader { background:#F0F1F3 !important; color: rgba(0,0,0,0.55) !important; }
          [data-arcbyte-email] .tableCell { background:#FFFFFF !important; }
          [data-arcbyte-email] .fineprint { color: rgba(0,0,0,0.45) !important; }
          [data-arcbyte-email] .brand { color: rgba(0,0,0,0.30) !important; }
        `
      : '';
    const css = `
      html, body { margin: 0; padding: 0; }
      body { background: ${baseBg}; color: ${baseText}; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 15px; line-height: 1.65; padding: 16px; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      pre { white-space: pre-wrap; word-break: break-word; }
      blockquote { margin: 12px 0; padding-left: 12px; border-left: 2px solid ${baseBorder}; }
      hr { border: 0; border-top: 1px solid ${baseBorder}; margin: 16px 0; }
      ${''}
      ${arcbyteForcedThemeCss}
    `;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>${css}</style>
  </head>
  <body>${html}</body>
</html>`;
  }, [html, isDark]);

  return (
    <div className={cn("rounded-2xl border overflow-hidden", isDark ? "border-[#282828] bg-[#181818]" : "border-[#E5E5E5] bg-white")}>
      <iframe
        ref={frameRef}
        title="message"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        className="w-full block"
        style={{
          height: `${heightPx}px`,
          maxHeight: '70vh',
          filter: isDark && !/data-arcbyte-email/i.test(html) ? 'invert(1) hue-rotate(180deg)' : undefined,
          background: isDark ? ( /data-arcbyte-email/i.test(html) ? '#121212' : '#EDEDED') : '#ffffff',
        }}
        srcDoc={srcDoc}
        onLoad={() => {
          computeHeight();
          window.setTimeout(computeHeight, 250);
          window.setTimeout(computeHeight, 1200);
        }}
      />
    </div>
  );
};

const ComposeModal = ({
  isMobile,
  onClose,
  initialDraft,
  onSent,
}: {
  isMobile: boolean;
  onClose: () => void;
  initialDraft?: ComposeDraft;
  onSent?: (folder: MailFolder, payload: { to: string[]; subject: string; html: string; text: string; date: string }) => void;
}) => {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [to, setTo] = useState(() => initialDraft?.to || '');
  const [cc, setCc] = useState(() => initialDraft?.cc || '');
  const [bcc, setBcc] = useState(() => initialDraft?.bcc || '');
  const [subject, setSubject] = useState(() => initialDraft?.subject || '');
  const [body, setBody] = useState(() => initialDraft?.body || '');
  const [showCcBcc, setShowCcBcc] = useState(() => Boolean(initialDraft?.showCcBcc));
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const handleSend = async () => {
    if (sending) return;
    setSendError(null);
    const toList = to.split(/[,\s]+/).filter(Boolean);
    const ccList = cc.split(/[,\s]+/).filter(Boolean);
    const bccList = bcc.split(/[,\s]+/).filter(Boolean);

    if (!toList.length || !subject.trim()) {
      setSendError('Add at least one recipient and a subject.');
      return;
    }
    
    setSending(true);
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = body;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      const identity = (() => {
        const name = String(localStorage.getItem('userName') || '').trim();
        const activeId = String(localStorage.getItem('activeMailAccountId') || '').trim();
        const raw = localStorage.getItem('mailAccounts');
        if (!raw) return { fromName: name || undefined, fromAvatarDataUrl: undefined as string | undefined };
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return { fromName: name || undefined, fromAvatarDataUrl: undefined };
          const acc = parsed.find((a) => a && typeof a === 'object' && 'id' in a && String((a as { id?: unknown }).id) === activeId) as
            | { avatarDataUrl?: unknown }
            | undefined;
          const avatar = acc && typeof acc.avatarDataUrl === 'string' ? acc.avatarDataUrl : undefined;
          const safeAvatar = avatar && avatar.length <= 200_000 ? avatar : undefined;
          return { fromName: name || undefined, fromAvatarDataUrl: safeAvatar };
        } catch {
          return { fromName: name || undefined, fromAvatarDataUrl: undefined };
        }
      })();

      await api.post('/mail/send', {
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: subject.trim(),
        html: body,
        text: plainText,
        fromName: identity.fromName,
        fromAvatarDataUrl: identity.fromAvatarDataUrl,
      });
      // const savedTo = (resp?.data && typeof resp.data === 'object' && 'savedTo' in resp.data) ? (resp.data.savedTo as string | null) : null;
      onSent?.('sent', { to: toList, subject: subject.trim(), html: body, text: plainText, date: new Date().toISOString() });
      onClose();
      } catch (err) {
      const response =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: unknown; data?: unknown } }).response
          : undefined;
      const status = response && typeof response.status === 'number' ? response.status : null;
      const data = response?.data ?? null;
      const errorCode =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null;
      const detailCode =
        data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : null;
        const detailText =
          data &&
          typeof data === 'object' &&
          'details' in data &&
          data.details &&
          typeof data.details === 'object' &&
          'message' in data.details &&
          typeof (data.details as { message?: unknown }).message === 'string'
            ? String((data.details as { message?: string }).message)
            : null;

      if (status === 401) {
        setSendError('Invalid mailbox credentials.');
        return;
      }
      if (status === 403 && (errorCode === 'csrf_required' || errorCode === 'csrf_invalid')) {
        setSendError('Session expired. Please sign in again.');
        return;
      }
      if (status === 400 && errorCode === 'invalid_payload') {
        setSendError('Add at least one recipient and a subject.');
        return;
      }
      if (status === 502 && errorCode === 'smtp_error') {
        setSendError(`Failed to send.${detailCode ? ` (${detailCode})` : ''}${detailText ? ` — ${detailText}` : ''}`);
        return;
      }
      if (status === 502) {
        setSendError('Failed to send. Mail server error.');
        return;
      }
      setSendError('Failed to send. Verify SMTP access and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-lg", isDark ? "bg-black/80" : "bg-white/60")}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={cn(
            "w-full max-w-3xl border rounded-2xl overflow-hidden flex flex-col relative",
            isMobile ? "h-full rounded-none" : "min-h-[650px] max-h-[90vh]",
            isDark ? "bg-[#121212] border-[#282828] shadow-[0_50px_100px_rgba(0,0,0,0.8)]" : "bg-white border-[#E5E5E5] shadow-[0_50px_100px_rgba(0,0,0,0.1)]"
          )}
        >
          {/* Green Glow Top */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#1DB954] to-[#1ED760]" />
          <div className="absolute top-0 inset-x-0 h-32 bg-[#1DB954]/10 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className={cn("flex items-center justify-between px-8 py-5 border-b backdrop-blur-md relative z-10", isDark ? "border-[#282828] bg-[#121212]/90" : "border-[#E5E5E5] bg-white/90")}>
            <span className={cn("text-lg font-bold tracking-tight", isDark ? "text-white" : "text-black")}>{t('new_message')}</span>
            <button 
              onClick={onClose} 
              className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Body */}
          <div className={cn("flex-1 flex flex-col relative z-10 overflow-y-auto min-h-0", isDark ? "bg-[#121212]" : "bg-white")}>
            {sendError && (
              <div className={cn("px-8 pt-4 shrink-0", isDark ? "bg-[#121212]" : "bg-white")}>
                <div className={cn(
                  "w-full px-4 py-3 rounded-xl border text-sm font-medium",
                  isDark ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                )}>
                  {sendError}
                </div>
              </div>
            )}
            <div className={cn("px-8 pt-4 pb-2 shrink-0", isDark ? "bg-[#121212]" : "bg-white")}>
              <div className={cn("flex items-center border-b relative group transition-colors focus-within:border-[#1DB954]/50", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
                <span className={cn("text-[14px] font-medium w-16 py-4", isDark ? "text-[#787878]" : "text-[#949494]")}>{t('to')}</span>
                <input
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className={cn("flex-1 bg-transparent border-none py-4 text-[15px] placeholder:text-[#333] focus:ring-0 focus:outline-none", isDark ? "text-white" : "text-black")}
                  placeholder={t('recipients_placeholder')}
                  autoFocus
                />
                {!showCcBcc && (
                  <button 
                    onClick={() => setShowCcBcc(true)}
                    className={cn("absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium hover:text-[#1DB954] px-2 py-1 rounded transition-colors", isDark ? "text-[#787878] hover:bg-[#1A1A1A]" : "text-[#949494] hover:bg-[#F0F0F0]")}
                  >
                    Cc/Bcc
                  </button>
                )}
              </div>

              {showCcBcc && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className={cn("flex items-center border-b focus-within:border-[#1DB954]/50 transition-colors", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
                    <span className={cn("text-[14px] font-medium w-16 py-3", isDark ? "text-[#787878]" : "text-[#949494]")}>{t('cc')}</span>
                    <input
                      value={cc}
                      onChange={e => setCc(e.target.value)}
                      className={cn("flex-1 bg-transparent border-none py-3 text-[14px] placeholder:text-[#333] focus:ring-0 focus:outline-none", isDark ? "text-white" : "text-black")}
                    />
                  </div>
                  <div className={cn("flex items-center border-b focus-within:border-[#1DB954]/50 transition-colors", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
                    <span className={cn("text-[14px] font-medium w-16 py-3", isDark ? "text-[#787878]" : "text-[#949494]")}>{t('bcc')}</span>
                    <input
                      value={bcc}
                      onChange={e => setBcc(e.target.value)}
                      className={cn("flex-1 bg-transparent border-none py-3 text-[14px] placeholder:text-[#333] focus:ring-0 focus:outline-none", isDark ? "text-white" : "text-black")}
                    />
                  </div>
                </motion.div>
              )}

              <div className="flex items-center focus-within:border-[#1DB954]/50 transition-colors border-b border-transparent">
                <span className={cn("text-[14px] font-medium w-16 py-4", isDark ? "text-[#787878]" : "text-[#949494]")}>{t('subject')}</span>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className={cn("flex-1 bg-transparent border-none py-4 text-[15px] font-bold placeholder:text-[#333] focus:ring-0 focus:outline-none", isDark ? "text-white" : "text-black")}
                  placeholder={t('subject_placeholder')}
                />
              </div>
            </div>

            <div className={cn("flex-1 flex flex-col min-h-0", isDark ? "bg-[#121212]" : "bg-white")}>
               <RichTextEditor
                 value={body}
                 onChange={setBody}
                 placeholder={t('body_placeholder')}
                 isDark={isDark}
                 className="flex-1"
               />
            </div>
          </div>

          {/* Footer */}
          <div className={cn("px-8 py-5 border-t flex items-center justify-between relative z-10", isDark ? "border-[#282828] bg-[#121212]" : "border-[#E5E5E5] bg-white")}>
             <button 
               onClick={onClose}
               className={cn("p-2.5 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-[#FF5555] hover:bg-[#1A1A1A]" : "text-[#5E5E5E] hover:text-[#FF5555] hover:bg-[#F0F0F0]")} title={t('delete_draft')}
             >
               <Trash2 size={20} />
             </button>
             
             <button
               onClick={handleSend}
               disabled={sending}
               className="pl-8 pr-8 py-3 bg-[#1DB954] hover:bg-[#1ED760] text-black text-[15px] font-bold rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_8px_20px_rgba(29,185,84,0.3)] hover:shadow-[0_12px_30px_rgba(29,185,84,0.4)]"
             >
               {sending ? (
                 <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/> 
                    <span>{t('sending')}</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-2">
                    <span>{t('send')}</span>
                    <Send size={16} strokeWidth={2.5} />
                 </div>
               )}
             </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const MobileNavItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  isDark,
}: {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  isDark: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "relative flex flex-col items-center justify-center w-14 h-full transition-all duration-300",
      isActive
        ? (isDark ? "text-white" : "text-black")
        : (isDark ? "text-[#787878] hover:text-white" : "text-[#949494] hover:text-black")
    )}
  >
    <div
      className={cn(
        "absolute -top-1 w-8 h-1 rounded-b-full bg-[#1DB954] transition-all duration-300",
        isActive ? "opacity-100 shadow-[0_2px_10px_#1DB954]" : "opacity-0 -translate-y-2"
      )}
    />

    <Icon
      size={22}
      strokeWidth={isActive ? 2.5 : 2}
      className={cn("transition-transform duration-300", isActive && "scale-110")}
    />
    <span
      className={cn(
        "text-[10px] font-medium mt-1 transition-all duration-300",
        isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden"
      )}
    >
      {label}
    </span>
  </button>
);

const MobileNav = ({
  activeFolder,
  onFolderChange,
  onCompose,
  profileActive,
  onOpenProfile,
}: {
  activeFolder: MailFolder;
  onFolderChange: (f: MailFolder) => void;
  onCompose: () => void;
  profileActive: boolean;
  onOpenProfile: () => void;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <>
    <div className="fixed bottom-6 inset-x-4 z-40 flex justify-center">
      <div className={cn(
        "w-full max-w-md h-16 rounded-2xl flex items-center justify-between px-6 backdrop-blur-xl border shadow-2xl relative",
        isDark 
          ? "bg-[#121212]/85 border-[#282828] shadow-black/50" 
          : "bg-white/85 border-[#E5E5E5] shadow-black/10"
      )}>
        <MobileNavItem 
          icon={Inbox} 
          label={t('inbox')} 
          isActive={!profileActive && activeFolder === 'inbox'} 
          onClick={() => onFolderChange('inbox')}
          isDark={isDark}
        />
        
        <MobileNavItem 
          icon={Send} 
          label={t('sent')} 
          isActive={!profileActive && activeFolder === 'sent'} 
          onClick={() => onFolderChange('sent')}
          isDark={isDark}
        />

        {/* Floating Compose Button */}
        <div className="relative -top-6">
           <div className={cn(
             "absolute inset-0 rounded-full blur-xl opacity-40 bg-[#1DB954]"
           )} />
           <button 
             onClick={onCompose}
             className="relative w-14 h-14 bg-gradient-to-tr from-[#1DB954] to-[#1ED760] rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(29,185,84,0.3)] text-black transition-transform active:scale-95 group border-4 border-transparent bg-clip-padding"
             style={{ borderColor: isDark ? '#000' : '#fff' }}
           >
             <Pencil size={24} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform duration-300" />
           </button>
        </div>

        <MobileNavItem 
          icon={FileText} 
          label={t('drafts')} 
          isActive={!profileActive && activeFolder === 'drafts'} 
          onClick={() => onFolderChange('drafts')}
          isDark={isDark}
        />
        
        <MobileNavItem
          icon={UserRound}
          label="Profile"
          isActive={profileActive}
          onClick={onOpenProfile}
          isDark={isDark}
        />
      </div>
    </div>
    </>
  );
};

const MobileProfileSection = ({
  accounts,
  activeAccountId,
  onClose,
  onSwitchAccount,
  onLogoutAccount,
  onUpdateAccountProfile,
  onAddAccount,
  onVerify2FAAddAccount,
  onConfirm2FASetupAddAccount,
  onLogoutCurrent,
}: {
  accounts: { id: string; email: string; name: string; avatarDataUrl?: string }[];
  activeAccountId: string | null;
  onClose: () => void;
  onSwitchAccount: (id: string) => void;
  onLogoutAccount: (id: string) => void;
  onUpdateAccountProfile: (id: string, updates: { displayName?: string; avatarDataUrl?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  onAddAccount: (email: string, password: string) => Promise<{ ok: boolean; error?: string; require2FA?: boolean; require2FASetup?: boolean; preAuthToken?: string; qrDataUrl?: string; manualKey?: string }>;
  onVerify2FAAddAccount: (preAuthToken: string, params: { token?: string; backupCode?: string }) => Promise<{ ok: boolean; error?: string }>;
  onConfirm2FASetupAddAccount: (params: { preAuthToken: string; token: string }) => Promise<{ ok: boolean; error?: string; backupCodes?: string[] }>;
  onLogoutCurrent: () => void;
}) => {
  const { isDark } = useTheme();
  const active = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  const [displayName, setDisplayName] = useState(active?.name || '');
  const [draftAvatar, setDraftAvatar] = useState<string | null | undefined>(undefined);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addShow, setAddShow] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<'form' | 'otp' | 'setup' | 'backupCodes'>('form');
  const [addPreAuthToken, setAddPreAuthToken] = useState('');
  const [addQrDataUrl, setAddQrDataUrl] = useState('');
  const [addManualKey, setAddManualKey] = useState('');
  const [addOtp, setAddOtp] = useState('');
  const [addUseBackup, setAddUseBackup] = useState(false);
  const [addBackupCodes, setAddBackupCodes] = useState<string[] | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; email: string } | null>(null);
  const addSectionRef = useRef<HTMLDivElement | null>(null);
  const addEmailRef = useRef<HTMLInputElement | null>(null);
  const prevActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextId = active?.id || null;
    if (prevActiveIdRef.current === nextId) return;
    prevActiveIdRef.current = nextId;
    setDisplayName(active?.name || '');
    setDraftAvatar(undefined);
    setSaveError(null);
    setPhotoError(null);
  }, [active?.id, active?.name]);

  const effectiveAvatar = draftAvatar === undefined ? (active?.avatarDataUrl || null) : draftAvatar;
  const hasUnsaved =
    Boolean(activeAccountId) &&
    ((displayName || '').trim() !== (active?.name || '').trim() || draftAvatar !== undefined);

  const resetAddFlow = () => {
    setAddStep('form');
    setAddPreAuthToken('');
    setAddQrDataUrl('');
    setAddManualKey('');
    setAddOtp('');
    setAddUseBackup(false);
    setAddBackupCodes(null);
    setAddError(null);
    setAddBusy(false);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors border",
              isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]"
            )}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className={cn("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-black")}>Profile</div>
            <div className={cn("text-sm mt-0.5 truncate", isDark ? "text-white/55" : "text-black/55")}>Edit name & photo.</div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        <div className={cn("rounded-3xl border overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#1A1A1A]" : "bg-white border-[#E5E5E5]")}>
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px] shrink-0">
                <div className={cn("w-full h-full rounded-full overflow-hidden flex items-center justify-center", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                  {effectiveAvatar ? (
                    <img src={effectiveAvatar} alt={active?.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={cn("font-bold text-xl", isDark ? "text-white" : "text-black")}>{(active?.email || '?')[0].toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[12px] font-bold tracking-widest uppercase truncate", isDark ? "text-white/45" : "text-black/45")}>{active?.email || ''}</div>
                <div className={cn("text-base font-bold mt-1 truncate", isDark ? "text-white" : "text-black")}>{active?.name || ''}</div>
              </div>
            </div>

            {photoError && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {photoError}
              </div>
            )}
            {saveError && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {saveError}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <label
                className={cn(
                  "flex-1 px-3 h-10 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 cursor-pointer border transition-colors",
                  isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]"
                )}
              >
                <ImagePlus size={16} />
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    setPhotoError(null);
                    setSaveError(null);
                    if (!file || !activeAccountId) return;
                    if (!file.type.startsWith('image/')) return setPhotoError('Choose an image file.');
                    if (file.size > 200_000) return setPhotoError('Image is too large. Use a smaller image.');
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = typeof reader.result === 'string' ? reader.result : '';
                      if (!result) return;
                      setDraftAvatar(result);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <button
                onClick={() => {
                  setPhotoError(null);
                  setSaveError(null);
                  if (!activeAccountId) return;
                  setDraftAvatar(null);
                }}
                className={cn(
                  "px-3 h-10 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 transition-colors border",
                  isDark ? "bg-transparent border-[#282828] text-white/70 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                )}
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>

            <div className="mt-4">
              <div className={cn("text-[11px] font-bold tracking-widest uppercase mb-2", isDark ? "text-white/45" : "text-black/45")}>Display name</div>
              <div className={cn("group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all", isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20")}>
                <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                  <UserRound size={16} strokeWidth={2.2} />
                </div>
                <input
                  value={displayName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDisplayName(v);
                  }}
                  className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                  placeholder="Your name"
                />
              </div>
              <button
                disabled={!hasUnsaved || saveBusy || !activeAccountId}
                onClick={async () => {
                  if (!activeAccountId) return;
                  setSaveBusy(true);
                  setSaveError(null);
                  try {
                    const payload: { displayName?: string; avatarDataUrl?: string | null } = {};
                    payload.displayName = displayName;
                    if (draftAvatar !== undefined) payload.avatarDataUrl = draftAvatar;
                    const res = await onUpdateAccountProfile(activeAccountId, payload);
                    if (!res.ok) {
                      setSaveError(res.error || 'Save failed. Please try again.');
                      return;
                    }
                    setDraftAvatar(undefined);
                  } finally {
                    setSaveBusy(false);
                  }
                }}
                className={cn(
                  "mt-3 w-full h-11 rounded-2xl text-[11px] font-extrabold tracking-[0.18em] uppercase border transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                  isDark
                    ? "bg-[#1DB954] text-black border-transparent hover:bg-[#1ED760]"
                    : "bg-[#1DB954] text-black border-transparent hover:bg-[#1ED760]"
                )}
              >
                {saveBusy ? 'Saving' : hasUnsaved ? 'Save changes' : 'Saved'}
              </button>
              <button
                onClick={() => setTwoFAOpen(true)}
                className={cn(
                  "mt-3 w-full h-11 rounded-2xl text-[11px] font-extrabold tracking-[0.18em] uppercase border transition-colors",
                  isDark
                    ? "bg-[#121212] border-[#282828] text-white/85 hover:bg-[#1A1A1A] hover:text-white"
                    : "bg-white border-[#E5E5E5] text-black/80 hover:bg-[#F6F6F6] hover:text-black"
                )}
              >
                Two‑Factor Auth
              </button>
            </div>
          </div>
        </div>

        <div className={cn("rounded-3xl border overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#1A1A1A]" : "bg-white border-[#E5E5E5]")}>
          <div
            className={cn(
              "px-5 py-4 text-[11px] font-bold tracking-widest uppercase flex items-center justify-between",
              isDark ? "text-white/45" : "text-black/45"
            )}
          >
            <span>Accounts</span>
            <button
              onClick={() => {
                resetAddFlow();
                setAddOpen(true);
                window.setTimeout(() => {
                  addSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  window.setTimeout(() => addEmailRef.current?.focus(), 250);
                }, 0);
              }}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-colors border",
                isDark
                  ? "bg-transparent border-[#282828] text-white/55 hover:text-white hover:bg-[#1A1A1A]"
                  : "bg-transparent border-[#E5E5E5] text-black/55 hover:text-black hover:bg-[#F6F6F6]"
              )}
              title="Add account"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="px-3 pb-4 space-y-2">
            {accounts.map((a) => {
              const isActive = a.id === activeAccountId;
              return (
                <div key={a.id} className={cn("flex items-center gap-3 rounded-2xl border px-3 py-3", isDark ? "border-[#1A1A1A] bg-[#111111]" : "border-[#E5E5E5] bg-[#FAFAFA]")}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px] shrink-0">
                    <div className={cn("w-full h-full rounded-full overflow-hidden flex items-center justify-center", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                      {a.avatarDataUrl ? (
                        <img src={a.avatarDataUrl} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className={cn("font-bold", isDark ? "text-white" : "text-black")}>{(a.email || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-[14px] font-bold truncate", isDark ? "text-white" : "text-black")}>{a.name || a.email}</div>
                    <div className={cn("text-[12px] truncate", isDark ? "text-white/50" : "text-black/50")}>{a.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isActive ? (
                      <div className={cn("px-3 h-9 rounded-xl font-bold text-[11px] tracking-widest uppercase flex items-center border", isDark ? "bg-[#121212] border-[#282828] text-[#1DB954]" : "bg-white border-[#E5E5E5] text-[#1DB954]")}>
                        Active
                      </div>
                    ) : (
                      <>
                      <button
                        onClick={() => onSwitchAccount(a.id)}
                        className={cn("px-3 h-9 rounded-xl font-bold text-[12px] transition-colors border", isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]")}
                      >
                        Switch
                      </button>
                    <button
                      onClick={() => setRemoveConfirm({ id: a.id, email: a.email })}
                      className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors border", isDark ? "bg-transparent border-[#282828] text-white/55 hover:text-[#FF5555] hover:bg-[#1A1A1A]" : "bg-transparent border-[#E5E5E5] text-black/55 hover:text-[#FF5555] hover:bg-[#F6F6F6]")}
                    >
                      <X size={16} />
                    </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {removeConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
                onClick={() => setRemoveConfirm(null)}
              />
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="fixed inset-0 z-[90] flex items-center justify-center px-4"
              >
                <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[#FF5555]/85 to-transparent" />
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0", isDark ? "bg-[#121212] border-[#282828]" : "bg-[#F7F7F7] border-[#E5E5E5]")}>
                        <AlertTriangle size={18} className="text-[#FF5555]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-bold tracking-tight">Remove account?</div>
                        <div className={cn("text-sm mt-1", isDark ? "text-white/55" : "text-black/55")}>
                          This logs out {removeConfirm.email}.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6 flex items-center gap-3">
                    <button
                      onClick={() => setRemoveConfirm(null)}
                      className={cn(
                        "flex-1 h-11 rounded-2xl font-bold text-[12px] border transition-colors",
                        isDark ? "bg-transparent border-[#282828] text-white/75 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onLogoutAccount(removeConfirm.id);
                        setRemoveConfirm(null);
                      }}
                      className="flex-1 h-11 rounded-2xl font-bold text-[12px] bg-[#FF5555] hover:bg-[#FF6B6B] text-black transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {addOpen && (
            <motion.div
              ref={addSectionRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className={cn("rounded-3xl border overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#1A1A1A]" : "bg-white border-[#E5E5E5]")}
            >
              <div
                className={cn(
                  "px-5 py-4 text-[11px] font-bold tracking-widest uppercase flex items-center justify-between",
                  isDark ? "text-white/45" : "text-black/45"
                )}
              >
                <span>Add account</span>
                <button
                  onClick={() => {
                    setAddOpen(false);
                    resetAddFlow();
                  }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-colors border",
                    isDark
                      ? "bg-transparent border-[#282828] text-white/55 hover:text-white hover:bg-[#1A1A1A]"
                      : "bg-transparent border-[#E5E5E5] text-black/55 hover:text-black hover:bg-[#F6F6F6]"
                  )}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-5 pb-5">
                {addError && (
                  <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{addError}</div>
                )}
                {addStep === 'form' && (
                  <div className="space-y-3">
                    <div className={cn("group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all", isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20")}>
                      <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                        <Mail size={16} strokeWidth={2.2} />
                      </div>
                      <input
                        ref={addEmailRef}
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                        placeholder="name@mail.arcbyte.co"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className={cn("group flex items-center gap-3 rounded-2xl px-4 h-12 border transition-all", isDark ? "bg-[#111111] border-white/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/25" : "bg-white border-black/10 focus-within:border-[#1DB954]/35 focus-within:ring-1 focus-within:ring-[#1DB954]/20")}>
                      <div className="w-9 h-9 rounded-xl bg-[#1DB954] text-black flex items-center justify-center shrink-0">
                        <KeyRound size={16} strokeWidth={2.2} />
                      </div>
                      <input
                        value={addPassword}
                        onChange={(e) => setAddPassword(e.target.value)}
                        type={addShow ? 'text' : 'password'}
                        className={cn("flex-1 min-w-0 bg-transparent outline-none text-base", isDark ? "text-white placeholder-white/20" : "text-black placeholder-black/30")}
                        placeholder="Mailbox password"
                      />
                      <button
                        type="button"
                        onClick={() => setAddShow((v) => !v)}
                        className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors", isDark ? "text-white/55 hover:text-white hover:bg-white/5" : "text-black/55 hover:text-black hover:bg-black/5")}
                      >
                        {addShow ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      disabled={addBusy}
                      onClick={async () => {
                        setAddError(null);
                        const e = addEmail.trim();
                        const p = addPassword;
                        if (!e || !p) return setAddError('Enter email and password.');
                        setAddBusy(true);
                        try {
                          const res = await onAddAccount(e, p);
                          if (res.require2FASetup && res.preAuthToken && res.qrDataUrl && res.manualKey) {
                            setAddStep('setup');
                            setAddPreAuthToken(res.preAuthToken);
                            setAddQrDataUrl(res.qrDataUrl);
                            setAddManualKey(res.manualKey);
                            setAddOtp('');
                            setAddUseBackup(false);
                            return;
                          }
                          if (res.require2FA && res.preAuthToken) {
                            setAddStep('otp');
                            setAddPreAuthToken(res.preAuthToken);
                            setAddOtp('');
                            setAddUseBackup(false);
                            return;
                          }
                          if (!res.ok) return setAddError(res.error || 'Sign in failed.');
                          setAddEmail('');
                          setAddPassword('');
                          setAddOpen(false);
                          resetAddFlow();
                        } finally {
                          setAddBusy(false);
                        }
                      }}
                      className={cn(
                        "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                        "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      {addBusy ? <Loader2 className="animate-spin" size={18} /> : 'Add account'}
                    </button>
                  </div>
                )}

                {addStep === 'setup' && (
                  <div className="space-y-4">
                    <div className={cn("rounded-2xl border p-4 flex items-center justify-center", isDark ? "bg-[#111111] border-white/10" : "bg-[#F9F9F9] border-black/10")}>
                      {addQrDataUrl ? <img src={addQrDataUrl} alt="2FA QR" className="w-44 h-44" /> : null}
                    </div>
                    <button
                      onClick={() => void navigator.clipboard?.writeText(addManualKey)}
                      className={cn("w-full rounded-2xl border px-4 py-3 text-left font-mono text-xs break-all transition-colors", isDark ? "bg-[#111111] border-white/10 hover:bg-[#1A1A1A] text-white/80" : "bg-white border-black/10 hover:bg-[#F6F6F6] text-black/80")}
                    >
                      {addManualKey}
                    </button>
                    <SixDigitCodeInput value={addOtp} onChange={setAddOtp} disabled={addBusy} autoFocus />
                    <button
                      disabled={addBusy}
                      onClick={async () => {
                        setAddError(null);
                        const code = addOtp.trim();
                        if (!code) return setAddError('Enter the 6-digit code.');
                        setAddBusy(true);
                        try {
                          const res = await onConfirm2FASetupAddAccount({ preAuthToken: addPreAuthToken, token: code });
                          if (!res.ok) {
                            const retry = await onAddAccount(addEmail.trim(), addPassword);
                            if (retry.require2FA && retry.preAuthToken) {
                              setAddStep('otp');
                              setAddPreAuthToken(retry.preAuthToken);
                              setAddOtp('');
                              setAddUseBackup(false);
                              return;
                            }
                            if (!retry.ok) return setAddError(res.error || retry.error || 'Sign in failed.');
                            setAddEmail('');
                            setAddPassword('');
                            setAddOpen(false);
                            resetAddFlow();
                            return;
                          }
                          if (res.backupCodes && res.backupCodes.length) {
                            setAddBackupCodes(res.backupCodes);
                            setAddStep('backupCodes');
                            return;
                          }
                          setAddEmail('');
                          setAddPassword('');
                          setAddOpen(false);
                          resetAddFlow();
                        } finally {
                          setAddBusy(false);
                        }
                      }}
                      className={cn(
                        "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                        "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      {addBusy ? <Loader2 className="animate-spin" size={18} /> : 'Verify & enable'}
                    </button>
                  </div>
                )}

                {addStep === 'otp' && (
                  <div className="space-y-4">
                    <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                      Two-factor authentication
                    </div>
                    {addUseBackup ? (
                      <input
                        value={addOtp}
                        onChange={(e) => setAddOtp(e.target.value)}
                        inputMode="text"
                        className={cn("w-full h-12 rounded-2xl border px-4 bg-transparent outline-none", isDark ? "border-white/10 text-white placeholder-white/20" : "border-black/10 text-black placeholder-black/30")}
                        placeholder="XXXX-XXXX-XXXX"
                      />
                    ) : (
                      <SixDigitCodeInput value={addOtp} onChange={setAddOtp} disabled={addBusy} autoFocus />
                    )}
                    <div className={cn("flex items-center justify-between text-xs", isDark ? "text-white/35" : "text-black/45")}>
                      <button type="button" onClick={() => { setAddUseBackup((v) => !v); setAddOtp(''); }} className={cn("transition-colors", isDark ? "hover:text-white" : "hover:text-black")}>
                        {addUseBackup ? 'Use authenticator code' : 'Use backup code'}
                      </button>
                    </div>
                    <button
                      disabled={addBusy}
                      onClick={async () => {
                        setAddError(null);
                        const code = addOtp.trim();
                        if (!code) return setAddError(addUseBackup ? 'Enter a backup code.' : 'Enter the 6-digit code.');
                        setAddBusy(true);
                        try {
                          const res = await onVerify2FAAddAccount(addPreAuthToken, addUseBackup ? { backupCode: code } : { token: code });
                          if (!res.ok) return setAddError(res.error || 'Sign in failed.');
                          setAddEmail('');
                          setAddPassword('');
                          setAddOpen(false);
                          resetAddFlow();
                        } finally {
                          setAddBusy(false);
                        }
                      }}
                      className={cn(
                        "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                        "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      {addBusy ? <Loader2 className="animate-spin" size={18} /> : 'Verify'}
                    </button>
                  </div>
                )}

                {addStep === 'backupCodes' && (
                  <div className="space-y-4">
                    <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                      Backup codes
                    </div>
                    <div className={cn("rounded-2xl border p-4 font-mono text-xs whitespace-pre-wrap", isDark ? "bg-[#111111] border-white/10 text-white/80" : "bg-white border-black/10 text-black/80")}>
                      {(addBackupCodes || []).join('\n')}
                    </div>
                    <button
                      onClick={() => {
                        setAddEmail('');
                        setAddPassword('');
                        setAddOpen(false);
                        resetAddFlow();
                      }}
                      className={cn(
                        "w-full h-12 rounded-2xl font-bold tracking-[0.14em] text-xs transition-all duration-300 flex items-center justify-center gap-2",
                        "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black shadow-[0_18px_50px_rgba(29,185,84,0.18)] hover:shadow-[0_22px_60px_rgba(29,185,84,0.28)] active:scale-[0.99]"
                      )}
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onLogoutCurrent}
          className={cn(
            "group relative w-full h-12 rounded-2xl font-extrabold tracking-[0.18em] text-[11px] uppercase overflow-hidden transition-all duration-300 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            isDark
              ? "bg-gradient-to-r from-[#FF3B3B] via-[#FF4D6D] to-[#FF7A59] text-black shadow-[0_18px_55px_rgba(255,85,85,0.22)] hover:shadow-[0_24px_75px_rgba(255,85,85,0.32)] focus-visible:ring-[#FF6B6B]/70 focus-visible:ring-offset-[#0A0A0A]"
              : "bg-gradient-to-r from-[#FF3B3B] via-[#FF4D6D] to-[#FF7A59] text-white shadow-[0_14px_44px_rgba(255,60,60,0.18)] hover:shadow-[0_20px_64px_rgba(255,60,60,0.26)] focus-visible:ring-[#FF3B3B]/55 focus-visible:ring-offset-white"
          )}
        >
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <span className="absolute -inset-8 bg-white/20 blur-2xl" />
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700" />
          </span>
          <span className="absolute inset-[1px] rounded-[15px] bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            <LogOut size={16} strokeWidth={2.6} />
            Log out
          </span>
        </button>
      </div>
      <TwoFactorModal open={twoFAOpen} onClose={() => setTwoFAOpen(false)} />
    </div>
  );
};

const TypingGreeting = () => {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const fullText = t('welcome_back');
  const { isDark } = useTheme();

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= fullText.length) {
        setText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100); // 100ms typing speed
    return () => clearInterval(interval);
  }, [fullText]);

  return (
    <div className="hidden xl:flex items-center min-w-[140px]">
        <span className={cn("text-2xl font-bold font-sans tracking-tighter", isDark ? "text-white" : "text-black")}>
            {text}
            <span className="animate-pulse text-[#1DB954]">|</span>
        </span>
    </div>
  );
};

function SixDigitCodeInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { isDark } = useTheme();
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
    <div className="w-full max-w-[320px] mx-auto grid grid-cols-6 gap-2" onPaste={handlePaste}>
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
          className={cn(
            "w-full h-12 text-center text-base font-mono border transition-all duration-200 rounded-2xl outline-none focus:ring-1",
            isDark
              ? "bg-[#111111] border-white/10 text-white placeholder-white/20 focus:ring-[#1DB954]/35 focus:border-[#1DB954]/35"
              : "bg-white border-black/10 text-black placeholder-black/30 focus:ring-[#1DB954]/25 focus:border-[#1DB954]/25"
          )}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

function TwoFactorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isDark } = useTheme();
  const { setActiveAuthToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'setup' | 'enabled'>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [otp, setOtp] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [logoutAllSessions, setLogoutAllSessions] = useState(true);
  const [disableMode, setDisableMode] = useState<'totp' | 'backup'>('totp');
  const downloadBackupCodes = (codes: string[]) => {
    const lines = [
      'ArcMail Backup Codes',
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
    a.download = `arcmail-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/auth/2fa/status');
        const enabled =
          res.data && typeof res.data === 'object' && 'enabled' in res.data && typeof (res.data as { enabled?: unknown }).enabled === 'boolean'
            ? Boolean((res.data as { enabled: boolean }).enabled)
            : false;
        if (stopped) return;
        setStep(enabled ? 'enabled' : 'idle');
        setQrDataUrl('');
        setManualKey('');
        setBackupCodes(null);
        setOtp('');
      } catch {
        if (stopped) return;
        setError('Failed to load 2FA status.');
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    void run();
    return () => {
      stopped = true;
    };
  }, [open]);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/enable-2fa', {});
      const nextQr =
        res.data && typeof res.data === 'object' && 'qrDataUrl' in res.data && typeof (res.data as { qrDataUrl?: unknown }).qrDataUrl === 'string'
          ? String((res.data as { qrDataUrl: string }).qrDataUrl)
          : '';
      const nextKey =
        res.data && typeof res.data === 'object' && 'manualKey' in res.data && typeof (res.data as { manualKey?: unknown }).manualKey === 'string'
          ? String((res.data as { manualKey: string }).manualKey)
          : '';
      if (!nextQr || !nextKey) throw new Error('invalid');
      setQrDataUrl(nextQr);
      setManualKey(nextKey);
      setStep('setup');
    } catch {
      setError('Failed to start 2FA setup.');
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async () => {
    const code = otp.trim().replace(/\s+/g, '');
    if (!code) return setError('Enter the 6-digit code.');
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/confirm-2fa', { token: code, logoutAllSessions });
      const codes =
        res.data && typeof res.data === 'object' && 'backupCodes' in res.data && Array.isArray((res.data as { backupCodes?: unknown }).backupCodes)
          ? ((res.data as { backupCodes: unknown[] }).backupCodes.filter((c) => typeof c === 'string') as string[])
          : [];
      const token =
        res.data && typeof res.data === 'object' && 'token' in res.data && typeof (res.data as { token?: unknown }).token === 'string'
          ? String((res.data as { token: string }).token)
          : null;
      if (token) setActiveAuthToken(token);
      setBackupCodes(codes.length ? codes : null);
      setStep('enabled');
      setOtp('');
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status : null;
      const data = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown } }).response?.data : null;
      const code =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      if (status === 401 && code === 'invalid_2fa_code') setError('Invalid code. Try again.');
      else setError('Failed to enable 2FA.');
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async () => {
    const code = otp.trim().replace(/\s+/g, '');
    if (!code) return setError(disableMode === 'backup' ? 'Enter a backup code.' : 'Enter the 6-digit code.');
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/disable-2fa', disableMode === 'backup' ? { backupCode: code } : { token: code });
      const token =
        res.data && typeof res.data === 'object' && 'token' in res.data && typeof (res.data as { token?: unknown }).token === 'string'
          ? String((res.data as { token: string }).token)
          : null;
      if (token) setActiveAuthToken(token);
      setStep('idle');
      setQrDataUrl('');
      setManualKey('');
      setBackupCodes(null);
      setOtp('');
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: unknown; data?: unknown } }).response?.status : null;
      const data = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown } }).response?.data : null;
      const code =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      if (status === 401 && code === 'invalid_2fa_code') setError('Invalid code. Try again.');
      else setError('Failed to disable 2FA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          >
            <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
              <div className={cn("px-6 py-5 flex items-start justify-between gap-4 border-b", isDark ? "border-[#1A1A1A]" : "border-[#E5E5E5]")}>
                <div className="min-w-0">
                  <div className={cn("text-lg font-bold tracking-tight", isDark ? "text-white" : "text-black")}>Two‑Factor Authentication</div>
                  <div className={cn("text-sm mt-0.5", isDark ? "text-white/55" : "text-black/55")}>
                    Protect your ArcMail session with a 6‑digit authenticator code.
                  </div>
                </div>
                <button onClick={onClose} className={cn("p-2 rounded-full transition-colors", isDark ? "text-white/55 hover:text-white hover:bg-[#1A1A1A]" : "text-black/55 hover:text-black hover:bg-[#F0F0F0]")}>
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {error && (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className={cn("text-sm", isDark ? "text-white/60" : "text-black/60")}>Loading…</div>
                )}

                {!loading && step === 'idle' && (
                  <button
                    onClick={() => void startSetup()}
                    className={cn(
                      "w-full h-12 rounded-2xl font-extrabold tracking-[0.14em] text-xs transition-colors border",
                      "bg-[#1DB954] text-black border-transparent hover:bg-[#1ED760]"
                    )}
                  >
                    Enable 2FA
                  </button>
                )}

                {!loading && step === 'setup' && (
                  <div className="space-y-4">
                    <div className={cn("text-sm leading-relaxed", isDark ? "text-white/55" : "text-black/55")}>
                      Install Google Authenticator, then open the app → tap <span className={cn("font-semibold", isDark ? "text-white/70" : "text-black/70")}>+</span> → <span className={cn("font-semibold", isDark ? "text-white/70" : "text-black/70")}>Scan a QR code</span>. Enter the 6‑digit code below.
                    </div>
                    <div className={cn("rounded-2xl border p-4 flex items-center justify-center", isDark ? "bg-[#111111] border-white/10" : "bg-[#F9F9F9] border-black/10")}>
                      {qrDataUrl ? <img src={qrDataUrl} alt="2FA QR" className="w-44 h-44" /> : null}
                    </div>
                    <div className={cn("text-xs font-mono tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>Manual key</div>
                    <button
                      onClick={() => void navigator.clipboard?.writeText(manualKey)}
                      className={cn("w-full rounded-2xl border px-4 py-3 text-left font-mono text-xs break-all transition-colors", isDark ? "bg-[#111111] border-white/10 hover:bg-[#1A1A1A] text-white/80" : "bg-white border-black/10 hover:bg-[#F6F6F6] text-black/80")}
                    >
                      {manualKey}
                    </button>
                    <div className="space-y-2">
                      <div className={cn("text-xs font-mono tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>6-digit code</div>
                      <SixDigitCodeInput value={otp} onChange={setOtp} disabled={loading} autoFocus />
                    </div>
                    <label className={cn("flex items-center gap-3 text-sm cursor-pointer select-none", isDark ? "text-white/60" : "text-black/60")}>
                      <span className="relative">
                        <input
                          type="checkbox"
                          checked={logoutAllSessions}
                          onChange={(e) => setLogoutAllSessions(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "block w-5 h-5 rounded-md border transition-all",
                            isDark ? "border-white/15 bg-[#111111]" : "border-black/15 bg-white",
                            "peer-checked:bg-[#1DB954] peer-checked:border-[#1DB954] peer-focus-visible:ring-2 peer-focus-visible:ring-[#1DB954]/30"
                          )}
                        />
                        <Check size={12} className="absolute inset-0 m-auto text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </span>
                      Logout all sessions after enabling
                    </label>
                    <button
                      onClick={() => void confirmSetup()}
                      className={cn(
                        "w-full h-12 rounded-2xl font-extrabold tracking-[0.14em] text-xs transition-colors border",
                        "bg-[#1DB954] text-black border-transparent hover:bg-[#1ED760]"
                      )}
                    >
                      Verify & Enable
                    </button>
                  </div>
                )}

                {!loading && step === 'enabled' && (
                  <div className="space-y-4">
                    {backupCodes && backupCodes.length > 0 && (
                      <div className={cn("rounded-2xl border p-4", isDark ? "bg-[#111111] border-white/10" : "bg-[#F9F9F9] border-black/10")}>
                        <div className={cn("text-xs font-bold tracking-widest uppercase mb-2", isDark ? "text-white/45" : "text-black/45")}>Backup codes</div>
                        <div className={cn("text-sm mb-3 leading-relaxed", isDark ? "text-white/55" : "text-black/55")}>
                          Save these codes safely. Each code works once if you lose access to Google Authenticator.
                        </div>
                        <div className={cn("text-sm whitespace-pre-wrap", isDark ? "text-white/80" : "text-black/80")}>
                          {backupCodes.join('\n')}
                        </div>
                        <button
                          onClick={() => downloadBackupCodes(backupCodes)}
                          className={cn(
                            "mt-3 w-full h-11 rounded-2xl border text-xs font-bold tracking-widest uppercase transition-colors",
                            isDark ? "border-white/10 text-white/70 hover:text-white hover:bg-white/5" : "border-black/10 text-black/70 hover:text-black hover:bg-black/5"
                          )}
                        >
                          Download codes
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setDisableMode('totp'); setOtp(''); }}
                        className={cn("flex-1 h-10 rounded-2xl border text-xs font-bold tracking-wide transition-colors", disableMode === 'totp' ? (isDark ? "bg-white/10 border-white/15 text-white" : "bg-black/5 border-black/15 text-black") : (isDark ? "bg-transparent border-white/10 text-white/60 hover:bg-white/5" : "bg-transparent border-black/10 text-black/60 hover:bg-black/5"))}
                      >
                        Authenticator
                      </button>
                      <button
                        onClick={() => { setDisableMode('backup'); setOtp(''); }}
                        className={cn("flex-1 h-10 rounded-2xl border text-xs font-bold tracking-wide transition-colors", disableMode === 'backup' ? (isDark ? "bg-white/10 border-white/15 text-white" : "bg-black/5 border-black/15 text-black") : (isDark ? "bg-transparent border-white/10 text-white/60 hover:bg-white/5" : "bg-transparent border-black/10 text-black/60 hover:bg-black/5"))}
                      >
                        Backup code
                      </button>
                    </div>

                    {disableMode === 'backup' ? (
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        inputMode="text"
                        className={cn("w-full h-12 rounded-2xl border px-4 bg-transparent outline-none", isDark ? "border-white/10 text-white placeholder-white/20" : "border-black/10 text-black placeholder-black/30")}
                        placeholder="XXXX-XXXX-XXXX"
                      />
                    ) : (
                      <SixDigitCodeInput value={otp} onChange={setOtp} disabled={loading} autoFocus />
                    )}

                    <button
                      onClick={() => void disable2fa()}
                      className={cn(
                        "w-full h-12 rounded-2xl font-extrabold tracking-[0.14em] text-xs transition-colors border",
                        "bg-[#FF5555] text-black border-transparent hover:bg-[#FF6B6B]"
                      )}
                    >
                      Disable 2FA
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const SettingsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { aiEnabled, toggleAi } = useAI();
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-3 rounded-full transition-colors relative border border-transparent",
          isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A] hover:border-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0] hover:border-[#E5E5E5]"
        )}
      >
        <Settings size={20} className={cn("transition-transform duration-500", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setLangMenuOpen(false); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className={cn(
                "absolute right-0 top-full mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden",
                isDark ? "bg-[#181818] border-[#282828]" : "bg-white border-[#E5E5E5]"
              )}
            >
              <div className="p-2 space-y-1">
                {/* Language */}
                <div className="relative">
                  <button 
                    onClick={() => setLangMenuOpen(!langMenuOpen)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-colors group",
                      isDark ? "text-[#EAEAEA] hover:bg-[#282828]" : "text-[#121212] hover:bg-[#F5F5F5]"
                    )}
                  >
                     <div className="flex items-center gap-3">
                        <Globe size={18} className={cn("group-hover:text-white", isDark ? "text-[#787878]" : "text-[#949494] group-hover:text-black")} />
                        <span>{t('language')}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className={cn("text-xs font-medium", isDark ? "text-[#5E5E5E]" : "text-[#949494]")}>
                         {LANGUAGES.find(l => l.code === language)?.name}
                       </span>
                       <ChevronRight size={14} className={cn("transition-transform", langMenuOpen && "rotate-90", isDark ? "text-[#5E5E5E]" : "text-[#949494]")} />
                     </div>
                  </button>
                  
                  <AnimatePresence>
                    {langMenuOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-4 pr-1"
                      >
                        <div className={cn("mt-1 p-1 rounded-xl border space-y-0.5", isDark ? "bg-[#121212] border-[#282828]" : "bg-[#F9F9F9] border-[#E5E5E5]")}>
                          {LANGUAGES.map(lang => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                setLanguage(lang.code);
                                setLangMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors",
                                language === lang.code 
                                  ? (isDark ? "bg-[#1DB954]/10 text-[#1DB954]" : "bg-[#1DB954]/10 text-[#1DB954]")
                                  : (isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A]" : "text-[#5E5E5E] hover:text-black hover:bg-[#EAEAEA]")
                              )}
                            >
                              <span>{lang.nativeName}</span>
                              {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theme Toggle */}
                <button 
                  onClick={toggleTheme}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-colors group",
                    isDark ? "text-[#EAEAEA] hover:bg-[#282828]" : "text-[#121212] hover:bg-[#F5F5F5]"
                  )}
                >
                   <div className="flex items-center gap-3">
                      {isDark ? (
                        <Moon size={18} className="text-[#787878] group-hover:text-white" />
                      ) : (
                        <Sun size={18} className="text-[#949494] group-hover:text-black" />
                      )}
                      <span>{t('dark_mode')}</span>
                   </div>
                   <div className={cn(
                     "w-9 h-5 rounded-full relative transition-colors duration-300",
                     isDark ? "bg-[#1DB954]" : "bg-[#E0E0E0]"
                   )}>
                     <div className={cn(
                       "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm",
                       isDark ? "left-5" : "left-1"
                     )} />
                   </div>
                </button>

                <button
                  onClick={toggleAi}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-colors group",
                    isDark ? "text-[#EAEAEA] hover:bg-[#282828]" : "text-[#121212] hover:bg-[#F5F5F5]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className={cn("group-hover:text-[#1DB954]", isDark ? "text-[#787878]" : "text-[#949494]")} />
                    <span>AI</span>
                  </div>
                  <div className={cn("w-9 h-5 rounded-full relative transition-colors duration-300", aiEnabled ? "bg-[#1DB954]" : (isDark ? "bg-[#282828]" : "bg-[#E0E0E0]"))}>
                    <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm", aiEnabled ? "left-5" : "left-1")} />
                  </div>
                </button>

                <div className={cn("h-[1px] my-1 mx-2", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />

                <button
                  onClick={() => {
                    setTwoFAOpen(true);
                    setIsOpen(false);
                    setLangMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-colors group",
                    isDark ? "text-[#EAEAEA] hover:bg-[#282828]" : "text-[#121212] hover:bg-[#F5F5F5]"
                  )}
                >
                  <Smartphone size={18} className={cn("group-hover:text-[#1DB954]", isDark ? "text-[#787878]" : "text-[#949494]")} />
                  <span>Two‑Factor Auth</span>
                </button>

                {/* Feedback */}
                <a 
                  href="mailto:feedbacks@arcbyte.co?subject=ArcMail Feedback"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-colors group",
                    isDark ? "text-[#EAEAEA] hover:bg-[#282828]" : "text-[#121212] hover:bg-[#F5F5F5]"
                  )}
                >
                   <MessageSquare size={18} className={cn("group-hover:text-[#1DB954]", isDark ? "text-[#787878]" : "text-[#949494]")} />
                   <span>{t('send_feedback')}</span>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <TwoFactorModal open={twoFAOpen} onClose={() => setTwoFAOpen(false)} />
    </div>
  );
};

// --- Preloader ---

const Preloader = ({ onComplete }: { onComplete: () => void }) => {
  const { isDark } = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.8, delay: 2.0, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onComplete}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center",
        isDark ? "bg-[#050507]" : "bg-[#F9F9F9]"
      )}
    >
      <div className="flex flex-col items-center gap-6">
         <div className="flex items-center gap-1 h-8 overflow-hidden">
            <motion.div 
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={cn("text-2xl font-bold tracking-tighter", isDark ? "text-white" : "text-black")}
            >
              ArcMail
            </motion.div>
            <motion.div
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               transition={{ duration: 0.5, delay: 0.4, type: "spring" }}
               className={cn("w-2 h-2 rounded-full mt-2", isDark ? "bg-white" : "bg-black")}
            />
         </div>
         <div className={cn("w-48 h-[1px] relative overflow-hidden", isDark ? "bg-white/10" : "bg-black/10")}>
            <motion.div 
               initial={{ x: "-100%" }}
               animate={{ x: "100%" }}
               transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
               className={cn("absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-current to-transparent", isDark ? "text-white" : "text-black")}
            />
         </div>
         <div className={cn("flex gap-4 text-[10px] font-mono uppercase tracking-widest", isDark ? "text-[#444]" : "text-[#999]")}>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>Syncing</motion.span>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>Decryption</motion.span>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>Ready</motion.span>
         </div>
      </div>
    </motion.div>
  );
};

const AccountSwitchPreloader = ({ email }: { email: string }) => {
  const { isDark } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "fixed inset-0 z-[120] flex items-center justify-center",
        isDark ? "bg-[#050507]" : "bg-[#F9F9F9]"
      )}
    >
      <div className="flex flex-col items-center gap-6 px-6">
        <div className="flex flex-col items-center gap-2">
          <div className={cn("text-2xl font-bold tracking-tighter", isDark ? "text-white" : "text-black")}>ArcMail</div>
          <div className={cn("text-[12px] font-semibold tracking-wide", isDark ? "text-white/55" : "text-black/55")}>
            Switching to {email || 'account'}
          </div>
        </div>
        <div className={cn("w-56 h-[1px] relative overflow-hidden", isDark ? "bg-white/10" : "bg-black/10")}>
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
            className={cn("absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-current to-transparent", isDark ? "text-white" : "text-black")}
          />
        </div>
        <div className={cn("flex gap-4 text-[10px] font-mono uppercase tracking-widest", isDark ? "text-[#444]" : "text-[#999]")}>
          <span>Syncing</span>
          <span>Switch</span>
          <span>Ready</span>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App Content ---

const MailAppContent = () => {
  const { user, isAuthenticated, isLoading, logout, accounts, activeAccountId, addAccount, verify2FAAddAccount, confirm2FASetupAddAccount, switchAccount, logoutAccount, updateAccountProfile } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isDesktop } = useViewport();
  const { isDark } = useTheme();
  const { aiEnabled } = useAI();
  const { t } = useLanguage();
  
  // State
  const [loading, setLoading] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const [activeFolder, setActiveFolder] = useState<MailFolder>('inbox');
  const [threads, setThreads] = useState<MailThreadSummary[]>([]);
  const [threadsCursor, setThreadsCursor] = useState<string | undefined>(undefined);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<MailThreadDetail | null>(null);
  const [threadDetailLoading, setThreadDetailLoading] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [askAiQuestion, setAskAiQuestion] = useState('');
  const [askAiAnswer, setAskAiAnswer] = useState<string | null>(null);
  const [askAiBusy, setAskAiBusy] = useState(false);
  const [askAiError, setAskAiError] = useState<string | null>(null);
  const [folderCounts, setFolderCounts] = useState<Partial<Record<MailFolder, number>>>({});
  const [folderUnreadCounts, setFolderUnreadCounts] = useState<Partial<Record<MailFolder, number>>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [composeState, setComposeState] = useState<{ open: boolean; key: number; draft?: ComposeDraft }>({
    open: false,
    key: 0,
    draft: undefined,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<{ unread?: boolean; flagged?: boolean; answered?: boolean; attachment?: boolean; from?: string; to?: string; since?: string; before?: string }>({});
  const [voiceActive, setVoiceActive] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<{ id: number; open: boolean; variant: 'success' | 'info' | 'error'; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioMasterGainRef = useRef<GainNode | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);
  const threadsCursorRef = useRef<string | undefined>(undefined);
  const selectedIdRef = useRef<string | null>(null);
  const composeOpen = composeState.open;
  const prevInboxUnseenRef = useRef<number>(0);
  const notifPromptedRef = useRef(false);
  const notificationsEnabledRef = useRef(false);
  const pushRegisteredRef = useRef(false);
  const replySnoozeKey = 'replyReminderSnoozeUntil';
  const [replySnoozeUntil, setReplySnoozeUntil] = useState<number>(() => {
    const raw = localStorage.getItem(replySnoozeKey);
    return raw ? Number(raw) || 0 : 0;
  });
  const unreadLocalCount = useMemo(() => threads.reduce((n, t) => n + (t.unread ? 1 : 0), 0), [threads]);
  const [accountSwitching, setAccountSwitching] = useState(false);
  const accountSwitchSawLoadingRef = useRef(false);
  const accountSwitchEmailRef = useRef<string>('');
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState<{ id: string; email: string; name: string } | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const pendingWelcomeEmailRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('arcMailNotificationsEnabled');
      notificationsEnabledRef.current = raw ? raw === '1' : true;
    } catch {
      notificationsEnabledRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.role !== 'MAIL_USER') return;
    if (!notificationsEnabledRef.current) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const keyRes = await api.get('/notifications/vapid-public-key');
        const publicKey =
          keyRes.data && typeof keyRes.data === 'object' && 'publicKey' in keyRes.data && typeof (keyRes.data as { publicKey?: unknown }).publicKey === 'string'
            ? (keyRes.data as { publicKey: string }).publicKey
            : '';
        if (!publicKey) return;
        const sub =
          existing ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }));
        await api.post('/notifications/subscribe', { subscription: sub.toJSON() });
        pushRegisteredRef.current = true;
      } catch {
        return;
      }
    };
    void run();
  }, [isAuthenticated, isLoading, user?.role]);

  const requestLogoutCurrent = useCallback(() => setLogoutConfirmOpen(true), []);

  const requestSwitchAccount = useCallback(
    (accountId: string) => {
      if (!accountId || accountId === activeAccountId) return;
      const target = accounts.find((a) => a.id === accountId);
      if (!target) return;
      setSwitchConfirm({ id: target.id, email: target.email, name: target.name });
    },
    [accounts, activeAccountId]
  );

  const confirmSwitchAccount = useCallback(() => {
    if (!switchConfirm) return;
    const target = switchConfirm;
    setSwitchConfirm(null);
    setMobileProfileOpen(false);
    setActiveFolder('inbox');
    setSelectedId(null);
    accountSwitchEmailRef.current = target.email || '';
    pendingWelcomeEmailRef.current = (target.email || '').trim().toLowerCase();
    accountSwitchSawLoadingRef.current = false;
    setAccountSwitching(true);
    switchAccount(target.id);
  }, [switchAccount, switchConfirm]);

  const confirmLogoutCurrent = useCallback(() => {
    setLogoutConfirmOpen(false);
    if (!activeAccountId) {
      logout();
      return;
    }
    if (accounts.length <= 1) {
      logout();
      return;
    }
    const nextEmail = accounts.find((a) => a.id !== activeAccountId)?.email || '';
    accountSwitchEmailRef.current = nextEmail;
    pendingWelcomeEmailRef.current = nextEmail.trim().toLowerCase();
    accountSwitchSawLoadingRef.current = false;
    setAccountSwitching(true);
    setMobileProfileOpen(false);
    setActiveFolder('inbox');
    setSelectedId(null);
    logoutAccount(activeAccountId);
  }, [accounts, activeAccountId, logout, logoutAccount]);

  useEffect(() => {
    if (loading) return;
    if (!contentVisible) return;
    if (!isAuthenticated) return;
    if (!user?.email) return;
    const emailLower = user.email.trim().toLowerCase();
    const force = pendingWelcomeEmailRef.current === emailLower;
    if (force) {
      pendingWelcomeEmailRef.current = null;
    } else {
      const key = `arcMailWelcomeShown:${emailLower}`;
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    }
    setWelcomeOpen(true);
    return;
  }, [contentVisible, isAuthenticated, loading, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    threadsAbortRef.current?.abort();
    threadsCursorRef.current = undefined;
    selectedIdRef.current = null;
    setThreads([]);
    setThreadsCursor(undefined);
    setThreadsError(null);
    setThreadsLoading(false);
    setSelectedId(null);
    setThreadDetail(null);
    setThreadDetailLoading(false);
    setSearchQuery('');
    setSearchFilters({});
    setFiltersOpen(false);
    setActiveFolder('inbox');
  }, [user?.email]);

  useEffect(() => {
    if (!accountSwitching) return;
    if (threadsLoading) accountSwitchSawLoadingRef.current = true;
  }, [accountSwitching, threadsLoading]);

  useEffect(() => {
    if (!accountSwitching) return;
    if (!accountSwitchSawLoadingRef.current) return;
    if (threadsLoading) return;
    const id = window.setTimeout(() => setAccountSwitching(false), 180);
    return () => window.clearTimeout(id);
  }, [accountSwitching, threadsLoading, threadsError, threads.length]);

  // Handle Loading
  useEffect(() => {
    if (loading) {
       // Optional: Lock body scroll if needed, though app is h-screen
    } else {
       setTimeout(() => setContentVisible(true), 100);
    }
  }, [loading]);

  // Handle mobile initial state
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  // Auth check
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user || user.role !== 'MAIL_USER')) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, user]);

  useEffect(() => {
    threadsCursorRef.current = threadsCursor;
  }, [threadsCursor]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const openCompose = useCallback((draft?: ComposeDraft) => {
    setComposeState((s) => ({ open: true, key: s.key + 1, draft }));
  }, []);

  const closeCompose = useCallback(() => {
    setComposeState((s) => ({ ...s, open: false, draft: undefined }));
  }, []);

  const escapeHtml = useCallback((input: string) => {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }, []);

  const normalizeSubjectPrefix = useCallback((subject: string, prefix: 'Re' | 'Fwd') => {
    const s = (subject || '').trim();
    if (!s) return `${prefix}: (no subject)`;
    const re = new RegExp(`^${prefix}:`, 'i');
    return re.test(s) ? s : `${prefix}: ${s}`;
  }, []);

  const buildQuotedBodyHtml = useCallback(
    (msg: MailThreadMessage) => {
      const fromAddress = msg.fromAddress || '';
      const fromDisplay = msg.fromName ? `${msg.fromName} <${fromAddress}>` : fromAddress;
      const dateText = new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const original =
        msg.html && msg.html.trim()
          ? msg.html
          : `<pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(msg.text || '')}</pre>`;
      return `<p></p><p></p><p>On ${escapeHtml(dateText)}, ${escapeHtml(fromDisplay)} wrote:</p><blockquote style="margin:0 0 0 0.8em;padding-left:0.8em;border-left:2px solid #2d2d2d;">${original}</blockquote>`;
    },
    [escapeHtml]
  );

  const buildForwardBodyHtml = useCallback(
    (msg: MailThreadMessage, subject: string) => {
      const fromAddress = msg.fromAddress || '';
      const fromDisplay = msg.fromName ? `${msg.fromName} <${fromAddress}>` : fromAddress;
      const toDisplay = msg.to.map((a) => a.name || a.address).join(', ');
      const dateText = new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const original =
        msg.html && msg.html.trim()
          ? msg.html
          : `<pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(msg.text || '')}</pre>`;
      return `<p></p><p>---------- Forwarded message ---------</p><p><strong>From:</strong> ${escapeHtml(fromDisplay)}<br/><strong>Date:</strong> ${escapeHtml(dateText)}<br/><strong>Subject:</strong> ${escapeHtml(subject || '(no subject)')}<br/><strong>To:</strong> ${escapeHtml(toDisplay)}</p><blockquote style="margin:0 0 0 0.8em;padding-left:0.8em;border-left:2px solid #2d2d2d;">${original}</blockquote>`;
    },
    [escapeHtml]
  );

  const handleReply = useCallback(() => {
    if (!threadDetail?.messages?.length) return;
    const msg = threadDetail.messages[threadDetail.messages.length - 1];
    openCompose({
      to: msg.fromAddress || '',
      subject: normalizeSubjectPrefix(threadDetail.subject, 'Re'),
      body: buildQuotedBodyHtml(msg),
      showCcBcc: false,
    });
  }, [threadDetail, openCompose, normalizeSubjectPrefix, buildQuotedBodyHtml]);

  const openAskAI = useCallback(() => {
    if (!aiEnabled) return;
    if (!selectedIdRef.current) return;
    setAskAiQuestion('');
    setAskAiAnswer(null);
    setAskAiError(null);
    setAskAiOpen(true);
  }, [aiEnabled]);

  const closeAskAI = useCallback(() => {
    setAskAiOpen(false);
    setAskAiBusy(false);
    setAskAiError(null);
  }, []);

  const submitAskAI = useCallback(async () => {
    if (!aiEnabled) return;
    if (!selectedId) return;
    const question = askAiQuestion.trim();
    if (!question) return;
    setAskAiBusy(true);
    setAskAiError(null);
    try {
      const res = await api.post('/ai/ask', {
        id: selectedId,
        folder: MAIL_FOLDER_IMAP_PATH[activeFolder],
        question,
      });
      const answer =
        res.data && typeof res.data === 'object' && 'answer' in res.data && typeof (res.data as { answer?: unknown }).answer === 'string'
          ? (res.data as { answer: string }).answer
          : '';
      setAskAiAnswer(answer || '');
    } catch (err) {
      const response = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown; status?: unknown } }).response : undefined;
      const status = typeof response?.status === 'number' ? response.status : null;
      const data = response?.data as unknown;
      const code =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : null;
      if (status === 503 && code === 'ai_disabled') {
        setAskAiError('AI is disabled.');
      } else if (status === 400) {
        setAskAiError('Invalid request.');
      } else {
        setAskAiError('Ask AI failed.');
      }
    } finally {
      setAskAiBusy(false);
    }
  }, [activeFolder, aiEnabled, askAiQuestion, selectedId]);

  const handleForward = useCallback(() => {
    if (!threadDetail?.messages?.length) return;
    const msg = threadDetail.messages[threadDetail.messages.length - 1];
    openCompose({
      to: '',
      subject: normalizeSubjectPrefix(threadDetail.subject, 'Fwd'),
      body: buildForwardBodyHtml(msg, threadDetail.subject),
      showCcBcc: false,
    });
  }, [threadDetail, openCompose, normalizeSubjectPrefix, buildForwardBodyHtml]);

  const markThreadRead = useCallback(async (id: string) => {
    try {
      await api.post(`/mail/threads/${encodeURIComponent(id)}/read`, null, {
        params: { folder: MAIL_FOLDER_IMAP_PATH[activeFolder] },
      });
    } catch {/* ignore */}
  }, [activeFolder]);

  const searchThreads = useCallback(async (options?: { reset?: boolean }) => {
    if (!user || !isAuthenticated) return;
    const imapFolder = MAIL_FOLDER_IMAP_PATH[activeFolder];
    const reset = options?.reset ?? false;
    const q = searchQuery.trim();
    if (!q && !searchFilters.unread && !searchFilters.flagged && !searchFilters.answered && !searchFilters.attachment && !searchFilters.from && !searchFilters.to && !searchFilters.since && !searchFilters.before) return;
    setThreadsLoading(true);
    setThreadsError(null);
    let timeoutId: number | undefined;
    try {
      threadsAbortRef.current?.abort();
      const controller = new AbortController();
      threadsAbortRef.current = controller;
      timeoutId = window.setTimeout(() => controller.abort(), 60000);
      const params: Record<string, string> = { folder: imapFolder, limit: '50' };
      if (q) params.q = q;
      if (reset ? undefined : threadsCursorRef.current) params.cursor = String(threadsCursorRef.current);
      if (searchFilters.unread) params.unread = 'true';
      if (searchFilters.flagged) params.flagged = 'true';
      if (searchFilters.answered) params.answered = 'true';
      if (searchFilters.attachment) params.attachment = 'true';
      if (searchFilters.from) params.from = searchFilters.from;
      if (searchFilters.to) params.to = searchFilters.to;
      if (searchFilters.since) params.since = String(Date.parse(searchFilters.since));
      if (searchFilters.before) params.before = String(Date.parse(searchFilters.before));
      const res = await api.get('/mail/search', { params, signal: controller.signal });
      const data = res.data as { threads: MailThreadSummary[]; nextCursor?: string };
      const mapped = (data.threads || []).map(t => ({
        ...t,
        id: String(t.id),
        folder: activeFolder,
        sender: t.from?.name || t.from?.address || 'Unknown',
        senderEmail: t.from?.address || '',
        subject: t.subject || '(no subject)',
        snippet: t.snippet || '',
        timestamp: t.lastMessageAt || '',
        unread: Boolean(t.unread),
      }));
      setThreads(prev => {
        if (reset) return mapped;
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...mapped.filter(i => !existingIds.has(i.id))];
      });
      threadsCursorRef.current = data.nextCursor;
      setThreadsCursor(data.nextCursor);
      if (reset && mapped.length > 0 && !isMobile && !selectedIdRef.current) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'ERR_CANCELED') return;
      if (err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'CanceledError') return;
      const response = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown; status?: unknown } }).response : undefined;
      threadsCursorRef.current = undefined;
      setThreadsCursor(undefined);
      if (!response) {
        setThreadsError('API unreachable. Start dev servers with `npm run dev`.');
      } else {
        const status = typeof response.status === 'number' ? response.status : null;
        const data = response.data as unknown;
        const errorCode =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
            ? String((data as { error: string }).error)
            : null;
        const detailCode =
          data && typeof data === 'object' && 'code' in data && typeof (data as { code?: unknown }).code === 'string'
            ? String((data as { code: string }).code)
            : null;

        if (status === 401) {
          setThreadsError('Session expired. Please sign in again.');
        } else if (status === 404) {
          setThreadsError('Search endpoint not found. Restart the backend.');
        } else if (status === 502) {
          setThreadsError(`Mail server error.${detailCode ? ` (${detailCode})` : ''}`);
        } else {
          setThreadsError(`Search failed.${errorCode ? ` (${errorCode})` : ''}`);
        }
      }
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setThreadsLoading(false);
    }
  }, [activeFolder, isAuthenticated, user, isMobile, searchFilters, searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    const hasFilters = Boolean(searchFilters.unread || searchFilters.flagged || searchFilters.answered || searchFilters.attachment || searchFilters.from || searchFilters.to || searchFilters.since || searchFilters.before);
    if (!q && !hasFilters) return;
    const id = window.setTimeout(() => {
      threadsCursorRef.current = undefined;
      setThreadsCursor(undefined);
      searchThreads({ reset: true });
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchQuery, searchFilters, searchThreads]);

  

  const onVoiceToggle = useCallback(() => {
    const ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!ctor) return;
    if (voiceActive) {
      setVoiceActive(false);
      return;
    }
    const rec: ISpeechRecognition = new ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const first = e.results && e.results[0] && (e.results[0] as unknown as { 0?: SpeechRecognitionEventResult })[0];
      const text = first?.transcript || '';
      if (text) setSearchQuery(text);
    };
    rec.onend = () => setVoiceActive(false);
    try {
      setVoiceActive(true);
      rec.start();
    } catch {
      setVoiceActive(false);
    }
  }, [voiceActive]);

  useEffect(() => {
    const unlock = () => {
      audioUnlockedRef.current = true;
      try {
        if (audioCtxRef.current) {
          void audioCtxRef.current.resume();
          return;
        }
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.setValueAtTime(1, ctx.currentTime);
        master.connect(ctx.destination);
        audioCtxRef.current = ctx;
        audioMasterGainRef.current = master;
        void ctx.resume();
      } catch {
        return;
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      try {
        if (audioCtxRef.current) void audioCtxRef.current.close();
      } catch {
        return;
      }
    };
  }, []);

  const playToastSound = useCallback((variant: 'success' | 'info' | 'error', count?: number) => {
    if (!audioUnlockedRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const master = audioMasterGainRef.current;
      if (!ctx || !master) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const n = Math.max(1, Math.min(5, Number.isFinite(count) ? Number(count) : 1));
      const base = variant === 'error' ? 220 : variant === 'info' ? 440 : 520;
      const gap = 0.28;

      for (let i = 0; i < n; i += 1) {
        const t0 = now + i * gap;
        const t1 = t0 + 0.22;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t1);
        gain.connect(master);

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(base, t0);
        osc2.frequency.setValueAtTime(base * 1.5, t0 + 0.02);
        osc1.connect(gain);
        osc2.connect(gain);
        osc1.start(t0);
        osc2.start(t0 + 0.02);
        osc1.stop(t1);
        osc2.stop(t1);
      }
    } catch {
      return;
    }
  }, []);

  const showToast = useCallback((next: { variant?: 'success' | 'info' | 'error'; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void; soundCount?: number }) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    const variant = next.variant || 'success';
    playToastSound(variant, next.soundCount);
    setToast({ id: Date.now(), open: true, variant, title: next.title, subtitle: next.subtitle, actionLabel: next.actionLabel, onAction: next.onAction });
    toastTimeoutRef.current = window.setTimeout(() => setToast((t) => (t ? { ...t, open: false } : t)), 3200);
  }, [playToastSound]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.role !== 'MAIL_USER') return;
    if (typeof Notification === 'undefined') return;
    if (!notificationsEnabledRef.current) return;
    if (Notification.permission !== 'default') return;
    if (notifPromptedRef.current) return;

    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const ensurePushSubscription = async () => {
      if (!('serviceWorker' in navigator)) return false;
      if (!('PushManager' in window)) return false;
      if (Notification.permission !== 'granted') return false;
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing;
        const keyRes = await api.get('/notifications/vapid-public-key');
        const publicKey =
          keyRes.data && typeof keyRes.data === 'object' && 'publicKey' in keyRes.data && typeof (keyRes.data as { publicKey?: unknown }).publicKey === 'string'
            ? (keyRes.data as { publicKey: string }).publicKey
            : '';
        if (!publicKey) return false;
        const finalSub =
          sub ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }));
        await api.post('/notifications/subscribe', { subscription: finalSub.toJSON() });
        pushRegisteredRef.current = true;
        return true;
      } catch {
        return false;
      }
    };

    const request = async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          try {
            localStorage.setItem('arcMailNotificationsEnabled', '1');
          } catch {
            void 0;
          }
          notificationsEnabledRef.current = true;
          showToast({ variant: 'success', title: 'Notifications enabled', subtitle: 'You’ll get alerts for new Inbox mail.' });
          void ensurePushSubscription();
          return;
        }
        try {
          localStorage.setItem('arcMailNotificationsEnabled', '0');
        } catch {
          void 0;
        }
        notificationsEnabledRef.current = false;
      } catch {
        return;
      }
    };

    notifPromptedRef.current = true;
    showToast({
      variant: 'info',
      title: 'Enable notifications',
      subtitle: 'Allow notifications to get alerts for new Inbox mail.',
      actionLabel: 'Enable',
      onAction: () => void request(),
    });

    const onGesture = () => void request();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [isAuthenticated, isLoading, showToast, user?.role]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const id = window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSearchOpen]);

  // Load threads
  const loadThreads = useCallback(async (options?: { reset?: boolean }) => {
    if (!user || !isAuthenticated) return;
    const imapFolder = MAIL_FOLDER_IMAP_PATH[activeFolder];
    const reset = options?.reset ?? false;
    const isCanceledError = (e: unknown) => {
      if (!e || typeof e !== 'object') return false;
      if ('code' in e && (e as { code?: unknown }).code === 'ERR_CANCELED') return true;
      if ('name' in e && (e as { name?: unknown }).name === 'CanceledError') return true;
      return false;
    };
    
    setThreadsLoading(true);
    setThreadsError(null);
    let timeoutId: number | undefined;
    try {
      threadsAbortRef.current?.abort();
      const controller = new AbortController();
      threadsAbortRef.current = controller;
      timeoutId = window.setTimeout(() => controller.abort(), 60000);
      const res = await api.get('/mail/threads', {
        params: {
          folder: imapFolder,
          limit: 50,
          cursor: reset ? undefined : threadsCursorRef.current,
        },
        signal: controller.signal,
      });
      const data = res.data as { threads: MailThreadSummary[]; nextCursor?: string };
      const mapped = (data.threads || []).map(t => ({
          ...t,
          id: String(t.id),
          folder: activeFolder,
          sender: t.from?.name || t.from?.address || 'Unknown',
          senderEmail: t.from?.address || '',
          subject: t.subject || '(no subject)',
          snippet: t.snippet || '',
          timestamp: t.lastMessageAt || '',
          unread: Boolean(t.unread),
          ai: (t as unknown as { ai?: EmailAI }).ai ?? null,
      }));

      setThreads(prev => {
        if (reset) {
          if (activeFolder === 'sent' && mapped.length === 0) {
            const hasLocal = prev.some(p => p.folder === 'sent' && String(p.id).startsWith('local-sent-'));
            if (hasLocal) return prev;
            const pending = readPendingSent();
            if (pending.length) return [...prev.filter(p => p.folder !== 'sent'), ...pending];
          }
          if (activeFolder === 'sent' && mapped.length > 0) clearPendingSent();
          return [...prev.filter(p => p.folder !== activeFolder), ...mapped];
        }
        const existingIds = new Set(prev.filter(p => p.folder === activeFolder).map(p => p.id));
        return [...prev, ...mapped.filter(i => !existingIds.has(i.id))];
      });
      threadsCursorRef.current = data.nextCursor;
      setThreadsCursor(data.nextCursor);
      
      if (reset && mapped.length > 0 && !isMobile && !selectedIdRef.current) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      if (isCanceledError(err)) return;
      const response =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown; status?: unknown } }).response
          : undefined;
      const data = response?.data ?? null;
      const code =
        data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : null;
      const detailsText =
        data &&
        typeof data === 'object' &&
        'details' in data &&
        data.details &&
        typeof data.details === 'object' &&
        'responseText' in data.details &&
        typeof (data.details as { responseText?: unknown }).responseText === 'string'
          ? String((data.details as { responseText?: string }).responseText)
          : null;
      threadsCursorRef.current = undefined;
      setThreadsCursor(undefined);
      if (!response) {
        setThreadsError('API unreachable. Start dev servers with `npm run dev`.');
        return;
      }
      setThreadsError(
        `Failed to load messages. Check connection and try again.${code ? ` (${code})` : ''}${detailsText ? ` — ${detailsText}` : ''}`
      );
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setThreadsLoading(false);
    }
  }, [activeFolder, isAuthenticated, user, isMobile]);

  useEffect(() => {
    const q = searchQuery.trim();
    const hasFilters = Boolean(searchFilters.unread || searchFilters.flagged || searchFilters.answered || searchFilters.attachment || searchFilters.from || searchFilters.to || searchFilters.since || searchFilters.before);
    if (q || hasFilters) return;
    threadsCursorRef.current = undefined;
    setThreadsCursor(undefined);
    loadThreads({ reset: true });
  }, [searchQuery, searchFilters, loadThreads]);

  // Initial load
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'MAIL_USER') {
      const hasLocalSent =
        activeFolder === 'sent' && readPendingSent().length > 0;
      if (!hasLocalSent) {
        setThreadsCursor(undefined);
        threadsCursorRef.current = undefined;
        setSelectedId(null);
        setThreadDetail(null);
      }
      loadThreads({ reset: true });
    }
  }, [activeFolder, isAuthenticated, isLoading, user, loadThreads]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'MAIL_USER') {
      const intervalId = window.setInterval(() => {
        loadThreads({ reset: true });
      }, 15000);
      return () => window.clearInterval(intervalId);
    }
  }, [isAuthenticated, isLoading, user, loadThreads]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'MAIL_USER') {
      let stopped = false;
      const controller = new AbortController();

      const updateTitle = (inboxUnseen: number) => {
        const base = 'ArcMail';
        const folderLabel = isMobile && mobileProfileOpen ? 'Profile' : t(activeFolder);
        const withFolder = folderLabel ? `${folderLabel} · ${base}` : base;
        document.title = inboxUnseen > 0 ? `(${inboxUnseen}) ${withFolder}` : withFolder;
      };

      const fetchStats = async () => {
        try {
          const res = await api.get('/mail/folders/stats', { signal: controller.signal });
          if (stopped) return;
          const folders = (res.data as { folders?: Record<string, { unseen?: number; messages?: number }> }).folders || {};
          const nextTotals: Partial<Record<MailFolder, number>> = {
            inbox: Number(folders.inbox?.messages || 0),
            sent: Number(folders.sent?.messages || 0),
            drafts: Number(folders.drafts?.messages || 0),
            spam: Number(folders.spam?.messages || 0),
            trash: Number(folders.trash?.messages || 0),
          };
          const nextUnseen: Partial<Record<MailFolder, number>> = {
            inbox: Number(folders.inbox?.unseen || 0),
            sent: Number(folders.sent?.unseen || 0),
            drafts: Number(folders.drafts?.unseen || 0),
            spam: Number(folders.spam?.unseen || 0),
            trash: Number(folders.trash?.unseen || 0),
          };
          setFolderCounts(nextTotals);
          setFolderUnreadCounts(nextUnseen);

          const inboxUnseen = nextUnseen.inbox || 0;
          updateTitle(inboxUnseen);

          if (inboxUnseen > prevInboxUnseenRef.current) {
            const diff = inboxUnseen - prevInboxUnseenRef.current;
            showToast({
              variant: 'info',
              title: 'New mail',
              subtitle: diff > 1 ? `+${diff} new in Inbox` : '+1 new in Inbox',
              actionLabel: 'View',
              onAction: () => setActiveFolder('inbox'),
              soundCount: diff,
            });
            if (!pushRegisteredRef.current && typeof Notification !== 'undefined') {
              const notify = async (title: string, body: string) => {
                const data = { url: '/' };
                try {
                  if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification(title, {
                      body,
                      icon: arcByteLogoPng,
                      badge: arcByteLogoPng,
                      tag: 'arcmail-inbox',
                      data,
                    });
                    return;
                  }
                } catch {
                  void 0;
                }
                try {
                  const n = new Notification(title, { body, icon: arcByteLogoPng, badge: arcByteLogoPng, tag: 'arcmail-inbox' });
                  n.onclick = () => {
                    try {
                      window.focus();
                      setActiveFolder('inbox');
                      setSelectedId(null);
                    } catch {
                      return;
                    }
                  };
                } catch {
                  return;
                }
              };

              if (Notification.permission === 'granted' && notificationsEnabledRef.current) {
                try {
                  await notify('New mail', diff > 1 ? `+${diff} new in Inbox` : '1 new in Inbox');
                } catch {
                  return;
                }
              }
            }
          }
          prevInboxUnseenRef.current = inboxUnseen;
        } catch {
          return;
        }
      };

      fetchStats();
      const intervalId = window.setInterval(fetchStats, 10000);
      return () => {
        stopped = true;
        controller.abort();
        window.clearInterval(intervalId);
      };
    }
  }, [activeFolder, isAuthenticated, isLoading, isMobile, mobileProfileOpen, showToast, t, user]);

  // Load detail
  useEffect(() => {
    if (!selectedId) {
      setThreadDetail(null);
      setThreadDetailLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);
    const fetchDetail = async () => {
      setThreadDetailLoading(true);
      try {
        const res = await api.get(`/mail/threads/${encodeURIComponent(selectedId)}`, {
          params: { folder: MAIL_FOLDER_IMAP_PATH[activeFolder] },
          signal: controller.signal,
        });
        if (cancelled) return;
        const data = res.data as { thread: (MailThreadDetail & { ai?: EmailAI }) | null };
        if (data.thread) {
          const mapped: MailThreadDetail = {
            ...data.thread,
            id: String(data.thread.id),
            folder: activeFolder,
            messages: data.thread.messages.map(m => ({
              ...m,
              id: String(m.id),
              subject: m.subject || data.thread?.subject || '',
            }))
          };
          setThreadDetail(mapped);
          setThreads(prev => prev.map(t => t.id === selectedId ? { ...t, unread: false } : t));
          // Mark as read on server
          try {
            await api.post(`/mail/threads/${encodeURIComponent(selectedId)}/read`, null, { params: { folder: MAIL_FOLDER_IMAP_PATH[activeFolder] } });
          } catch {
            // ignore
          }
        } else {
          setThreadDetail(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'ERR_CANCELED') return;
        if (err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'CanceledError') return;
        setThreadDetail(null);
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setThreadDetailLoading(false);
      }
    };
    fetchDetail();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
      setThreadDetailLoading(false);
    };
  }, [selectedId, activeFolder]);

  // Filter threads
  const visibleThreads = useMemo(() => {
    return threads.filter(t => t.folder === activeFolder);
  }, [threads, activeFolder]);

  const hasActiveSearchFilters = Boolean(
    searchFilters.unread ||
    searchFilters.flagged ||
    searchFilters.answered ||
    searchFilters.attachment ||
    searchFilters.from ||
    searchFilters.to ||
    searchFilters.since ||
    searchFilters.before
  );
  const isSearching = Boolean(searchQuery.trim() || hasActiveSearchFilters);

  if (isLoading || !isAuthenticated) return null;

  const showList = !isMobile || !selectedId;
  const showDetail = !isMobile || !!selectedId;

  return (
    <div className={cn(
      "mail-shell h-screen w-full flex overflow-hidden font-sans selection:bg-[#1DB954] selection:text-black relative",
      isDark ? "dark text-white" : "light text-black"
    )}>
      <Preloader onComplete={() => setLoading(false)} />
      <AnimatePresence>
        {accountSwitching && <AccountSwitchPreloader email={accountSwitchEmailRef.current || (user?.email || '')} />}
      </AnimatePresence>

      <div className={cn("flex w-full h-full overflow-hidden transition-opacity duration-1000", contentVisible ? "opacity-100" : "opacity-0")}>
      {/* Sidebar */}
      {(isDesktop || (isMobile && !sidebarCollapsed)) && (
         <div className={cn("shrink-0 z-30 h-full", isMobile && "fixed inset-0")}>
            <MailSidebar 
              accounts={accounts}
              activeAccountId={activeAccountId}
              activeEmail={user?.email || ''}
              activeFolder={activeFolder}
              onFolderChange={(f) => {
                if (f === activeFolder) return;
                threadsCursorRef.current = undefined;
                setThreadsCursor(undefined);
                setThreadsError(null);
                setThreadsLoading(true);
                setSelectedId(null);
                setThreadDetail(null);
                setThreadDetailLoading(false);
                setActiveFolder(f);
                if (isMobile) setSidebarCollapsed(true);
              }}
              onCompose={() => openCompose()}
              collapsed={!isMobile && sidebarCollapsed}
              setCollapsed={setSidebarCollapsed}
              onLogoutCurrent={requestLogoutCurrent}
              onLogoutAll={logout}
              onAddAccount={async (email, password) => addAccount(password, email)}
              onVerify2FAAddAccount={verify2FAAddAccount}
              onConfirm2FASetupAddAccount={confirm2FASetupAddAccount}
              onSwitchAccount={requestSwitchAccount}
              onLogoutAccount={logoutAccount}
              onUpdateAccountProfile={updateAccountProfile}
              isMobile={isMobile}
              folderCounts={folderCounts}
              folderUnreadCounts={folderUnreadCounts}
            />
         </div>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col min-w-0 z-10", isDark ? "bg-[#121212]" : "bg-white")}>
        
        {/* Global Header */}
        <header className={cn(
          "h-16 md:h-20 flex items-center justify-between px-4 md:px-8 border-b z-50 shrink-0 sticky top-0 transition-all duration-300",
          isDark ? "bg-[#0B0B0B] border-[#1A1A1A]" : "bg-[#F6F6F6] border-[#E5E5E5]"
        )}>
          
          {/* Typing Greeting (Left) */}
          <TypingGreeting />

          {/* Mobile Header Logo */}
          {isMobile && (
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSidebarCollapsed(false)}
                  className={cn("p-2 -ml-1 rounded-xl mr-1 group relative transition-all duration-300 hover:scale-105 active:scale-95", isDark ? "hover:bg-[#1A1A1A]" : "hover:bg-[#F0F0F0]")}
                >
                   <div className="flex flex-col gap-1.5 w-6 items-start">
                       <span className={cn("h-0.5 rounded-full w-3 transition-all duration-300 group-hover:w-6", isDark ? "bg-white" : "bg-black")} />
                       <span className={cn("h-0.5 rounded-full w-6 transition-all duration-300 group-hover:bg-[#1DB954]", isDark ? "bg-[#787878]" : "bg-[#949494]")} />
                       <span className={cn("h-0.5 rounded-full w-4 transition-all duration-300 group-hover:w-2", isDark ? "bg-white" : "bg-black")} />
                   </div>
                </button>
                <img src={arcByteLogo} alt="ArcMail" className={cn("h-7 w-auto object-contain", !isDark && "brightness-0")} />
                <span className={cn("font-bold text-xl tracking-tight", isDark ? "text-white" : "text-black")}>ArcMail</span>
             </div>
          )}

          {/* Center Search */}
          <div className={cn("flex-1 flex justify-center max-w-2xl mx-auto w-full relative", isMobile && "hidden")}>
             <div className="relative group w-full">
                {/* Search Glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1DB954]/20 to-[#1ED760]/20 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl" />
                
                <div className={cn(
                  "relative flex items-center h-12 px-5 border rounded-full shadow-sm group-focus-within:border-[#1DB954]/40 transition-all duration-300",
                  isDark ? "bg-[#121212] border-[#282828] group-focus-within:bg-[#181818]" : "bg-white border-[#E5E5E5] group-focus-within:bg-white"
                )}>
                   <Search size={18} className={cn("transition-colors mr-3", isDark ? "text-[#5E5E5E] group-focus-within:text-[#1DB954]" : "text-[#949494] group-focus-within:text-[#1DB954]")} />
                   <input 
                     placeholder={t('search_placeholder')}
                     className={cn(
                       "flex-1 bg-transparent border-none text-[15px] focus:outline-none h-full font-medium",
                       isDark ? "text-white placeholder:text-[#5E5E5E]" : "text-black placeholder:text-[#949494]"
                     )}
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                   />
                   <div className={cn("flex items-center gap-3 pl-3 border-l ml-2", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
                      <kbd className={cn("hidden md:inline-flex h-6 items-center gap-1 rounded border px-2 font-mono text-[10px] font-medium", isDark ? "border-[#333] bg-[#1A1A1A] text-[#787878]" : "border-[#E0E0E0] bg-[#F0F0F0] text-[#949494]")}>
                         <span className="text-xs">⌘</span>K
                      </kbd>
                      <button onClick={() => setFiltersOpen(v => !v)} className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}>
                         <Filter size={16} />
                      </button>
                      <button onClick={onVoiceToggle} aria-pressed={voiceActive} className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}>
                         <Mic size={16} />
                      </button>
                   </div>
                </div>
                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={cn("absolute left-0 right-0 top-14 rounded-2xl border p-4 grid grid-cols-2 md:grid-cols-3 gap-3 z-50", isDark ? "bg-[#0F0F0F] border-[#1A1A1A]" : "bg-white border-[#E5E5E5]")}
                    >
                      <div className="flex flex-col gap-1">
                        <label className={cn("text-xs font-semibold", isDark ? "text-white/70" : "text-black/70")}>From</label>
                        <input className={cn("h-9 rounded-lg px-3 border", isDark ? "bg-[#121212] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")} value={searchFilters.from || ''} onChange={e => setSearchFilters(s => ({ ...s, from: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={cn("text-xs font-semibold", isDark ? "text-white/70" : "text-black/70")}>To</label>
                        <input className={cn("h-9 rounded-lg px-3 border", isDark ? "bg-[#121212] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")} value={searchFilters.to || ''} onChange={e => setSearchFilters(s => ({ ...s, to: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">Unread</label>
                        <input type="checkbox" checked={!!searchFilters.unread} onChange={e => setSearchFilters(s => ({ ...s, unread: e.target.checked || undefined }))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">Flagged</label>
                        <input type="checkbox" checked={!!searchFilters.flagged} onChange={e => setSearchFilters(s => ({ ...s, flagged: e.target.checked || undefined }))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">Answered</label>
                        <input type="checkbox" checked={!!searchFilters.answered} onChange={e => setSearchFilters(s => ({ ...s, answered: e.target.checked || undefined }))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">Attachments</label>
                        <input type="checkbox" checked={!!searchFilters.attachment} onChange={e => setSearchFilters(s => ({ ...s, attachment: e.target.checked || undefined }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={cn("text-xs font-semibold", isDark ? "text-white/70" : "text-black/70")}>Since</label>
                        <input type="date" className={cn("h-9 rounded-lg px-3 border", isDark ? "bg-[#121212] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")} value={searchFilters.since || ''} onChange={e => setSearchFilters(s => ({ ...s, since: e.target.value || undefined }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={cn("text-xs font-semibold", isDark ? "text-white/70" : "text-black/70")}>Before</label>
                        <input type="date" className={cn("h-9 rounded-lg px-3 border", isDark ? "bg-[#121212] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")} value={searchFilters.before || ''} onChange={e => setSearchFilters(s => ({ ...s, before: e.target.value || undefined }))} />
                      </div>
                      <div className="col-span-full flex justify-end gap-2">
                        <button onClick={() => { setSearchFilters({}); setFiltersOpen(false); setSearchQuery(''); loadThreads({ reset: true }); }} className={cn("px-4 h-9 rounded-full text-xs font-semibold border", isDark ? "bg-[#121212] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>Clear</button>
                        <button onClick={() => { threadsCursorRef.current = undefined; setThreadsCursor(undefined); searchThreads({ reset: true }); setFiltersOpen(false); }} className="px-4 h-9 rounded-full text-xs font-semibold bg-[#1DB954] text-black">Apply</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-3 w-auto lg:w-20 min-w-max ml-4">
             {isMobile && (
               <button
                 onClick={() => setMobileSearchOpen(true)}
                 className={cn(
                   "p-3 rounded-full transition-colors border border-transparent",
                   isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A] hover:border-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0] hover:border-[#E5E5E5]"
                 )}
                 title={t('search_placeholder')}
               >
                 <Search size={20} />
               </button>
             )}
             <SettingsDropdown />

             {aiEnabled && selectedId && (
               <>
                 <button
                   onClick={openAskAI}
                   className={cn(
                     "hidden md:flex items-center gap-2 px-4 h-11 rounded-full border transition-all font-semibold text-sm whitespace-nowrap",
                     isDark
                       ? "bg-[#121212] border-[#282828] text-white hover:bg-[#181818] hover:border-[#1DB954]/30"
                       : "bg-white border-[#E5E5E5] text-black hover:bg-[#F0F0F0] hover:border-[#1DB954]/30"
                   )}
                 >
                   <Sparkles size={18} className="text-[#1DB954]" />
                   Ask AI
                 </button>
                 <button
                   onClick={openAskAI}
                   className={cn(
                     "md:hidden p-3 rounded-full transition-colors relative border border-transparent",
                     isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A] hover:border-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0] hover:border-[#E5E5E5]"
                   )}
                   title="Ask AI"
                 >
                   <Sparkles size={20} />
                 </button>
               </>
             )}

             <button className={cn(
               "p-3 rounded-full transition-colors relative border border-transparent",
               isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A] hover:border-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0] hover:border-[#E5E5E5]"
             )}>
                <div className={cn("absolute top-3 right-3 w-2 h-2 bg-[#1DB954] rounded-full border-2", isDark ? "border-[#0B0B0B]" : "border-white")} />
                <Inbox size={20} />
             </button>
          </div>
        </header>

        <AnimatePresence>
          {isMobile && mobileSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "fixed inset-x-0 top-16 z-[70] px-4 py-3 border-b",
                isDark ? "bg-[#0B0B0B] border-[#1A1A1A]" : "bg-[#F6F6F6] border-[#E5E5E5]"
              )}
            >
              <div className="relative group w-full">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1DB954]/20 to-[#1ED760]/20 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl" />
                <div
                  className={cn(
                    "relative flex items-center h-12 px-4 border rounded-full shadow-sm group-focus-within:border-[#1DB954]/40 transition-all duration-300",
                    isDark ? "bg-[#121212] border-[#282828] group-focus-within:bg-[#181818]" : "bg-white border-[#E5E5E5] group-focus-within:bg-white"
                  )}
                >
                  <Search size={18} className={cn("transition-colors mr-3", isDark ? "text-[#5E5E5E] group-focus-within:text-[#1DB954]" : "text-[#949494] group-focus-within:text-[#1DB954]")} />
                  <input
                    ref={mobileSearchInputRef}
                    placeholder={t('search_placeholder')}
                    className={cn(
                      "flex-1 bg-transparent border-none text-[15px] focus:outline-none h-full font-medium",
                      isDark ? "text-white placeholder:text-[#5E5E5E]" : "text-black placeholder:text-[#949494]"
                    )}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className={cn("flex items-center gap-2 pl-2 border-l ml-2", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
                    <button
                      onClick={() => setFiltersOpen(v => !v)}
                      className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}
                    >
                      <Filter size={16} />
                    </button>
                    <button
                      onClick={onVoiceToggle}
                      aria-pressed={voiceActive}
                      className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}
                    >
                      <Mic size={16} />
                    </button>
                    <button
                      onClick={() => setMobileSearchOpen(false)}
                      className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {askAiOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 bg-black/60" onClick={closeAskAI} />
              <motion.div
                initial={{ y: 14, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 14, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "relative w-full max-w-2xl rounded-3xl border overflow-hidden shadow-2xl",
                  isDark ? "bg-[#0F0F0F] border-[#1A1A1A]" : "bg-white border-[#E5E5E5]"
                )}
              >
                <div className={cn("px-5 py-4 flex items-start justify-between gap-4 border-b", isDark ? "border-[#1A1A1A]" : "border-[#E5E5E5]")}>
                  <div className="min-w-0">
                    <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>Ask AI</div>
                    <div className={cn("text-sm font-semibold mt-1 truncate", isDark ? "text-white" : "text-black")}>
                      {threadDetail?.subject || 'Selected email'}
                    </div>
                  </div>
                  <button
                    onClick={closeAskAI}
                    className={cn("p-2 rounded-full transition-colors", isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0]")}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-5 space-y-4">
                  <textarea
                    value={askAiQuestion}
                    onChange={(e) => setAskAiQuestion(e.target.value)}
                    placeholder="Ask any question about this email..."
                    rows={4}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB954]/30 resize-none",
                      isDark ? "bg-[#121212] border-[#1A1A1A] text-white placeholder:text-white/35" : "bg-white border-[#E5E5E5] text-black placeholder:text-black/35"
                    )}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        void submitAskAI();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className={cn("text-xs", isDark ? "text-white/45" : "text-black/45")}>Ctrl/⌘ + Enter to ask</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={closeAskAI}
                        className={cn(
                          "px-4 h-10 rounded-full text-xs font-semibold transition-colors border",
                          isDark ? "bg-[#121212] border-[#282828] text-white hover:bg-[#1A1A1A]" : "bg-white border-[#E5E5E5] text-black hover:bg-[#F6F6F6]"
                        )}
                      >
                        Close
                      </button>
                      <button
                        onClick={() => void submitAskAI()}
                        disabled={askAiBusy || !askAiQuestion.trim()}
                        className={cn(
                          "px-4 h-10 rounded-full text-xs font-semibold bg-[#1DB954] hover:bg-[#1ED760] text-black whitespace-nowrap flex items-center gap-2 transition-colors",
                          (askAiBusy || !askAiQuestion.trim()) && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {askAiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Ask
                      </button>
                    </div>
                  </div>

                  {askAiError && (
                    <div className={cn("rounded-2xl border px-4 py-3 text-sm", isDark ? "bg-[#1A1212] border-[#2A1414] text-white/85" : "bg-[#FFF3F3] border-[#FFD7D7] text-black/80")}>
                      {askAiError}
                    </div>
                  )}

                  {askAiAnswer !== null && (
                    <div className={cn("rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed", isDark ? "bg-[#121212] border-[#1A1A1A] text-white/85" : "bg-[#F9F9F9] border-[#EAEAEA] text-black/80")}>
                      {askAiAnswer || '—'}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn("flex-1 flex min-h-0", isMobile && "pb-16")}>
        {isMobile && mobileProfileOpen ? (
          <MobileProfileSection
            accounts={accounts}
            activeAccountId={activeAccountId}
            onClose={() => setMobileProfileOpen(false)}
            onSwitchAccount={requestSwitchAccount}
            onLogoutAccount={logoutAccount}
            onUpdateAccountProfile={updateAccountProfile}
            onAddAccount={async (email, password) => addAccount(password, email)}
            onVerify2FAAddAccount={verify2FAAddAccount}
            onConfirm2FASetupAddAccount={confirm2FASetupAddAccount}
            onLogoutCurrent={requestLogoutCurrent}
          />
        ) : (
          <>
          
          {/* Thread List */}
          {showList && (
            <div className={cn(
              "flex flex-col transition-all duration-300",
              isDark ? "bg-[#121212]" : "bg-white",
              isMobile ? "w-full" : (isDark ? "w-[420px] shrink-0 border-r border-[#1A1A1A]" : "w-[420px] shrink-0 border-r border-[#E5E5E5]")
            )}>
              {/* List Header */}
              <div className={cn(
                "h-16 flex items-center justify-between px-6 pb-2 pt-2 sticky top-0 z-20 backdrop-blur-md border-b",
                isDark ? "bg-[#121212]/95 border-[#1A1A1A]" : "bg-white/95 border-[#E5E5E5]"
              )}>
                 <div className="flex items-baseline gap-3">
                    <h2 className={cn("text-2xl font-bold capitalize tracking-tight", isDark ? "text-white" : "text-black")}>{t(activeFolder)}</h2>
                     <span className={cn("text-sm font-medium", isDark ? "text-[#5E5E5E]" : "text-[#949494]")}>{threads.length} {t('messages')}</span>
                  </div>
                 <div className="flex items-center gap-2">
                   <button className={cn(
                     "flex items-center gap-2 px-3 py-1.5 rounded-full border hover:border-[#1DB954]/30 transition-all group",
                     isDark ? "bg-[#1A1A1A] hover:bg-[#222] border-[#282828]" : "bg-white hover:bg-[#F9F9F9] border-[#E5E5E5]"
                   )}>
                      <span className={cn("text-xs font-bold group-hover:text-black transition-colors", isDark ? "text-[#B3B3B3] group-hover:text-white" : "text-[#5E5E5E]")}>{t('mark_all_read')}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]" />
                   </button>
                 </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative px-2 z-10">
                {activeFolder === 'inbox' && !isSearching && unreadLocalCount > 0 && Date.now() > replySnoozeUntil && (
                  <div
                    className={cn(
                      "mx-2 my-3 rounded-full px-5 py-3 flex items-center justify-between gap-4 border",
                      isDark ? "bg-[#121212] border-[#1F1F1F] text-white" : "bg-white border-[#E5E5E5] text-black"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <div className="text-sm font-semibold">{t('reply_reminder')}</div>
                        <div className={cn("text-xs truncate max-w-[220px]", isDark ? "text-white/50" : "text-black/50")}>
                          {t('reply_reminder_desc', { count: String(unreadLocalCount) })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                      <button
                        onClick={() => {
                          const until = Date.now() + 30 * 60 * 1000;
                          localStorage.setItem(replySnoozeKey, String(until));
                          setReplySnoozeUntil(until);
                        }}
                        className={cn(
                          "px-4 h-9 rounded-full text-xs font-semibold transition-colors whitespace-nowrap",
                          isDark ? "bg-transparent text-white/80 border border-[#2A2A2A] hover:bg-[#1A1A1A]" : "bg-transparent text-black/70 border border-[#E5E5E5] hover:bg-[#F7F7F7]"
                        )}
                      >
                        {t('remind_later')}
                      </button>
                      <button
                        onClick={() => {
                          const first = threads.find(t => t.unread);
                          if (first) setSelectedId(first.id);
                          else loadThreads({ reset: true });
                        }}
                        className="px-4 h-9 rounded-full text-xs font-semibold bg-[#1DB954] hover:bg-[#1ED760] text-black whitespace-nowrap"
                      >
                        {t('reply_now')}
                      </button>
                    </div>
                  </div>
                )}
                {threadsLoading && visibleThreads.length === 0 ? (
                      <div className="space-y-2 mt-2">
                         {[1,2,3,4,5].map(i => (
                           <div key={i} className={cn("h-24 rounded-md animate-pulse", isDark ? "bg-[#181818]" : "bg-[#F0F0F0]")} />
                         ))}
                      </div>
                    ) : threadsError ? (
                      <div className="px-4 py-6">
                        <div className={cn(
                          "rounded-2xl border p-5 flex items-center justify-between gap-4",
                          isDark ? "bg-[#181818] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black"
                        )}>
                          <div className="text-sm font-medium">{threadsError}</div>
                          <button
                            onClick={() => {
                              threadsCursorRef.current = undefined;
                              setThreadsCursor(undefined);
                              if (isSearching) {
                                searchThreads({ reset: true });
                              } else {
                                loadThreads({ reset: true });
                              }
                            }}
                            className={cn(
                              "px-4 py-2 rounded-full border text-xs font-bold tracking-wide transition-colors",
                              isDark ? "bg-[#1A1A1A] border-[#333] hover:border-[#1DB954]/40 hover:text-[#1DB954]" : "bg-white border-[#E5E5E5] hover:border-[#1DB954]/40 hover:text-[#1DB954]"
                            )}
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 pb-4">
                        {visibleThreads.map(t => (
                          <MailListItem 
                            key={t.id} 
                            thread={t} 
                            selected={selectedId === t.id}
                            onClick={() => {
                              setSelectedId(t.id);
                              setThreads(prev => prev.map(p => p.id === t.id ? { ...p, unread: false } : p));
                              markThreadRead(t.id);
                            }}
                          />
                        ))}
                        {visibleThreads.length === 0 && threadsLoading && !threadsError && (
                          <div className="flex-1 flex flex-col gap-3 py-6 px-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-[76px] rounded-2xl border overflow-hidden relative",
                                  isDark ? "bg-[#181818] border-[#282828]" : "bg-white border-[#E5E5E5]"
                                )}
                              >
                                <div className="absolute inset-0">
                                  <motion.div
                                    initial={{ x: "-60%" }}
                                    animate={{ x: "120%" }}
                                    transition={{ duration: 1.25, ease: "easeInOut", repeat: Infinity, delay: i * 0.06 }}
                                    className={cn(
                                      "absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-current to-transparent opacity-20",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  />
                                </div>
                                <div className="relative p-4 flex items-center gap-3">
                                  <div className={cn("w-11 h-11 rounded-2xl border", isDark ? "bg-[#121212] border-[#1A1A1A]" : "bg-[#F6F6F6] border-[#E5E5E5]")} />
                                  <div className="flex-1 min-w-0">
                                    <div className={cn("h-3 w-1/3 rounded-full", isDark ? "bg-white/10" : "bg-black/10")} />
                                    <div className={cn("h-3 w-2/3 rounded-full mt-3", isDark ? "bg-white/10" : "bg-black/10")} />
                                  </div>
                                  <div className={cn("h-3 w-12 rounded-full", isDark ? "bg-white/10" : "bg-black/10")} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {visibleThreads.length === 0 && !threadsLoading && (
                          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center relative overflow-hidden min-h-[400px]">
                             
                             <motion.div 
                                 initial={{ scale: 0.8, opacity: 0 }}
                                 animate={{ scale: 1, opacity: 1 }}
                                 transition={{ type: "spring", duration: 0.8 }}
                                 className="relative mb-8 group"
                             >
                                 <div className="absolute -inset-4 bg-[#1DB954]/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                 <div className={cn(
                                   "relative w-24 h-24 rounded-[2rem] flex items-center justify-center border group-hover:border-[#1DB954]/50 transition-colors duration-500",
                                   isDark ? "bg-[#181818] border-[#282828] shadow-[0_8px_30px_rgba(0,0,0,0.5)]" : "bg-white border-[#E5E5E5] shadow-lg"
                                 )}>
                                      <Inbox size={40} className={cn("group-hover:text-[#1DB954] transition-colors duration-500", isDark ? "text-[#5E5E5E]" : "text-[#949494]")} />
                                      
                                      <div className={cn("absolute top-0 right-0 w-3 h-3 bg-[#1DB954] rounded-full border-2 translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100", isDark ? "border-[#121212]" : "border-white")} />
                                 </div>
                             </motion.div>

                             <motion.div
                                 initial={{ y: 20, opacity: 0 }}
                                 animate={{ y: 0, opacity: 1 }}
                                 transition={{ delay: 0.2, duration: 0.5 }}
                             >
                                 <h3 className={cn("text-2xl font-bold mb-3 tracking-tight", isDark ? "text-white" : "text-black")}>{t('all_caught_up')}</h3>
                                 <p className={cn("max-w-[240px] mx-auto leading-relaxed", isDark ? "text-[#787878]" : "text-[#5E5E5E]")}>
                                   {t('empty_folder', { folder: t(activeFolder) })} <br/>{t('relax_message')}
                                 </p>
                                 
                                 <button className={cn(
                                   "mt-8 px-6 py-2.5 rounded-full border text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-lg",
                                   isDark ? "bg-[#1A1A1A] hover:bg-[#222] border-[#282828] text-white hover:text-[#1DB954]" : "bg-white hover:bg-[#F9F9F9] border-[#E5E5E5] text-black hover:text-[#1DB954]"
                                 )}>
                                    {t('refresh_inbox')}
                                 </button>
                             </motion.div>
                          </div>
                        )}
                      </div>
                    )}
              </div>
            </div>
          )}
          {/* Reading Pane */}
          {showDetail && (
            <ReadingPane 
              thread={threadDetail} 
              loading={threadDetailLoading} 
              showBack={isMobile}
              onBack={() => setSelectedId(null)}
              onReply={handleReply}
              onForward={handleForward}
              isMobile={isMobile}
              onCompose={() => openCompose()}
            />
          )}
          </>
        )}
        </div>

        {/* Global Footer */}
        <footer className={cn(
          "h-8 border-t hidden md:flex items-center justify-between px-4 z-20 shrink-0 text-[11px] font-medium select-none",
          isDark ? "bg-[#0B0B0B] border-[#1A1A1A] text-[#5E5E5E]" : "bg-[#F6F6F6] border-[#E5E5E5] text-[#737373]"
        )}>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 group cursor-help">
                 <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
                 <span className={cn("transition-colors", isDark ? "group-hover:text-white" : "group-hover:text-black")}>{t('system_operational')}</span>
              </div>
              <div className={cn("w-[1px] h-3", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />
              <span className={cn("transition-colors cursor-pointer", isDark ? "hover:text-white" : "hover:text-black")}>v2.4.0 (Stable)</span>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <span>{t('storage')}</span>
                 <div className={cn("w-20 h-1.5 rounded-full overflow-hidden", isDark ? "bg-[#1A1A1A]" : "bg-[#E5E5E5]")}>
                    <div className="w-[35%] h-full bg-[#1DB954] rounded-full" />
                 </div>
                 <span className={isDark ? "text-white" : "text-black"}>35%</span>
              </div>
              
              <div className="hidden md:flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <kbd className={cn("border rounded px-1 min-w-[16px] text-center text-[9px]", isDark ? "bg-[#1A1A1A] border-[#282828] text-[#B3B3B3]" : "bg-[#F0F0F0] border-[#E0E0E0] text-[#737373]")}>C</kbd>
                    <span>{t('compose')}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <kbd className={cn("border rounded px-1 min-w-[16px] text-center text-[9px]", isDark ? "bg-[#1A1A1A] border-[#282828] text-[#B3B3B3]" : "bg-[#F0F0F0] border-[#E0E0E0] text-[#737373]")}>/</kbd>
                    <span>{t('search')}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <kbd className={cn("border rounded px-1 min-w-[16px] text-center text-[9px]", isDark ? "bg-[#1A1A1A] border-[#282828] text-[#B3B3B3]" : "bg-[#F0F0F0] border-[#E0E0E0] text-[#737373]")}>?</kbd>
                    <span>{t('shortcuts')}</span>
                 </div>
              </div>
           </div>
        </footer>
      </main>

      {/* Mobile Nav */}
      {isMobile && !composeOpen && (
        <MobileNav 
          activeFolder={activeFolder}
          onFolderChange={(f) => {
            if (f === activeFolder) {
              setMobileProfileOpen(false);
              window.scrollTo(0, 0);
              return;
            }
            threadsCursorRef.current = undefined;
            setThreadsCursor(undefined);
            setThreadsError(null);
            setThreadsLoading(true);
            setSelectedId(null);
            setThreadDetail(null);
            setThreadDetailLoading(false);
            setActiveFolder(f);
            setMobileProfileOpen(false);
            window.scrollTo(0, 0);
          }}
          onCompose={() => {
            setMobileProfileOpen(false);
            openCompose();
          }}
          profileActive={mobileProfileOpen}
          onOpenProfile={() => {
            setMobileProfileOpen(true);
            window.scrollTo(0, 0);
          }}
        />
      )}

      </div>

      {composeOpen && (
        <ComposeModal
          key={composeState.key}
          isMobile={isMobile}
          onClose={closeCompose}
          initialDraft={composeState.draft}
          onSent={(folder, payload) => {
            showToast({ title: 'Sent successfully', subtitle: payload.subject ? payload.subject : undefined });
            if (folder === 'sent') {
              setFolderCounts((c) => ({ ...c, sent: (c.sent || 0) + 0 })); // keep unread 0
              setActiveFolder('sent');
              setSelectedId(null);
              const tempId = `local-sent-${Date.now()}`;
              const optimistic: MailThreadSummary = {
                id: tempId,
                folder: 'sent',
                sender: (user?.name || user?.email || 'Me'),
                senderEmail: user?.email || '',
                subject: payload.subject || '(no subject)',
                snippet: '',
                timestamp: new Date().toISOString(),
                unread: false,
                from: { name: user?.name || undefined, address: user?.email || '' },
                lastMessageAt: new Date().toISOString(),
              };
              const next = [optimistic, ...threads.filter(t => t.folder === 'sent')];
              setThreads(next);
              writePendingSent(next);
              // fetch real server state shortly after (allow server append to finish)
              setTimeout(() => loadThreads({ reset: true }), 3500);
            }
            if (threadDetail && selectedId && activeFolder === 'inbox') {
              const newMsg: MailThreadMessage = {
                id: `local-${Date.now()}`,
                subject: payload.subject || threadDetail.subject,
                fromName: user?.name || undefined,
                fromAddress: user?.email || undefined,
                to: (payload.to || []).map(a => ({ address: a })),
                cc: [],
                bcc: [],
                date: payload.date,
                text: payload.text,
                html: payload.html,
                attachments: [],
                flags: { seen: true, flagged: false, answered: true },
              };
              setThreadDetail(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
              setThreads(prev => prev.map(t => t.id === selectedId ? { ...t, unread: false } : t));
              window.setTimeout(() => {
                if (selectedIdRef.current) {
                  loadThreads({ reset: true });
                }
              }, 3000);
            }
          }}
        />
      )}
      <AnimatePresence>
        {welcomeOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => setWelcomeOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed inset-0 z-[75] flex items-center justify-center px-4"
            >
              <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
                <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/90 to-transparent" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px] shrink-0">
                        <div className={cn("w-full h-full rounded-2xl flex items-center justify-center", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                          <img src={arcByteLogo} alt="ArcMail" className={cn("h-6 w-auto object-contain", !isDark && "brightness-0")} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={cn("text-[11px] font-bold tracking-widest uppercase", isDark ? "text-white/45" : "text-black/45")}>
                          Welcome to ArcMail
                        </div>
                        <div className={cn("text-xl font-bold tracking-tight truncate", isDark ? "text-white" : "text-black")}>
                          {user?.name || 'Welcome'}
                        </div>
                        <div className={cn("text-sm truncate mt-0.5", isDark ? "text-white/55" : "text-black/55")}>
                          {user?.email || ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setWelcomeOpen(false)}
                      className={cn("p-2 rounded-full transition-colors", isDark ? "text-white/55 hover:text-white hover:bg-[#1A1A1A]" : "text-black/55 hover:text-black hover:bg-[#F0F0F0]")}
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <button
                    onClick={() => setWelcomeOpen(false)}
                    className={cn(
                      "w-full h-11 rounded-2xl font-bold text-[12px] tracking-[0.14em] transition-colors",
                      "bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black"
                    )}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {switchConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
              onClick={() => setSwitchConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            >
              <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
                <div className="h-[2px] bg-gradient-to-r from-transparent via-[#1DB954]/85 to-transparent" />
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0", isDark ? "bg-[#121212] border-[#282828]" : "bg-[#F7F7F7] border-[#E5E5E5]")}>
                      <UserRound size={18} className="text-[#1DB954]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-bold tracking-tight">Switch account?</div>
                      <div className={cn("text-sm mt-1", isDark ? "text-white/55" : "text-black/55")}>
                        Switch to {switchConfirm.name || switchConfirm.email} and open Inbox.
                      </div>
                    </div>
                  </div>
                </div>
                <div className={cn("px-6 pb-6 flex items-center gap-3", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                  <button
                    onClick={() => setSwitchConfirm(null)}
                    className={cn(
                      "flex-1 h-11 rounded-2xl font-bold text-[12px] border transition-colors",
                      isDark ? "bg-transparent border-[#282828] text-white/75 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSwitchAccount}
                    className="flex-1 h-11 rounded-2xl font-bold text-[12px] bg-gradient-to-r from-[#1DB954] to-[#1ED760] text-black transition-colors"
                  >
                    Switch
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logoutConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
              onClick={() => setLogoutConfirmOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            >
              <div className={cn("w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden", isDark ? "bg-[#0B0B0B] border-[#282828] text-white" : "bg-white border-[#E5E5E5] text-black")}>
                <div className="h-[2px] bg-gradient-to-r from-transparent via-[#FF5555]/85 to-transparent" />
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0", isDark ? "bg-[#121212] border-[#282828]" : "bg-[#F7F7F7] border-[#E5E5E5]")}>
                      <AlertTriangle size={18} className={cn(isDark ? "text-[#FF5555]" : "text-[#FF5555]")} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-bold tracking-tight">Log out?</div>
                      <div className={cn("text-sm mt-1", isDark ? "text-white/55" : "text-black/55")}>
                        {accounts.length > 1
                          ? "This logs out the active account and switches to the next account."
                          : "This will sign you out and return to the login screen."}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={cn("px-6 pb-6 flex items-center gap-3", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                  <button
                    onClick={() => setLogoutConfirmOpen(false)}
                    className={cn(
                      "flex-1 h-11 rounded-2xl font-bold text-[12px] border transition-colors",
                      isDark ? "bg-transparent border-[#282828] text-white/75 hover:bg-[#1A1A1A] hover:text-white" : "bg-transparent border-[#E5E5E5] text-black/70 hover:bg-[#F6F6F6] hover:text-black"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLogoutCurrent}
                    className="flex-1 h-11 rounded-2xl font-bold text-[12px] bg-[#FF5555] hover:bg-[#FF6B6B] text-black transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast?.open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              "fixed z-[60] px-4",
              isMobile
                ? "left-0 right-0 top-[calc(4rem+env(safe-area-inset-top)+0.75rem)]"
                : "right-6 top-24"
            )}
          >
            <div className="w-full max-w-[520px] mx-auto">
              <div className="relative rounded-2xl bg-[#121212]/95 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 bg-[#0F0F0F]")}>
                    {toast.variant === 'success' ? (
                      <Check size={18} className="text-[#1DB954]" strokeWidth={2.6} />
                    ) : toast.variant === 'info' ? (
                      <Inbox size={18} className="text-[#1DB954]" strokeWidth={2.6} />
                    ) : (
                      <AlertTriangle size={18} className="text-[#FF7777]" strokeWidth={2.6} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[13px] font-semibold tracking-tight leading-tight text-white">{toast.title}</div>
                    {toast.subtitle && (
                      <div className="mt-1 text-[12px] leading-snug truncate text-white/55">{toast.subtitle}</div>
                    )}
                  </div>
                  {toast.actionLabel && toast.onAction && (
                    <button
                      onClick={() => {
                        toast.onAction?.();
                        setToast((t) => (t ? { ...t, open: false } : t));
                      }}
                      className={cn(
                        "h-10 px-3 rounded-2xl text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors border",
                        toast.variant === 'error'
                          ? "border-white/10 text-white/80 hover:bg-white/5"
                          : "border-white/10 text-white/80 hover:bg-white/5"
                      )}
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                  <button
                    onClick={() => setToast((t) => (t ? { ...t, open: false } : t))}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors border border-white/10 text-white/65 hover:text-white hover:bg-white/5"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="h-[2px] w-full bg-white/10">
                  <motion.div
                    key={toast.id}
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 3.2, ease: 'linear' }}
                    className={cn("h-full", toast.variant === 'error' ? "bg-[#FF5555]" : "bg-[#1DB954]")}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MailApp = () => {
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => setIsDark(!isDark);
  const [language, setLanguage] = useState<Language>('en');
  const [aiEnabled, setAiEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('arcmailAiEnabled');
      if (v === null) return true;
      return v === '1';
    } catch {
      return true;
    }
  });
  const toggleAi = useCallback(() => {
    setAiEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('arcmailAiEnabled', next ? '1' : '0');
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [language]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <AIContext.Provider value={{ aiEnabled, toggleAi }}>
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
          <MailAppContent />
        </LanguageContext.Provider>
      </AIContext.Provider>
    </ThemeContext.Provider>
  );
};

export default MailApp;
