
import React, { useEffect, useRef, useState } from 'react';
import { Notebook } from '../types';
import { getLiveClient, LIVE_MODEL_NAME, getDebateSystemInstruction } from '../services/ai';
import { Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, Activity, Swords, Users, Shield } from 'lucide-react';
import { base64ToUint8Array, arrayBufferToBase64, convertFloat32ToInt16 } from '../services/audioUtils';
import { useTheme } from '../App';

interface Props {
  notebook: Notebook;
}

// Simple linear downsampling to ensure 24kHz output
function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number) {
    if (outputRate === inputRate) {
        return buffer;
    }
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

const LiveSession: React.FC<Props> = ({ notebook }) => {
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<'setup' | 'connecting' | 'live' | 'error'>('setup');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Arena Configuration
  const [sessionMode, setSessionMode] = useState<'Standard' | 'Arena'>('Standard');
  const [debateRole, setDebateRole] = useState<'Moderator' | 'Pro' | 'Con'>('Pro');

  const { theme } = useTheme();

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSessionRef = useRef<any>(null); // Direct reference to active session
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connect = async () => {
    setStatus('connecting');
    setErrorMsg('');

    try {
        const client = getLiveClient();
        
        // 1. Setup Audio Context
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx(); 
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        audioContextRef.current = ctx;

        // 2. Setup Analyser for Visualizer
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // 3. Get Microphone Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. Connect to Gemini Live
        const sourceContext = notebook.sources.map(s => `Title: ${s.title}\nContent: ${s.content.substring(0, 1000)}...`).join('\n\n');
        const TARGET_RATE = 24000; // Gemini Live preferred rate
        
        let sysInstruction = "";
        if (sessionMode === 'Arena') {
            sysInstruction = getDebateSystemInstruction(sourceContext, debateRole, debateRole === 'Pro' ? 'Supporting the Topic' : debateRole === 'Con' ? 'Opposing the Topic' : 'Neutral');
        } else {
            sysInstruction = `You are a podcast host (Host A). You are knowledgeable, enthusiastic, and articulate. 
                You are discussing the following material with the user (who is acting as a guest or co-host).
                
                MATERIAL:
                ${sourceContext}

                IMPORTANT INSTRUCTIONS:
                1. Use the provided MATERIAL as a foundation for your knowledge.
                2. If the user asks a question NOT in the material, answer politely based on general knowledge.
                3. Keep responses concise and conversational.`;
        }

        const sessionPromise = client.connect({
            model: LIVE_MODEL_NAME,
            config: {
                responseModalities: [Modality.AUDIO],
                // Removed tools: [{ googleSearch: {} }] as it causes handshake errors in Live API
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
                },
                systemInstruction: sysInstruction
            },
            callbacks: {
                onopen: () => {
                    console.log("Live Session Connected");
                    setStatus('live');
                    setConnected(true);
                    
                    // Store session for direct access in audio loop
                    sessionPromise.then(sess => { activeSessionRef.current = sess; });
                    
                    if (!audioContextRef.current) return;
                    
                    const ctx = audioContextRef.current;
                    const source = ctx.createMediaStreamSource(stream);
                    const processor = ctx.createScriptProcessor(4096, 1, 1);
                    
                    processor.onaudioprocess = (e) => {
                        if (muted || !activeSessionRef.current) return;
                        
                        const inputData = e.inputBuffer.getChannelData(0);
                        
                        // RESAMPLE: Ensure we send exactly 24kHz to avoid VAD disconnects
                        const resampledData = downsampleBuffer(inputData, ctx.sampleRate, TARGET_RATE);
                        
                        const pcmInt16 = convertFloat32ToInt16(resampledData);
                        const base64 = arrayBufferToBase64(pcmInt16.buffer);
                        
                        try {
                            activeSessionRef.current.sendRealtimeInput({
                                media: {
                                    mimeType: `audio/pcm;rate=${TARGET_RATE}`,
                                    data: base64
                                }
                            });
                        } catch (err) {
                            console.error("Audio Send Error", err);
                        }
                    };

                    source.connect(processor);
                    processor.connect(ctx.destination);
                    
                    inputSourceRef.current = source;
                    processorRef.current = processor;
                },
                onmessage: async (msg) => {
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && audioContextRef.current) {
                        const ctx = audioContextRef.current;
                        const rawBytes = base64ToUint8Array(audioData);
                        
                        // Create audio buffer (raw PCM 24kHz 1 channel)
                        const buffer = ctx.createBuffer(1, Math.floor(rawBytes.length / 2), 24000);
                        const channelData = buffer.getChannelData(0);
                        const view = new DataView(rawBytes.buffer);
                        
                        for(let i=0; i<channelData.length; i++) {
                            channelData[i] = view.getInt16(i * 2, true) / 32768.0;
                        }

                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        
                        if (analyserRef.current) {
                             source.connect(analyserRef.current);
                        }
                        source.connect(ctx.destination);
                        
                        const now = ctx.currentTime;
                        const startTime = Math.max(now, nextStartTimeRef.current);
                        source.start(startTime);
                        nextStartTimeRef.current = startTime + buffer.duration;
                        
                        sourcesRef.current.add(source);
                        source.onended = () => sourcesRef.current.delete(source);
                    }
                    
                    if (msg.serverContent?.interrupted) {
                        sourcesRef.current.forEach(s => s.stop());
                        sourcesRef.current.clear();
                        if (audioContextRef.current) {
                            nextStartTimeRef.current = audioContextRef.current.currentTime;
                        }
                    }
                },
                onclose: () => {
                    console.log("Session Closed");
                    setStatus('setup');
                    setConnected(false);
                    activeSessionRef.current = null;
                },
                onerror: (err) => {
                    console.error("Session Error", err);
                    setErrorMsg("Connection error. Please try again.");
                    // Check for network connectivity
                    if (!navigator.onLine) {
                        setErrorMsg("No internet connection.");
                    }
                }
            }
        });

    } catch (e) {
        console.error(e);
        setErrorMsg("Failed to access microphone or API.");
        setStatus('error');
    }
  };

  const disconnect = () => {
    if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    setStatus('setup');
    setConnected(false);
  };

  useEffect(() => {
    return () => {
        disconnect();
    };
  }, []);

  // Visualizer Logic (Unchanged but using updated refs)
  useEffect(() => {
    let animationFrameId: number;
    let rotation = 0;
    
    const draw = () => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) {
             animationFrameId = requestAnimationFrame(draw);
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
        // Responsive radius based on canvas width
        const radius = Math.min(centerX, centerY) * 0.45; 
        const bars = 64;
        const step = (Math.PI * 2) / bars;
        
        rotation += 0.005;

        if (status === 'live') {
            for (let i = 0; i < bars; i++) {
                const value = dataArray[i * 2] || 0;
                const barHeight = (value / 255) * (radius * 1.2) + 5; 
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
                gradient.addColorStop(0.5, '#3b82f6');
                gradient.addColorStop(1, '#a855f7'); 
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Pulse effect
            const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
            if (avg > 10) {
                 ctx.beginPath();
                 ctx.arc(centerX, centerY, radius + (avg / 2), 0, Math.PI * 2);
                 ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(0.3, avg/500)})`;
                 ctx.lineWidth = 1;
                 ctx.stroke();
            }

        } else {
             ctx.beginPath();
             ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
             ctx.strokeStyle = '#334155';
             ctx.lineWidth = 2;
             ctx.setLineDash([5, 5]);
             ctx.stroke();
             ctx.setLineDash([]);
        }

        animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [status]);

  if (status === 'setup') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[400px] h-full glass-panel rounded-2xl p-8 relative overflow-hidden bg-slate-950 mx-4 md:mx-0">
                <div className="relative z-10 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">Configure Live Session</h2>
                    
                    <div className="space-y-4">
                        {/* Mode Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setSessionMode('Standard')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${sessionMode === 'Standard' ? `bg-${theme.colors.primary}-600/20 border-${theme.colors.primary}-500 text-white` : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                            >
                                <Users size={24} />
                                <span className="font-bold text-sm">Guest Chat</span>
                            </button>
                            <button 
                                onClick={() => setSessionMode('Arena')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${sessionMode === 'Arena' ? 'bg-rose-500/20 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                            >
                                <Swords size={24} />
                                <span className="font-bold text-sm">Debate Arena</span>
                            </button>
                        </div>

                        {/* Arena Specific Options */}
                        {sessionMode === 'Arena' && (
                            <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-slate-900 rounded-xl border border-white/10">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-3 block">Choose Your Role</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setDebateRole('Pro')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${debateRole === 'Pro' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-800 border-transparent text-slate-400'}`}>Pro</button>
                                    <button onClick={() => setDebateRole('Con')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${debateRole === 'Con' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-transparent text-slate-400'}`}>Con</button>
                                    <button onClick={() => setDebateRole('Moderator')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${debateRole === 'Moderator' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-transparent text-slate-400'}`}>Mod</button>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={connect}
                            className={`w-full py-4 mt-4 bg-gradient-to-r ${sessionMode === 'Arena' ? 'from-rose-600 to-orange-600' : `from-${theme.colors.primary}-600 to-${theme.colors.secondary}-600`} text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-transform`}
                        >
                            Start Session
                        </button>
                    </div>
                </div>
          </div>
      );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center min-h-[400px] h-[60vh] md:h-[500px] glass-panel rounded-2xl relative overflow-hidden bg-slate-950 mx-4 md:mx-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"></div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ${sessionMode === 'Arena' ? 'bg-rose-900/20' : 'bg-cyan-900/20'} blur-[80px] rounded-full animate-pulse`}></div>
        
        <div className="relative z-10 flex flex-col items-center gap-8 w-full">
            <div className="relative w-full h-[280px] md:h-[320px] flex items-center justify-center">
                 {/* Responsive Canvas */}
                 <canvas ref={canvasRef} width={400} height={320} className="z-10 w-full max-w-[400px] h-full object-contain" />
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none">
                      <div className={`p-4 rounded-full transition-all duration-500 ${status === 'live' ? 'bg-slate-900/80 shadow-[0_0_30px_rgba(34,211,238,0.3)] backdrop-blur-md border border-cyan-500/30' : 'bg-slate-800'}`}>
                          {status === 'live' ? <Activity className={sessionMode === 'Arena' ? "text-rose-400 w-8 h-8 animate-pulse" : "text-cyan-400 w-8 h-8 animate-pulse"} /> : <MicOff className="text-slate-500 w-8 h-8" />}
                      </div>
                 </div>
            </div>

            <div className="text-center -mt-8 z-20 px-4">
                <h2 className="text-xl md:text-2xl font-bold mb-2 text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    {status === 'connecting' ? 'Establishing Uplink...' : sessionMode === 'Arena' ? 'DEBATE ARENA LIVE' : 'Live on Air'}
                </h2>
                <p className="text-slate-400 max-w-sm mx-auto text-sm font-medium">
                    {status === 'live' ? (sessionMode === 'Arena' ? 'Defend your stance. The AI hosts are ready.' : 'Listening to you... (Speak naturally)') : errorMsg || 'Calibrating neural audio stream...'}
                </p>
            </div>

            <div className="flex gap-4 z-20">
                {status === 'error' ? (
                    <button 
                        onClick={() => setStatus('setup')}
                        className="px-6 md:px-8 py-3 bg-slate-800 text-white rounded-full font-bold border border-white/10"
                    >
                        Retry Setup
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={() => setMuted(!muted)}
                            className={`p-4 rounded-full transition-colors border border-white/10 shadow-lg ${muted ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                        >
                            {muted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                        <button 
                            onClick={disconnect}
                            className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all border border-red-500/50 shadow-lg"
                        >
                            <PhoneOff size={24} />
                        </button>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

export default LiveSession;
