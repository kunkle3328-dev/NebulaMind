
import React, { useState, useEffect } from 'react';
import { Notebook, Source } from '../types';
import { ArrowLeft, MessageSquare, Layers, FolderOpen, Palette, ChevronLeft, ChevronRight, Edit2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SourcesTab from './SourcesTab';
import ChatTab from './ChatTab';
import StudioTab from './StudioTab';
import { useTheme, NebulaLogo } from '../App';
import { THEMES } from '../constants';

interface Props {
  notebook: Notebook;
  onUpdate: (nb: Notebook) => void;
}

type Tab = 'sources' | 'chat' | 'studio';

const NotebookView: React.FC<Props> = ({ notebook, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('sources');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { theme, setThemeId } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(notebook.title);

  useEffect(() => {
      setEditedTitle(notebook.title);
  }, [notebook.title]);

  const saveTitle = () => {
      if (editedTitle.trim() && editedTitle !== notebook.title) {
          onUpdate({ ...notebook, title: editedTitle, updatedAt: Date.now() });
      }
      setIsEditingTitle(false);
  };

  const addSource = (source: Source) => {
    const updated = {
      ...notebook,
      sources: [...notebook.sources, source],
      updatedAt: Date.now()
    };
    onUpdate(updated);
  };

  const deleteSource = (sourceId: string) => {
    const updated = {
        ...notebook,
        sources: notebook.sources.filter(s => s.id !== sourceId),
        updatedAt: Date.now()
    };
    onUpdate(updated);
  };

  return (
    <div className={`min-h-screen ${theme.colors.background} ${theme.colors.text} flex flex-col md:flex-row transition-colors duration-700`}>
      {/* Mobile Header */}
      <div className="md:hidden glass-panel p-4 flex justify-between items-center sticky top-0 z-50 border-b border-white/5">
        <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft /></Link>
        <h1 className="font-semibold truncate max-w-[200px]">{notebook.title}</h1>
        <div className="w-6" />
      </div>

      {/* Sidebar (Desktop) */}
      <nav className={`
        fixed bottom-0 left-0 w-full h-16 glass-panel border-t border-white/10 z-40
        md:relative md:h-screen md:border-t-0 md:border-r md:flex md:flex-col
        transition-all duration-300 bg-black/20 backdrop-blur-xl
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'}
      `}>
        {/* Toggle Collapse Button */}
        <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-3 top-10 w-6 h-6 bg-slate-800 border border-white/10 rounded-full items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 z-50 shadow-lg"
        >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`hidden md:flex p-6 items-center gap-3 mb-6 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}>
            <Link to="/" className="text-slate-400 hover:text-white transition-colors">
                <div className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></div>
            </Link>
            {!isSidebarCollapsed && <NebulaLogo size="sm" />}
        </div>
        
        <div className={`px-6 mb-8 hidden md:block ${isSidebarCollapsed ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'}`}>
            <h2 className={`text-xs font-bold text-${theme.colors.secondary}-400 uppercase tracking-widest mb-3 opacity-80`}>Active Project</h2>
            <div className={`p-4 rounded-xl bg-${theme.colors.primary}-500/5 border border-${theme.colors.primary}-500/10 group`}>
                
                {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                        <input 
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                            autoFocus
                            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white w-full outline-none"
                        />
                        <button onClick={saveTitle} className="text-green-400 hover:text-green-300"><Check size={14}/></button>
                    </div>
                ) : (
                    <div className="flex items-start justify-between">
                         <div>
                            <h1 className="font-bold text-lg truncate leading-tight w-40" title={notebook.title}>
                                {notebook.title}
                            </h1>
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Online
                            </p>
                         </div>
                         <button 
                            onClick={() => setIsEditingTitle(true)}
                            className="text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Edit2 size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
        
        <div className="flex flex-row justify-around h-full items-center md:flex-col md:justify-start md:px-4 md:gap-3">
            <button 
                onClick={() => setActiveTab('sources')}
                title="Sources"
                className={`flex flex-col md:flex-row items-center gap-3 p-2 md:px-4 md:py-3.5 rounded-xl transition-all w-full group
                ${activeTab === 'sources' ? `text-${theme.colors.primary}-400 bg-${theme.colors.primary}-900/20 border border-${theme.colors.primary}-500/20` : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                ${isSidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
            >
                <FolderOpen size={24} className="md:w-5 md:h-5" />
                {!isSidebarCollapsed && (
                    <>
                        <span className="text-xs md:text-sm font-medium">Sources</span>
                        <span className={`hidden md:block ml-auto text-xs ${activeTab === 'sources' ? `bg-${theme.colors.primary}-500/20 text-${theme.colors.primary}-300` : 'bg-slate-800 text-slate-500'} px-2 py-0.5 rounded-full transition-colors`}>{notebook.sources.length}</span>
                    </>
                )}
            </button>

            <button 
                onClick={() => setActiveTab('chat')}
                title="Chat"
                className={`flex flex-col md:flex-row items-center gap-3 p-2 md:px-4 md:py-3.5 rounded-xl transition-all w-full
                ${activeTab === 'chat' ? `text-${theme.colors.primary}-400 bg-${theme.colors.primary}-900/20 border border-${theme.colors.primary}-500/20` : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                ${isSidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
            >
                <MessageSquare size={24} className="md:w-5 md:h-5" />
                {!isSidebarCollapsed && <span className="text-xs md:text-sm font-medium">Chat Assistant</span>}
            </button>

            <button 
                onClick={() => setActiveTab('studio')}
                title="Studio"
                className={`flex flex-col md:flex-row items-center gap-3 p-2 md:px-4 md:py-3.5 rounded-xl transition-all w-full
                ${activeTab === 'studio' ? `text-${theme.colors.primary}-400 bg-${theme.colors.primary}-900/20 border border-${theme.colors.primary}-500/20` : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                ${isSidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
            >
                <Layers size={24} className="md:w-5 md:h-5" />
                {!isSidebarCollapsed && <span className="text-xs md:text-sm font-medium">Creative Studio</span>}
            </button>
        </div>

        {/* Theme Selector in Sidebar Footer */}
        <div className="mt-auto p-4 hidden md:block border-t border-white/5 relative">
            <button 
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className={`w-full flex items-center gap-3 p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/5 ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={isSidebarCollapsed ? "Change Theme" : ""}
            >
                <div className={`p-1.5 rounded-lg bg-${theme.colors.primary}-500/20`}>
                    <Palette size={16} className={`text-${theme.colors.primary}-400`} />
                </div>
                {!isSidebarCollapsed && (
                    <div className="text-left">
                        <span className="text-xs text-slate-500 block">Theme</span>
                        <span className="text-sm font-medium">{theme.name}</span>
                    </div>
                )}
            </button>

            {showThemeMenu && (
                <div className={`absolute bottom-full left-4 mb-3 glass-panel bg-slate-950 border border-white/10 rounded-2xl p-1 shadow-2xl animate-in fade-in slide-in-from-bottom-2 z-50 ${isSidebarCollapsed ? 'w-56' : 'right-4'}`}>
                     {Object.values(THEMES).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setThemeId(t.id); setShowThemeMenu(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors ${theme.id === t.id ? `bg-${t.colors.primary}-500/20 text-${t.colors.primary}-400` : 'text-slate-400 hover:bg-white/5'}`}
                        >
                          <div className={`w-3 h-3 rounded-full bg-gradient-to-br from-${t.colors.primary}-400 to-${t.colors.secondary}-500 shadow-[0_0_8px_currentColor]`}></div>
                          {t.name}
                        </button>
                      ))}
                </div>
            )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen relative ${theme.colors.background} transition-colors duration-700`}>
        {/* Ambient Backgrounds for Content Area */}
        {theme.id === 'quantum' && <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-900/10 rounded-full blur-[100px] pointer-events-none"></div>}
        {theme.id === 'gilded' && <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[100px] pointer-events-none"></div>}
        {theme.id === 'crimson' && <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-900/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>}
        
        <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 md:pb-8 relative z-10">
            {activeTab === 'sources' && <SourcesTab sources={notebook.sources} onAddSource={addSource} onDeleteSource={deleteSource} />}
            {activeTab === 'chat' && <ChatTab notebook={notebook} />}
            {activeTab === 'studio' && <StudioTab notebook={notebook} onUpdate={onUpdate} />}
        </div>
      </main>
    </div>
  );
};

export default NotebookView;
