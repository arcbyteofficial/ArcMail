import React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  Lock,
  Globe,
  Server,
  Cpu,
  Check,
  ArrowRight,
  Terminal,
  EyeOff,
  Database,
  Layers,
  Search,
  Paperclip
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import arcMailPreview from '../../assets/arcmail.png';

// --- Visual System & Components ---

const Section = ({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`relative w-full px-6 md:px-12 lg:px-24 py-24 md:py-32 overflow-hidden bg-[#050507] ${className}`}>
    {children}
  </section>
);

const Container = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-[1200px] mx-auto w-full relative z-10 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[11px] font-mono tracking-wider text-white/80 uppercase mb-6 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
    {children}
  </div>
);

const Heading = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] ${className}`}>
    {children}
  </h2>
);

const Text = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-lg md:text-xl leading-relaxed text-[#888888] font-light max-w-2xl ${className}`}>
    {children}
  </p>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  onClick 
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary'; 
  onClick?: () => void 
}) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`
      px-8 py-4 rounded-full font-medium text-sm tracking-wide transition-all duration-300
      ${variant === 'primary' 
        ? 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
        : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
      }
    `}
  >
    {children}
  </motion.button>
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={`bg-[#18181B] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-colors duration-300 shadow-lg ${className}`}
  >
    {children}
  </motion.div>
);

// --- Sections ---

const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="relative w-full min-h-screen flex items-center pt-32 pb-20 px-6 md:px-12 bg-[#050507] overflow-hidden">
      {/* Cinematic Depth Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#27272A_0%,_#050507_60%)] pointer-events-none opacity-40" />
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay" />
      
      <Container className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge>Internal Infrastructure v2.4</Badge>
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter text-white leading-[1.05] mb-8 max-w-4xl mx-auto">
            Email infrastructure, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
              rebuilt for operators.
            </span>
          </h1>
          <Text className="mx-auto mb-10 text-xl">
            ArcMail is ArcByte’s flagship internal business mail client. <br className="hidden md:block" />
            Powered by Hostinger IMAP/SMTP. Zero tracking. Session-bound security.
          </Text>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => navigate('/mail/login')}>Open ArcMail</Button>
            <Button variant="secondary" onClick={() => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' })}>
              View Security Architecture
            </Button>
          </div>
        </motion.div>

        {/* Hero Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 w-full max-w-6xl rounded-2xl border border-white/5 bg-[#18181B] shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent z-10" />
          <img 
            src={arcMailPreview} 
            alt="ArcMail Interface" 
            className="w-full h-auto opacity-80 group-hover:opacity-100 transition-opacity duration-700"
          />
          <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center gap-8 text-xs font-mono text-white/40 uppercase tracking-widest">
            <span>TLS 1.3 Enforced</span>
            <span>•</span>
            <span>Hostinger Backbone</span>
            <span>•</span>
            <span>No Ads</span>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

const TrustBar = () => (
  <div className="w-full border-y border-white/5 bg-[#050507]">
    <Container className="py-8">
      <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 md:justify-between items-center opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
        {['Hostinger IMAP+SMTP', 'TLS 1.3 Enforced', 'Zero Tracking', 'Session Bound Auth', 'Enterprise Ready', 'Privacy First'].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
            <span className="text-sm font-medium text-white tracking-wide">{item}</span>
          </div>
        ))}
      </div>
    </Container>
  </div>
);

const FeatureGrid = () => {
  const features = [
    { title: 'Lightning-fast inbox', icon: Zap, desc: 'Optimized rendering engine with zero layout shift. Keyboard-first navigation.' },
    { title: 'Hostinger Backbone', icon: Server, desc: 'Direct IMAP/SMTP integration ensuring enterprise-grade delivery reliability.' },
    { title: 'Secure Sessions', icon: Lock, desc: 'Stateless JWT authentication with strict session binding and auto-expiry.' },
    { title: 'Zero-tracking', icon: EyeOff, desc: 'No pixels, no analytics, no third-party observers. Your data stays yours.' },
    { title: 'Team Workflows', icon: Layers, desc: 'Shared contexts and rapid threading for high-velocity engineering teams.' },
    { title: 'Smart Search', icon: Search, desc: 'Client-side indexing for instant retrieval of deep archives without latency.' },
  ];

  return (
    <Section>
      <Container>
        <div className="mb-16">
          <Badge>Core Capabilities</Badge>
          <Heading>Engineered for <br />velocity.</Heading>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                <f.icon className="text-white" size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-[#888] leading-relaxed text-sm">{f.desc}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
};

const SecuritySection = () => (
  <Section className="bg-[#050507]" id="security">
    <Container>
      <div className="grid lg:grid-cols-2 gap-20 items-center">
        <div>
          <Badge>Security Architecture</Badge>
          <Heading className="mb-8">Trust by design, <br />not by policy.</Heading>
          <Text className="mb-8">
            ArcMail operates on a zero-trust model. We do not store your passwords. 
            Credentials are exchanged directly with Hostinger's encrypted gateways via ephemeral sessions.
          </Text>
          
          <div className="space-y-6">
            {[
              { label: 'Transport Security', desc: 'All connections enforced over TLS 1.3 with pinned certificates.' },
              { label: 'Ephemeral Storage', desc: 'Sensitive data exists only in volatile memory during active sessions.' },
              { label: 'Audit Logging', desc: 'Comprehensive immutable logs for all access and modification events.' }
            ].map((item, i) => (
              <div key={i} className="pl-6 border-l border-white/10">
                <h4 className="text-white font-bold mb-1">{item.label}</h4>
                <p className="text-[#666] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 blur-[100px] opacity-20" />
          <Card className="relative bg-[#121212] border-white/10 p-10">
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between text-xs font-mono text-[#666] uppercase tracking-widest mb-4">
                <span>Client</span>
                <span>Encrypted Tunnel</span>
                <span>Hostinger</span>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#18181B] border border-white/10 flex items-center justify-center">
                   <Cpu size={24} className="text-white" />
                </div>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent relative">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-[#050507] border border-white/10 rounded-full text-[10px] text-[#888]">
                     TLS 1.3
                   </div>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#18181B] border border-white/10 flex items-center justify-center">
                   <Server size={24} className="text-white" />
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-[#18181B] border border-white/5 font-mono text-xs text-[#888] space-y-2">
                <div className="flex gap-2">
                  <span className="text-green-500">➜</span>
                  <span>POST /auth/login</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-500">ℹ</span>
                  <span>Verifying handshake...</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Session established (Secure)</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  </Section>
);

const GlobalInfrastructure = () => (
  <Section className="bg-[#050507]">
    <Container>
      <div className="flex flex-col lg:flex-row gap-16 items-start">
        <div className="flex-1">
          <Badge>Global Edge Network</Badge>
          <Heading className="mb-6">Data where you are.<br />Instantly.</Heading>
          <Text className="mb-8">
            ArcMail leverages Hostinger's distributed data centers to ensure your email operations are low-latency, regardless of your physical location.
          </Text>
          
          <div className="grid grid-cols-2 gap-y-8 gap-x-4">
            {[
              { region: "US-East", status: "Operational", latency: "12ms" },
              { region: "EU-West", status: "Operational", latency: "24ms" },
              { region: "Asia-Pacific", status: "Operational", latency: "45ms" },
              { region: "South America", status: "Operational", latency: "58ms" },
            ].map((node, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="text-white font-bold text-sm">{node.region}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#666]">
                  <span>{node.status}</span>
                  <span>{node.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 relative">
           {/* Abstract Map Visualization */}
           <div className="aspect-square w-full rounded-full border border-white/5 bg-[radial-gradient(circle_at_30%_30%,_#27272A_0%,_#050507_70%)] relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
              <div className="w-[80%] h-[80%] rounded-full border border-white/5 animate-[spin_60s_linear_infinite]" />
              <div className="w-[60%] h-[60%] rounded-full border border-white/5 animate-[spin_40s_linear_infinite_reverse]" />
              <div className="w-[40%] h-[40%] rounded-full border border-white/10 animate-[spin_20s_linear_infinite]" />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                 <Globe size={48} className="text-white/20 mx-auto mb-2" strokeWidth={1} />
                 <div className="text-xs font-mono text-white/40 tracking-widest">GLOBAL MESH</div>
              </div>
           </div>
        </div>
      </div>
    </Container>
  </Section>
);

const DeveloperExperience = () => (
  <Section className="bg-[#050507] border-y border-white/5">
    <Container>
      <div className="text-center mb-16">
        <Badge>Developer Control</Badge>
        <Heading>Built for the <br />terminal generation.</Heading>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 relative overflow-hidden group p-0">
           <div className="absolute inset-0 bg-[#18181B]" />
           <div className="relative z-10 p-8 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                 <Terminal size={20} className="text-white" />
                 <span className="text-sm font-bold text-white">Command Palette</span>
              </div>
              <div className="flex-1 font-mono text-sm text-[#A1A1AA] space-y-2">
                 <p><span className="text-green-500">$</span> arcmail config --get user.preferences</p>
                 <p className="text-[#666]">{`{ "theme": "charcoal", "shortcuts": "vim", "notifications": false }`}</p>
                 <p><span className="text-green-500">$</span> arcmail search --query "production outage" --limit 5</p>
                 <div className="pl-4 border-l border-white/10 mt-2 space-y-1">
                    <p className="text-white">1. [CRITICAL] Database latency spike (2m ago)</p>
                    <p className="text-[#666]">2. Re: Deployment rollback status (15m ago)</p>
                    <p className="text-[#666]">3. Post-mortem: API Gateway (1h ago)</p>
                 </div>
              </div>
           </div>
        </Card>

        <div className="space-y-4">
           {[
             { key: "⌘ + K", action: "Open Command Palette" },
             { key: "/", action: "Global Search" },
             { key: "C", action: "Compose New" },
             { key: "J / K", action: "Navigate List" },
             { key: "E", action: "Archive Thread" },
           ].map((shortcut, i) => (
             <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#18181B] hover:bg-white/5 transition-colors">
                <span className="text-sm text-[#A1A1AA]">{shortcut.action}</span>
                <kbd className="px-2 py-1 rounded bg-[#27272A] border border-white/10 text-xs font-mono text-white font-bold min-w-[40px] text-center">
                  {shortcut.key}
                </kbd>
             </div>
           ))}
        </div>
      </div>
    </Container>
  </Section>
);

const MobileSection = () => (
  <Section className="border-t border-white/5 bg-[#050507]">
    <Container>
       <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
             <Badge>Pocket Operations</Badge>
             <Heading>Full power.<br/>Anywhere.</Heading>
             <Text>
               The ArcMail mobile engine isn't a "lite" version. It's the full distributed system, optimized for touch targets and thumb reach.
             </Text>
             <div className="space-y-4">
                {[
                  { icon: Zap, label: "Instant Sync", desc: "Push notifications via WebSocket" },
                  { icon: Shield, label: "Biometric Lock", desc: "FaceID/TouchID enforced" },
                  { icon: Globe, label: "Offline Mode", desc: "Read & queue actions without net" }
                ].map((item, i) => (
                   <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                         <item.icon size={18} className="text-white" />
                      </div>
                      <div>
                         <div className="text-white font-bold text-sm">{item.label}</div>
                         <div className="text-[#A1A1AA] text-xs">{item.desc}</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
          <div className="flex-1 flex justify-center">
             {/* Abstract Mobile Mockup */}
             <div className="w-[300px] h-[600px] rounded-[3rem] border border-white/10 bg-[#18181B] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#000] to-transparent z-10" />
                <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#000] to-transparent z-10" />
                
                {/* Mock Content */}
                <div className="p-6 pt-16 space-y-4 opacity-50">
                   {[1, 2, 3, 4, 5].map((_, i) => (
                      <div key={i} className="h-20 rounded-2xl bg-white/5 w-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                   ))}
                </div>

                {/* Floating Action Button Pulse */}
                <div className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg z-20">
                   <Paperclip size={24} />
                </div>
             </div>
          </div>
       </div>
    </Container>
  </Section>
);

const EcosystemSection = () => (
  <Section>
    <Container className="text-center">
       <Badge>Unified Ecosystem</Badge>
       <Heading className="mb-16">Not just email.<br/>The nervous system.</Heading>
       
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Team Tasks", desc: "Turn emails into tickets", icon: Check },
            { label: "Client Billing", desc: "Invoice from threads", icon: Database },
            { label: "Intern Control", desc: "Assign tasks directly", icon: Layers },
            { label: "Docs", desc: "Wiki integration", icon: Paperclip }
          ].map((item, i) => (
             <Card key={i} className="flex flex-col items-center justify-center py-12 px-4 hover:bg-white/5 transition-colors cursor-default">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 text-white">
                   <item.icon size={20} />
                </div>
                <div className="text-white font-bold mb-1">{item.label}</div>
                <div className="text-[#666] text-xs">{item.desc}</div>
             </Card>
          ))}
       </div>
    </Container>
  </Section>
);

const FAQSection = () => (
  <Section className="bg-[#050507]">
    <Container>
      <div className="grid md:grid-cols-3 gap-12">
        <div className="col-span-1">
           <Heading className="text-3xl mb-4">Engineering <br/>Queries</Heading>
           <p className="text-[#A1A1AA] text-sm">Everything you need to know about the transition to ArcMail.</p>
        </div>
        <div className="col-span-2 space-y-4">
           {[
             { q: "Is this replacing our GSuite instance?", a: "Yes. ArcMail is the new primary interface for all internal @arcbyte.co communications. GSuite will remain as a backup archive for Q3 2024." },
             { q: "How does the encryption actually work?", a: "We use a double-ratchet algorithm for session keys. Data at rest in Hostinger is AES-256 encrypted, and the ArcMail client handles decryption locally." },
             { q: "Can I use third-party clients?", a: "IMAP/SMTP credentials are available in your settings, but we recommend the ArcMail client for the zero-tracking and thread-optimization features." },
             { q: "What about calendar invites?", a: "ArcMail has a built-in parser for .ics files and syncs directly with the Team Calendar module." }
           ].map((faq, i) => (
             <div key={i} className="p-6 rounded-2xl border border-white/5 bg-[#18181B] hover:border-white/10 transition-colors">
                <h4 className="text-white font-bold mb-2">{faq.q}</h4>
                <p className="text-[#A1A1AA] text-sm leading-relaxed">{faq.a}</p>
             </div>
           ))}
        </div>
      </div>
    </Container>
  </Section>
);

const DownloadSection = () => (
  <Section className="bg-[#050507] border-y border-white/5">
    <Container>
      <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
        <div className="flex-1 space-y-8">
           <Badge>Internal Distribution</Badge>
           <Heading>ArcMail for Android</Heading>
           <Text>
             Direct engineering distribution. Not available on Google Play. 
             Requires ArcByte VPN connection for initial provisioning.
           </Text>
           
           <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-[#18181B] border border-white/10 flex items-center justify-between max-w-md group hover:border-[#333] transition-colors cursor-pointer">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3DDC84]/10 flex items-center justify-center text-[#3DDC84]">
                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0225 3.503c-1.6704-.762-3.5385-1.2285-5.5566-1.2285-2.0181 0-3.8862.4665-5.5566 1.2285L3.9999 5.447c-.1673-.2901-.5392-.3892-.8293-.2219a.4158.4158 0 00-.1519.5674l2.0223 3.503C2.1554 10.9785 1 13.8893 1 17.1558h22c0-3.2665-1.1554-6.1773-4.0685-7.8344" />
                       </svg>
                    </div>
                    <div>
                       <div className="text-white font-bold text-sm">Download .APK</div>
                       <div className="text-[#A1A1AA] text-xs font-mono">v2.4.0 • 45MB • SHA-256 Verified</div>
                    </div>
                 </div>
                 <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} />
                 </div>
              </div>
              
              <div className="flex gap-6 text-xs text-[#666] font-mono px-2">
                 <span>• Minimum Android 12</span>
                 <span>• Requires Sideloading</span>
              </div>
           </div>
        </div>

        <div className="flex-1 flex justify-center lg:justify-end">
           <div className="relative p-8 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-[#3DDC84]/10 to-transparent rounded-3xl opacity-20" />
              <div className="relative bg-white p-2 rounded-xl">
                 {/* QR Code Placeholder */}
                 <div className="w-48 h-48 bg-[#000] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://arcbyte.co/download/android')] bg-cover bg-center opacity-90 mix-blend-screen" />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center border border-white/20">
                          <img src={arcMailPreview} className="w-8 h-8 object-contain" alt="A" />
                       </div>
                    </div>
                 </div>
              </div>
              <div className="mt-4 text-center font-mono text-xs text-[#666] tracking-widest uppercase">
                 Scan to Install
              </div>
           </div>
        </div>
      </div>
    </Container>
  </Section>
);

const SpecsSection = () => (
  <Section className="border-t border-white/5">
    <Container>
      <div className="flex flex-col md:flex-row justify-between items-end mb-16">
        <div>
          <Badge>System Specs</Badge>
          <Heading>Technical <br/>Datasheet</Heading>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-sm font-mono text-[#666]">Build v2.4.0</div>
          <div className="text-sm font-mono text-[#666]">Stable Release</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
        {[
          {
            category: "Protocols",
            items: ["IMAP4rev1 (RFC 3501)", "SMTP Submission (RFC 6409)", "JMAP Core (Draft Compatibility)"]
          },
          {
            category: "Encryption",
            items: ["TLS 1.3 (Forward Secrecy)", "AES-256-GCM At Rest", "ECDHE-RSA-AES256-GCM-SHA384"]
          },
          {
            category: "Client Engine",
            items: ["React 18 Concurrent Mode", "TanStack Query v5", "Zustand State Management"]
          },
          {
            category: "Limits",
            items: ["50MB Attachment Size", "Unlimited Archive Retention", "100 Concurrent Connections"]
          }
        ].map((group, i) => (
          <div key={i} className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2">{group.category}</h3>
            <ul className="space-y-2">
              {group.items.map((item, j) => (
                <li key={j} className="text-sm text-[#888] font-mono leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Container>
  </Section>
);

const ComparisonTable = () => (
  <Section>
    <Container>
      <div className="text-center mb-16">
        <Heading>Why ArcMail?</Heading>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-6 pl-6 text-sm font-medium text-[#666] uppercase tracking-widest w-1/3">Feature</th>
              <th className="py-6 text-sm font-bold text-white uppercase tracking-widest w-1/3">ArcMail</th>
              <th className="py-6 text-sm font-medium text-[#444] uppercase tracking-widest w-1/3">Traditional Webmail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              { feature: 'Privacy', arc: 'Zero-tracking', trad: 'Ad-driven analysis' },
              { feature: 'Infrastructure', arc: 'Hostinger Dedicated', trad: 'Shared/Throttled' },
              { feature: 'Interface', arc: 'Native-feel React', trad: 'Clunky HTML' },
              { feature: 'Keyboard Control', arc: 'First-class support', trad: 'Limited' },
              { feature: 'Session Security', arc: 'Ephemeral JWT', trad: 'Persistent Cookies' },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-6 pl-6 text-white font-medium">{row.feature}</td>
                <td className="py-6 text-white flex items-center gap-2">
                  <Check size={16} className="text-white" /> {row.arc}
                </td>
                <td className="py-6 text-[#666]">{row.trad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  </Section>
);

const StatsSection = () => (
  <Section className="bg-[#050507]">
    <Container>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { value: '<50ms', label: 'Interaction Latency' },
          { value: '99.99%', label: 'Uptime SLA' },
          { value: '0', label: 'Trackers Found' },
          { value: '100%', label: 'Encryption' },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">{stat.value}</div>
            <div className="text-sm font-mono text-[#666] uppercase tracking-widest">{stat.label}</div>
          </div>
        ))}
      </div>
    </Container>
  </Section>
);

const Preloader = ({ onComplete }: { onComplete: () => void }) => (
  <motion.div
    initial={{ opacity: 1 }}
    animate={{ opacity: 0, pointerEvents: "none" }}
    transition={{ duration: 0.8, delay: 2.2, ease: [0.22, 1, 0.36, 1] }}
    onAnimationComplete={onComplete}
    className="fixed inset-0 z-[100] bg-[#050507] flex items-center justify-center"
  >
    <div className="flex flex-col items-center gap-6">
       <div className="flex items-center gap-1 h-8 overflow-hidden">
          <motion.div 
            initial={{ y: 30 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-white text-2xl font-bold tracking-tighter"
          >
            ArcMail
          </motion.div>
          <motion.div
             initial={{ scale: 0 }}
             animate={{ scale: 1 }}
             transition={{ duration: 0.5, delay: 0.4, type: "spring" }}
             className="w-2 h-2 rounded-full bg-white mt-2"
          />
       </div>
       <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
          <motion.div 
             initial={{ x: "-100%" }}
             animate={{ x: "100%" }}
             transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
             className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent"
          />
       </div>
       <div className="flex gap-4 text-[10px] font-mono text-[#444] uppercase tracking-widest">
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>Initializing</motion.span>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>TLS Handshake</motion.span>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>Secure</motion.span>
       </div>
    </div>
  </motion.div>
);

// --- Main Page Component ---

const ArcMailInfo = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [contentVisible, setContentVisible] = React.useState(false);

  React.useEffect(() => {
     if (loading) {
        document.body.style.overflow = 'hidden';
     } else {
        document.body.style.overflow = 'unset';
        // Delay content fade-in slightly to match preloader fade-out
        setTimeout(() => setContentVisible(true), 100);
     }
  }, [loading]);

  return (
    <div className="bg-[#050507] min-h-screen w-full selection:bg-white selection:text-black font-sans relative">
      <Preloader onComplete={() => setLoading(false)} />
      
      <div className={`transition-opacity duration-1000 ${contentVisible ? "opacity-100" : "opacity-0"}`}>
        <Hero />
        <TrustBar />
        <FeatureGrid />
        <SecuritySection />
        <GlobalInfrastructure />
        <DeveloperExperience />
        <MobileSection />
        <DownloadSection />
        <EcosystemSection />
        <SpecsSection />
        <ComparisonTable />
        <FAQSection />
        <StatsSection />
        
        {/* Final CTA */}
        <Section>
          <Container className="text-center">
            <Heading className="mb-8">Ready to operate at <br />inbox speed?</Heading>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button onClick={() => navigate('/mail/login')}>Open ArcMail</Button>
            </div>
          </Container>
        </Section>
      </div>
    </div>
  );
};

export default ArcMailInfo;
