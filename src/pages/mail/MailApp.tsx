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
  Filter,
  Clock,
  X,
  Menu,
  Mic,
  ChevronRight,
  MoreVertical,
  PanelLeftClose,
  Settings,
  Moon,
  Sun,
  Globe,
  MessageSquare,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { cn } from '../../utils/cn';
import { RichTextEditor } from '../../components/editor/RichTextEditor';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
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

// --- Types ---

type MailFolder = 'inbox' | 'drafts' | 'sent' | 'spam' | 'trash';

const MAIL_FOLDER_IMAP_PATH: Record<MailFolder, string> = {
  inbox: 'INBOX',
  drafts: 'Drafts',
  sent: 'Sent',
  spam: 'Spam',
  trash: 'Trash',
};

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
  lastMessageAt?: string;
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
};

type ComposeDraft = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  showCcBcc?: boolean;
};

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
          {count !== undefined && count > 0 && (
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
  email,
  activeFolder,
  onFolderChange,
  onCompose,
  collapsed,
  setCollapsed,
  onLogout,
  isMobile,
  folderCounts,
}: {
  email: string;
  activeFolder: MailFolder;
  onFolderChange: (f: MailFolder) => void;
  onCompose: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onLogout: () => void;
  isMobile: boolean;
  folderCounts?: Partial<Record<MailFolder, number>>;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

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
            count={folderCounts?.inbox}
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
            count={folderCounts?.sent}
          />
          <SidebarItem
            icon={FileText}
            label={t('drafts')}
            active={activeFolder === 'drafts'}
            onClick={() => onFolderChange('drafts')}
            collapsed={collapsed}
            count={folderCounts?.drafts}
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
            count={folderCounts?.spam}
          />
          <SidebarItem
            icon={Trash2}
            label={t('trash')}
            active={activeFolder === 'trash'}
            onClick={() => onFolderChange('trash')}
            collapsed={collapsed}
            count={folderCounts?.trash}
          />
        </div>
      </nav>

      {/* Profile */}
      <div className={cn("p-4 mt-auto border-t", isDark ? "border-[#1A1A1A]" : "border-[#E5E5E5]")}>
        <div className={cn(
            "relative flex items-center gap-3 w-full p-3 rounded-2xl transition-all duration-300 group cursor-pointer overflow-hidden",
            collapsed ? "justify-center p-0 bg-transparent" : (isDark ? "bg-[#181818] border border-[#282828]" : "bg-white border border-[#E5E5E5] shadow-sm")
        )}>
           
           {/* Avatar */}
           <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ED760] p-[2px]">
                 <div className={cn("w-full h-full rounded-full flex items-center justify-center", isDark ? "bg-[#0B0B0B]" : "bg-white")}>
                    <span className={cn("font-bold", isDark ? "text-white" : "text-black")}>{email.charAt(0).toUpperCase()}</span>
                 </div>
              </div>
              <div className={cn("absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#1DB954] border-2 rounded-full z-10", isDark ? "border-[#121212]" : "border-white")} />
           </div>

           {!collapsed && (
             <>
               <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center justify-between">
                     <span className={cn("text-[14px] font-bold truncate", isDark ? "text-white" : "text-black")}>{email.split('@')[0]}</span>
                  </div>
                  <div className={cn("text-[12px] truncate", isDark ? "text-[#787878]" : "text-[#949494]")}>{email}</div>
               </div>
               
               <button 
                 onClick={onLogout}
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
            <span className={cn(
              "text-[12px] shrink-0",
              thread.unread ? "text-[#1DB954] font-medium" : (isDark ? "text-[#5E5E5E]" : "text-[#949494]")
            )}>
              {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
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
           <span>{thread.snippet}</span>
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

  return (
    <div className={cn("flex-1 flex flex-col h-full relative overflow-hidden", isDark ? "bg-[#121212]" : "bg-white")}>
      {/* Spotify Gradient Overlay */}
      {isDark && <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-[#1DB954]/10 via-[#1DB954]/[0.02] to-transparent pointer-events-none z-0" />}
      
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

          {/* Messages */}
          <div className="space-y-8">
            {thread.messages.map((msg, idx) => {
               const isLast = idx === thread.messages.length - 1;
               const senderInitial = (msg.fromName || msg.fromAddress || '?')[0].toUpperCase();
               
               return (
                 <div key={msg.id} className={cn("group transition-all duration-300", !isLast && "opacity-60 hover:opacity-100")}>
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border", isDark ? "bg-gradient-to-b from-[#333] to-[#181818] text-white border-[#282828]" : "bg-gradient-to-b from-[#F5F5F5] to-white text-black border-[#E5E5E5]")}>
                            {senderInitial}
                          </div>
                          <div>
                             <div className="flex items-baseline gap-2">
                               <span className={cn("text-[15px] font-bold", isDark ? "text-white" : "text-black")}>
                                 {msg.fromName || msg.fromAddress}
                               </span>
                               <span className={cn("text-[12px]", isDark ? "text-[#787878]" : "text-[#949494]")}>
                                 {new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                               </span>
                             </div>
                             <div className={cn("text-[12px]", isDark ? "text-[#B3B3B3]" : "text-[#5E5E5E]")}>
                               to {msg.to.map(t => t.name || t.address).join(', ')}
                             </div>
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
                       
                       {msg.attachments.length > 0 && (
                         <div className="mt-6 flex flex-wrap gap-3">
                           {msg.attachments.map(att => (
                             <div key={att.id} className={cn(
                               "flex items-center gap-3 p-3 pr-4 rounded-xl border transition-all cursor-pointer group/att",
                               isDark ? "bg-[#181818] border-[#282828] hover:bg-[#222] hover:border-[#333]" : "bg-white border-[#E5E5E5] hover:bg-[#F9F9F9] hover:border-[#D4D4D4]"
                             )}>
                               <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isDark ? "bg-[#282828]" : "bg-[#F0F0F0]")}>
                                  <FileText size={20} className={cn("group-hover/att:text-[#1DB954]", isDark ? "text-[#B3B3B3]" : "text-[#5E5E5E]")} />
                               </div>
                               <div className="flex flex-col">
                                 <span className={cn("text-[13px] font-medium truncate max-w-[150px]", isDark ? "text-white" : "text-black")}>{att.filename}</span>
                                 <span className={cn("text-[11px]", isDark ? "text-[#787878]" : "text-[#949494]")}>{(att.size / 1024).toFixed(1)} KB</span>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
               );
            })}
          </div>

          <div className={cn("mt-10 pt-8 border-t flex items-center gap-3", isDark ? "border-[#282828]" : "border-[#E5E5E5]")}>
            <button
              onClick={onReply}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all hover:scale-105 active:scale-95",
                isDark ? "bg-[#1A1A1A] text-white hover:bg-[#222] border border-[#282828]" : "bg-white text-black hover:bg-[#F9F9F9] border border-[#E5E5E5]"
              )}
            >
              <Reply size={16} strokeWidth={2.5} />
              <span>{t('reply')}</span>
            </button>
            <button
              onClick={onForward}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all hover:scale-105 active:scale-95",
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
    const css = `
      html, body { margin: 0; padding: 0; }
      body { background: #ffffff; color: #121212; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 15px; line-height: 1.65; padding: 16px; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      pre { white-space: pre-wrap; word-break: break-word; }
      blockquote { margin: 12px 0; padding-left: 12px; border-left: 2px solid #e5e5e5; }
      hr { border: 0; border-top: 1px solid #e5e5e5; margin: 16px 0; }
      ${isDark ? 'img, video { filter: invert(1) hue-rotate(180deg); }' : ''}
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
        className={cn("w-full block", isDark ? "bg-[#121212]" : "bg-white")}
        style={{ height: `${heightPx}px`, maxHeight: '70vh', filter: isDark ? 'invert(1) hue-rotate(180deg)' : undefined }}
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

      await api.post('/mail/send', {
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: subject.trim(),
        html: body,
        text: plainText,
      });
      // const savedTo = (resp?.data && typeof resp.data === 'object' && 'savedTo' in resp.data) ? (resp.data.savedTo as string | null) : null;
      onSent?.('sent', { to: toList, subject: subject.trim(), html: body, text: plainText, date: new Date().toISOString() });
      onClose();
    } catch {
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
  onMenu
}: {
  activeFolder: MailFolder;
  onFolderChange: (f: MailFolder) => void;
  onCompose: () => void;
  onMenu: () => void;
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
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
          isActive={activeFolder === 'inbox'} 
          onClick={() => onFolderChange('inbox')}
          isDark={isDark}
        />
        
        <MobileNavItem 
          icon={Send} 
          label={t('sent')} 
          isActive={activeFolder === 'sent'} 
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
          isActive={activeFolder === 'drafts'} 
          onClick={() => onFolderChange('drafts')}
          isDark={isDark}
        />
        
        <MobileNavItem 
          icon={Menu} 
          label={t('more')} 
          isActive={false} 
          onClick={onMenu}
          isDark={isDark}
        />
      </div>
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

const SettingsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
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

                <div className={cn("h-[1px] my-1 mx-2", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />

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

// --- Main App Content ---

const MailAppContent = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isDesktop } = useViewport();
  const { isDark } = useTheme();
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
  const [folderCounts, setFolderCounts] = useState<Partial<Record<MailFolder, number>>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [composeState, setComposeState] = useState<{ open: boolean; key: number; draft?: ComposeDraft }>({
    open: false,
    key: 0,
    draft: undefined,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const threadsAbortRef = useRef<AbortController | null>(null);
  const threadsCursorRef = useRef<string | undefined>(undefined);
  const selectedIdRef = useRef<string | null>(null);
  const composeOpen = composeState.open;
  const prevInboxUnseenRef = useRef<number>(0);
  const replySnoozeKey = 'replyReminderSnoozeUntil';
  const [replySnoozeUntil, setReplySnoozeUntil] = useState<number>(() => {
    const raw = localStorage.getItem(replySnoozeKey);
    return raw ? Number(raw) || 0 : 0;
  });
  const unreadLocalCount = useMemo(() => threads.reduce((n, t) => n + (t.unread ? 1 : 0), 0), [threads]);

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
        params: { folder: imapFolder, limit: 50, cursor: reset ? undefined : threadsCursorRef.current },
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
      }));

      setThreads(prev => {
        if (reset) {
          if (activeFolder === 'sent' && mapped.length === 0) {
            const hasLocal = prev.some(p => p.folder === 'sent' && String(p.id).startsWith('local-sent-'));
            if (hasLocal) return prev;
            const pending = readPendingSent();
            if (pending.length) return pending;
          }
          if (activeFolder === 'sent' && mapped.length > 0) clearPendingSent();
          return mapped;
        }
        const existingIds = new Set(prev.map(p => p.id));
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

  // Initial load
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'MAIL_USER') {
      const hasLocalSent =
        activeFolder === 'sent' && readPendingSent().length > 0;
      if (!hasLocalSent) {
        setThreads([]);
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
        document.title = inboxUnseen > 0 ? `(${inboxUnseen}) ${base}` : base;
      };

      const fetchStats = async () => {
        try {
          const res = await api.get('/mail/folders/stats', { signal: controller.signal });
          if (stopped) return;
          const folders = (res.data as { folders?: Record<string, { unseen?: number }> }).folders || {};
          const nextCounts: Partial<Record<MailFolder, number>> = {
            inbox: Number(folders.inbox?.unseen || 0),
            sent: Number(folders.sent?.unseen || 0),
            drafts: Number(folders.drafts?.unseen || 0),
            spam: Number(folders.spam?.unseen || 0),
            trash: Number(folders.trash?.unseen || 0),
          };
          setFolderCounts(nextCounts);

          const inboxUnseen = nextCounts.inbox || 0;
          updateTitle(inboxUnseen);

          if (inboxUnseen > prevInboxUnseenRef.current) {
            if (typeof Notification !== 'undefined' && document.hidden && Notification.permission === 'granted') {
              new Notification('New unread mail', { body: `Inbox: ${inboxUnseen} unread` });
            }
          }
          prevInboxUnseenRef.current = inboxUnseen;
        } catch {
          return;
        }
      };

      fetchStats();
      const intervalId = window.setInterval(fetchStats, 20000);
      return () => {
        stopped = true;
        controller.abort();
        window.clearInterval(intervalId);
      };
    }
  }, [isAuthenticated, isLoading, user]);

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
        const data = res.data as { thread: MailThreadDetail | null };
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

  if (isLoading || !isAuthenticated) return null;

  const showList = !isMobile || !selectedId;
  const showDetail = !isMobile || !!selectedId;

  return (
    <div className={cn(
      "mail-shell h-screen w-full flex overflow-hidden font-sans selection:bg-[#1DB954] selection:text-black relative",
      isDark ? "dark text-white" : "light text-black"
    )}>
      <Preloader onComplete={() => setLoading(false)} />

      <div className={cn("flex w-full h-full overflow-hidden transition-opacity duration-1000", contentVisible ? "opacity-100" : "opacity-0")}>
      {/* Sidebar */}
      {(isDesktop || (isMobile && !sidebarCollapsed)) && (
         <div className={cn("shrink-0 z-30 h-full", isMobile && "fixed inset-0")}>
            <MailSidebar 
              email={user?.email || ''}
              activeFolder={activeFolder}
              onFolderChange={(f) => {
                setActiveFolder(f);
                if (isMobile) setSidebarCollapsed(true);
              }}
              onCompose={() => openCompose()}
              collapsed={!isMobile && sidebarCollapsed}
              setCollapsed={setSidebarCollapsed}
              onLogout={logout}
              isMobile={isMobile}
              folderCounts={folderCounts}
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
                      <button className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}>
                         <Filter size={16} />
                      </button>
                      <button className={cn("transition-colors p-1.5 rounded-full", isDark ? "text-[#787878] hover:text-white hover:bg-[#282828]" : "text-[#949494] hover:text-black hover:bg-[#F0F0F0]")}>
                         <Mic size={16} />
                      </button>
                   </div>
                </div>
             </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-3 w-auto lg:w-20 min-w-max ml-4">
             <SettingsDropdown />

             <button className={cn(
               "p-3 rounded-full transition-colors relative border border-transparent",
               isDark ? "text-[#B3B3B3] hover:text-white hover:bg-[#1A1A1A] hover:border-[#282828]" : "text-[#5E5E5E] hover:text-black hover:bg-[#F0F0F0] hover:border-[#E5E5E5]"
             )}>
                <div className={cn("absolute top-3 right-3 w-2 h-2 bg-[#1DB954] rounded-full border-2", isDark ? "border-[#0B0B0B]" : "border-white")} />
                <Inbox size={20} />
             </button>
          </div>
        </header>

        <div className={cn("flex-1 flex min-h-0", isMobile && "pb-16")}>
          
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
                {activeFolder === 'inbox' && unreadLocalCount > 0 && Date.now() > replySnoozeUntil && (
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const until = Date.now() + 30 * 60 * 1000;
                          localStorage.setItem(replySnoozeKey, String(until));
                          setReplySnoozeUntil(until);
                        }}
                        className={cn(
                          "px-4 h-9 rounded-full text-xs font-semibold transition-colors",
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
                        className="px-4 h-9 rounded-full text-xs font-semibold bg-[#1DB954] hover:bg-[#1ED760] text-black"
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
                        onClick={() => loadThreads({ reset: true })}
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
                    {visibleThreads.length === 0 && (
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
                                  
                                  {/* Decor elements */}
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
            setActiveFolder(f);
            window.scrollTo(0, 0);
          }}
          onCompose={() => openCompose()}
          onMenu={() => setSidebarCollapsed(false)}
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
    </div>
  );
};

const MailApp = () => {
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => setIsDark(!isDark);
  const [language, setLanguage] = useState<Language>('en');

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
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <MailAppContent />
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
};

export default MailApp;
