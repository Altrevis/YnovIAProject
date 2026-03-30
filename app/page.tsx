'use client';

import { useState } from 'react';
import Chat from '@/components/chat';
import ChatConv from '@/components/chat-conv';

type Tab = 'scraper' | 'chat';

export default function Home() {
  const [tab, setTab] = useState<Tab>('scraper');

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {tab === 'scraper' ? '🕷️ Scraper IA — Mistral 3B' : '💬 Chat — Mistral 3B'}
        </h1>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
          <button
            onClick={() => setTab('scraper')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'scraper'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            🕷️ Scraper
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'chat'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            💬 Chat
          </button>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center py-6 px-4">
        {tab === 'scraper' ? <Chat /> : <ChatConv />}
      </main>
    </div>
  );
}
