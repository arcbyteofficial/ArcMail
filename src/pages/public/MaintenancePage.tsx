import { Facebook, Twitter, Mail } from 'lucide-react';
import arcByteLogo from '../../assets/arcbyte.co_logo.png';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen w-full bg-[#E5E7E8] flex items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Main White Card */}
      <div className="w-full max-w-[1000px] bg-white shadow-xl flex flex-col items-center">
        
        {/* Header / Logo */}
        <div className="w-full flex items-center justify-center pt-12 pb-6 gap-3">
          <img 
            src={arcByteLogo} 
            alt="ArcByte Logo" 
            className="h-8 sm:h-10 w-auto object-contain" 
          />
          <span className="font-bold text-[24px] text-[#2F374A] tracking-[-0.02em]">ArcByte</span>
        </div>

        {/* Text Content */}
        <div className="text-center px-6 mt-8">
          <h1 className="text-[36px] sm:text-[46px] md:text-[56px] font-bold text-[#333333] leading-[1.1] mb-6">
            ArcMail is upgrading and is<br />down for maintenance
          </h1>
          <p className="text-[17px] text-[#7A828A] font-medium leading-relaxed max-w-md mx-auto">
            We apologize for any inconveniences caused.<br />
            We've almost done.
          </p>
        </div>

        {/* Graphic Area */}
        <div className="w-full flex items-center justify-center mt-12 mb-10 overflow-hidden relative">
          <img 
            src="/plug-illustration.png" 
            alt="Maintenance Plugs" 
            className="w-full max-w-[800px] h-auto object-contain min-h-[150px]"
            onError={(e) => {
              // Fallback placeholder
              const target = e.target as HTMLImageElement;
              target.onerror = null; 
              target.src = `data:image/svg+xml;utf8,<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="200" fill="%23ffffff"/><path d="M0,100 L250,100 L250,120 L300,120 L300,80 L350,80 L350,120 L400,120" stroke="%2356B2E1" stroke-width="20" fill="none"/><path d="M800,100 L550,100 L550,120 L500,120 L500,80 L450,80 L450,120" stroke="%234AD340" stroke-width="20" fill="none"/><text x="400" y="50" font-family="sans-serif" font-size="16" font-weight="bold" fill="%237A828A" text-anchor="middle" dominant-baseline="middle">Please place 'plug-illustration.png' in the public/ folder.</text></svg>`;
            }}
          />
        </div>

        {/* Footer */}
        <div className="w-full border-t border-[#F0F2F5] py-8 px-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-[14px] text-[#7A828A] font-semibold flex-wrap">
          <span>You can contact us:</span>
          <span className="text-[#2F374A]">Phone: +91 9380221281</span>
          <span className="text-[#2F374A]">Email: support@arcbyte.co</span>
          
          {/* Social Icons matching the circles in screenshot */}
          <div className="flex items-center gap-2 ml-0 md:ml-4">
            <a href="#" className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              <span className="font-bold text-xs uppercase">f</span>
            </a>
            <a href="#" className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              <span className="font-bold text-xs uppercase">ok</span>
            </a>
            <a href="#" className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              <span className="font-bold text-xs uppercase">vk</span>
            </a>
            <a href="#" className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              <Twitter size={14} className="fill-current" />
            </a>
            <a href="#" className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              <Mail size={14} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
