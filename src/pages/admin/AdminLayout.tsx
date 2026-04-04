import React from 'react';
import { LayoutDashboard, Globe, AtSign, Activity, Lock, Send, Settings, HelpCircle, LogOut, Mail, Bell, Search, Plus, Moon, Sun } from 'lucide-react';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';

interface AdminLayoutProps {
  user: any;
  tab: string;
  setTab: (t: string) => void;
  onLogout: () => void;
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  children: React.ReactNode;
}

export function AdminLayout({ user, tab, setTab, onLogout, isDark, setIsDark, children }: AdminLayoutProps) {
  const tabs = [
    { id: 'twofa', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'domains', icon: Globe, label: 'Domains' },
    { id: 'emails', icon: AtSign, label: 'Emails' },
    { id: 'activity', icon: Activity, label: 'Activity' },
    { id: 'login', icon: Lock, label: 'Security' },
    { id: 'send', icon: Send, label: 'Send Access' },
  ];

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-6 font-sans transition-colors duration-200", isDark ? "bg-[#0B0B0B] text-[#E2E8F0]" : "bg-[#F2F4F7] text-[#1A1D1F]")}>
      <main className={cn("w-full max-w-[1500px] h-full min-h-[900px] rounded-[32px] overflow-hidden flex shadow-[0_20px_60px_rgba(0,0,0,0.05)] border transition-colors duration-200", isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
        
        {/* SIDEBAR */}
        <aside className={cn("w-[260px] flex-shrink-0 flex flex-col pt-8 pb-8 px-6 border-r relative z-10 transition-colors duration-200", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#F1F5F9]")}>
          <div className="flex items-center gap-3 px-2">
             <div className={cn("h-10 w-10 rounded-full shadow-sm flex items-center justify-center border overflow-hidden p-2", isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>
               <img src={arcByteLogo} alt="Logo" className={cn("w-full h-full object-contain", isDark ? "" : "brightness-0")} />
             </div>
             <div className={cn("text-[20px] font-bold tracking-tight", isDark ? "text-white" : "text-[#111827]")}>ArcByte</div>
          </div>

          <div className="mt-10 flex-1 overflow-y-auto custom-scrollbar">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#94A3B8] px-3 mb-4">Menu</div>
            <div className="space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 relative h-11 rounded-lg transition-colors group",
                    tab === t.id 
                      ? (isDark ? "bg-[#1A1A1A]" : "bg-[#F8FAFC]") 
                      : (isDark ? "hover:bg-[#1A1A1A]" : "hover:bg-[#F8FAFC]")
                  )}
                >
                  {tab === t.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#1F7A55] rounded-r-md" />
                  )}
                  <t.icon size={18} className={cn(tab === t.id ? "text-[#1F7A55]" : (isDark ? "text-[#94A3B8] group-hover:text-[#E2E8F0]" : "text-[#64748B] group-hover:text-[#94A3B8]"))} />
                  <span className={cn("text-[14px] font-semibold", tab === t.id ? "text-[#1F7A55]" : (isDark ? "text-white" : "text-[#64748B] group-hover:text-[#94A3B8]"))}>
                    {t.label}
                  </span>
                  {t.id === 'emails' && <div className="ml-auto bg-[#1F7A55] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">12+</div>}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#94A3B8] px-3 mt-8 mb-4">General</div>
            <div className="space-y-1">
              <button className={cn("w-full flex items-center gap-3 px-3 h-11 rounded-lg transition-colors group", isDark ? "hover:bg-[#1A1A1A] text-white" : "hover:bg-[#F8FAFC] text-[#64748B]")}>
                <Settings size={18} className={cn(isDark ? "text-[#94A3B8] group-hover:text-[#E2E8F0]" : "group-hover:text-[#94A3B8]")}/>
                <span className="text-[14px] font-semibold">Settings</span>
              </button>
              <button className={cn("w-full flex items-center gap-3 px-3 h-11 rounded-lg transition-colors group", isDark ? "hover:bg-[#1A1A1A] text-white" : "hover:bg-[#F8FAFC] text-[#64748B]")}>
                <HelpCircle size={18} className={cn(isDark ? "text-[#94A3B8] group-hover:text-[#E2E8F0]" : "group-hover:text-[#94A3B8]")}/>
                <span className="text-[14px] font-semibold">Help</span>
              </button>
              <button onClick={onLogout} className={cn("w-full flex items-center gap-3 px-3 h-11 rounded-lg transition-colors group", isDark ? "hover:bg-[#BE185D]/10 text-[#E2E8F0] hover:text-[#BE185D]" : "hover:bg-[#FDF2F8] text-[#64748B] hover:text-[#BE185D]")}>
                <LogOut size={18} className={cn(isDark ? "text-[#94A3B8] group-hover:text-[#BE185D]" : "")} />
                <span className="text-[14px] font-semibold">Logout</span>
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-[20px] bg-gradient-to-b from-[#0F3523] to-[#0A2617] p-5 text-center relative overflow-hidden shadow-xl border border-[#174F34]">
            <div className="absolute inset-0 bg-white/5 opacity-30" style={{ backgroundSize: '20px 20px', backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)'}}></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center mb-4">
                 <img src={arcByteLogo} className="h-5 w-5 brightness-0 invert opacity-90" />
              </div>
              <div className="font-bold text-[16px] text-white leading-[1.2] mb-1.5">Download our<br/>Mobile App</div>
              <div className="text-[12px] text-white/50 mb-5 font-medium">Get easy in another way</div>
              <a href="https://mail.arcbyte.co/arcmail/app" target="_blank" rel="noopener noreferrer" className="block w-full py-2.5 rounded-full bg-[#1F7A55] hover:bg-[#1C6949] text-white text-[13px] font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(31,122,85,0.4)]">
                Download
              </a>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <div className={cn("flex-1 flex flex-col min-w-0 transition-colors duration-200", isDark ? "bg-[#0F0F0F]" : "bg-[#F8FAFC]")}>
          {/* HEADER */}
          <header className={cn("h-[90px] flex items-center justify-between px-10 border-b shrink-0 relative z-20 transition-colors duration-200", isDark ? "bg-[#141414] border-[#2A2A2A]" : "bg-white border-[#F1F5F9]")}>
            <div className="relative w-full max-w-[420px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18}/>
              <input 
                className={cn("w-full h-11 border rounded-full pl-11 pr-14 text-[14px] outline-none placeholder-[#94A3B8] font-medium transition-all", isDark ? "bg-[#0B0B0B] border-[#2A2A2A] text-white focus:border-[#404040]" : "bg-[#F8FAFC] border-[#F1F5F9] text-[#0F172A] focus:border-[#E2E8F0] focus:bg-white")}
                placeholder="Search task" 
              />
              <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 border rounded-md shadow-sm text-[11px] font-bold text-[#64748B]", isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-[#E2E8F0]")}>⌘F</div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsDark(!isDark)}
                  className={cn("h-[42px] w-[42px] rounded-full border flex items-center justify-center transition-colors", isDark ? "border-[#2A2A2A] text-[#94A3B8] hover:bg-[#1A1A1A]" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]")}
                >
                  {isDark ? <Sun size={18} className="text-[#FBBF24]" /> : <Moon size={18}/>}
                </button>
                <button className={cn("h-[42px] w-[42px] rounded-full border flex items-center justify-center transition-colors", isDark ? "border-[#2A2A2A] text-[#94A3B8] hover:bg-[#1A1A1A]" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]")}><Mail size={18}/></button>
                <button className={cn("h-[42px] w-[42px] rounded-full border flex items-center justify-center transition-colors", isDark ? "border-[#2A2A2A] text-[#94A3B8] hover:bg-[#1A1A1A]" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]")}><Bell size={18}/></button>
              </div>
              <div className={cn("h-8 w-[1px]", isDark ? "bg-[#2A2A2A]" : "bg-[#E2E8F0]")}></div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="h-[42px] w-[42px] rounded-full bg-[#FFE4D6] flex items-center justify-center text-[#E56832] font-extrabold text-[16px] shadow-sm group-hover:scale-105 transition-transform">
                  {(user?.username || 'T')[0]?.toUpperCase()}
                </div>
                <div>
                  <div className={cn("font-bold text-[14px] leading-none mb-1.5", isDark ? "text-white" : "text-[#0F172A]")}>{user?.username || 'Admin User'}</div>
                  <div className="text-[12px] text-[#64748B] leading-none font-medium">{user?.email || 'admin@arcmail.com'}</div>
                </div>
              </div>
            </div>
          </header>

          {/* SCROLLING CONTENT PORTAL */}
          <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
