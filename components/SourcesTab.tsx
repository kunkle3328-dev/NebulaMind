import React, { useState, useRef } from 'react';
    import { Source } from '../types';
    import { fetchWebsiteContent, processFileWithGemini } from '../services/ai';
    import { FileText, Link as LinkIcon, Youtube, Type, Upload, Trash2, Globe, FileAudio, Image, PlusCircle, X, Loader2 } from 'lucide-react';
    
    interface Props {
      sources: Source[];
      onAddSource: (s: Source) => void;
      onDeleteSource: (id: string) => void;
    }
    
    const SourcesTab: React.FC<Props> = ({ sources, onAddSource, onDeleteSource }) => {
      // Modal State
      const [activeModal, setActiveModal] = useState<'text' | 'website' | 'youtube' | 'file' | null>(null);
      const [fileType, setFileType] = useState<'pdf' | 'audio' | 'image' | null>(null);
      
      // Input State
      const [inputValue, setInputValue] = useState('');
      const [titleValue, setTitleValue] = useState('');
      const [selectedFile, setSelectedFile] = useState<File | null>(null);
      const [isProcessing, setIsProcessing] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const fileInputRef = useRef<HTMLInputElement>(null);
    
      const resetModal = () => {
          setActiveModal(null);
          setFileType(null);
          setInputValue('');
          setTitleValue('');
          setSelectedFile(null);
          setError(null);
          setIsProcessing(false);
      };

      const handleAddSource = async () => {
        setError(null);
        setIsProcessing(true);
        
        try {
            let content = "";
            let finalTitle = titleValue;
            let type: Source['type'] = 'copiedText';
            let metadata: any = {};

            if (activeModal === 'text') {
                content = inputValue;
                type = 'copiedText';
                if (!finalTitle) finalTitle = "Pasted Text " + new Date().toLocaleTimeString();
            } 
            else if (activeModal === 'website') {
                if (!inputValue.startsWith('http')) throw new Error("Invalid URL");
                content = await fetchWebsiteContent(inputValue);
                type = 'website';
                if (!finalTitle) finalTitle = inputValue; // Ideally fetch title from scraping result
                metadata = { originalUrl: inputValue };
            }
            else if (activeModal === 'youtube') {
                // For YouTube, getting transcripts client-side without API key is hard.
                // We will treat it as a source entry that informs the user.
                // In a real prod app, we'd use a backend.
                // For this demo, we'll extract metadata and tell Gemini about it.
                if (!inputValue.includes('youtube.com') && !inputValue.includes('youtu.be')) throw new Error("Invalid YouTube URL");
                
                // OEmbed fetch for title
                try {
                    const oembedUrl = `https://noembed.com/embed?url=${inputValue}`;
                    const res = await fetch(oembedUrl);
                    const json = await res.json();
                    if (json.title) finalTitle = json.title;
                } catch (e) { console.warn("Could not fetch oEmbed", e); }

                if (!finalTitle) finalTitle = "YouTube Video";
                
                content = `[YouTube Video Source]\nURL: ${inputValue}\nTitle: ${finalTitle}\n\n(Note: Video transcript ingestion requires backend API. Treat this source as context for the video's existence.)`;
                type = 'youtube';
                metadata = { originalUrl: inputValue };
            }
            else if (activeModal === 'file' && selectedFile && fileType) {
                 if (!finalTitle) finalTitle = selectedFile.name;
                 
                 // Process file with Gemini Multimodal
                 content = await processFileWithGemini(selectedFile, selectedFile.type);
                 type = fileType;
                 metadata = { filename: selectedFile.name, size: selectedFile.size };
            }

            if (!content) throw new Error("No content could be extracted.");

            const newSource: Source = {
                id: crypto.randomUUID(),
                type,
                title: finalTitle,
                content: content,
                createdAt: Date.now(),
                metadata
            };

            onAddSource(newSource);
            resetModal();

        } catch (err: any) {
            setError(err.message || "Failed to add source.");
        } finally {
            setIsProcessing(false);
        }
      };

      const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files[0]) {
              setSelectedFile(e.target.files[0]);
              if (!titleValue) setTitleValue(e.target.files[0].name);
          }
      };
    
      const SourceCard: React.FC<{ source: Source }> = ({ source }) => {
        let Icon = FileText;
        if (source.type === 'website') Icon = Globe;
        if (source.type === 'youtube') Icon = Youtube;
        if (source.type === 'copiedText') Icon = Type;
        if (source.type === 'audio') Icon = FileAudio;
        if (source.type === 'image') Icon = Image;
    
        return (
          <div className="glass-panel p-4 rounded-xl flex items-start gap-3 hover:border-cyan-500/50 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                <Icon size={20} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-200 truncate">{source.title}</h3>
                <p className="text-xs text-slate-400 mt-1 truncate">
                    {source.type === 'copiedText' ? 'Pasted Text' : source.metadata?.originalUrl || source.metadata?.filename || 'Uploaded File'}
                </p>
                <div className="mt-2 text-xs text-slate-500 flex gap-2">
                    <span>{source.content.length} chars</span>
                    <span>•</span>
                    <span>{new Date(source.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
            <button 
                onClick={() => onDeleteSource(source.id)}
                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg transition-all"
            >
                <Trash2 size={16} />
            </button>
          </div>
        );
      };
    
      return (
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
              <div className="space-y-2">
                 <h2 className="text-3xl font-bold text-white tracking-tight">Sources</h2>
                 <p className="text-slate-400 max-w-lg">
                    Add content to ground your notebook. The AI uses these sources to answer questions and generate audio overviews.
                 </p>
              </div>
              <div className="text-right">
                  <span className="text-4xl font-bold text-cyan-400">{sources.length}</span>
                  <span className="text-slate-500 text-sm block uppercase tracking-wider font-semibold">Total Sources</span>
              </div>
          </div>
    
          {/* Quick Actions */}
          <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Add New Source</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                 <button 
                    onClick={() => setActiveModal('text')} 
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-rose-500/10 rounded-full group-hover:bg-rose-500/20 transition-colors">
                        <Type className="text-rose-400" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">Paste Text</span>
                 </button>
                 
                 <button 
                    onClick={() => setActiveModal('website')}
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                        <Globe className="text-blue-400" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">Website</span>
                 </button>
                 
                 <button 
                    onClick={() => setActiveModal('youtube')}
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-red-500/10 rounded-full group-hover:bg-red-500/20 transition-colors">
                        <Youtube className="text-red-500" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">YouTube</span>
                 </button>
                 
                 <button 
                    onClick={() => { setActiveModal('file'); setFileType('pdf'); }}
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors">
                        <FileText className="text-orange-400" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">PDF</span>
                 </button>
                 
                 <button 
                    onClick={() => { setActiveModal('file'); setFileType('audio'); }}
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-purple-500/10 rounded-full group-hover:bg-purple-500/20 transition-colors">
                        <FileAudio className="text-purple-400" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">Audio</span>
                 </button>
                 
                 <button 
                    onClick={() => { setActiveModal('file'); setFileType('image'); }}
                    className="p-5 glass-panel rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 hover:scale-[1.02] transition-all group border-transparent hover:border-cyan-500/30"
                 >
                     <div className="p-3 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors">
                        <Image className="text-green-400" size={24} />
                     </div>
                     <span className="text-sm font-medium text-slate-200">Image</span>
                 </button>
              </div>
          </div>
    
          {/* Sources List */}
          <div className="pt-4">
            {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 glass-panel rounded-2xl border-dashed border-slate-700 bg-slate-900/30">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <PlusCircle size={32} className="text-slate-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-400">No sources yet</p>
                    <p className="text-sm mt-1">Paste text, URL, or upload a file to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sources.map(s => <SourceCard key={s.id} source={s} />)}
                </div>
            )}
          </div>
    
          {/* Modals */}
          {activeModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-white/10 shadow-2xl relative">
                    <button onClick={resetModal} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>

                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        {activeModal === 'text' && <Type className="text-rose-400" />}
                        {activeModal === 'website' && <Globe className="text-blue-400" />}
                        {activeModal === 'youtube' && <Youtube className="text-red-500" />}
                        {activeModal === 'file' && fileType === 'pdf' && <FileText className="text-orange-400" />}
                        {activeModal === 'file' && fileType === 'audio' && <FileAudio className="text-purple-400" />}
                        {activeModal === 'file' && fileType === 'image' && <Image className="text-green-400" />}
                        
                        {activeModal === 'text' && 'Paste Text'}
                        {activeModal === 'website' && 'Import Website'}
                        {activeModal === 'youtube' && 'Import YouTube'}
                        {activeModal === 'file' && `Upload ${fileType?.toUpperCase()}`}
                    </h3>

                    <div className="space-y-4">
                        <input 
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                            placeholder="Title (Optional)"
                            value={titleValue}
                            onChange={(e) => setTitleValue(e.target.value)}
                            disabled={isProcessing}
                        />

                        {activeModal === 'text' && (
                            <textarea 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none min-h-[200px]"
                                placeholder="Paste your content here..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isProcessing}
                            ></textarea>
                        )}

                        {(activeModal === 'website' || activeModal === 'youtube') && (
                            <input 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-mono text-sm"
                                placeholder={activeModal === 'website' ? "https://example.com/article" : "https://youtube.com/watch?v=..."}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isProcessing}
                            />
                        )}

                        {activeModal === 'file' && (
                            <div 
                                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}
                                onClick={() => !isProcessing && fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept={
                                        fileType === 'pdf' ? "application/pdf" : 
                                        fileType === 'audio' ? "audio/*" : 
                                        "image/*"
                                    }
                                    onChange={handleFileSelect}
                                    disabled={isProcessing}
                                />
                                {selectedFile ? (
                                    <>
                                        <div className="w-12 h-12 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mb-3">
                                            <Upload size={24} />
                                        </div>
                                        <p className="font-medium text-slate-200">{selectedFile.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-3">
                                            <Upload size={24} />
                                        </div>
                                        <p className="font-medium text-slate-400">Click to Upload {fileType?.toUpperCase()}</p>
                                    </>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
                                {error}
                            </div>
                        )}
                        
                        {isProcessing && (
                            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg flex items-center gap-3">
                                <Loader2 className="animate-spin text-cyan-400" size={20} />
                                <div className="text-sm">
                                    <p className="text-cyan-200 font-medium">Processing Source...</p>
                                    <p className="text-cyan-500/70 text-xs">This may take a few seconds.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={resetModal} 
                                className="px-5 py-2.5 hover:bg-white/10 rounded-xl transition-colors font-medium text-slate-300"
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAddSource}
                                disabled={isProcessing || (!inputValue && !selectedFile)}
                                className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={18} />}
                                Add Source
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      );
    };
    
    export default SourcesTab;