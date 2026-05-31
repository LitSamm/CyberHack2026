'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggested_actions?: { label: string; url: string }[];
}

const QUICK_QUESTIONS = [
  "Lot mana yang belum di-QC?",
  "Ada berapa slot cold-chain kosong?",
  "Lot urgent hari ini?",
  "Ringkasan operasional hari ini"
];

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load history
  useEffect(() => {
    try {
      const history = localStorage.getItem('aromos_chat_history');
      if (history) {
        setMessages(JSON.parse(history));
      }
    } catch (e) {
      console.error('Failed to load chat history');
    }
  }, []);

  // Save history & scroll
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('aromos_chat_history', JSON.stringify(messages.slice(-50)));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearHistory = () => {
    if (confirm('Hapus semua riwayat percakapan?')) {
      setMessages([]);
      localStorage.removeItem('aromos_chat_history');
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        suggested_actions: data.suggested_actions
      }]);

    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Maaf, terjadi kesalahan: ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (url: string) => {
    router.push(url);
  };

  const hasMessages = messages.length > 0;

  return (
    <DashboardLayout allowedRoles={['admin', 'qc', 'ppic', 'warehouse']}>
      <div className="relative flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-8rem)] w-full bg-[#090D14] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }}
      />

      {/* Header Actions */}
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        {hasMessages && (
          <button 
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full backdrop-blur-md border border-white/10 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Central Orb / Greeting (Only show if no messages) */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full w-40 h-40" />
            <div className="w-32 h-32 rounded-full border-[3px] border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-purple-500/20 mix-blend-overlay" />
              <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(59,130,246,0.5)_360deg)]" />
              <div className="w-[calc(100%-4px)] h-[calc(100%-4px)] rounded-full bg-gray-900 flex items-center justify-center z-10">
                <Bot className="w-12 h-12 text-blue-400 group-hover:scale-110 transition-transform duration-500" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Good to see you, {user?.name || 'Sima Arome'}
          </h1>
          <p className="text-slate-400 mt-2 max-w-md text-center">
            Saya asisten AI cerdas Anda. Ada data operasional yang ingin Anda ketahui hari ini?
          </p>
        </div>
      )}

      {/* Chat Messages */}
      {hasMessages && (
        <div className="flex-1 overflow-y-auto p-6 md:p-12 relative z-10 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg",
                  msg.role === 'user' 
                    ? "bg-blue-600 text-white" 
                    : "bg-[#1A2333] border border-white/10 text-blue-400"
                )}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                <div className={cn("flex flex-col gap-3 max-w-[80%]", msg.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "px-5 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm" 
                      : "bg-[#1A2333] border border-white/5 text-slate-200 rounded-2xl rounded-tl-sm"
                  )}>
                    {msg.content}
                  </div>

                  {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {msg.suggested_actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(action.url)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm rounded-xl transition-all"
                        >
                          {action.label}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#1A2333] border border-white/10 flex items-center justify-center shrink-0 shadow-lg text-blue-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="px-5 py-4 bg-[#1A2333] border border-white/5 rounded-2xl rounded-tl-sm flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <span className="text-slate-400 text-sm">Menganalisis data operasional...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className={cn(
        "absolute left-0 right-0 z-20 flex flex-col items-center px-4 transition-all duration-700",
        hasMessages ? "bottom-6" : "bottom-12"
      )}>
        {/* Quick Questions (Only show initially) */}
        {!hasMessages && (
          <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-slate-300 transition-all backdrop-blur-md"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* The Input Bar */}
        <div className="w-full max-w-3xl relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="relative flex items-center bg-[#1A2333]/90 backdrop-blur-xl border border-white/10 rounded-full p-2 shadow-2xl"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="hello how can you help me..."
              className="flex-1 bg-transparent border-none text-white px-6 py-3 focus:outline-none focus:ring-0 placeholder-slate-500 text-base"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all mr-1"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
        </div>
        
        <div className="mt-6 text-xs text-slate-500 font-medium">
          &copy; 2026 AromOS AI Assistant &bull; Sima Arome
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
