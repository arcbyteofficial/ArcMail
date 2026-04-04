import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, Mail, Check } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import arcByteLogo from '../../assets/arcbyte.co Logo_white_transparent.png';
import AdminDesktopOnlyGate from '../../components/admin/AdminDesktopOnlyGate';
import { getAdminBaseUrl } from '../../api/adminClient';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const isLocalDev = useMemo(() => {
    try {
      const host = window.location.hostname;
      return import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1');
    } catch {
      return false;
    }
  }, []);
  const allowRemote = useMemo(() => {
    try {
      return (localStorage.getItem('arcmailAdminAllowRemoteApi') || '') === '1';
    } catch {
      return false;
    }
  }, []);
  const adminBase = isLocalDev ? getAdminBaseUrl() : '';

  return (
    <AdminDesktopOnlyGate>
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="w-full max-w-[1280px] h-[800px] flex p-4 md:p-6 lg:p-8">
          
          {/* LEFT SIDE - FORM */}
          <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 lg:px-20 relative">
            
            {/* Logo */}
            <div className="mb-10 flex flex-col mt-[-40px]">
              <div className="flex items-center justify-center w-12 h-12 mb-2">
                 <img src={arcByteLogo} alt="ArcByte" className="h-8 w-8 object-contain brightness-0" />
              </div>
              <div className="font-extrabold text-[16px] tracking-tight text-[#0F172A]">ArcByte</div>
            </div>

            <h1 className="text-[32px] font-bold text-[#0F172A] mb-8 tracking-tight">Sign in</h1>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-[13px] font-bold flex items-center gap-2 rounded-xl">
                <Lock size={14} />
                {error}
              </div>
            )}

            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setBusy(true);
                try {
                  const res = await login(username.trim(), password);
                  if (!res.ok) {
                    setError(res.error || 'Login failed.');
                    return;
                  }
                  navigate('/admin', { replace: true });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div>
                <label className="block text-[12px] font-bold text-[#111827] mb-2">Username</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-11 bg-white border border-[#E2E8F0] rounded-xl pl-11 pr-4 text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#1F7A55] focus:ring-1 focus:ring-[#1F7A55] transition-all shadow-sm"
                    placeholder="example@domain.com"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#111827] mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    className="w-full h-11 bg-white border border-[#E2E8F0] rounded-xl pl-11 pr-4 text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#1F7A55] focus:ring-1 focus:ring-[#1F7A55] transition-all shadow-sm tracking-widest"
                    placeholder="••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <button type="button" onClick={() => setRemember(!remember)} className={cn("w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors", remember ? "bg-[#1A1A1A] border-[#1A1A1A]" : "bg-white border-[#D1D5DB]")}>
                  {remember && <Check size={12} className="text-white"/>}
                </button>
                <span className="text-[12px] font-bold text-[#111827] cursor-pointer" onClick={() => setRemember(!remember)}>Remember me</span>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-[#1A1A1A] hover:bg-black text-white text-[13px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : 'Sign in'}
              </button>

            </form>

            {isLocalDev && (
              <div className="absolute bottom-8 left-8 text-[11px] font-mono text-[#94A3B8] flex items-center gap-4">
                <span>API: {adminBase || 'None'}</span>
              </div>
            )}
          </div>

          {/* RIGHT SIDE - DARK GRAPHIC PANEL */}
          <div className="hidden lg:flex flex-1 bg-[#09090B] rounded-[32px] relative overflow-hidden flex-col shadow-2xl">
            
            {/* Background Geometric Abstract Pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute top-[10%] left-[20%] w-[300px] h-[300px] rotate-45 border-r-[40px] border-b-[20px] border-white/5 mix-blend-overlay"></div>
              <div className="absolute top-[40%] right-[-10%] w-[500px] h-2 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent rotate-[35deg]"></div>
              <div className="absolute bottom-[20%] left-[-20%] w-[800px] h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rotate-[-35deg]"></div>
            </div>

            {/* Large 3D "A" Graphic centered top */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[300px] h-[300px] flex items-center justify-center opacity-90 drop-shadow-2xl">
               <svg viewBox="0 0 100 100" className="w-full h-full fill-[#1A1A1A]">
                  <polygon points="50,10 20,90 40,90 50,60 60,90 80,90" />
                  <polygon points="43,80 50,60 57,80" className="fill-black" />
                  <polygon points="50,10 20,90 30,90 50,30" className="fill-[#333333]" />
               </svg>
            </div>

            {/* Content Text Block */}
            <div className="absolute bottom-12 left-12 right-12 z-10 flex flex-col gap-6">
              
              <div className="space-y-4 max-w-md relative z-10">
                <div className="mb-6 flex items-center gap-2">
                  <img src={arcByteLogo} alt="ArcByte" className="h-4 w-auto object-contain brightness-0 invert opacity-90" />
                  <span className="text-white text-[14px] font-bold tracking-widest uppercase">ARCBYTE</span>
                </div>
                <h2 className="text-white text-[32px] font-bold tracking-tight leading-tight">Welcome to ArcMail <br/>Admin Console</h2>
                <p className="text-white/60 text-[13px] leading-relaxed w-11/12 mt-2">
                  ArcByte helps developers to build organized and well coded dashboards full of beautiful and rich modules. Join us and start building your application today.
                </p>
                <p className="text-white/80 text-[13px] font-semibold mt-4">
                  More than 17k people joined us, it's your turn
                </p>
              </div>

              {/* Lower Inner Card */}
              <div className="mt-8 bg-[#222222]/90 backdrop-blur-md rounded-tl-[24px] rounded-bl-[24px] rounded-br-[24px] rounded-tr-[8px] p-8 w-full max-w-md border border-white/5 relative z-10 shadow-xl overflow-hidden group hover:bg-[#2A2A2A]/90 transition-colors">
                
                {/* Weird shape indent (simulated with border radii and layout) */}
                <h3 className="text-white text-[18px] font-bold leading-snug mb-4 max-w-[250px]">
                  Get your right job and right place apply now
                </h3>
                <p className="text-white/60 text-[13px] mb-8 max-w-[250px] leading-relaxed">
                  Be among the first founders to experience the easiest way to start run a business.
                </p>
                
                {/* Avatar Stack */}
                <div className="absolute bottom-8 right-8 flex -space-x-3">
                  <img src="https://i.pravatar.cc/100?img=1" className="w-9 h-9 rounded-full border-2 border-[#222222] shadow-sm"/>
                  <img src="https://i.pravatar.cc/100?img=2" className="w-9 h-9 rounded-full border-2 border-[#222222] shadow-sm"/>
                  <img src="https://i.pravatar.cc/100?img=3" className="w-9 h-9 rounded-full border-2 border-[#222222] shadow-sm"/>
                  <div className="w-9 h-9 rounded-full border-2 border-[#222222] bg-[#0F172A] text-white flex items-center justify-center text-[11px] font-bold relative z-10">+2</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AdminDesktopOnlyGate>
  );
}
