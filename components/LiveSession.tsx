
import React, { useEffect, useRef, useState } from 'react';
import { Notebook } from '../types';
import { getLiveClient, LIVE_MODEL_NAME } from '../services/ai';
import { Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, Activity } from 'lucide-react';
import { base64ToUint8Array, arrayBufferToBase64, convertFloat32ToInt16 } from '../services/audioUtils';

interface Props {
  notebook: Notebook;
}

const LiveSession: React.FC<Props> = ({ notebook }) => {
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null); // LiveSession interface from SDK
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const connect = async () => {
    setStatus('connecting');
    setErrorMsg('');

    try {
        const client = getLiveClient();
        
        // 1. Setup Audio Contexts
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 24000 });
        audioContextRef.current = ctx;

        // 2. Setup Analyser for Visualizer
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // 3. Get Microphone Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. Connect to Gemini Live
        const sourceContext = notebook.sources.map(s => `Title: ${s.title}\nContent: ${s.content.substring(0, 1000)}...`).join('\n\n');
        
        const sessionPromise = client.connect({
            model: LIVE_MODEL_NAME,
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
                },
                systemInstruction: `You are a podcast host (Host A). You are knowledgeable, enthusiastic, and articulate. 
                You are discussing the following material with the user (who is acting as a guest or co-host).
                Keep responses concise and conversational.
                
                MATERIAL:
                ${sourceContext}
                `
            },
            callbacks: {
                onopen: () => {
                    console.log("Live Session Connected");
                    setStatus('live');
                    setConnected(true);
                    
                    if (!audioContextRef.current) return;
                    
                    const ctx = audioContextRef.current;
                    const source = ctx.createMediaStreamSource(stream);
                    const processor = ctx.createScriptProcessor(4096, 1, 1);
                    
                    processor.onaudioprocess = (e) => {
                        if (muted) return;
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmInt16 = convertFloat32ToInt16(inputData);
                        const base64 = arrayBufferToBase64(pcmInt16.buffer);
                        
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({
                                media: {
                                    mimeType: 'audio/pcm;rate=24000',
                                    data: base64
                                }
                            });
                        });
                    };

                    source.connect(processor);
                    processor.connect(ctx.destination);
                    
                    // Connect input to analyser for visuals (optional, or we can visualize output)
                    inputSourceRef.current = source;
                    processorRef.current = processor;
                },
                onmessage: async (msg) => {
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && audioContextRef.current) {
                        const ctx = audioContextRef.current;
                        const rawBytes = base64ToUint8Array(audioData);
                        
                        // Create audio buffer manually (raw PCM 24kHz 1 channel)
                        const buffer = ctx.createBuffer(1, rawBytes.length / 2, 24000);
                        const channelData = buffer.getChannelData(0);
                        const view = new DataView(rawBytes.buffer);
                        for(let i=0; i<channelData.length; i++) {
                            channelData[i] = view.getInt16(i * 2, true) / 32768.0;
                        }

                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        
                        // Connect source to analyser AND destination
                        if (analyserRef.current) {
                             source.connect(analyserRef.current);
                        }
                        source.connect(ctx.destination);
                        
                        // Scheduling
                        const now = ctx.currentTime;
                        const startTime = Math.max(now, nextStartTimeRef.current);
                        source.start(startTime);
                        nextStartTimeRef.current = startTime + buffer.duration;
                        
                        sourcesRef.current.add(source);
                        source.onended = () => sourcesRef.current.delete(source);
                    }
                    
                    if (msg.serverContent?.interrupted) {
                        // Clear queue
                        sourcesRef.current.forEach(s => s.stop());
                        sourcesRef.current.clear();
                        if (audioContextRef.current) {
                            nextStartTimeRef.current = audioContextRef.current.currentTime;
                        }
                    }
                },
                onclose: () => {
                    console.log("Session Closed");
                    setStatus('idle');
                    setConnected(false);
                },
                onerror: (err) => {
                    console.error(err);
                    setErrorMsg("Connection error.");
                    setStatus('error');
                }
            }
        });

        sessionRef.current = sessionPromise;

    } catch (e) {
        console.error(e);
        setErrorMsg("Failed to access microphone or API.");
        setStatus('error');
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    
    // Check state before closing to avoid "Cannot close a closed AudioContext" error
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    
    setStatus('idle');
    setConnected(false);
  };

  useEffect(() => {
    return () => {
        disconnect();
    };
  }, []);

  // Professional Waveform Visualizer
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

        // Circular Visualization
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 70; 
        const bars = 64;
        const step = (Math.PI * 2) / bars;
        
        // Slowly rotate the visualizer
        rotation += 0.005;

        if (status === 'live') {
            for (let i = 0; i < bars; i++) {
                // Map frequency data to bars
                const value = dataArray[i * 2] || 0;
                // Scale height with a minimum base
                const barHeight = (value / 255) * 80 + 5; 
                
                const angle = i * step + rotation;
                
                // Calculate start and end points for the bar extending outwards
                const x1 = centerX + Math.cos(angle) * radius;
                const y1 = centerY + Math.sin(angle) * radius;
                const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                
                // Gradient for bars
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, '#22d3ee'); // Cyan
                gradient.addColorStop(0.5, '#3b82f6'); // Blue
                gradient.addColorStop(1, '#a855f7'); // Purple
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Inner glow circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
            ctx.fill();
            
            // Pulse effect based on average volume
            const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
            if (avg > 10) {
                 ctx.beginPath();
                 ctx.arc(centerX, centerY, radius + (avg / 2), 0, Math.PI * 2);
                 ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(0.3, avg/500)})`;
                 ctx.lineWidth = 1;
                 ctx.stroke();
            }

        } else {
             // Idle State Ring
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

  return (
    <div className="flex flex-col items-center justify-center h-[500px] glass-panel rounded-2xl relative overflow-hidden bg-slate-950">
        {/* Background Animation */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-900/20 blur-[80px] rounded-full animate-pulse"></div>
        
        <div className="relative z-10 flex flex-col items-center gap-8 w-full">
            {/* Canvas Visualizer */}
            <div className="relative w-full h-[320px] flex items-center justify-center">
                 <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={320}
                    className="z-10"
                 />
                 
                 {/* Center Icon Overlay */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none">
                      <div className={`p-4 rounded-full transition-all duration-500 ${status === 'live' ? 'bg-slate-900/80 shadow-[0_0_30px_rgba(34,211,238,0.3)] backdrop-blur-md border border-cyan-500/30' : 'bg-slate-800'}`}>
                          {status === 'live' ? <Activity className="text-cyan-400 w-8 h-8 animate-pulse" /> : <MicOff className="text-slate-500 w-8 h-8" />}
                      </div>
                 </div>
            </div>

            <div className="text-center -mt-8 z-20">
                <h2 className="text-2xl font-bold mb-2 text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    {status === 'idle' ? 'Start Live Session' : status === 'connecting' ? 'Establishing Uplink...' : status === 'live' ? 'Live on Air' : 'Connection Failed'}
                </h2>
                <p className="text-slate-400 max-w-sm mx-auto text-sm font-medium">
                    {status === 'idle' 
                        ? 'Join the conversation. Interrupt anytime.' 
                        : status === 'live' 
                        ? 'Listening to you... (Speak naturally)' 
                        : errorMsg || 'Calibrating neural audio stream...'}
                </p>
            </div>

            <div className="flex gap-4 z-20">
                {status === 'idle' || status === 'error' ? (
                    <button 
                        onClick={connect}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-bold text-lg hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-105 transition-all flex items-center gap-2 border border-white/10"
                    >
                        <Mic size={20} /> Go Live
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
    