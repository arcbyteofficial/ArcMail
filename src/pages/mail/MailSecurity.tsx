import React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Activity,
  Server,
  Eye,
  KeyRound,
  Ban,
  Fingerprint,
  Network,
  Cpu,
  Globe,
  Zap,
  CheckCircle2,
  FileCode,
  Smartphone,
  type LucideIcon
} from 'lucide-react';

// --- Visual Components ---

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-mono tracking-[0.2em] text-white/70 uppercase ${className}`}>
    {children}
  </div>
);

const GradientText = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/60 ${className}`}>
    {children}
  </span>
);

const FeaturePill = ({ label, icon: Icon }: { label: string; icon?: LucideIcon }) => (
  <motion.div
    whileHover={{ y: -2, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)' }}
    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.03] backdrop-blur-sm cursor-default transition-all duration-300 group"
  >
    {Icon && <Icon size={12} className="text-[#555] group-hover:text-[#22C55E] transition-colors" />}
    <span className="text-[11px] font-mono uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">{label}</span>
  </motion.div>
);

// --- Layout Components ---

const Section = ({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`relative w-full max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24 py-24 md:py-32 ${className}`}>
    {children}
  </section>
);

// --- Hero Section ---

const Hero = () => (
  <section className="relative w-full min-h-screen flex items-center pt-32 pb-20 px-6 md:px-12 lg:px-24 overflow-hidden bg-[#050505]">
    {/* Cinematic Background */}
    <div className="absolute inset-0 bg-[#050505] z-0" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#111_0%,_transparent_50%)] opacity-40 z-0" />
    
    {/* Green Glows */}
    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#22C55E]/5 rounded-full blur-[160px] pointer-events-none" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#22C55E]/[0.02] rounded-full blur-[120px] pointer-events-none" />
    
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay z-0" />
    
    <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
      
      {/* Left Content - Dominant (60%) */}
      <div className="lg:col-span-7 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-[1px] bg-[#22C55E]/50" />
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#22C55E]">Security Architecture</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter leading-[0.95] text-white mb-8">
            Defense in <br />
            <GradientText>depth & motion.</GradientText>
          </h1>
          
          <p className="text-lg md:text-xl text-[#999] font-light leading-relaxed max-w-2xl">
            ArcMail isn't just an email client. It's a fortified operational environment. 
            We enforce a zero-trust model where every session is ephemeral, every byte is encrypted, 
            and your data never rests on our servers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex flex-wrap gap-3 mt-4"
        >
          <FeaturePill icon={Shield} label="TLS 1.3 Enforced" />
          <FeaturePill icon={Lock} label="Zero-Trust Access" />
          <FeaturePill icon={Server} label="Hostinger Backbone" />
          <FeaturePill icon={Activity} label="Live Audit Logs" />
        </motion.div>
      </div>

      {/* Right Panel - Floating Intelligence (40%) */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="lg:col-span-5 w-full"
      >
        <div className="relative group perspective-1000">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-b from-[#22C55E]/20 to-transparent rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Panel */}
          <div className="relative bg-[#0A0A0A] border border-white/10 rounded-[2rem] p-8 shadow-2xl overflow-hidden backdrop-blur-2xl group-hover:border-[#22C55E]/30 transition-colors duration-500">
            {/* Inner Highlight */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#555] mb-1">Status</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                  <span className="text-sm font-bold text-white tracking-tight">System Secure</span>
                </div>
              </div>
              <Cpu className="text-white/20" size={24} />
            </div>

            {/* Metrics */}
            <div className="space-y-6">
              {[
                { label: 'Encryption Standard', value: 'AES-256-GCM', icon: Lock },
                { label: 'Transport Layer', value: 'TLS 1.3 (Strict)', icon: Network },
                { label: 'Session State', value: 'Ephemeral / Bound', icon: Activity },
                { label: 'Data Residency', value: 'Hostinger EU-1', icon: Globe },
              ].map((metric, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group/item">
                  <div className="flex items-center gap-3">
                    <metric.icon size={14} className="text-[#555] group-hover/item:text-[#22C55E] transition-colors" />
                    <span className="text-xs font-mono uppercase tracking-wider text-[#777]">{metric.label}</span>
                  </div>
                  <span className="text-sm font-medium text-white group-hover/item:text-white transition-colors">{metric.value}</span>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-10 pt-6 border-t border-white/5 flex gap-4">
               <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '100%' }}
                   transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                   className="h-full bg-gradient-to-r from-transparent via-[#22C55E] to-transparent w-1/2"
                 />
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

// --- Compliance Strip ---

const ComplianceStrip = () => (
  <div className="w-full border-y border-white/5 bg-[#000000] relative overflow-hidden">
    <div className="absolute inset-0 bg-[#22C55E]/[0.02]" />
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8 flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-60 hover:opacity-100 transition-opacity duration-500 relative z-10">
       <span className="text-xs font-mono uppercase tracking-[0.3em] text-[#444]">Compliance Standards</span>
       <div className="flex items-center gap-12 text-sm font-bold text-white/80">
          {['SOC2 Type II', 'ISO 27001', 'GDPR Compliant', 'HIPAA Ready'].map((std) => (
             <span key={std} className="hover:text-[#22C55E] transition-colors cursor-default">{std}</span>
          ))}
       </div>
    </div>
  </div>
);

// --- Global Infrastructure ---

const GlobalInfrastructure = () => (
  <Section className="bg-[#050505]">
    <div className="flex flex-col lg:flex-row gap-20 items-center">
      <div className="flex-1 space-y-8">
         <Badge>Global Edge Network</Badge>
         <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
           Data residency <br/>
           <span className="text-[#555]">where you need it.</span>
         </h2>
         <p className="text-lg text-[#999] leading-relaxed max-w-xl">
           ArcMail leverages Hostinger's premium data centers across Europe, North America, and Asia. 
           Your encrypted mailbox data stays in your chosen region, while our edge network accelerates 
           delivery and attachment handling globally.
         </p>
         
         <div className="grid grid-cols-2 gap-6 pt-8">
            {[
              { val: "7", label: "Regions" },
              { val: "99.99%", label: "Uptime SLA" },
              { val: "<20ms", label: "Edge Latency" },
              { val: "24/7", label: "NOC Support" }
            ].map((stat, i) => (
              <div key={i} className="group cursor-default">
                 <div className="text-3xl font-bold text-white mb-2 group-hover:text-[#22C55E] transition-colors">{stat.val}</div>
                 <div className="text-xs font-mono uppercase tracking-widest text-[#555] group-hover:text-[#888] transition-colors">{stat.label}</div>
              </div>
            ))}
         </div>
      </div>
      
      <div className="flex-1 w-full flex justify-center">
         {/* Abstract Globe Visualization */}
         <div className="relative w-[400px] h-[400px] lg:w-[500px] lg:h-[500px]">
            <div className="absolute inset-0 rounded-full border border-white/5 bg-[radial-gradient(circle_at_30%_30%,_#0A0A0A_0%,_transparent_70%)] animate-[spin_60s_linear_infinite]" />
            <div className="absolute inset-4 rounded-full border border-white/5 border-dashed opacity-30 animate-[spin_40s_linear_infinite_reverse]" />
            <div className="absolute inset-1/4 rounded-full bg-[#22C55E]/5 blur-3xl" />
            
            {/* Nodes */}
            {[...Array(6)].map((_, i) => (
               <div 
                 key={i}
                 className="absolute w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_15px_rgba(34,197,94,0.8)]"
                 style={{
                    top: `${50 + 35 * Math.sin(i * 1.05)}%`,
                    left: `${50 + 35 * Math.cos(i * 1.05)}%`,
                    animation: `pulse 3s infinite ${i * 0.5}s`
                 }}
               />
            ))}
         </div>
      </div>
    </div>
  </Section>
);

// --- Threat Intelligence Terminal ---

const ThreatIntelligence = () => (
  <Section className="bg-[#000000] border-y border-white/5">
    <div className="grid lg:grid-cols-2 gap-16 items-center">
       <div className="order-2 lg:order-1 relative rounded-2xl bg-[#050505] border border-white/10 p-6 font-mono text-xs shadow-2xl overflow-hidden group">
          {/* Terminal Header */}
          <div className="flex items-center justify-between mb-6 px-2 border-b border-white/5 pb-4">
             <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
             </div>
             <span className="text-[#555]">threat_prevention.log</span>
          </div>

          <div className="space-y-3 text-[#888] h-[300px] overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505] z-10" />
             <p>[10:42:01] <span className="text-[#22C55E]">INFO</span> Scanning incoming payload ID: 8f92a...</p>
             <p>[10:42:02] <span className="text-[#22C55E]">INFO</span> SPF/DKIM validation passed.</p>
             <p>[10:42:02] <span className="text-yellow-400">WARN</span> Suspicious pattern detected in attachment headers.</p>
             <p>[10:42:02] <span className="text-[#22C55E]">INFO</span> Initiating deep sandboxing...</p>
             <p>[10:42:03] <span className="text-red-400">CRITICAL</span> Malware signature found: HEUR.Trojan.Win32</p>
             <p>[10:42:03] <span className="text-[#22C55E]">ACTION</span> Payload blocked. Sender IP blacklisted.</p>
             <p>[10:42:04] <span className="text-[#22C55E]">INFO</span> Threat telemetry updated to edge nodes.</p>
             <p>[10:42:05] <span className="text-[#22C55E]">INFO</span> Operator notified (Severity: High).</p>
             {/* Repeat for visual density */}
             <p className="opacity-50">[10:42:08] <span className="text-[#22C55E]">INFO</span> Routine health check completed.</p>
             <p className="opacity-40">[10:42:09] <span className="text-[#22C55E]">INFO</span> Encryption keys rotated successfully.</p>
          </div>
          
          {/* Scan Line */}
          <motion.div 
             animate={{ top: ["0%", "100%"] }}
             transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
             className="absolute left-0 right-0 h-[2px] bg-[#22C55E]/20 blur-[2px] z-20 pointer-events-none"
          />
       </div>
       
       <div className="order-1 lg:order-2 space-y-8">
          <Badge>Active Defense</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
            Threats neutralized <br/>
            <span className="text-[#555]">before arrival.</span>
          </h2>
          <p className="text-lg text-[#999] leading-relaxed">
            Our multi-layered security engine analyzes mail headers, attachments, and sender reputation 
            in real-time. Malicious payloads are sandboxed and neutralized at the network edge, 
            never reaching your device.
          </p>
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#22C55E]/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
                   <Shield size={20} />
                </div>
                <div>
                   <div className="text-white font-bold group-hover:text-[#22C55E] transition-colors">Heuristic Analysis</div>
                   <div className="text-sm text-[#666]">AI-driven pattern recognition for zero-day threats.</div>
                </div>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#22C55E]/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
                   <Ban size={20} />
                </div>
                <div>
                   <div className="text-white font-bold group-hover:text-[#22C55E] transition-colors">Global Blacklisting</div>
                   <div className="text-sm text-[#666]">Shared threat intelligence across the ArcByte network.</div>
                </div>
             </div>
          </div>
       </div>
    </div>
  </Section>
);

// --- Encryption Specs (Code) ---

const EncryptionSpecs = () => (
  <Section className="bg-[#050505]">
     <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
           <Badge>Cryptographic Primitives</Badge>
           <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
             Zero-knowledge <br/>
             <span className="text-[#555]">by design.</span>
           </h2>
           <p className="text-lg text-[#999] leading-relaxed">
             We employ the Signal Protocol's Double Ratchet algorithm for session key management. 
             Every message is encrypted with a unique ephemeral key that cannot be reconstructed 
             even if long-term identity keys are compromised.
           </p>
           
           <div className="space-y-6 pt-4">
              {[
                { label: "AES-256-GCM", desc: "Authenticated encryption for all payload data at rest and in transit." },
                { label: "Curve25519", desc: "Elliptic curve Diffie-Hellman key exchange for session initiation." },
                { label: "SHA-256", desc: "HMAC for message integrity and authentication verification." }
              ].map((item, i) => (
                 <div key={i} className="flex gap-4 group">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#22C55E]/10 group-hover:border-[#22C55E]/30 transition-colors">
                       <KeyRound size={20} className="text-[#555] group-hover:text-[#22C55E]" />
                    </div>
                    <div>
                       <div className="text-white font-bold mb-1 group-hover:text-[#22C55E] transition-colors">{item.label}</div>
                       <div className="text-sm text-[#666]">{item.desc}</div>
                    </div>
                 </div>
              ))}
           </div>
        </div>

        <div className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 p-8 shadow-2xl overflow-hidden group">
           <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#22C55E] via-emerald-500 to-[#22C55E]" />
           <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                 <FileCode size={16} className="text-[#22C55E]" />
                 <span className="text-xs font-mono text-[#888]">crypto_core.rs</span>
              </div>
              <div className="flex gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                 <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                 <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
              </div>
           </div>
           
           <pre className="font-mono text-xs leading-relaxed overflow-x-auto">
              <code>
                 <span className="text-[#22C55E]">pub fn</span> <span className="text-blue-400">encrypt_payload</span>(msg: <span className="text-yellow-300">&[u8]</span>, key: <span className="text-yellow-300">&SessionKey</span>) {'->'} <span className="text-yellow-300">Result</span>&lt;Vec&lt;u8&gt;&gt; {'{'}
                 {'\n'}  <span className="text-[#555]">// Generate random nonce for GCM</span>
                 {'\n'}  <span className="text-[#22C55E]">let</span> nonce = <span className="text-blue-400">generate_nonce</span>();
                 {'\n'}
                 {'\n'}  <span className="text-[#555]">// Ratchet the key forward (Forward Secrecy)</span>
                 {'\n'}  <span className="text-[#22C55E]">let</span> (next_key, msg_key) = key.<span className="text-blue-400">ratchet</span>();
                 {'\n'}
                 {'\n'}  <span className="text-[#555]">// Encrypt with AES-256-GCM</span>
                 {'\n'}  <span className="text-[#22C55E]">let</span> cipher = <span className="text-blue-400">Aes256Gcm::new</span>(&msg_key);
                 {'\n'}  <span className="text-[#22C55E]">let</span> encrypted = cipher.<span className="text-blue-400">encrypt</span>(&nonce, msg)?;
                 {'\n'}
                 {'\n'}  <span className="text-[#22C55E]">Ok</span>([nonce, encrypted].<span className="text-blue-400">concat</span>())
                 {'\n'}{'}'}
              </code>
           </pre>
        </div>
     </div>
  </Section>
);

// --- Mobile Enclave ---

const MobileEnclave = () => (
  <Section className="bg-[#050505] border-t border-white/5">
     <div className="flex flex-col lg:flex-row gap-20 items-center">
        <div className="flex-1 flex justify-center order-2 lg:order-1">
           {/* Abstract Mobile Enclave Visualization */}
           <div className="relative w-[300px] h-[600px] rounded-[3rem] border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden flex flex-col items-center pt-12 group">
              <div className="absolute inset-0 bg-gradient-to-b from-[#22C55E]/5 to-transparent pointer-events-none" />
              
              {/* Notch */}
              <div className="absolute top-0 w-32 h-6 bg-black rounded-b-2xl" />
              
              {/* Lock Icon (Biometric) */}
              <div className="mt-20 mb-8 w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative group-hover:border-[#22C55E]/50 transition-colors duration-500">
                 <div className="absolute inset-0 rounded-full border border-[#22C55E] opacity-50 animate-ping" />
                 <Fingerprint size={32} className="text-[#22C55E]" />
              </div>
              
              <div className="text-center px-8 space-y-2 mb-12">
                 <div className="text-white font-bold">ArcMail Secure</div>
                 <div className="text-xs text-[#555]">Touch ID Required</div>
              </div>
              
              {/* Secure Storage visual */}
              <div className="w-full px-6 space-y-3">
                 <div className="h-2 rounded-full bg-white/10 w-full overflow-hidden">
                    <div className="h-full bg-[#22C55E] w-[80%]" />
                 </div>
                 <div className="flex justify-between text-[10px] font-mono uppercase text-[#555]">
                    <span>Enclave Storage</span>
                    <span>Encrypted</span>
                 </div>
                 
                 <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5 text-[10px] font-mono text-[#888] space-y-2 group-hover:border-[#22C55E]/20 transition-colors">
                    <div className="flex justify-between">
                       <span>KeyStore</span>
                       <span className="text-[#22C55E]">LOCKED</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Sandboxing</span>
                       <span className="text-[#22C55E]">ACTIVE</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Network</span>
                       <span className="text-blue-400">VPN_TUNNEL</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex-1 space-y-8 order-1 lg:order-2">
           <Badge>Hardware Security</Badge>
           <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
             The Secure Enclave <br/>
             <span className="text-[#555]">advantage.</span>
           </h2>
           <p className="text-lg text-[#999] leading-relaxed">
             On mobile devices, ArcMail utilizes the hardware Secure Enclave to store session keys. 
             This means your encryption keys never leave the physical device's dedicated security processor, 
             making them inaccessible even to the OS kernel.
           </p>
           
           <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {[
                { icon: Smartphone, title: "Hardware Backed", desc: "Keys stored in dedicated silicon." },
                { icon: Fingerprint, title: "Biometric Gate", desc: "FaceID/TouchID decryption." },
                { icon: Zap, title: "Instant Revocation", desc: "Remote wipe via MDM protocol." },
                { icon: Globe, title: "VPN Enforced", desc: "Traffic tunneled automatically." }
              ].map((item, i) => (
                 <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-[#22C55E]/20 transition-all group">
                    <item.icon className="text-[#555] mb-3 group-hover:text-[#22C55E] transition-colors" size={20} />
                    <div className="text-sm font-bold text-white mb-1">{item.title}</div>
                    <div className="text-xs text-[#666]">{item.desc}</div>
                 </div>
              ))}
           </div>
        </div>
     </div>
  </Section>
);

// --- System Specs ---

const SystemSpecs = () => (
  <Section className="bg-[#050505] border-t border-white/5">
     <div className="mb-16">
        <h2 className="text-3xl font-bold text-white mb-4">Technical Specifications</h2>
        <p className="text-[#666]">Detailed operational limits and standards.</p>
     </div>
     
     <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {[
          { k: "Max Attachment", v: "50 MB (Encrypted)" },
          { k: "Retention Policy", v: "Configurable (30-365 days)" },
          { k: "Key Rotation", v: "Every 100 Messages / 24h" },
          { k: "API Rate Limit", v: "1000 req / min" },
          { k: "Cipher Suite", v: "TLS_AES_256_GCM_SHA384" },
          { k: "MFA Support", v: "TOTP, WebAuthn, YubiKey" },
          { k: "Compliance", v: "SOC2, HIPAA, GDPR" },
          { k: "Infrastructure", v: "Kubernetes / Hostinger" }
        ].map((item, i) => (
           <div key={i} className="bg-[#0A0A0A] p-6 hover:bg-[#111] transition-colors group">
              <div className="text-xs font-mono uppercase tracking-widest text-[#555] mb-2 group-hover:text-[#22C55E] transition-colors">{item.k}</div>
              <div className="text-sm font-bold text-white">{item.v}</div>
           </div>
        ))}
     </div>
  </Section>
);

// --- Pillars Section ---

const SecurityCard = ({ 
  icon: Icon, 
  title, 
  desc, 
  delay = 0 
}: { 
  icon: LucideIcon; 
  title: string; 
  desc: string; 
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -5 }}
    className="group relative p-8 md:p-10 rounded-3xl bg-[#0A0A0A] border border-white/5 hover:border-[#22C55E]/30 transition-all duration-300 overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-[#22C55E]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative z-10 flex flex-col h-full">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:bg-[#22C55E]/10 group-hover:text-[#22C55E] transition-colors duration-300">
        <Icon size={24} strokeWidth={1.5} className="text-white/80 group-hover:text-[#22C55E] transition-colors" />
      </div>
      
      <h3 className="text-xl font-bold text-white mb-4 tracking-tight group-hover:text-[#22C55E] transition-colors">{title}</h3>
      <p className="text-sm text-[#999] leading-relaxed flex-1">{desc}</p>
      
      <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#555] group-hover:text-[#22C55E] transition-colors">
        <CheckCircle2 size={12} />
        <span>Verified</span>
      </div>
    </div>
  </motion.div>
);

const Pillars = () => (
  <Section className="bg-[#050505]">
    <div className="mb-20">
      <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6">
        Enterprise-grade <br />
        <span className="text-[#555]">guarantees.</span>
      </h2>
      <div className="w-24 h-1 bg-[#22C55E]" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      <SecurityCard
        icon={Shield}
        title="Transport Security"
        desc="Mail flows over enforced TLS 1.3 on every hop we control, with strict host verification and hardened cipher selection."
        delay={0.1}
      />
      <SecurityCard
        icon={KeyRound}
        title="Zero-Trust Access"
        desc="Credentials are handled server‑side only, wrapped in short‑lived sessions with device‑ and context‑aware checks."
        delay={0.2}
      />
      <SecurityCard
        icon={Activity}
        title="Live Posture"
        desc="Per‑session activity, anomaly patterns and transport failures are monitored and surfaced to operators in real-time."
        delay={0.3}
      />
      <SecurityCard
        icon={Server}
        title="Ephemeral Storage"
        desc="Mail resides in Hostinger mailboxes. ArcMail stores only the minimum metadata required for performance, in memory."
        delay={0.4}
      />
      <SecurityCard
        icon={Eye}
        title="Audit Logging"
        desc="Access attempts, configuration changes and session escalations are logged for internal security review and compliance."
        delay={0.5}
      />
      <SecurityCard
        icon={Ban}
        title="Privacy First"
        desc="ArcMail never injects marketing trackers, third‑party pixels, or analytics scripts into operator conversations."
        delay={0.6}
      />
    </div>
  </Section>
);

const Footer = () => (
  <footer className="w-full border-t border-white/5 py-12 bg-[#000000]">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2 text-white/40 text-xs font-mono uppercase tracking-widest">
        <Lock size={12} />
        <span>Secured by ArcByte Infrastructure</span>
      </div>
      <div className="flex gap-8 text-xs text-[#555] font-medium">
        <a href="#" className="hover:text-white transition-colors">Documentation</a>
        <a href="#" className="hover:text-white transition-colors">Compliance</a>
        <a href="#" className="hover:text-white transition-colors">Status</a>
      </div>
    </div>
  </footer>
);

const MailSecurity: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#22C55E]/30 selection:text-white font-sans overflow-x-hidden">
      <Hero />
      <ComplianceStrip />
      <GlobalInfrastructure />
      <ThreatIntelligence />
      <EncryptionSpecs />
      <MobileEnclave />
      <SystemSpecs />
      <Pillars />
      <Footer />
    </div>
  );
};

export default MailSecurity;
