'use client';

import { useState } from 'react';
import { Send, Paperclip } from 'lucide-react';

export default function InputArea() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    console.log('Sending message:', message);
    
    // Simulate sending
    setTimeout(() => {
      setMessage('');
      setIsLoading(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl shadow-2xl p-4 border border-green-400/30 backdrop-blur-sm">
      <div className="flex gap-2 items-end">
        <button className="p-2 hover:bg-green-700 rounded-lg transition-all duration-200 transform hover:scale-110 text-white">
          <Paperclip size={18} />
        </button>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Posez votre question à l'IA..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg bg-white/95 text-gray-800 placeholder-gray-400 border-2 border-green-300/50 focus:border-white focus:outline-none focus:ring-2 focus:ring-green-300/50 resize-none backdrop-blur-sm transition-all duration-200 font-medium text-sm"
        />
        
        <button
          onClick={handleSend}
          disabled={isLoading || !message.trim()}
          className="bg-white hover:bg-gray-50 disabled:bg-gray-300 text-green-600 font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-md transform hover:scale-105 active:scale-95 text-sm"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
