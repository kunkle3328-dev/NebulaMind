export const APP_NAME = "Nebula Mind";

export const AUDIO_SAMPLE_RATE = 24000; // Gemini Live standard

export const COLORS = {
  background: 'bg-slate-950',
  primary: 'text-cyan-400',
  accent: 'text-rose-500',
  glass: 'bg-slate-900/60 backdrop-blur-xl border border-white/10',
};

// Initial system prompt for RAG
export const RAG_SYSTEM_INSTRUCTION = `You are a helpful AI research assistant inside a notebook app called Nebula Mind. 
Answer questions based STRICTLY on the provided sources. 
If the answer is not in the sources, state that clearly.
Cite your sources by referring to the title of the document.
Keep answers concise and professional.`;