import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { Notebook } from './types';
import { getNotebooks, createNotebook, getNotebookById, saveNotebook } from './services/storage';
import { COLORS } from './constants';
import { Plus, Book, MoreVertical, ArrowLeft, Sparkles } from 'lucide-react';
import NotebookView from './components/NotebookView';
import SplashScreen from './components/SplashScreen';

// 1. Dashboard Component
const Dashboard: React.FC = () => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setNotebooks(getNotebooks());
  }, []);

  const handleCreate = () => {
    const title = `Notebook ${new Date().toLocaleDateString()}`;
    const nb = createNotebook(title);
    navigate(`/notebook/${nb.id}`);
  };

  return (
    <div className={`min-h-screen ${COLORS.background} p-4 md:p-8 relative overflow-hidden`}>
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <header className="flex justify-between items-center mb-12 relative z-10">
        <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Sparkles size={20} className="text-white" />
             </div>
             <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
               Nebula<span className="text-cyan-400">Mind</span>
             </h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10"></div>
      </header>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl text-slate-300">Your Research</h2>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white px-5 py-2.5 rounded-full transition-all shadow-lg shadow-cyan-900/50 font-medium"
          >
            <Plus size={18} /> New Notebook
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {notebooks.length === 0 ? (
            <div className="col-span-3 text-center py-20 opacity-50 border border-dashed border-slate-700 rounded-2xl">
              <p className="text-lg">No notebooks yet. Start your journey.</p>
            </div>
          ) : (
            notebooks.map(nb => (
              <Link key={nb.id} to={`/notebook/${nb.id}`}>
                <div className="group relative h-48 p-6 glass-panel rounded-2xl hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={16} />
                  </div>
                  <div>
                    <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Book size={20} className="text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">{nb.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{nb.sources.length} sources</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Updated {new Date(nb.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Notebook Container
const NotebookContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [notebook, setNotebook] = useState<Notebook | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      const nb = getNotebookById(id);
      if (nb) {
        setNotebook(nb);
      } else {
        navigate('/');
      }
    }
  }, [id, navigate]);

  const handleUpdate = (updated: Notebook) => {
    setNotebook(updated);
    saveNotebook(updated);
  };

  if (!notebook) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500">Loading Nebula...</div>;

  return <NotebookView notebook={notebook} onUpdate={handleUpdate} />;
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
      return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/notebook/:id" element={<NotebookContainer />} />
      </Routes>
    </HashRouter>
  );
};

export default App;