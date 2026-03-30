'use client';

import { useChat } from 'ai/react';
import type { Message } from 'ai';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[80vh]">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message: Message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Posez votre question..."
            disabled={isLoading}
            className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-40 hover:opacity-80"
          >
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
