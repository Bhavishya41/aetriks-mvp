import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const SentinelChat = ({ city = 'unknown', activeMetrics = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          city: city,
          metrics: activeMetrics.length > 0 ? activeMetrics : ['LST', 'NDVI', 'NO2'],
        }),
      });
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: data.reply || data.error || 'No response from Sentinel.' },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: 'Connection error. Sentinel systems offline.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button — pulses while loading */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition transform hover:scale-105 flex items-center justify-center z-50 ${
            isLoading ? 'animate-pulse' : ''
          }`}
          aria-label="Open Sentinel AI Analyst"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-[#0f1117] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden text-sm font-sans">

          {/* Header */}
          <div className="bg-[#0a0c14] px-4 py-3 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bot
                  size={22}
                  className={`text-indigo-400 ${isLoading ? 'animate-pulse' : ''}`}
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[#0a0c14]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm leading-tight">Sentinel AI Analyst</h3>
                <p className="text-slate-500 text-[10px] leading-tight">
                  {city.charAt(0).toUpperCase() + city.slice(1)} · {activeMetrics.join(', ') || 'LST, NDVI, NO2'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-white transition"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area — hidden scrollbar */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-2">
                <Bot size={36} className="text-indigo-900" />
                <p className="text-xs leading-relaxed max-w-[200px]">
                  Ask me about temperature trends, air quality, or vegetation data for{' '}
                  <span className="text-indigo-400">
                    {city.charAt(0).toUpperCase() + city.slice(1)}
                  </span>.
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-[#1a1c2e] border border-slate-700/50 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1a1c2e] border border-slate-700/50 text-indigo-400 px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-2 text-[13px]">
                  <Loader2 className="animate-spin" size={14} />
                  <span>Analysing…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-[#0a0c14] border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Ask Sentinel…"
                disabled={isLoading}
                className="flex-1 bg-[#1a1c2e] text-white placeholder-slate-500 rounded-lg px-4 py-2 border border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 text-[13px]"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-40 transition"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SentinelChat;
