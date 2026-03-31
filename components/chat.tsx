'use client';

import { useChat } from 'ai/react';
import type { Message } from 'ai';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[80vh]" style={{ color: 'var(--text-main)' }}>
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message: Message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed"
              style={{
                background: message.role === 'user'
                  ? 'linear-gradient(135deg, #6647fc, #eb6ea6)'
                  : 'var(--bg-card)',
                color: message.role === 'user' ? 'var(--text-on-gradient)' : 'var(--text-main)',
                border: message.role === 'user' ? 'none' : '1px solid rgba(102,71,252,0.12)',
              }}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2 text-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t" style={{ borderColor: 'rgba(102,71,252,0.12)' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Posez votre question..."
            disabled={isLoading}
            className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              borderColor: 'rgba(102,71,252,0.2)',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-full px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-40 hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #6647fc, #eb6ea6)', color: 'var(--text-on-gradient)' }}
          >
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
