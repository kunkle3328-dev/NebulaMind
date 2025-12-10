import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const timer1 = setTimeout(() => {
      setFading(true);
    }, 2500);

    // Complete after fade out (3s total)
    const timer2 = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-700 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="relative">
        {/* Animated Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px] animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-600/20 rounded-full blur-[60px] animate-ping" style={{ animationDuration: '3s' }}></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/50 mb-6 animate-bounce" style={{ animationDuration: '2s' }}>
                <Sparkles size={40} className="text-white" />
            </div>
            
            <h1 className="text-5xl font-bold text-white tracking-tighter mb-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 animate-gradient-x">
                    Nebula Mind
                </span>
            </h1>
            <p className="text-slate-400 text-sm tracking-widest uppercase font-semibold">
                AI Research Studio
            </p>
        </div>
      </div>
      
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 w-full animate-progress origin-left"></div>
          </div>
          <span className="text-xs text-slate-600 font-mono">INITIALIZING MODELS...</span>
      </div>

      <style>{`
        @keyframes progress {
            0% { transform: scaleX(0); }
            100% { transform: scaleX(1); }
        }
        .animate-progress {
            animation: progress 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;