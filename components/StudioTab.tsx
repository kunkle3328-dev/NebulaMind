import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Notebook, Artifact } from '../types';
import { Mic, Headphones, FileText, HelpCircle, Layout, Presentation, Play, Pause, Loader2, X, Download, Wand2, Activity, Sparkles, ChevronRight, ChevronLeft, Maximize2, Minimize2, Monitor, AlertCircle, Share2, FileCode, GraduationCap, BookOpen, Volume2, ImageIcon, RotateCcw, Shuffle } from 'lucide-react';
import LiveSession from './LiveSession';
import { useTheme, useJobs } from '../App';
import { VOICES } from '../constants';

interface Props {
  notebook: Notebook;
  onUpdate: (nb: Notebook) => void;
}

const StudioTab: React.FC<Props> = ({ notebook, onUpdate }) => {
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  
  // AudioConfig State
  const [audioLength, setAudioLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [audioMode, setAudioMode] = useState<'Standard' | 'Learn'>('Standard');
  const [selectedVoices, setSelectedVoices] = useState({ joe: 'Orus', jane: 'Zephyr' });
  const [showAudioConfig, setShowAudioConfig] = useState(false);

  const { theme } = useTheme();
  const { startJob } = useJobs();

  // Check if any specific type is currently generating (to disable buttons)
  const isGenerating = (type: string) => {
      return notebook.artifacts.some(a => a.type === type && a.status === 'generating');
  };

  const handleGenerate = async (type: Artifact['type']) => {
    if (notebook.sources.length === 0) {
        alert("Please add sources first.");
        return;
    }
    
    // Start background job
    startJob(notebook.id, type, notebook.sources, { length: audioLength, mode: audioMode, voices: selectedVoices });
    setShowAudioConfig(false);
  };

  const handleShareArtifact = (artifact: Artifact) => {
      // Simulating share
      alert(`Shared "${artifact.title}" to clipboard!`);
  };

  const AudioPlayerVisualizer = ({ audioUrl, coverUrl, onJoinLive, title, topic }: { audioUrl: string; coverUrl?: string; onJoinLive?: () => void; title?: string; topic?: string }) => {
      const audioRef = useRef<HTMLAudioElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const audioCtxRef = useRef<AudioContext | null>(null);
      const analyserRef = useRef<AnalyserNode | null>(null);
      
      const [isPlaying, setIsPlaying] = useState(false);
      const [duration, setDuration] = useState(0);
      const [currentTime, setCurrentTime] = useState(0);

      // Responsive Sizing State
      const [dims, setDims] = useState({ canvasSize: 360, artSize: 192 }); // Default Desktop

      useEffect(() => {
          const handleResize = () => {
              const isMobile = window.innerWidth < 768;
              setDims({
                  canvasSize: isMobile ? 280 : 380, // Canvas width/height
                  artSize: isMobile ? 144 : 192,   // w-36 (144px) vs w-48 (192px)
              });
          };
          handleResize(); // Init
          window.addEventListener('resize', handleResize);
          return () => window.removeEventListener('resize', handleResize);
      }, []);

      useEffect(() => {
          const audio = audioRef.current;
          if (audio) {
              audio.src = audioUrl;
              audio.onloadedmetadata = () => setDuration(audio.duration);
              audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
              audio.onended = () => setIsPlaying(false);
          }
          return () => {
              if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                  audioCtxRef.current.close();
              }
          };
      }, [audioUrl]);

      const togglePlay = async () => {
          if (!audioRef.current) return;

          if (!audioCtxRef.current) {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioCtx();
              audioCtxRef.current = ctx;
              
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 512;
              analyser.smoothingTimeConstant = 0.8;
              analyserRef.current = analyser;

              const source = ctx.createMediaElementSource(audioRef.current);
              source.connect(analyser);
              analyser.connect(ctx.destination);
          }

          if (audioCtxRef.current?.state === 'suspended') {
              await audioCtxRef.current.resume();
          }

          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
          setIsPlaying(!isPlaying);
      };

      // Visualizer Colors
      let primaryColorHex = '#22d3ee'; // Default Cyan
      let secondaryColorHex = '#3b82f6'; // Default Blue

      if (theme.id === 'obsidian') { primaryColorHex = '#f59e0b'; secondaryColorHex = '#ea580c'; }
      if (theme.id === 'arctic') { primaryColorHex = '#38bdf8'; secondaryColorHex = '#818cf8'; }
      if (theme.id === 'quantum') { primaryColorHex = '#8b5cf6'; secondaryColorHex = '#d946ef'; }
      if (theme.id === 'gilded') { primaryColorHex = '#10b981'; secondaryColorHex = '#fbbf24'; }
      if (theme.id === 'crimson') { primaryColorHex = '#ef4444'; secondaryColorHex = '#f43f5e'; }
      if (theme.id === 'cyberpunk') { primaryColorHex = '#d946ef'; secondaryColorHex = '#06b6d4'; } // Fuchsia & Cyan

      useEffect(() => {
          let animationId: number;
          let rotation = 0;

          const render = () => {
              const canvas = canvasRef.current;
              const analyser = analyserRef.current;
              
              if (!canvas || !analyser) {
                  animationId = requestAnimationFrame(render);
                  return;
              }
              
              const ctx = canvas.getContext('2d');
              if (!ctx) return;

              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              analyser.getByteFrequencyData(dataArray);

              ctx.clearRect(0, 0, canvas.width, canvas.height);

              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              
              // Calculate radius to start EXACTLY at the edge of the art
              // Dims.artSize is diameter, so radius is / 2. Add a small buffer (8px).
              const baseRadius = (dims.artSize / 2) + 12; 
              
              const bars = 90;
              const step = (Math.PI * 2) / bars;

              rotation += 0.002; // Slow rotation

              for (let i = 0; i < bars; i++) {
                  const dataIndex = Math.floor((i / bars) * (bufferLength * 0.7));
                  const value = dataArray[dataIndex] || 0;
                  // Scale value for bar length
                  const barLen = (value / 255) * (dims.canvasSize * 0.15); // Dynamic length based on canvas size
                  
                  const angle = i * step + rotation;
                  
                  // Start point (on edge of album art)
                  const x1 = centerX + Math.cos(angle) * baseRadius;
                  const y1 = centerY + Math.sin(angle) * baseRadius;
                  
                  // End point
                  const x2 = centerX + Math.cos(angle) * (baseRadius + barLen);
                  const y2 = centerY + Math.sin(angle) * (baseRadius + barLen);

                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  
                  // Color based on theme
                  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                  gradient.addColorStop(0, primaryColorHex);
                  gradient.addColorStop(1, secondaryColorHex);
                  
                  ctx.strokeStyle = gradient;
                  ctx.lineWidth = 3;
                  ctx.lineCap = 'round';
                  ctx.stroke();
              }

              // Outer glow ring (only when playing)
              if (isPlaying) {
                  const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, baseRadius + 4, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.2, avg/500)})`;
                  ctx.lineWidth = 1;
                  ctx.stroke();
              }

              animationId = requestAnimationFrame(render);
          };

          render();
          return () => cancelAnimationFrame(animationId);
      }, [isPlaying, primaryColorHex, secondaryColorHex, dims]);

      const formatTime = (t: number) => {
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          return `${m}:${s.toString().padStart(2, '0')}`;
      };

      return (
          <div className="flex flex-col min-h-full relative bg-slate-950/50">
              {/* Audio Element */}
              <audio key={audioUrl} ref={audioRef} crossOrigin="anonymous" className="hidden" />
              
              {/* Top Half: Visualizer & Art */}
              <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-[280px] p-4">
                   
                   {/* Background Blur */}
                   {coverUrl && (
                       <div className="absolute inset-0 z-0 opacity-20 blur-3xl scale-125 pointer-events-none overflow-hidden">
                           <img src={coverUrl} className="w-full h-full object-cover" alt="" />
                       </div>
                   )}

                   {/* Main Centerpiece */}
                   <div 
                        className="relative flex items-center justify-center"
                        style={{ width: dims.canvasSize, height: dims.canvasSize }}
                   >
                        {/* Canvas Layer */}
                        <canvas 
                            ref={canvasRef} 
                            width={dims.canvasSize} 
                            height={dims.canvasSize} 
                            className="absolute inset-0 z-10 pointer-events-none" 
                        />
                        
                        {/* Album Art Container (Circular) */}
                        <div 
                            className={`relative rounded-full overflow-hidden z-20 shadow-2xl border-4 border-slate-900/50 ${isPlaying ? 'animate-spin-slow' : ''}`} 
                            style={{ width: dims.artSize, height: dims.artSize, animationDuration: '30s' }}
                        >
                            {coverUrl ? (
                                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br from-${theme.colors.primary}-900 to-slate-900 flex items-center justify-center`}>
                                    <Headphones size={48} className={`text-${theme.colors.primary}-400 opacity-50`} />
                                </div>
                            )}
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-black/20"></div>
                        </div>

                        {/* Play Button (Centered on Art) */}
                        <button 
                            onClick={togglePlay}
                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-14 h-14 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform border border-white/20 shadow-lg group`}
                        >
                            {isPlaying ? (
                                <Pause fill="white" size={24} className="drop-shadow-md" />
                            ) : (
                                <Play fill="white" size={24} className="ml-1 drop-shadow-md" />
                            )}
                        </button>
                   </div>
                   
                   {/* Title info below art */}
                   <div className="mt-2 md:mt-4 text-center z-20 px-4 max-w-sm">
                       <h2 className="text-lg md:text-2xl font-bold text-white leading-tight drop-shadow-lg line-clamp-1">{title || "Audio Overview"}</h2>
                       <p className="text-xs md:text-sm text-slate-400 mt-1 font-medium">{topic || "Deep Dive Podcast"}</p>
                   </div>
              </div>

              {/* Bottom Control Bar */}
              <div className="w-full p-4 md:p-6 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 z-30 shrink-0">
                   {/* Progress Bar */}
                   <div 
                        className="relative w-full h-1.5 bg-slate-800 rounded-full cursor-pointer group mb-4"
                        onClick={(e) => {
                            if(audioRef.current && duration) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const pos = (e.clientX - rect.left) / rect.width;
                                audioRef.current.currentTime = pos * duration;
                            }
                        }}
                    >
                        <div 
                            className={`absolute top-0 left-0 h-full bg-gradient-to-r from-${theme.colors.primary}-500 to-${theme.colors.secondary}-500 rounded-full`}
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        />
                        {/* Thumb */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        />
                   </div>

                   <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-3">
                       <span>{formatTime(currentTime)}</span>
                       <span>{formatTime(duration)}</span>
                   </div>

                   <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                             <button onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10; }} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                                <span className="text-[10px] font-bold">-10s</span>
                             </button>
                             <button onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                                <span className="text-[10px] font-bold">+10s</span>
                             </button>
                        </div>

                        {onJoinLive && (
                            <button 
                                onClick={onJoinLive}
                                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-${theme.colors.primary}-600 hover:bg-${theme.colors.primary}-500 text-white rounded-full text-xs font-bold shadow-lg shadow-${theme.colors.primary}-500/20 transition-all border border-white/10 shrink-0`}
                            >
                                <Mic size={14} /> 
                                <span className="hidden xs:inline">Join Live</span>
                                <span className="xs:hidden">Live</span>
                            </button>
                        )}
                   </div>
              </div>
          </div>
      );
  };
  
  const FlashcardPlayer = ({ content }: { content: any }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const cards = content?.cards || [];
    
    // Shuffle logic
    const [shuffledCards, setShuffledCards] = useState([...cards]);
    const [isShuffled, setIsShuffled] = useState(false);

    // Reset when content changes
    useEffect(() => {
        setShuffledCards([...cards]);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsShuffled(false);
    }, [content]);

    const activeCards = isShuffled ? shuffledCards : cards;
    const currentCard = activeCards[currentIndex];

    const nextCard = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % activeCards.length);
        }, 150);
    };

    const prevCard = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
             setCurrentIndex(prev => (prev - 1 + activeCards.length) % activeCards.length);
        }, 150);
    };

    const toggleShuffle = () => {
        setIsFlipped(false);
        if (isShuffled) {
             setIsShuffled(false);
             setCurrentIndex(0);
        } else {
             // Fisher-Yates shuffle
             const shuffled = [...cards];
             for (let i = shuffled.length - 1; i > 0; i--) {
                 const j = Math.floor(Math.random() * (i + 1));
                 [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
             }
             setShuffledCards(shuffled);
             setIsShuffled(true);
             setCurrentIndex(0);
        }
    };

    if (!currentCard) return <div className="p-8 text-center text-slate-500">No flashcards available.</div>;

    return (
        <div className="flex flex-col h-full bg-slate-950/50 relative overflow-hidden">
             {/* Progress Header */}
             <div className="p-4 flex justify-between items-center text-slate-400 border-b border-white/5">
                 <span className="text-xs font-bold uppercase tracking-widest">{isShuffled ? 'Randomized' : 'Sequential'}</span>
                 <span className="font-mono text-sm">{currentIndex + 1} / {activeCards.length}</span>
             </div>

             {/* Card Area */}
             <div className="flex-1 flex items-center justify-center p-4 md:p-12 perspective-1000">
                  <div 
                    className={`relative w-full max-w-2xl aspect-[4/3] md:aspect-[16/9] cursor-pointer group perspective-1000`}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                        <div 
                            className={`w-full h-full relative transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* FRONT */}
                            <div className={`absolute inset-0 backface-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 md:p-16 text-center hover:border-${theme.colors.primary}-500/30 transition-colors`}>
                                <span className={`text-${theme.colors.primary}-400 text-xs font-bold uppercase tracking-widest mb-4`}>Term</span>
                                <h2 className="text-2xl md:text-5xl font-bold text-white">{currentCard.term}</h2>
                                <p className="text-slate-500 text-sm mt-8 absolute bottom-8">Tap to flip</p>
                            </div>

                            {/* BACK */}
                            <div 
                                className={`absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-${theme.colors.primary}-900/20 to-slate-900 border border-${theme.colors.primary}-500/30 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 md:p-16 text-center`}
                            >
                                <span className={`text-${theme.colors.secondary}-400 text-xs font-bold uppercase tracking-widest mb-4`}>Definition</span>
                                <p className="text-lg md:text-2xl font-medium text-slate-200 leading-relaxed max-h-full overflow-y-auto">
                                    {currentCard.definition}
                                </p>
                            </div>
                        </div>
                  </div>
             </div>

             {/* Controls */}
             <div className="p-4 md:p-6 border-t border-white/5 flex items-center justify-center gap-6 bg-slate-900/50 backdrop-blur-md">
                 <button onClick={toggleShuffle} className={`p-3 rounded-full hover:bg-white/5 transition-colors ${isShuffled ? `text-${theme.colors.primary}-400` : 'text-slate-500'}`} title="Shuffle">
                     <Shuffle size={20} />
                 </button>
                 
                 <div className="flex items-center gap-4">
                     <button onClick={prevCard} className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all border border-white/5 hover:border-white/20 active:scale-95">
                         <ChevronLeft size={24} />
                     </button>
                     
                     <button 
                        onClick={() => setIsFlipped(!isFlipped)} 
                        className={`px-8 py-3 bg-${theme.colors.primary}-600/20 hover:bg-${theme.colors.primary}-600/30 text-${theme.colors.primary}-200 border border-${theme.colors.primary}-500/50 rounded-xl font-bold transition-all w-32`}
                     >
                         {isFlipped ? 'Show Term' : 'Show Def'}
                     </button>

                     <button onClick={nextCard} className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all border border-white/5 hover:border-white/20 active:scale-95">
                         <ChevronRight size={24} />
                     </button>
                 </div>

                 <button onClick={() => { setCurrentIndex(0); setIsFlipped(false); }} className="p-3 rounded-full hover:bg-white/5 text-slate-500 transition-colors" title="Reset">
                     <RotateCcw size={20} />
                 </button>
             </div>

             <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
             `}</style>
        </div>
    );
  };

  const SlidePlayer = ({ deck }: { deck: any }) => {
     const [currentSlide, setCurrentSlide] = useState(0);
      const [showNotes, setShowNotes] = useState(false);
      const [isFullscreen, setIsFullscreen] = useState(false);

      const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, deck.slides.length - 1));
      const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));
      
      const downloadHtml = () => {
         if (!deck.html) return;
         const blob = new Blob([deck.html], { type: 'text/html' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${deck.deckTitle.replace(/\s+/g, '_')}_Presentation.html`;
         a.click();
         URL.revokeObjectURL(url);
      };

      const slide = deck.slides[currentSlide];

      return (
          <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'relative'}`}>
              <div className="p-4 bg-slate-900 border-b border-white/5 flex flex-wrap justify-between items-center gap-2 shrink-0">
                  <h4 className="font-semibold text-slate-300 flex items-center gap-2 truncate max-w-[200px] md:max-w-none">
                      <Presentation size={18} className="text-rose-400 shrink-0" />
                      {deck.deckTitle}
                  </h4>
                  <div className="flex items-center gap-2 ml-auto">
                       {/* Export HTML Button */}
                      <button 
                        onClick={downloadHtml}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors border border-white/5"
                        title="Download Standalone HTML Presentation"
                      >
                          <FileCode size={14} />
                          <span className="hidden sm:inline">Export HTML</span>
                      </button>
                      <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400">
                          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                  </div>
              </div>

              <div className="flex-1 flex items-center justify-center bg-slate-950 p-4 md:p-8 relative overflow-hidden group">
                  {/* Updated Container: Full height on mobile, Aspect Video on Desktop */}
                  <div className="w-full max-w-5xl h-full md:h-auto md:aspect-video bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
                      <div className="flex-1 p-6 md:p-12 flex flex-col justify-center relative z-10 overflow-y-auto">
                          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 md:mb-8 leading-tight tracking-tight">
                              {slide.slideTitle}
                          </h2>
                          <div className="space-y-4 md:space-y-4">
                              {slide.bulletPoints.map((point: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-3 md:gap-4">
                                      <div className={`mt-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-${theme.colors.primary}-400 shrink-0`}></div>
                                      <p className="text-lg md:text-xl text-slate-300 leading-relaxed">{point}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                   <button onClick={prevSlide} disabled={currentSlide === 0} className={`absolute left-2 md:left-4 p-2 md:p-3 bg-black/50 hover:bg-${theme.colors.primary}-500 rounded-full text-white backdrop-blur-sm transition-all disabled:opacity-0 hover:scale-110 z-20`}>
                      <ChevronLeft size={24} className="md:w-8 md:h-8" />
                  </button>
                  <button onClick={nextSlide} disabled={currentSlide === deck.slides.length - 1} className={`absolute right-2 md:right-4 p-2 md:p-3 bg-black/50 hover:bg-${theme.colors.primary}-500 rounded-full text-white backdrop-blur-sm transition-all disabled:opacity-0 hover:scale-110 z-20`}>
                      <ChevronRight size={24} className="md:w-8 md:h-8" />
                  </button>
              </div>
          </div>
      );
  };
  
  const ArtifactModal = ({ artifact, onClose, onJoinLive }: { artifact: Artifact; onClose: () => void; onJoinLive: () => void }) => {
     const modalContent = (
        <div className="fixed inset-0 bg-black/95 md:bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-0 md:p-4">
            <div className={`glass-panel w-full h-full md:rounded-3xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border-x-0 md:border border-white/10 shadow-2xl overflow-hidden ${artifact.type === 'slideDeck' ? 'max-w-7xl md:h-[90vh]' : 'max-w-5xl md:h-[85vh]'}`}>
                <div className="flex justify-between items-center p-3 md:p-6 border-b border-white/10 bg-slate-900/50 shrink-0 safe-top">
                    <h3 className="text-base md:text-xl font-bold flex items-center gap-3 text-white truncate pr-2">
                        {artifact.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => handleShareArtifact(artifact)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <Share2 size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
                    </div>
                </div>
                
                <div className={`flex-1 bg-slate-950 min-h-0 ${artifact.type === 'audioOverview' || artifact.type === 'slideDeck' || artifact.type === 'flashcards' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                    {/* Render content based on type */}
                    {artifact.type === 'audioOverview' && (
                        <div className="flex flex-col md:grid md:grid-cols-2 h-full">
                            {/* Left Col: Player (50% on mobile with scrolling, Full on desktop) */}
                            <div className="h-[50%] md:h-full border-b md:border-b-0 md:border-r border-white/5 bg-slate-900/30 relative overflow-y-auto md:overflow-hidden scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                <AudioPlayerVisualizer 
                                    audioUrl={artifact.content.audioUrl} 
                                    coverUrl={artifact.content.coverUrl} 
                                    onJoinLive={onJoinLive} 
                                    title={artifact.content.title}
                                    topic={artifact.content.topic}
                                />
                            </div>
                            
                            {/* Right Col: Transcript (50% on mobile, Full on desktop) */}
                            <div className="h-[50%] md:h-full overflow-y-auto bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                <div className="p-4 md:p-8 space-y-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-950 py-2 z-10 border-b border-white/5">Transcript</h4>
                                    {artifact.content.script.split('\n').map((line: string, i: number) => {
                                        const parts = line.split(':');
                                        const speaker = parts[0]?.trim();
                                        const text = parts.slice(1).join(':').trim();
                                        
                                        if (!text) return null;

                                        const isJoe = speaker.toLowerCase().includes('joe');
                                        // Use dynamic bubble styling
                                        const bubbleColor = isJoe ? `bg-${theme.colors.primary}-900/20 border-${theme.colors.primary}-500/10` : `bg-${theme.colors.secondary}-900/20 border-${theme.colors.secondary}-500/10`;
                                        const textColor = isJoe ? `text-${theme.colors.primary}-100` : `text-${theme.colors.secondary}-100`;
                                        const alignClass = isJoe ? 'mr-8 md:mr-12' : 'ml-8 md:ml-12';
                                        
                                        return (
                                            <div key={i} className={`flex flex-col gap-1 ${alignClass} group animate-in slide-in-from-bottom-2 duration-500`}>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1 ${!isJoe && 'text-right'}`}>
                                                    {speaker}
                                                </span>
                                                <div className={`p-3 md:p-4 rounded-2xl text-sm md:text-base leading-relaxed border ${bubbleColor} ${textColor} hover:brightness-110 transition-all shadow-sm`}>
                                                    {text}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Infographic Renderer */}
                    {artifact.type === 'infographic' && (
                        <div className="flex flex-col items-center p-4 md:p-8 gap-4 overflow-y-auto h-full">
                            <img src={artifact.content.imageUrl} className="w-full max-w-4xl rounded-lg shadow-2xl border border-white/10" alt="Generated Infographic" />
                            <a 
                                href={artifact.content.imageUrl} 
                                download="infographic.png"
                                className={`flex items-center gap-2 px-6 py-3 bg-${theme.colors.primary}-600 hover:bg-${theme.colors.primary}-500 text-white rounded-xl font-bold shadow-lg mt-4 shrink-0`}
                            >
                                <Download size={18} /> Download Image
                            </a>
                        </div>
                    )}

                    {/* Slide Deck Player */}
                    {artifact.type === 'slideDeck' && <SlidePlayer deck={artifact.content} />}

                    {/* Flashcard Player */}
                    {artifact.type === 'flashcards' && <FlashcardPlayer content={artifact.content} />}
                    
                    {/* Fallback for others */}
                    {(artifact.type === 'quiz') && (
                        <div className="p-6 md:p-8">
                            <pre className="text-xs text-slate-400 overflow-auto">{JSON.stringify(artifact.content, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
      // Use createPortal to render the modal at the document root, above all other layers
      return createPortal(modalContent, document.body);
  };

  if (liveSessionActive) {
      return (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => setLiveSessionActive(false)}
                className="self-start mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-2 group"
              >
                  <div className="p-1 rounded-full bg-white/5 group-hover:bg-white/10"><X size={14}/></div>
                  Back to Studio
              </button>
              <LiveSession notebook={notebook} />
          </div>
      );
  }

  return (
    <div className="space-y-8 pb-20">
      {viewingArtifact && (
          <ArtifactModal 
              artifact={viewingArtifact} 
              onClose={() => setViewingArtifact(null)} 
              onJoinLive={() => { setViewingArtifact(null); setLiveSessionActive(true); }}
          />
      )}

      {/* Audio Overview Hero Section */}
      <div className={`glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden border border-${theme.colors.primary}-500/20 shadow-[0_0_40px_rgba(var(--color-${theme.colors.primary}),0.1)] group`}>
        <div className={`absolute top-0 right-0 p-40 bg-${theme.colors.primary}-500/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-${theme.colors.primary}-500/15 transition-colors duration-700`}></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 bg-gradient-to-br from-${theme.colors.primary}-400 to-${theme.colors.secondary}-600 rounded-lg shadow-lg shadow-${theme.colors.primary}-500/30`}>
                        <Headphones className="text-white" size={24} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Audio Overview</h2>
                </div>
                <p className="text-slate-400 text-base md:text-lg leading-relaxed">
                    Turn your notebook sources into an engaging <span className={`text-${theme.colors.primary}-400 font-medium`}>Deep Dive Podcast</span>. 
                    Two AI hosts will summarize, debate, and explain key concepts.
                </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[320px]">
                 {isGenerating('audioOverview') ? (
                     <div className={`w-full bg-slate-900/90 border border-${theme.colors.primary}-500/30 p-5 rounded-xl flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95`}>
                         <Loader2 className={`animate-spin text-${theme.colors.primary}-400`} size={24} />
                         <div className="text-center">
                             <p className={`text-${theme.colors.primary}-400 font-bold text-sm animate-pulse`}>Generating in background...</p>
                         </div>
                     </div>
                 ) : showAudioConfig ? (
                     <div className={`bg-slate-900/90 border border-${theme.colors.primary}-500/30 p-5 rounded-xl space-y-5 animate-in fade-in zoom-in-95`}>
                         {/* Format/Mode Selector */}
                         <div>
                             <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Format</label>
                             <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setAudioMode('Standard')}
                                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all ${audioMode === 'Standard' ? `bg-${theme.colors.primary}-600/20 border-${theme.colors.primary}-500 text-${theme.colors.primary}-200` : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <Mic size={18} />
                                    <span className="text-xs font-medium">Deep Dive</span>
                                </button>
                                <button
                                    onClick={() => setAudioMode('Learn')}
                                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all ${audioMode === 'Learn' ? `bg-${theme.colors.primary}-600/20 border-${theme.colors.primary}-500 text-${theme.colors.primary}-200` : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <GraduationCap size={18} />
                                    <span className="text-xs font-medium">Study Guide</span>
                                </button>
                             </div>
                         </div>

                         {/* Voice Selector */}
                         <div>
                             <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Host Voices</label>
                             <div className="space-y-2">
                                {/* Joe Voice */}
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold bg-${theme.colors.primary}-900/50 text-${theme.colors.primary}-300 px-1.5 py-0.5 rounded border border-${theme.colors.primary}-500/20`}>JOE</span>
                                    <select 
                                        value={selectedVoices.joe}
                                        onChange={(e) => setSelectedVoices(prev => ({ ...prev, joe: e.target.value }))}
                                        className="flex-1 bg-slate-800 border-none rounded text-xs text-white p-1.5 focus:ring-1 focus:ring-cyan-500"
                                    >
                                        {VOICES.joe.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Jane Voice */}
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold bg-${theme.colors.secondary}-900/50 text-${theme.colors.secondary}-300 px-1.5 py-0.5 rounded border border-${theme.colors.secondary}-500/20`}>JANE</span>
                                    <select 
                                        value={selectedVoices.jane}
                                        onChange={(e) => setSelectedVoices(prev => ({ ...prev, jane: e.target.value }))}
                                        className="flex-1 bg-slate-800 border-none rounded text-xs text-white p-1.5 focus:ring-1 focus:ring-blue-500"
                                    >
                                        {VOICES.jane.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                             </div>
                         </div>
                         
                         {/* Length Selector */}
                         <div>
                             <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Length</label>
                             <div className="flex bg-slate-800 rounded-lg p-1">
                                 {['Short', 'Medium', 'Long'].map((l) => (
                                     <button
                                        key={l}
                                        onClick={() => setAudioLength(l as any)}
                                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${audioLength === l ? `bg-${theme.colors.primary}-600 text-white shadow-md` : 'text-slate-400 hover:text-slate-200'}`}
                                     >
                                         {l}
                                     </button>
                                 ))}
                             </div>
                         </div>

                         <button 
                            onClick={() => handleGenerate('audioOverview')}
                            className={`w-full py-2.5 bg-gradient-to-r from-${theme.colors.primary}-500 to-${theme.colors.secondary}-600 text-white font-bold rounded-lg shadow-lg shadow-${theme.colors.primary}-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2`}
                        >
                            <Wand2 size={16} /> Generate {audioMode === 'Learn' ? 'Guide' : 'Podcast'}
                         </button>
                     </div>
                 ) : (
                    <>
                        <button 
                            onClick={() => setShowAudioConfig(true)}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-slate-200 hover:text-white hover:border-white/10"
                        >
                            <Wand2 size={18} />
                            Generate Podcast
                        </button>
                        <button 
                            onClick={() => setLiveSessionActive(true)}
                            className={`w-full py-3 bg-gradient-to-r from-${theme.colors.primary}-600 to-${theme.colors.secondary}-600 rounded-xl font-bold text-white shadow-lg hover:shadow-${theme.colors.primary}-500/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 border border-white/10`}
                        >
                            <Mic size={18} />
                            Join Live Discussion
                        </button>
                    </>
                 )}
            </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Layout size={20} className="text-slate-400" />
            Study Materials
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { id: 'flashcards', label: 'Flashcards', icon: Layout, color: 'text-yellow-400', desc: 'Study key terms' },
                { id: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-purple-400', desc: 'Test your knowledge' },
                { id: 'infographic', label: 'Infographic', icon: FileText, color: 'text-green-400', desc: 'Visual outline' },
                { id: 'slideDeck', label: 'Slide Deck', icon: Presentation, color: 'text-rose-400', desc: 'Presentation outline' },
            ].map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => handleGenerate(tool.id as any)}
                    disabled={isGenerating(tool.id)}
                    className={`glass-panel p-6 rounded-2xl flex flex-col items-start gap-4 hover:bg-slate-800 hover:border-${theme.colors.primary}-500/30 transition-all group text-left`}
                >
                    <div className={`p-3 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform shadow-inner border border-white/5 group-hover:border-white/10`}>
                        {isGenerating(tool.id) ? (
                            <Loader2 className={`animate-spin ${tool.color}`} size={24} />
                        ) : (
                            <tool.icon className={tool.color} size={24} />
                        )}
                    </div>
                    <div>
                        <span className="font-bold text-slate-200 block text-lg">{tool.label}</span>
                        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{isGenerating(tool.id) ? 'Generating...' : tool.desc}</span>
                    </div>
                </button>
            ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Activity size={20} className="text-slate-400" />
            Generated Media
        </h3>
        <div className="space-y-3">
            {notebook.artifacts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                    <Wand2 className="mx-auto mb-3 opacity-50" size={32} />
                    <p>No media generated yet.</p>
                </div>
            ) : (
                notebook.artifacts.map(art => (
                    <div key={art.id} className={`glass-panel p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-800/50 transition-colors group border-transparent hover:border-white/5 ${art.status === 'generating' ? 'opacity-70' : ''} gap-4`}>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="p-3 bg-slate-900 rounded-xl shadow-inner border border-white/5 relative shrink-0 overflow-hidden">
                                {art.status === 'generating' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-20">
                                        <Loader2 className="animate-spin text-white" size={16} />
                                    </div>
                                )}
                                {/* Cover Art Preview for Audio Overview */}
                                {art.type === 'audioOverview' && art.content?.coverUrl ? (
                                    <img src={art.content.coverUrl} className="w-6 h-6 object-cover rounded" alt="Cover" />
                                ) : (
                                    <>
                                        {art.type === 'audioOverview' && <Headphones className={`text-${theme.colors.primary}-400`} size={20} />}
                                        {art.type === 'flashcards' && <Layout className="text-yellow-400" size={20} />}
                                        {art.type === 'quiz' && <HelpCircle className="text-purple-400" size={20} />}
                                        {art.type === 'infographic' && <FileText className="text-green-400" size={20} />}
                                        {art.type === 'slideDeck' && <Presentation className="text-rose-400" size={20} />}
                                    </>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h4 className={`font-medium text-slate-200 group-hover:text-${theme.colors.primary}-300 transition-colors truncate`}>
                                    {art.content?.title || art.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-800 rounded-full capitalize border border-white/5 ${art.status === 'failed' ? 'text-red-400 border-red-900/50' : ''}`}>
                                        {art.status === 'generating' ? 'Processing...' : art.status === 'failed' ? 'Failed' : art.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                             {/* Share Button for Artifacts */}
                             {art.status === 'completed' && (
                                <button 
                                    onClick={() => handleShareArtifact(art)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                    title="Share"
                                >
                                    <Share2 size={16} />
                                </button>
                             )}
                             {art.status === 'completed' && (
                                <button 
                                    onClick={() => setViewingArtifact(art)}
                                    className={`px-4 py-2 bg-slate-800 hover:bg-${theme.colors.primary}-500 hover:text-white rounded-lg text-sm font-medium transition-all text-slate-400 border border-white/5 hover:border-${theme.colors.primary}-500/50`}
                                >
                                    View
                                </button>
                            )}
                        </div>
                        {art.status === 'failed' && (
                            <div className="px-4 py-2 text-red-500 text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> Error
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default StudioTab;