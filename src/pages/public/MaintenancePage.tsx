import { motion } from 'framer-motion';

export default function MaintenancePage() {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#f3f4f6] flex flex-col items-center justify-center overflow-hidden font-inter">
      {/* Abstract Background Container matching the screenshot */}
      <div 
        className="relative w-full max-w-[800px] h-[400px] rounded-[100px] sm:rounded-[150px] shadow-2xl flex items-center justify-center bg-[#070b2e] overflow-hidden"
        style={{
          borderRadius: '40% 60% 70% 30% / 45% 50% 50% 55%',
        }}
      >
        {/* Decorative elements to mimic the blobs */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-[#F29C74] rounded-2xl rotate-12 blur-[2px]" />
        <div className="absolute top-8 right-32 w-16 h-16 bg-[#B56EE4] rounded-full blur-[1px]" />
        <div className="absolute bottom-16 right-20 w-48 h-48 bg-[#3B82F6] rounded-[40%] blur-[2px]" />
        <div className="absolute center right-10 w-20 h-20 bg-[#A6F2D6] rounded-full blur-[1px]" />
        <div className="absolute bottom-10 left-16 w-32 h-32 bg-[#4853C9] rounded-[40%] blur-[1px]" />
        
        {/* Floating animated central GIF */}
        <motion.div
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10"
        >
          <img 
            src="/fastening-screws.gif" 
            alt="Fastening Screws Animation" 
            className="w-[280px] h-auto object-contain drop-shadow-lg"
            onError={(e) => {
              // Fallback placeholder if the gif is not found
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg width="280" height="280" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="280" fill="%23ffffff" rx="140"/><text x="140" y="140" font-family="sans-serif" font-size="20" fill="%23070b2e" text-anchor="middle" dominant-baseline="middle">Please add fastening-screws.gif</text></svg>';
            }}
          />
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-16 text-center z-10"
      >
        <h1 className="text-[32px] sm:text-[42px] font-bold text-[#1e1b4b] tracking-tight">
          We are fastening some screws!
        </h1>
      </motion.div>
    </div>
  );
}
