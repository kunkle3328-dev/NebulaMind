import React, { useState, useRef, useEffect } from 'react';
import { Notebook, Artifact } from '../types';
import { generateArtifact, generateAudioOverview } from '../services/ai';
import { Mic, Headphones, FileText, HelpCircle, Layout, Presentation, Play, Pause, Loader2, X, Download, Wand2, Activity, Sparkles } from 'lucide-react';
import LiveSession from './LiveSession';

interface Props {
  notebook: Notebook;
  onUpdate: (nb: Notebook) => void;
}

const StudioTab: React.FC<Props> = ({ notebook, onUpdate }) => {
  const [generating, setGenerating] = useState<string | null>(null);
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  
  // Audio Config State
  const [audioLength, setAudioLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [showAudioConfig, setShowAudioConfig] = useState(false);

  const handleGenerate = async (type: Artifact['type']) => {
    if (notebook.sources.length === 0) {
        alert("Please add sources first.");
        return;
    }
    setGenerating(type);
    setShowAudioConfig(false);

    try {
        let content;
        if (type === 'audioOverview') {
            // Generate real audio script + synthesis with selected length
            content = await generateAudioOverview(notebook.sources, audioLength);
        } else {
            content = await generateArtifact(type, notebook.sources);
        }

        const newArtifact: Artifact = {
            id: crypto.randomUUID(),
            type,
            title: `${type === 'audioOverview' ? 'Podcast' : type.charAt(0).toUpperCase() + type.slice(1)} - ${new Date().toLocaleTimeString()}`,
            content,
            createdAt: Date.now(),
            status: 'completed'
        };

        onUpdate({
            ...notebook,
            artifacts: [newArtifact, ...notebook.artifacts]
        });
    } catch (e) {
        console.error(e);
        alert("Generation failed. Please try again.");
    } finally {
        setGenerating(null);
    }
  };

  const AudioPlayerVisualizer = ({ audioUrl }: { audioUrl: string }) => {
      const audioRef = useRef<HTMLAudioElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const audioCtxRef = useRef<AudioContext | null>(null);
      const analyserRef = useRef<AnalyserNode | null>(null);
      const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
      
      const [isPlaying, setIsPlaying] = useState(false);
      const [duration, setDuration] = useState(0);
      const [currentTime, setCurrentTime] = useState(0);

      useEffect(() => {
          const audio = audioRef.current;
          if (audio) {
              audio.src = audioUrl;
              audio.onloadedmetadata = () => setDuration(audio.duration);
              audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
              audio.onended = () => setIsPlaying(false);
          }
          return () => {
              // Cleanup
              if (audioCtxRef.current) {
                  audioCtxRef.current.close();
              }
          };
      }, [audioUrl]);

      const togglePlay = async () => {
          if (!audioRef.current) return;

          // Initialize Audio Context on first play
          if (!audioCtxRef.current) {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioCtx();
              audioCtxRef.current = ctx;
              
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyserRef.current = analyser;

              const source = ctx.createMediaElementSource(audioRef.current);
              source.connect(analyser);
              analyser.connect(ctx.destination);
              sourceRef.current = source;
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

      // Visualizer Loop
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
              const radius = 60;
              const bars = 64;
              const step = (Math.PI * 2) / bars;

              rotation += 0.002; // Slow rotation

              for (let i = 0; i < bars; i++) {
                  const value = dataArray[i * 2] || 0;
                  // Scale bar height based on volume, default small if paused
                  const barHeight = isPlaying ? (value / 255) * 60 + 5 : 5;
                  
                  const angle = i * step + rotation;
                  
                  const x1 = centerX + Math.cos(angle) * radius;
                  const y1 = centerY + Math.sin(angle) * radius;
                  const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                  const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  
                  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                  gradient.addColorStop(0, '#22d3ee');
                  gradient.addColorStop(1, '#a855f7');
                  
                  ctx.strokeStyle = gradient;
                  ctx.lineWidth = 3;
                  ctx.lineCap = 'round';
                  ctx.stroke();
              }

              // Inner Circles
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2);
              ctx.fillStyle = '#0f172a';
              ctx.fill();
              
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
              ctx.lineWidth = 1;
              ctx.stroke();

              animationId = requestAnimationFrame(render);
          };

          render();
          return () => cancelAnimationFrame(animationId);
      }, [isPlaying]);

      const formatTime = (t: number) => {
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          return `${m}:${s.toString().padStart(2, '0')}`;
      };

      return (
          <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
              <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />
              
              <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                  {/* Background Glow */}
                  <div className={`absolute inset-0 bg-cyan-500/20 blur-[60px] rounded-full transition-opacity duration-700 ${isPlaying ? 'opacity-100' : 'opacity-20'}`}></div>
                  
                  <canvas ref={canvasRef} width={300} height={300} className="relative z-10" />
                  
                  {/* Center Control */}
                  <button 
                      onClick={togglePlay}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform text-white"
                  >
                      {isPlaying ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
                  </button>
              </div>

              <div className="w-full space-y-2">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                          className="h-full bg-cyan-400 transition-all duration-100" 
                          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      ></div>
                  </div>
              </div>
          </div>
      );
  };

  const ArtifactModal = ({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) => {
      return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/10 shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-slate-900/50 shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-3 text-white">
                        {artifact.type === 'audioOverview' && <div className="p-2 bg-cyan-500/20 rounded-lg"><Headphones className="text-cyan-400" size={20} /></div>}
                        {artifact.type === 'quiz' && <div className="p-2 bg-purple-500/20 rounded-lg"><HelpCircle className="text-purple-400" size={20} /></div>}
                        {artifact.type === 'flashcards' && <div className="p-2 bg-yellow-500/20 rounded-lg"><Layout className="text-yellow-400" size={20} /></div>}
                        {artifact.title}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                
                {/* 
                    Use overflow-hidden for audioOverview to allow split-pane independent scrolling.
                    Use overflow-y-auto for other types to allow full body scrolling.
                */}
                <div className={`flex-1 bg-slate-950/50 min-h-0 ${artifact.type === 'audioOverview' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                    {artifact.type === 'audioOverview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                            {/* Visualizer Side - Fixed at top, independent scroll if needed */}
                            <div className="p-8 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-white/5 bg-slate-900/30 overflow-y-auto">
                                <h4 className="text-center text-slate-300 mb-8 font-medium">Now Playing</h4>
                                <AudioPlayerVisualizer audioUrl={artifact.content.audioUrl} />
                                <div className="mt-8 flex gap-4">
                                     <a 
                                        href={artifact.content.audioUrl} 
                                        download={`${artifact.title}.wav`}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 flex items-center gap-2 transition-colors"
                                    >
                                        <Download size={14} /> Download WAV
                                    </a>
                                </div>
                            </div>
                            
                            {/* Transcript Side - Independent scroll */}
                            <div className="p-6 md:p-8 overflow-y-auto h-full bg-slate-950 relative">
                                <div className="sticky top-0 bg-slate-950/95 backdrop-blur-sm py-3 z-10 border-b border-white/5 mb-4">
                                    <h4 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">Transcript</h4>
                                </div>
                                <div className="space-y-4 text-sm leading-relaxed text-slate-300 font-mono pb-8">
                                    {artifact.content.script.split('\n').map((line: string, i: number) => {
                                        const [speaker, ...text] = line.split(':');
                                        if (text.length > 0) {
                                            const isJoe = speaker.trim().toLowerCase().includes('joe');
                                            return (
                                                <div key={i} className="flex gap-4">
                                                    <span className={`font-bold w-12 shrink-0 text-xs uppercase mt-1 text-right ${isJoe ? 'text-cyan-400' : 'text-purple-400'}`}>
                                                        {speaker}
                                                    </span>
                                                    <p className="opacity-90">{text.join(':')}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {artifact.type === 'quiz' && (
                        <div className="p-8 space-y-8 max-w-3xl mx-auto">
                            {artifact.content.questions.map((q: any, i: number) => (
                                <div key={i} className="bg-slate-900 border border-white/5 p-6 rounded-2xl">
                                    <p className="font-semibold text-lg mb-4 flex gap-3">
                                        <span className="text-cyan-500 font-mono">0{i+1}</span>
                                        {q.question}
                                    </p>
                                    <div className="space-y-3">
                                        {q.options.map((opt: string, idx: number) => (
                                            <div key={idx} className={`p-4 rounded-xl border transition-all ${idx === q.correctAnswerIndex ? 'border-green-500/30 bg-green-500/10 text-green-100' : 'border-white/5 bg-slate-800/50 hover:bg-slate-800'}`}>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 p-4 bg-blue-900/20 rounded-xl flex gap-3 items-start border border-blue-500/10">
                                        <div className="mt-1"><Sparkles size={16} className="text-blue-400" /></div>
                                        <p className="text-sm text-blue-200">{q.explanation}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {artifact.type === 'flashcards' && (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                            {artifact.content.cards.map((card: any, i: number) => (
                                <div key={i} className="group perspective-1000 h-64 cursor-pointer">
                                    <div className="relative w-full h-full transition-all duration-500 transform-style-3d group-hover:rotate-y-180">
                                        {/* Front */}
                                        <div className="absolute inset-0 backface-hidden glass-panel border border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-lg">
                                            <span className="text-xs text-slate-500 uppercase tracking-widest mb-4">Term</span>
                                            <h5 className="font-bold text-2xl text-cyan-400">{card.term}</h5>
                                        </div>
                                        {/* Back */}
                                        <div className="absolute inset-0 backface-hidden glass-panel border border-cyan-500/30 bg-slate-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center rotate-y-180">
                                            <span className="text-xs text-slate-500 uppercase tracking-widest mb-4">Definition</span>
                                            <p className="text-slate-200 leading-relaxed">{card.definition}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {(artifact.type === 'infographic' || artifact.type === 'slideDeck') && (
                        <div className="p-8">
                             <div className="bg-slate-900 rounded-xl p-6 border border-white/10 font-mono text-xs text-slate-300 overflow-x-auto">
                                <pre>{JSON.stringify(artifact.content, null, 2)}</pre>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
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
      {viewingArtifact && <ArtifactModal artifact={viewingArtifact} onClose={() => setViewingArtifact(null)} />}

      {/* Audio Overview Hero Section */}
      <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-cyan-500/20 shadow-[0_0_40px_rgba(8,145,178,0.1)] group">
        <div className="absolute top-0 right-0 p-40 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-cyan-500/15 transition-colors duration-700"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/30">
                        <Headphones className="text-white" size={24} />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Audio Overview</h2>
                </div>
                <p className="text-slate-400 text-lg leading-relaxed">
                    Turn your notebook sources into an engaging <span className="text-cyan-400 font-medium">Deep Dive Podcast</span>. 
                    Two AI hosts (Joe & Jane) will summarize, debate, and explain the key concepts.
                </p>
            </div>
            
            <div className="flex flex-col gap-3 min-w-[200px]">
                 {showAudioConfig ? (
                     <div className="bg-slate-900/90 border border-cyan-500/30 p-4 rounded-xl space-y-4 animate-in fade-in zoom-in-95">
                         <div>
                             <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Length</label>
                             <div className="flex bg-slate-800 rounded-lg p-1">
                                 {['Short', 'Medium', 'Long'].map((l) => (
                                     <button
                                        key={l}
                                        onClick={() => setAudioLength(l as any)}
                                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${audioLength === l ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                                     >
                                         {l}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         <button 
                            onClick={() => handleGenerate('audioOverview')}
                            className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                         >
                            <Wand2 size={16} /> Generate
                         </button>
                     </div>
                 ) : (
                    <>
                        <button 
                            onClick={() => setShowAudioConfig(true)}
                            disabled={!!generating}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            {generating === 'audioOverview' ? <Loader2 className="animate-spin" size={18}/> : <Wand2 size={18} />}
                            Generate Podcast
                        </button>
                        <button 
                            onClick={() => setLiveSessionActive(true)}
                            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-white shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 border border-white/10"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { id: 'flashcards', label: 'Flashcards', icon: Layout, color: 'text-yellow-400', desc: 'Study key terms' },
                { id: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-purple-400', desc: 'Test your knowledge' },
                { id: 'infographic', label: 'Infographic', icon: FileText, color: 'text-green-400', desc: 'Visual outline' },
                { id: 'slideDeck', label: 'Slide Deck', icon: Presentation, color: 'text-rose-400', desc: 'Presentation outline' },
            ].map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => handleGenerate(tool.id as any)}
                    disabled={!!generating}
                    className="glass-panel p-6 rounded-2xl flex flex-col items-start gap-4 hover:bg-slate-800 hover:border-cyan-500/30 transition-all group text-left"
                >
                    <div className={`p-3 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform shadow-inner`}>
                        {generating === tool.id ? (
                            <Loader2 className={`animate-spin ${tool.color}`} size={24} />
                        ) : (
                            <tool.icon className={tool.color} size={24} />
                        )}
                    </div>
                    <div>
                        <span className="font-bold text-slate-200 block text-lg">{tool.label}</span>
                        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{tool.desc}</span>
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
                    <p className="text-sm">Try creating a Quiz or Audio Overview above.</p>
                </div>
            ) : (
                notebook.artifacts.map(art => (
                    <div key={art.id} className="glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-slate-800/50 transition-colors group border-transparent hover:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-900 rounded-xl shadow-inner">
                                {art.type === 'audioOverview' && <Headphones className="text-cyan-400" size={20} />}
                                {art.type === 'flashcards' && <Layout className="text-yellow-400" size={20} />}
                                {art.type === 'quiz' && <HelpCircle className="text-purple-400" size={20} />}
                                {art.type === 'infographic' && <FileText className="text-green-400" size={20} />}
                                {art.type === 'slideDeck' && <Presentation className="text-rose-400" size={20} />}
                            </div>
                            <div>
                                <h4 className="font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">{art.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-800 rounded-full capitalize">{art.type === 'audioOverview' ? 'Podcast' : art.type}</span>
                                    <span className="text-xs text-slate-600">•</span>
                                    <span className="text-xs text-slate-600">{new Date(art.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setViewingArtifact(art)}
                            className="px-4 py-2 bg-slate-800 hover:bg-cyan-500 hover:text-white rounded-lg text-sm font-medium transition-all text-slate-400"
                        >
                            View
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default StudioTab;