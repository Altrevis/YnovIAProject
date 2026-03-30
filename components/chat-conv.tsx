'use client';

import { useRef, useState, useEffect, type FormEvent } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatConv() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      // Limite à 10 messages pour éviter de grossir le contexte (ralentit l'inférence)
      const history = updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error('HTTP error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const token = JSON.parse(line.slice(2));
              if (typeof token === 'string') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: m.content + token } : m,
                  ),
                );
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: 'Erreur de connexion au modèle.' } : m,
        ),
      );
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto h-[86vh]">
      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-8">
            <div className="text-5xl">💬</div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                Chat conversationnel
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
                Posez n&apos;importe quelle question. Le modèle répond en français de façon concise et utile.
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black break-words">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (!msg.content) {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-500 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  Réflexion…
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Posez une question…"
            disabled={isLoading}
            className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-40 hover:opacity-80"
          >
            {isLoading ? '…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  );
}
