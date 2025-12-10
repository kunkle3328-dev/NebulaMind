import React, { useState } from 'react';
import { Notebook, Source } from '../types';
import { ArrowLeft, MessageSquare, Layers, FolderOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import SourcesTab from './SourcesTab';
import ChatTab from './ChatTab';
import StudioTab from './StudioTab';

interface Props {
  notebook: Notebook;
  onUpdate: (nb: Notebook) => void;
}

type Tab = 'sources' | 'chat' | 'studio';

const NotebookView: React.FC<Props> = ({ notebook, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('sources');

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden glass-panel p-4 flex justify-between items-center sticky top-0 z-50">
        <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft /></Link>
        <h1 className="font-semibold truncate max-w-[200px]">{notebook.title}</h1>
        <div className="w-6" />
      </div>

      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <nav className="
        fixed bottom-0 left-0 w-full h-16 glass-panel border-t border-white/10 z-50
        md:relative md:w-64 md:h-screen md:border-t-0 md:border-r md:flex md:flex-col
      ">
        <div className="hidden md:flex p-6 items-center gap-3 mb-6">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors">
                <div className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></div>
            </Link>
            <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-cyan-500/20 rounded-md flex items-center justify-center">
                    <Sparkles size={12} className="text-cyan-400"/>
                 </div>
                 <span className="font-bold text-white tracking-tight">Nebula</span>
            </div>
        </div>
        
        <div className="px-6 mb-4 hidden md:block">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notebook</h2>
            <h1 className="font-bold text-lg text-white truncate" title={notebook.title}>
                {notebook.title}
            </h1>
        </div>
        
        <div className="flex flex-row justify-around h-full items-center md:flex-col md:justify-start md:px-4 md:gap-2">
            <button 
                onClick={() => setActiveTab('sources')}
                className={`flex flex-col md:flex-row items-center gap-2 p-2 md:px-4 md:py-3 rounded-xl transition-all w-full group
                ${activeTab === 'sources' ? 'text-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
                <FolderOpen size={24} className="md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">Sources</span>
                <span className="hidden md:block ml-auto text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 group-hover:bg-slate-700 transition-colors">{notebook.sources.length}</span>
            </button>

            <button 
                onClick={() => setActiveTab('chat')}
                className={`flex flex-col md:flex-row items-center gap-2 p-2 md:px-4 md:py-3 rounded-xl transition-all w-full
                ${activeTab === 'chat' ? 'text-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
                <MessageSquare size={24} className="md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">Chat</span>
            </button>

            <button 
                onClick={() => setActiveTab('studio')}
                className={`flex flex-col md:flex-row items-center gap-2 p-2 md:px-4 md:py-3 rounded-xl transition-all w-full
                ${activeTab === 'studio' ? 'text-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
                <Layers size={24} className="md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">Studio</span>
            </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen relative bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
            {activeTab === 'sources' && <SourcesTab sources={notebook.sources} onAddSource={addSource} onDeleteSource={deleteSource} />}
            {activeTab === 'chat' && <ChatTab notebook={notebook} />}
            {activeTab === 'studio' && <StudioTab notebook={notebook} onUpdate={onUpdate} />}
        </div>
      </main>
    </div>
  );
};

export default NotebookView;