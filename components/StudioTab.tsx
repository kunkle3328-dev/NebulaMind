
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Notebook, Artifact } from '../types';
import { Mic, Headphones, FileText, HelpCircle, Layout, Presentation, Play, Pause, Loader2, X, Download, Wand2, Activity, Sparkles, ChevronRight, ChevronLeft, Maximize2, Minimize2, Monitor, AlertCircle, Share2, FileCode, GraduationCap, BookOpen, Volume2, ImageIcon, RotateCcw, Shuffle, Network, Check, Flame, Newspaper, Coffee, Users, AlignLeft, Target, Copy, Radio, Info, ScrollText, CheckCircle2, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import LiveSession from './LiveSession';
import { useTheme, useJobs } from '../App';
import { VOICES, PODCAST_STYLES, LEARNING_INTENTS } from '../constants';

interface Props {
  notebook: Notebook;
  onUpdate: (nb: Notebook) => void;
}

// --- SUB-COMPONENTS ---

const AudioPlayerVisualizer = ({ audioUrl, coverUrl, onJoinLive, title, topic, script }: { audioUrl: string; coverUrl?: string; onJoinLive?: () => void; title?: string; topic?: string; script?: string }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const { theme } = useTheme();

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
            // Force 1.0x speed on load
            audio.playbackRate = 1.0;
            // Re-enforce on loadeddata
            audio.onloadeddata = () => { audio.playbackRate = 1.0; };
            
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

        // Ensure rate is 1.0x immediately before playing
        audioRef.current.playbackRate = 1.0; 

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
    if (theme.id === 'lux') { primaryColorHex = '#d946ef'; secondaryColorHex = '#fbbf24'; } // Violet & Gold

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
        <div className="flex flex-col h-full relative bg-slate-950/50 overflow-x-hidden">
            {/* Audio Element */}
            <audio key={audioUrl} ref={audioRef} crossOrigin="anonymous" className="hidden" />
            
            {/* Transcript Overlay */}
            {showTranscript && (
                <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <AlignLeft size={18} className={`text-${theme.colors.primary}-400`} />
                            Transcript
                        </h3>
                        <button onClick={() => setShowTranscript(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed text-slate-300">
                        {script ? (
                            script.split('\n').map((line, i) => {
                                const isHostA = line.startsWith('Joe:') || line.startsWith('JOE:');
                                const isHostB = line.startsWith('Jane:') || line.startsWith('JANE:');
                                
                                return (
                                    <p key={i} className={`mb-4 ${isHostA ? `text-${theme.colors.primary}-300` : isHostB ? `text-${theme.colors.secondary}-300` : 'text-slate-400'}`}>
                                        {line}
                                    </p>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                <FileText size={48} className="mb-2" />
                                <p>Transcript not available for this session.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Top Half: Visualizer & Art */}
            <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-[280px] p-4 overflow-hidden">
                 
                 {/* Background Blur */}
                 {coverUrl && (
                     <div className="absolute inset-0 z-0 opacity-20 blur-3xl scale-125 pointer-events-none overflow-hidden">
                         <img src={coverUrl} className="w-full h-full object-cover" alt="" />
                     </div>
                 )}

                 {/* Main Centerpiece */}
                 <div 
                      className="relative flex items-center justify-center shrink-0"
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

                      <div className="flex items-center gap-2">
                          <button 
                              onClick={() => setShowTranscript(true)}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-xs font-bold transition-all border border-white/5 shrink-0"
                              title="Show Transcript"
                          >
                              <AlignLeft size={14} />
                              <span className="hidden xs:inline">Transcript</span>
                          </button>

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
        </div>
    );
};

const FlashcardPlayer = ({ content }: { content: any }) => {
    // Re-implemented to ensure context
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const { theme } = useTheme();

    if (!content?.cards || content.cards.length === 0) return <div className="p-8 text-center text-slate-500">No cards available</div>;

    const card = content.cards[index];

    const next = () => {
        setIsFlipped(false);
        setIndex((prev) => (prev + 1) % content.cards.length);
    };

    const prev = () => {
        setIsFlipped(false);
        setIndex((prev) => (prev - 1 + content.cards.length) % content.cards.length);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 relative perspective-[1000px]">
             <div 
                className={`relative w-full max-w-xl aspect-[3/2] cursor-pointer transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
             >
                 <div className={`absolute inset-0 backface-hidden glass-panel rounded-2xl border border-white/10 flex flex-col items-center justify-center p-8 text-center bg-slate-900 shadow-2xl`}>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Term</p>
                     <h3 className="text-2xl md:text-4xl font-bold text-white leading-tight">{card.term}</h3>
                     <p className="absolute bottom-6 text-xs text-slate-500 animate-pulse">Click to flip</p>
                 </div>
                 <div 
                    className={`absolute inset-0 backface-hidden glass-panel rounded-2xl border border-${theme.colors.primary}-500/30 flex flex-col items-center justify-center p-8 text-center bg-${theme.colors.primary}-900/20 shadow-2xl rotate-y-180`}
                    style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
                >
                     <p className={`text-xs font-bold text-${theme.colors.primary}-400 uppercase tracking-widest mb-4`}>Definition</p>
                     <p className="text-lg md:text-xl text-slate-200 leading-relaxed">{card.definition}</p>
                 </div>
             </div>
             <div className="flex items-center gap-8 mt-8">
                 <button onClick={prev} className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-white/10"><ChevronLeft size={24} /></button>
                 <span className="font-mono text-slate-500">{index + 1} / {content.cards.length}</span>
                 <button onClick={next} className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-white/10"><ChevronRight size={24} /></button>
             </div>
        </div>
    );
};

const SlideDeckViewer = ({ content }: { content: any }) => {
    const [index, setIndex] = useState(0);
    const { theme } = useTheme();
    if (!content?.slides) return <div className="p-8 text-center text-slate-500">No slides available</div>;
    const slide = content.slides[index];
    const next = () => setIndex((prev) => Math.min(prev + 1, content.slides.length - 1));
    const prev = () => setIndex((prev) => Math.max(prev - 1, 0));
    const downloadHtml = () => {
        if (content.html) {
            const blob = new Blob([content.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${content.deckTitle || 'Presentation'}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };
    return (
        <div className="flex flex-col h-full bg-slate-950">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-white truncate">{content.deckTitle}</h3>
                <div className="flex gap-2">
                    {content.html && (
                         <button onClick={downloadHtml} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-2">
                             <Download size={14} /> Download HTML
                         </button>
                    )}
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden bg-slate-900 relative">
                <div className="w-full max-w-4xl aspect-[16/9] bg-white text-slate-900 rounded-lg shadow-2xl p-8 md:p-16 flex flex-col relative overflow-hidden">
                    <div className="relative z-10 flex flex-col h-full">
                        <h2 className={`text-3xl md:text-5xl font-bold text-${theme.colors.primary}-600 mb-8 leading-tight`}>{slide.slideTitle}</h2>
                        <ul className="space-y-4 text-lg md:text-2xl flex-1">
                            {slide.bulletPoints?.map((bp: string, i: number) => (
                                <li key={i} className="flex items-start gap-3"><span className={`mt-2 w-2 h-2 rounded-full bg-${theme.colors.secondary}-500 shrink-0`}></span><span>{bp}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t border-white/10 flex items-center justify-between bg-slate-900/50">
                 <button onClick={prev} disabled={index === 0} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30"><ChevronLeft size={24} /></button>
                 <button onClick={next} disabled={index === content.slides.length - 1} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30"><ChevronRight size={24} /></button>
            </div>
        </div>
    );
};

const ExecutiveBriefViewer = ({ content }: { content: any }) => {
    const { theme } = useTheme();
    
    return (
        <div className="h-full w-full bg-slate-950 overflow-y-auto p-4 md:p-12">
            <div className="max-w-4xl mx-auto bg-white text-slate-900 shadow-2xl rounded-sm min-h-[1000px] relative overflow-hidden flex flex-col">
                
                {/* Confidential Stamp */}
                <div className="absolute top-12 right-12 border-4 border-red-600/30 text-red-600/30 font-black text-4xl px-4 py-2 uppercase rotate-[-15deg] pointer-events-none z-0">
                    Confidential
                </div>

                {/* Header */}
                <div className={`p-12 pb-8 border-b-4 border-${theme.colors.primary}-600 bg-slate-50 relative z-10`}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3 text-slate-500">
                             <div className={`w-10 h-10 bg-${theme.colors.primary}-600 rounded flex items-center justify-center text-white`}>
                                 <ScrollText size={24} />
                             </div>
                             <div>
                                 <h1 className="font-bold text-xs uppercase tracking-widest">Executive Briefing</h1>
                                 <p className="text-[10px] opacity-70">Internal Use Only</p>
                             </div>
                        </div>
                        <div className="text-right">
                             <p className="text-xs font-mono text-slate-400">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 leading-tight mb-2">{content.briefTitle}</h1>
                </div>

                {/* Content */}
                <div className="p-12 space-y-10 flex-1 relative z-10">
                    
                    {/* Executive Summary */}
                    <section>
                        <h3 className={`text-sm font-bold text-${theme.colors.primary}-600 uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            <Info size={16} /> Executive Summary
                        </h3>
                        <p className="text-xl leading-relaxed font-serif text-slate-700 italic border-l-4 border-slate-200 pl-6">
                            "{content.executiveSummary}"
                        </p>
                    </section>

                    {/* Key Findings Grid */}
                    <section>
                        <h3 className={`text-sm font-bold text-${theme.colors.primary}-600 uppercase tracking-widest mb-4 flex items-center gap-2`}>
                            <Target size={16} /> Key Findings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {content.keyFindings?.map((finding: any, i: number) => (
                                <div key={i} className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                                    <h4 className="font-bold text-slate-800 mb-2">{finding.heading}</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">{finding.point}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Strategic Implications */}
                    <section>
                         <h3 className={`text-sm font-bold text-${theme.colors.primary}-600 uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            <TrendingUp size={16} /> Strategic Implications
                        </h3>
                         <div className="p-6 bg-slate-900 text-slate-200 rounded-lg shadow-inner">
                             <p className="leading-relaxed">{content.strategicImplications}</p>
                         </div>
                    </section>

                    {/* Action Items */}
                    <section>
                        <h3 className={`text-sm font-bold text-${theme.colors.primary}-600 uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            <CheckCircle2 size={16} /> Recommended Actions
                        </h3>
                        <ul className="space-y-3">
                            {content.actionableItems?.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-3 text-slate-700">
                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-${theme.colors.secondary}-500 shrink-0`}></div>
                                    <span className="font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                </div>

                {/* Footer */}
                <div className="bg-slate-100 p-6 border-t border-slate-200 text-center text-xs text-slate-400 uppercase tracking-widest">
                    Generated by Nebula Mind AI • Confidential Document
                </div>
            </div>
        </div>
    );
};

const StudioTab: React.FC<Props> = ({ notebook, onUpdate }) => {
    const { theme } = useTheme();
    const { startJob, jobs } = useJobs();
    
    // Navigation
    const [section, setSection] = useState<'audio' | 'lab' | 'live'>('audio');
    
    // Audio Generation State
    const [audioLength, setAudioLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
    const [audioStyle, setAudioStyle] = useState('Deep Dive');
    const [learningIntent, setLearningIntent] = useState('Understand Basics');
    const [selectedVoices, setSelectedVoices] = useState({ joe: 'Puck', jane: 'Aoede' });
    
    // Lab Generation State
    const [artifactType, setArtifactType] = useState<Artifact['type']>('flashcards');

    // Artifact Viewing State
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

    // Helpers
    const audioArtifact = notebook.artifacts.find(a => a.type === 'audioOverview' && a.status === 'completed');
    // Find active job for this notebook and audio type to get progress
    const activeAudioJob = jobs.find(j => j.notebookId === notebook.id && j.type === 'audioOverview' && j.status === 'processing');
    const isAudioGenerating = !!activeAudioJob || notebook.artifacts.some(a => a.type === 'audioOverview' && a.status === 'generating');
    
    const handleGenerateAudio = async () => {
        await startJob(notebook.id, 'audioOverview', notebook.sources, {
            length: audioLength,
            style: audioStyle,
            voices: selectedVoices, // Pass the selected voices
            learningIntent: audioStyle === 'Study Guide' ? learningIntent : undefined
        });
    };

    const handleGenerateArtifact = async (type: Artifact['type']) => {
        await startJob(notebook.id, type, notebook.sources);
    };

    const handleDeleteArtifact = (id: string) => {
        const updated = {
            ...notebook,
            artifacts: notebook.artifacts.filter(a => a.id !== id),
            updatedAt: Date.now()
        };
        onUpdate(updated);
        if (selectedArtifact?.id === id) setSelectedArtifact(null);
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Top Navigation Bar */}
            <div className="flex items-center gap-2 p-1 bg-slate-900/50 rounded-xl border border-white/10 w-fit overflow-x-auto max-w-full no-scrollbar">
                <button onClick={() => setSection('audio')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${section === 'audio' ? `bg-${theme.colors.primary}-600 text-white shadow-lg` : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                    <Headphones size={16} /> Audio Studio
                </button>
                <button onClick={() => setSection('lab')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${section === 'lab' ? `bg-${theme.colors.primary}-600 text-white shadow-lg` : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                    <Layout size={16} /> Knowledge Lab
                </button>
                <button onClick={() => setSection('live')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${section === 'live' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                    <Activity size={16} /> Live Arena
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 glass-panel rounded-2xl border border-white/10 overflow-hidden relative">
                
                {/* 1. AUDIO STUDIO */}
                {section === 'audio' && (
                    <div className="h-full flex flex-col">
                        {audioArtifact ? (
                            <AudioPlayerVisualizer 
                                audioUrl={audioArtifact.content.audioUrl}
                                coverUrl={audioArtifact.content.coverUrl}
                                title={audioArtifact.content.title}
                                topic={audioArtifact.content.topic}
                                script={audioArtifact.content.script}
                                onJoinLive={() => setSection('live')}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto overflow-y-auto">
                                <div className={`w-24 h-24 rounded-full bg-${theme.colors.primary}-900/20 flex items-center justify-center mb-6 shrink-0`}>
                                    <Headphones size={48} className={`text-${theme.colors.primary}-400`} />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Generate Audio Overview</h2>
                                <p className="text-slate-400 mb-8">Turn your sources into an engaging, deep-dive podcast with two AI hosts.</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                                    <div className="space-y-3 text-left">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Length</label>
                                        <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10">
                                            {['Short', 'Medium', 'Long'].map((l) => (
                                                <button 
                                                    key={l}
                                                    onClick={() => setAudioLength(l as any)}
                                                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${audioLength === l ? `bg-${theme.colors.primary}-600 text-white` : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Style</label>
                                        <select 
                                            value={audioStyle} 
                                            onChange={(e) => setAudioStyle(e.target.value)}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-white/30"
                                        >
                                            {PODCAST_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* Voice Selectors */}
                                    <div className="space-y-3 text-left">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Host A (Analytical)</label>
                                        <select 
                                            value={selectedVoices.joe}
                                            onChange={(e) => setSelectedVoices(prev => ({ ...prev, joe: e.target.value }))}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-white/30"
                                        >
                                            {VOICES.joe.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Host B (Creative)</label>
                                        <select 
                                            value={selectedVoices.jane}
                                            onChange={(e) => setSelectedVoices(prev => ({ ...prev, jane: e.target.value }))}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-white/30"
                                        >
                                            {VOICES.jane.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Study Guide Specific Selection */}
                                {audioStyle === 'Study Guide' && (
                                    <div className="w-full mb-8 text-left animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Learning Intent</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {LEARNING_INTENTS.map((intent) => (
                                                <button
                                                    key={intent.id}
                                                    onClick={() => setLearningIntent(intent.id)}
                                                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${learningIntent === intent.id ? `bg-${theme.colors.primary}-900/30 border-${theme.colors.primary}-500 text-white` : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/20'}`}
                                                >
                                                    {learningIntent === intent.id && (
                                                        <div className={`absolute top-2 right-2 text-${theme.colors.primary}-400`}>
                                                            <Check size={14} />
                                                        </div>
                                                    )}
                                                    <span className="block text-sm font-bold mb-1">{intent.label}</span>
                                                    <span className="block text-[10px] opacity-70 leading-tight">{intent.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isAudioGenerating ? (
                                    <div className={`w-full max-w-md bg-${theme.colors.primary}-900/10 border border-${theme.colors.primary}-500/20 rounded-2xl p-6 flex flex-col items-center gap-4 animate-in fade-in shadow-2xl`}>
                                        <div className="relative">
                                            <div className={`w-16 h-16 rounded-full border-4 border-${theme.colors.primary}-500/30 border-t-${theme.colors.primary}-500 animate-spin`}></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Radio size={24} className={`text-${theme.colors.primary}-400 animate-pulse`} />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <h3 className={`text-lg font-bold text-${theme.colors.primary}-300`}>Generating Podcast...</h3>
                                            <p className="text-sm text-slate-400 mt-1 font-mono">{activeAudioJob?.progress || 'Initializing models...'}</p>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                            <div className={`h-full bg-${theme.colors.primary}-500 w-2/3 animate-progress-indeterminate`}></div>
                                        </div>
                                        <p className="text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">Estimated time: 2-5 minutes</p>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleGenerateAudio}
                                        disabled={notebook.sources.length === 0}
                                        className={`w-full md:w-auto px-8 py-4 bg-gradient-to-r from-${theme.colors.primary}-600 to-${theme.colors.secondary}-600 rounded-xl text-white font-bold text-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3`}
                                    >
                                        <Wand2 />
                                        Generate {audioStyle === 'Study Guide' ? 'Lesson' : 'Podcast'}
                                    </button>
                                )}
                                
                                {notebook.sources.length === 0 && <p className="text-red-400 text-xs mt-3">Add sources first.</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. KNOWLEDGE LAB */}
                {section === 'lab' && (
                    <div className="h-full flex">
                        {/* Sidebar List - Hidden on mobile when viewing artifact to save space, visible otherwise */}
                        <div className={`w-full md:w-72 bg-slate-900/50 md:border-r border-white/10 flex flex-col absolute md:relative z-10 h-full transition-transform ${selectedArtifact ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                            {/* ... (rest of the component) ... */}
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Artifacts</h3>
                                <div className="grid grid-cols-2 md:grid-cols-2 gap-2 mb-4">
                                    <button onClick={() => handleGenerateArtifact('flashcards')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 flex flex-col items-center gap-2 group" title="Flashcards">
                                        <Copy size={20} className="text-orange-400 group-hover:scale-110 transition-transform"/>
                                        <span className="text-[10px] text-slate-400">Cards</span>
                                    </button>
                                    <button onClick={() => handleGenerateArtifact('quiz')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 flex flex-col items-center gap-2 group" title="Quiz">
                                        <HelpCircle size={20} className="text-green-400 group-hover:scale-110 transition-transform"/>
                                        <span className="text-[10px] text-slate-400">Quiz</span>
                                    </button>
                                    <button onClick={() => handleGenerateArtifact('executiveBrief')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 flex flex-col items-center gap-2 group" title="Executive Brief">
                                        <ScrollText size={20} className="text-cyan-400 group-hover:scale-110 transition-transform"/>
                                        <span className="text-[10px] text-slate-400">Brief</span>
                                    </button>
                                    <button onClick={() => handleGenerateArtifact('slideDeck')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 flex flex-col items-center gap-2 group" title="Slides">
                                        <Presentation size={20} className="text-purple-400 group-hover:scale-110 transition-transform"/>
                                        <span className="text-[10px] text-slate-400">Slides</span>
                                    </button>
                                    <button onClick={() => handleGenerateArtifact('infographic')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 flex flex-col items-center gap-2 group col-span-2 md:col-span-2" title="Infographic">
                                        <ImageIcon size={20} className="text-pink-400 group-hover:scale-110 transition-transform"/>
                                        <span className="text-[10px] text-slate-400">Infographic Poster</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {notebook.artifacts.filter(a => a.type !== 'audioOverview').map(a => (
                                    <button 
                                        key={a.id}
                                        onClick={() => setSelectedArtifact(a)}
                                        className={`w-full p-3 rounded-lg text-left transition-all border ${selectedArtifact?.id === a.id ? `bg-${theme.colors.primary}-900/30 border-${theme.colors.primary}-500/50` : 'bg-transparent border-transparent hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-1">
                                            {a.type === 'flashcards' && <Copy size={14} className="text-orange-400" />}
                                            {a.type === 'quiz' && <HelpCircle size={14} className="text-green-400" />}
                                            {a.type === 'executiveBrief' && <ScrollText size={14} className="text-cyan-400" />}
                                            {a.type === 'slideDeck' && <Presentation size={14} className="text-purple-400" />}
                                            {a.type === 'infographic' && <ImageIcon size={14} className="text-pink-400" />}
                                            <span className={`text-sm font-medium truncate ${selectedArtifact?.id === a.id ? 'text-white' : 'text-slate-300'}`}>{a.title}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500">{new Date(a.createdAt).toLocaleTimeString()}</span>
                                            {a.status === 'generating' ? (
                                                <Loader2 size={12} className="animate-spin text-slate-400" />
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteArtifact(a.id); }} className="text-slate-600 hover:text-red-400 p-1"><X size={12} /></button>
                                            )}
                                        </div>
                                    </button>
                                ))}
                                {notebook.artifacts.filter(a => a.type !== 'audioOverview').length === 0 && (
                                    <div className="text-center p-4 text-slate-500 text-xs">
                                        Generate an artifact above.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Viewer Area */}
                        <div className={`flex-1 bg-slate-950 relative w-full h-full transition-transform ${selectedArtifact ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                             {selectedArtifact && (
                                 <button 
                                    onClick={() => setSelectedArtifact(null)} 
                                    className="md:hidden absolute top-4 left-4 z-50 p-2 bg-black/50 backdrop-blur rounded-full text-white border border-white/10"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                             )}
                             
                             {selectedArtifact ? (
                                 <div className="h-full w-full">
                                     {selectedArtifact.status === 'generating' && (
                                         <div className="h-full flex flex-col items-center justify-center">
                                             <Loader2 size={48} className={`animate-spin text-${theme.colors.primary}-500 mb-4`} />
                                             <p className="text-slate-400 animate-pulse">Generating Content...</p>
                                         </div>
                                     )}
                                     {selectedArtifact.status === 'completed' && (
                                         <>
                                             {selectedArtifact.type === 'flashcards' && <FlashcardPlayer content={selectedArtifact.content} />}
                                             {selectedArtifact.type === 'executiveBrief' && <ExecutiveBriefViewer content={selectedArtifact.content} />}
                                             {selectedArtifact.type === 'slideDeck' && <SlideDeckViewer content={selectedArtifact.content} />}
                                             {selectedArtifact.type === 'infographic' && (
                                                 // Mobile Layout Fix: Removed justify-center/items-center to allow natural scrolling of tall images
                                                 <div className="h-full w-full overflow-y-auto p-4 md:p-8 flex flex-col justify-start items-center">
                                                     <div className="max-w-md md:max-w-4xl w-full flex flex-col gap-6">
                                                         <div className="relative group">
                                                             <img 
                                                                src={selectedArtifact.content.imageUrl} 
                                                                alt="Infographic" 
                                                                className="w-full h-auto rounded-lg shadow-2xl border border-white/10" 
                                                             />
                                                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                 <a href={selectedArtifact.content.imageUrl} download="infographic.png" className="pointer-events-auto px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">Download</a>
                                                             </div>
                                                         </div>
                                                         
                                                         <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                                                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                                 <Sparkles size={12} className={`text-${theme.colors.primary}-400`} /> 
                                                                 AI Design Prompt
                                                             </h4>
                                                             <p className="text-xs text-slate-400 font-mono leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                                                                 {selectedArtifact.content.prompt}
                                                             </p>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                             {(selectedArtifact.type === 'quiz') && (
                                                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                     <FileCode size={48} className="mb-4 opacity-50" />
                                                     <p>Viewer for {selectedArtifact.type} coming soon.</p>
                                                     <pre className="mt-4 p-4 bg-black/50 rounded-lg text-xs max-w-lg overflow-auto max-h-60">
                                                         {JSON.stringify(selectedArtifact.content, null, 2)}
                                                     </pre>
                                                 </div>
                                             )}
                                         </>
                                     )}
                                 </div>
                             ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                     <Layout size={48} className="mb-4 opacity-20" />
                                     <p>Select an artifact to view</p>
                                 </div>
                             )}
                        </div>
                    </div>
                )}

                {/* 3. LIVE SESSION */}
                {section === 'live' && (
                    <div className="h-full p-4 md:p-8 flex items-center justify-center bg-slate-950">
                        <div className="w-full max-w-4xl h-full">
                            <LiveSession notebook={notebook} />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default StudioTab;
