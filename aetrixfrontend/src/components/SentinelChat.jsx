import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, Loader2 } from 'lucide-react';

const SentinelChat = () => {
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
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('https://aetriks-mvp.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, city: "vadodara" })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply || data.error || 'No response.' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Sentinel down.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition transform hover:scale-105 animate-pulse flex items-center justify-center z-50"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden text-sm font-sans">
          
          {/* Header */}
          <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Bot className="text-indigo-400" size={24} />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-950"></span>
              </div>
              <h3 className="text-white font-semibold">Sentinel AI Analyst</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-200">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 mt-10">
                <p>Hello. How can I assist you with your data today?</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-slate-700 text-white rounded-br-none'
                      : 'bg-indigo-950/80 border border-indigo-800 text-indigo-100 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-indigo-950/80 border border-indigo-800 text-indigo-400 p-3 rounded-2xl rounded-bl-none flex items-center space-x-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Processing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-900 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Sentinel..."
                className="flex-1 bg-slate-800 text-white placeholder-slate-400 rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SentinelChat;
