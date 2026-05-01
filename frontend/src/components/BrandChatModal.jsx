import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, SkipForward } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from './LoadingSpinner';

const GREETING = (brandName, niche) =>
  `Hi! I'm your Brand Strategy AI 👋\n\nI'll ask you 5 quick questions about **${brandName}** so I can generate a smarter Instagram content calendar that works with the algorithm.\n\nLet's start — what products or services does ${brandName} offer?`;

export default function BrandChatModal({ client, onClose, onComplete }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING(client.name, client.niche) },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(1).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post(`/api/clients/${client.id}/chat`, {
        message: msg,
        chatHistory: history.slice(0, -1),
      });

      const { reply, brandInfo, isComplete: done } = res.data;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);

      if (done && brandInfo) {
        setIsComplete(true);
        onComplete({ ...client, brandInfo });
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const userTurns = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal flex flex-col" style={{ maxWidth: '560px', height: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Brand Strategy Setup</h2>
              <p className="text-xs text-slate-500">{client.name} · {userTurns}/5 questions answered</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSkip} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
              <SkipForward size={12} /> Skip for now
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-slate-800">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${Math.min((userTurns / 5) * 100, 100)}%` }}
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'assistant' ? 'bg-brand/20' : 'bg-slate-700'
              }`}>
                {msg.role === 'assistant' ? <Bot size={14} className="text-brand" /> : <User size={14} className="text-slate-300" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-slate-800 text-slate-200 rounded-tl-sm'
                  : 'bg-brand text-white rounded-tr-sm'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>
                    {line.replace(/\*\*(.*?)\*\*/g, (_, t) => t)}
                    {j < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-brand" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!isComplete && (
          <div className="p-4 border-t border-slate-700/50">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2"
            >
              <input
                className="input flex-1 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer…"
                disabled={loading}
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-primary px-3 disabled:opacity-40"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Send size={15} />}
              </button>
            </form>
            <p className="text-xs text-slate-600 mt-2 text-center">
              This helps the AI generate an Instagram-algorithm-optimized calendar for {client.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
