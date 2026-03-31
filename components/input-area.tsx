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
    <div style={{
      background: 'linear-gradient(135deg, #5c3ef0, #d85f98)',
      borderColor: 'rgba(92, 62, 240, 0.22)',
      backgroundClip: 'padding-box',
    }} className="rounded-2xl shadow-2xl p-4 backdrop-blur-sm transition-colors duration-200 border">
      <div className="flex gap-2 items-end">
        <button className="p-2 rounded-lg transition-all duration-200 transform hover:scale-110" style={{
          color: '#ffffff',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Paperclip size={18} />
        </button>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Posez votre question à l'IA..."
          rows={2}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            borderColor: 'rgba(255, 255, 255, 0.28)',
            caretColor: '#ffffff',
          }}
          className="flex-1 px-3 py-2 rounded-lg border-2 placeholder-opacity-50 focus:outline-none focus:ring-2 resize-none backdrop-blur-sm transition-all duration-200 font-medium text-sm text-white"
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
          }}
          placeholder-color="rgba(255, 255, 255, 0.5)"
        />
        
        <button
          onClick={handleSend}
          disabled={isLoading || !message.trim()}
          className="font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 text-sm bg-white/90 text-black hover:bg-white/95 dark:bg-gray-200/85 dark:text-black dark:hover:bg-gray-300/90"
          style={{
            opacity: isLoading || !message.trim() ? 0.5 : 1,
          }}
        >
          {isLoading ? (
            <div style={{
              borderColor: 'var(--primary)',
              borderTopColor: 'transparent',
            }} className="w-5 h-5 border-2 rounded-full animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
