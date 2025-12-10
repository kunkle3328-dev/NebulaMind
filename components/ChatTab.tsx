import React, { useState, useRef, useEffect } from 'react';
import { Notebook, ChatMessage } from '../types';
import { generateAnswer } from '../services/ai';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface Props {
  notebook: Notebook;
}

const ChatTab: React.FC<Props> = ({ notebook }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
        id: 'welcome',
        role: 'model',
        text: `Hi! I'm ready to answer questions based on the ${notebook.sources.length} sources in this notebook. What would you like to know?`,
        citations: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: input
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const modelMsgId = crypto.randomUUID();
    const modelMsg: ChatMessage = {
        id: modelMsgId,
        role: 'model',
        text: '',
        isStreaming: true
    };
    setMessages(prev => [...prev, modelMsg]);

    let fullResponse = '';
    
    await generateAnswer(userMsg.text, notebook.sources, (chunk) => {
        fullResponse += chunk;
        setMessages(prev => prev.map(m => 
            m.id === modelMsgId ? { ...m, text: fullResponse } : m
        ));
    });

    setMessages(prev => prev.map(m => 
        m.id === modelMsgId ? { ...m, isStreaming: false } : m
    ));
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
                        <Sparkles size={16} className="text-white" />
                    </div>
                )}
                
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                    ? 'bg-slate-800 text-slate-100 rounded-tr-sm' 
                    : 'glass-panel text-slate-200 rounded-tl-sm border-transparent'
                }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    {msg.isStreaming && <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse"/>}
                </div>

                {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <User size={16} className="text-slate-400" />
                    </div>
                )}
            </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 relative">
        <div className="glass-panel p-2 rounded-2xl flex items-center gap-2 focus-within:border-cyan-500/50 transition-colors">
            <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${notebook.sources.length} sources...`}
                className="flex-1 bg-transparent p-3 outline-none text-slate-100 placeholder-slate-500"
                disabled={loading || notebook.sources.length === 0}
            />
            <button 
                type="submit"
                disabled={loading || !input.trim() || notebook.sources.length === 0}
                className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-white transition-all neon-glow-blue"
            >
                <Send size={20} />
            </button>
        </div>
        {notebook.sources.length === 0 && (
            <p className="text-center text-xs text-rose-500 mt-2">Add sources in the Sources tab to start chatting.</p>
        )}
      </form>
    </div>
  );
};

export default ChatTab;
