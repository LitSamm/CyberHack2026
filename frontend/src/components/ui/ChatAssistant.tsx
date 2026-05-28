'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, X, Send, Bot, User, Loader2, ArrowRight } from 'lucide-react';
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

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1); // Default 1 to encourage click

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load history from localStorage
  useEffect(() => {
    try {
      const history = localStorage.getItem('aromos_chat_history');
      if (history) {
        setMessages(JSON.parse(history));
        setUnreadCount(0); // If they've used it, remove initial unread count
      } else {
        // Initial greeting
        setMessages([{
          role: 'assistant',
          content: 'Halo! Saya asisten operasional AromOS. Ada data yang ingin Anda ketahui hari ini?'
        }]);
      }
    } catch (e) {
      console.error('Failed to load chat history');
    }
  }, []);

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('aromos_chat_history', JSON.stringify(messages.slice(-50)));
    }
    // Scroll to bottom
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnreadCount(0);
  };

  const clearHistory = () => {
    if (confirm('Hapus semua riwayat percakapan?')) {
      const initial = [{
        role: 'assistant' as const,
        content: 'Halo! Saya asisten operasional AromOS. Ada data yang ingin Anda ketahui hari ini?'
      }];
      setMessages(initial);
      localStorage.setItem('aromos_chat_history', JSON.stringify(initial));
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
        content: `Maaf, terjadi kesalahan: ${err.message}. Pastikan API Key Anthropic sudah diatur.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (url: string) => {
    router.push(url);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={cn(
          "fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all duration-300 z-50 flex items-center justify-center",
          isOpen ? "bg-slate-700 hover:bg-slate-600 scale-90" : "bg-orange-500 hover:bg-orange-600 hover:scale-105"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 border-2 border-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 w-[400px] h-[550px] max-h-[80vh] max-w-[calc(100vw-48px)] bg-slate-900 border border-slate-700/50 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 origin-bottom-right",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700/50 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
              <Bot className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">AromOS Assistant</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-medium">Online (Arom AI)</span>
              </div>
            </div>
          </div>
          <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-red-400 transition-colors">
            Clear History
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.role === 'user' ? "bg-blue-500" : "bg-slate-800 border border-slate-700")}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-orange-400" />}
              </div>

              <div className="flex flex-col gap-2">
                <div className={cn("p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === 'user' ? "bg-blue-500 text-white rounded-tr-sm" : "bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm"
                )}>
                  {msg.content}
                </div>

                {/* Suggested Actions */}
                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    {msg.suggested_actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(action.url)}
                        className="flex items-center justify-between px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs rounded-lg transition-colors"
                      >
                        {action.label}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-orange-400" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-sm bg-slate-800 border border-slate-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                <span className="text-xs text-slate-400">Sedang menganalisis data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-slate-800/80 backdrop-blur border-t border-slate-700/50 shrink-0">
          {/* Quick Questions */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 hide-scrollbar">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="whitespace-nowrap px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 rounded-full text-xs text-slate-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya info operasional..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
