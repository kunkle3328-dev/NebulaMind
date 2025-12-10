

export const APP_NAME = "Nebula Mind";

export const AUDIO_SAMPLE_RATE = 24000; // Gemini Live standard

export const RAG_SYSTEM_INSTRUCTION = `You are a helpful AI research assistant inside a notebook app called Nebula Mind. 
Answer questions based STRICTLY on the provided sources. 
If the answer is not in the sources, state that clearly.
Cite your sources by referring to the title of the document.
Keep answers concise and professional.`;

// --- THEMING SYSTEM ---

export type ThemeId = 'neon' | 'obsidian' | 'arctic' | 'quantum' | 'gilded' | 'crimson';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    primary: string; // Tailwind color name (e.g., 'cyan')
    secondary: string; // Tailwind color name (e.g., 'blue')
    accent: string; // Tailwind color name (e.g., 'rose')
    background: string; // Tailwind class (e.g., 'bg-slate-950')
    panel: string; // Tailwind class for glass panels
    text: string; // Tailwind class for primary text
  };
}

export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: 'neon',
    name: 'Neon Nebula',
    colors: {
      primary: 'cyan',
      secondary: 'blue',
      accent: 'rose',
      background: 'bg-slate-950',
      panel: 'bg-slate-900/60',
      text: 'text-slate-100'
    }
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Gold',
    colors: {
      primary: 'amber',
      secondary: 'orange',
      accent: 'red',
      background: 'bg-neutral-950',
      panel: 'bg-neutral-900/60',
      text: 'text-neutral-100'
    }
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Frost',
    colors: {
      primary: 'sky',
      secondary: 'indigo',
      accent: 'teal',
      background: 'bg-slate-900',
      panel: 'bg-slate-800/60',
      text: 'text-slate-50'
    }
  },
  quantum: {
    id: 'quantum',
    name: 'Quantum Pulse',
    colors: {
      primary: 'violet',
      secondary: 'fuchsia',
      accent: 'cyan',
      background: 'bg-black',
      panel: 'bg-zinc-900/80',
      text: 'text-violet-50'
    }
  },
  gilded: {
    id: 'gilded',
    name: 'Gilded Horizon',
    colors: {
      primary: 'emerald',
      secondary: 'yellow',
      accent: 'amber',
      background: 'bg-stone-950',
      panel: 'bg-stone-900/60',
      text: 'text-emerald-50'
    }
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Eclipse',
    colors: {
      primary: 'red',
      secondary: 'rose',
      accent: 'orange',
      background: 'bg-black',
      panel: 'bg-neutral-900/80',
      text: 'text-red-50'
    }
  }
};
