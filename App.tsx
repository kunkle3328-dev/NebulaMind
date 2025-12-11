import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { Notebook, Notification, BackgroundJob, Artifact } from './types';
import { getNotebooks, createNotebook, getNotebookById, saveNotebook } from './services/storage';
import { THEMES, ThemeId, Theme } from './constants';
import { Plus, Book, MoreVertical, Sparkles, Palette, Check, Zap, X, Bell, Loader2, Edit2 } from 'lucide-react';
import NotebookView from './components/NotebookView';
import SplashScreen from './components/SplashScreen';
import { generateArtifact, generateAudioOverview } from './services/ai';

// --- THEME CONTEXT ---
interface ThemeContextType {
  theme: Theme;
  setThemeId: (id: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.neon,
  setThemeId: () => {}
});

export const useTheme = () => useContext(ThemeContext);

// --- JOB & NOTIFICATION CONTEXT ---
interface JobContextType {
  startJob: (notebookId: string, type: Artifact['type'], sources: any[], config?: any) => Promise<void>;
  jobs: BackgroundJob[];
  notifications: Notification[];
  dismissNotification: (id: string) => void;
}

export const JobContext = createContext<JobContextType>({
  startJob: async () => {},
  jobs: [],
  notifications: [],
  dismissNotification: () => {}
});

export const useJobs = () => useContext(JobContext);

// NEW ADVANCED LOGO COMPONENT (SVG)
export const NebulaLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
    const { theme } = useTheme();
    const isLg = size === 'lg';
    
    // Dynamic gradients based on theme
    const primary = theme.colors.primary;
    const secondary = theme.colors.secondary;
    
    const sizePx = isLg ? 48 : 32;

    return (
        <div className="flex items-center gap-3 select-none">
             <div className={`relative ${isLg ? 'w-12 h-12' : 'w-8 h-8'} transition-all duration-500`}>
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
                    <defs>
                        <linearGradient id={`grad-${primary}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: `var(--color-${primary}-400)`, stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: `var(--color-${secondary}-600)`, stopOpacity: 1 }} />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    {/* Neural Connections */}
                    <path d="M50 20 L20 80 L80 80 Z" fill="none" stroke={`url(#grad-${primary})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse-slow" filter="url(#glow)" />
                    <circle cx="50" cy="20" r="8" fill={`var(--color-${primary}-500)`} />
                    <circle cx="20" cy="80" r="8" fill={`var(--color-${secondary}-500)`} />
                    <circle cx="80" cy="80" r="8" fill={`var(--color-${theme.colors.accent}-500)`} />
                    
                    {/* Inner Circuit */}
                    <path d="M50 20 L50 50 L20 80 M50 50 L80 80" stroke="white" strokeWidth="2" strokeOpacity="0.5" />
                    <circle cx="50" cy="50" r="4" fill="white" className="animate-ping" style={{ animationDuration: '3s' }} />
                </svg>
             </div>
             <h1 className={`${isLg ? 'text-2xl md:text-3xl' : 'text-xl'} font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}>
               Nebula<span className={`bg-clip-text text-transparent bg-gradient-to-r from-${primary}-400 to-${secondary}-400 transition-all duration-500`}>Mind</span>
             </h1>
        </div>
    );
};

export const ThemeSelector: React.FC = () => {
  const { theme, setThemeId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-[100]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md transition-all ${theme.colors.panel} text-${theme.colors.primary}-400 hover:bg-white/5 shadow-lg shadow-black/20`}
      >
        <Palette size={16} />
        <span className="text-xs font-medium hidden md:inline">Theme</span>
        <div className={`w-2 h-2 rounded-full bg-${theme.colors.primary}-500 animate-pulse`}></div>
      </button>

      {isOpen && (
        <>
            <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 origin-top-right z-[100]">
            <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Select Theme</div>
            {Object.values(THEMES).map((t) => (
                <button
                key={t.id}
                onClick={() => { setThemeId(t.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors mb-1 ${theme.id === t.id ? `bg-${t.colors.primary}-500/20 text-${t.colors.primary}-400` : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full bg-gradient-to-br from-${t.colors.primary}-400 to-${t.colors.secondary}-500 shadow-[0_0_8px_currentColor]`}></div>
                    <span className={theme.id === t.id ? 'font-semibold' : ''}>{t.name}</span>
                </div>
                {theme.id === t.id && <Check size={14} />}
                </button>
            ))}
            </div>
        </>
      )}
    </div>
  );
};

// 1. Dashboard Component
const Dashboard: React.FC = () => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    setNotebooks(getNotebooks());
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    const nb = createNotebook(newTitle);
    navigate(`/notebook/${nb.id}`);
  };

  return (
    <div className={`min-h-screen ${theme.colors.background} p-4 md:p-8 relative transition-colors duration-700`}>
      {/* Advanced Background Effects */}
      {theme.id === 'cyberpunk' && (
          <>
             {/* Cyberpunk Grid */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-50"></div>
             {/* Neon Ambient Glows */}
             <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-fuchsia-900/30 via-cyan-900/10 to-transparent blur-[120px] pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-cyan-900/20 via-purple-900/10 to-transparent blur-[100px] pointer-events-none"></div>
          </>
      )}
      {theme.id === 'crimson' && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(20,0,0,0.5)_2px,transparent_2px),linear-gradient(90deg,rgba(20,0,0,0.5)_2px,transparent_2px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,transparent_0%,black_90%)] pointer-events-none"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[100px] animate-pulse-slow pointer-events-none"></div>
          </>
      )}
      {theme.id === 'quantum' && (
          <>
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(139,92,246,0.15),transparent_70%)] animate-pulse-slow"></div>
             <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-900/20 rounded-full blur-[120px] pointer-events-none animate-blob"></div>
             <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-900/20 rounded-full blur-[100px] pointer-events-none animate-blob animation-delay-2000"></div>
          </>
      )}
      {theme.id === 'gilded' && (
          <>
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.1),transparent_80%)]"></div>
             <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none"></div>
          </>
      )}
      {theme.id === 'lux' && (
          <>
             <div className="absolute inset-0 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-violet-950 via-slate-950 to-black opacity-80"></div>
             <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
             <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
             <div className="absolute bottom-0 right-1/3 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay"></div>
          </>
      )}
      {(theme.id === 'neon' || theme.id === 'arctic' || theme.id === 'obsidian') && (
          <div className={`absolute top-0 left-1/4 w-96 h-96 bg-${theme.colors.secondary}-900/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000`}></div>
      )}

      <header className="flex justify-between items-center mb-10 md:mb-16 relative z-50">
        <NebulaLogo size="lg" />
        <ThemeSelector />
      </header>

      <div className="max-w-6xl mx-auto relative z-10 pb-20">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-xl text-slate-300 font-light tracking-wide">Your Research Space</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* New Notebook Card */}
          <button 
            onClick={() => { setShowCreateModal(true); setNewTitle(''); }}
            className={`group relative h-72 p-6 glass-panel rounded-3xl hover:border-${theme.colors.primary}-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-6 bg-${theme.colors.primary}-900/5 hover:bg-${theme.colors.primary}-900/10 border-dashed border-white/20`}
          >
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-${theme.colors.primary}-500 to-${theme.colors.secondary}-600 flex items-center justify-center shadow-2xl shadow-${theme.colors.primary}-500/30 group-hover:scale-110 transition-transform duration-500`}>
                <Plus size={32} className="text-white" />
            </div>
            <span className="font-semibold text-lg text-slate-300 group-hover:text-white transition-colors">Create Notebook</span>
          </button>

          {notebooks.map((nb, i) => (
              <Link key={nb.id} to={`/notebook/${nb.id}`}>
                <div className={`group relative h-72 rounded-3xl hover:border-${theme.colors.primary}-500/50 transition-all cursor-pointer flex flex-col justify-between overflow-hidden hover:shadow-2xl hover:shadow-${theme.colors.primary}-900/20 hover:-translate-y-1 duration-300 border border-white/10 bg-slate-900/50`}>
                  
                  {/* Premium "Book Cover" Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-${theme.colors.primary}-900/20 to-slate-900 z-0`}></div>
                  
                  {/* Top Decoration */}
                  <div className="relative z-10 p-6 flex justify-between items-start">
                     <div className={`w-12 h-16 rounded-sm bg-gradient-to-b from-${theme.colors.primary}-500 to-${theme.colors.secondary}-600 shadow-lg opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                     <div className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <MoreVertical size={20} />
                     </div>
                  </div>
                  
                  {/* Card Content */}
                  <div className="relative z-10 p-6 pt-0">
                    <h3 className={`text-2xl font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-${theme.colors.primary}-300 transition-colors`}>{nb.title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mb-4">
                        <span className={`w-2 h-2 rounded-full bg-${theme.colors.secondary}-500`}></span>
                        {nb.sources.length} sources
                    </p>
                    
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                           {new Date(nb.updatedAt).toLocaleDateString()}
                        </span>
                        {nb.artifacts.length > 0 && (
                            <div className="flex -space-x-2">
                                {nb.artifacts.slice(0,3).map((a, idx) => (
                                    <div key={idx} className={`w-6 h-6 rounded-full bg-${theme.colors.primary}-900 border border-slate-800 flex items-center justify-center text-[8px] text-white`}>
                                        <Zap size={10} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className={`glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">New Notebook</h3>
                      <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleCreate}>
                      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Title</label>
                      <input 
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Advanced Physics Research"
                        className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-${theme.colors.primary}-500 focus:ring-1 focus:ring-${theme.colors.primary}-500 transition-all mb-6`}
                      />
                      <div className="flex justify-end gap-3">
                          <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 hover:bg-white/5 rounded-lg text-slate-300 text-sm font-medium">Cancel</button>
                          <button 
                            type="submit" 
                            disabled={!newTitle.trim()}
                            className={`px-6 py-2 bg-${theme.colors.primary}-600 hover:bg-${theme.colors.primary}-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-${theme.colors.primary}-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                          >
                              Create Notebook
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

// 2. Notebook Container
const NotebookContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [notebook, setNotebook] = useState<Notebook | undefined>(undefined);
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Use Job Context to update notebook if a background job finishes for this notebook
  const { jobs } = useJobs();

  useEffect(() => {
    if (id) {
      const nb = getNotebookById(id);
      if (nb) {
        setNotebook(nb);
      } else {
        navigate('/');
      }
    }
  }, [id, navigate, jobs]); // Re-fetch if jobs change (completion might trigger update)

  const handleUpdate = (updated: Notebook) => {
    setNotebook(updated);
    saveNotebook(updated);
  };

  if (!notebook) return (
      <div className={`min-h-screen ${theme.colors.background} flex flex-col items-center justify-center gap-4`}>
          <div className={`w-12 h-12 border-4 border-${theme.colors.primary}-500 border-t-transparent rounded-full animate-spin`}></div>
          <span className={`text-${theme.colors.primary}-500 font-medium animate-pulse`}>Loading Nebula...</span>
      </div>
  );

  return <NotebookView notebook={notebook} onUpdate={handleUpdate} />;
};

const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<BackgroundJob[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((title: string, message: string, type: 'success' | 'error' | 'info') => {
        const id = crypto.randomUUID();
        setNotifications(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const startJob = async (notebookId: string, type: Artifact['type'], sources: any[], config?: any) => {
        const jobId = crypto.randomUUID();
        const placeholderId = crypto.randomUUID();
        
        // 1. Create Placeholder Artifact in Notebook
        const notebook = getNotebookById(notebookId);
        if (notebook) {
            const placeholder: Artifact = {
                id: placeholderId,
                type,
                title: `${type === 'audioOverview' ? 'Podcast' : type} (Generating...)`,
                content: {},
                createdAt: Date.now(),
                status: 'generating'
            };
            notebook.artifacts.unshift(placeholder);
            saveNotebook(notebook);
        }

        const newJob: BackgroundJob = {
            id: jobId,
            notebookId,
            type,
            status: 'processing'
        };
        setJobs(prev => [...prev, newJob]);

        // 2. Start Async Process
        // We use a timeout to push this to the event loop so the UI updates immediately
        setTimeout(async () => {
            try {
                let content;
                if (type === 'audioOverview') {
                    // Pass the mode and length from config
                    content = await generateAudioOverview(sources, config?.length, config?.mode);
                } else {
                    content = await generateArtifact(type, sources);
                }

                // Update Notebook with Real Artifact
                const nb = getNotebookById(notebookId);
                if (nb) {
                    const idx = nb.artifacts.findIndex(a => a.id === placeholderId);
                    if (idx !== -1) {
                        nb.artifacts[idx] = {
                            ...nb.artifacts[idx],
                            title: `${type === 'audioOverview' ? 'Podcast' : type} - ${new Date().toLocaleTimeString()}`,
                            content,
                            status: 'completed'
                        };
                        saveNotebook(nb);
                    }
                }

                setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed' } : j));
                addNotification("Generation Complete", `Your ${type} is ready to view.`, 'success');

            } catch (error) {
                console.error(error);
                // Update placeholder to failed
                 const nb = getNotebookById(notebookId);
                 if (nb) {
                     const idx = nb.artifacts.findIndex(a => a.id === placeholderId);
                     if (idx !== -1) {
                         nb.artifacts[idx].status = 'failed';
                         saveNotebook(nb);
                     }
                 }
                setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed' } : j));
                addNotification("Generation Failed", "Something went wrong. Please try again.", 'error');
            }
        }, 0);
    };

    return (
        <JobContext.Provider value={{ startJob, jobs, notifications, dismissNotification }}>
            {children}
            {/* Notification Toast Container */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
                {notifications.map(n => (
                    <div key={n.id} className={`glass-panel p-4 rounded-xl border-l-4 shadow-2xl flex items-start gap-3 w-80 animate-in slide-in-from-right-full duration-300 ${n.type === 'success' ? 'border-green-500' : n.type === 'error' ? 'border-red-500' : 'border-blue-500'}`}>
                        <div className={`mt-0.5 ${n.type === 'success' ? 'text-green-400' : n.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                            {n.type === 'success' ? <Check size={18} /> : <Zap size={18} />}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-white">{n.title}</h4>
                            <p className="text-xs text-slate-300 mt-1">{n.message}</p>
                        </div>
                        <button onClick={() => dismissNotification(n.id)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                    </div>
                ))}
            </div>
        </JobContext.Provider>
    );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>('neon');

  if (showSplash) {
      return (
        <ThemeContext.Provider value={{ theme: THEMES[activeThemeId], setThemeId: setActiveThemeId }}>
            <SplashScreen onComplete={() => setShowSplash(false)} />
        </ThemeContext.Provider>
      );
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[activeThemeId], setThemeId: setActiveThemeId }}>
      <JobProvider>
        <HashRouter>
            <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/notebook/:id" element={<NotebookContainer />} />
            </Routes>
        </HashRouter>
      </JobProvider>
    </ThemeContext.Provider>
  );
};

export default App;