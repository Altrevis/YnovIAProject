'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatAreaProps {
  messages: Message[];
}

export default function ChatArea({ messages }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Skip scroll on initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  return (
    <div style={{
      background: `linear-gradient(180deg, var(--bg-secondary), var(--bg-card))`,
      borderColor: 'rgba(102, 71, 252, 0.2)',
    }} className="rounded-2xl shadow-xl p-4 h-full flex flex-col border overflow-hidden transition-colors duration-400">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{
        borderColor: 'rgba(102, 71, 252, 0.2)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #6647fc, #eb6ea6)',
        }} className="p-2 rounded-lg">
          <MessageCircle size={20} style={{ color: '#ffffff' }} />
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Conversation IA</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={48} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
              <p className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun message pour le moment</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Commencez une conversation !</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className="max-w-lg px-4 py-2 rounded-2xl shadow-md transition-[background-color,color,border-color,box-shadow] duration-200 hover:shadow-lg"
                style={{
                  background: message.role === 'user' 
                    ? 'linear-gradient(135deg, #6647fc, #eb6ea6)'
                    : `var(--bg-card)`,
                  color: message.role === 'user' ? '#ffffff' : 'var(--text-main)',
                  borderRadius: message.role === 'user' ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                  border: message.role !== 'user' ? `2px solid var(--primary)` : 'none',
                  boxShadow: message.role === 'user' ? '0 4px 12px rgba(235, 110, 166, 0.2)' : 'none',
                }}
              >
                <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                <span className="text-xs mt-2 block" style={{
                  color: message.role === 'user' ? 'rgba(255, 255, 255, 0.82)' : 'var(--text-secondary)'
                }}>
                  {message.timestamp.toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Placeholder indicator */}
      {messages.length === 1 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(102, 71, 252, 0.1), rgba(235, 110, 166, 0.1))',
          borderColor: 'rgba(102, 71, 252, 0.3)',
          color: 'var(--text-secondary)',
        }} className="p-3 rounded-lg border-2 text-xs text-center font-bold transition-colors duration-200">
          💡 Tapez un message pour commencer à discuter
        </div>
      )}
    </div>
  );
}
