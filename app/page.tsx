'use client';

import Chat from '@/components/chat';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          🕷️ Scraper IA — Mistral 3B
        </h1>
      </header>
      <main className="flex flex-1 items-start justify-center py-6 px-4">
        <Chat />
      </main>
    </div>
  );
}

