'use client';

import { useState } from 'react';
import Navbar from '@/components/navbar';
import FilterPanel from '@/components/filter-panel';
import ChatArea from '@/components/chat-area';
import InputArea from '@/components/input-area';
import ResultsTable from '@/components/results-table';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Exhibitor {
  id: string;
  nom: string;
  description: string;
  siteWeb: string;
  logo: string;
  stand: string;
  pays: string;
  linkedin: string;
  twitter: string;
  categories: string;
  email: string;
  telephone: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [url, setUrl] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['all']);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return;

    setScrapeLoading(true);
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `Analyser: ${url}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: `❌ Erreur: ${data.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else if (data.exhibitors && Array.isArray(data.exhibitors)) {
        setExhibitors(data.exhibitors);
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-success`,
          role: 'assistant',
          content: `✅ Trouvé ${data.count} exposants sur ${url}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-catch`,
        role: 'assistant',
        content: `❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || chatLoading) return;

    setChatLoading(true);
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line || line === ':') continue;

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);

              let textDelta = '';
              if (data.type === 'text-delta' && data.delta) {
                textDelta = data.delta;
              } else if (data.choices?.[0]?.delta?.content) {
                textDelta = data.choices[0].delta.content;
              }

              if (textDelta) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === assistantMessage.id) {
                    lastMsg.content += textDelta;
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Parse error - skip
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.id === assistantMessage.id) {
          lastMsg.content = `❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-main)' }}
      className="relative isolate flex flex-col w-screen min-h-screen font-sans overflow-x-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f7fc,#ffffff)] opacity-100 transition-opacity duration-500 dark:opacity-0" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b0b0f,#12121a)] opacity-0 transition-opacity duration-500 dark:opacity-100" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main className="flex flex-1 gap-4 px-6 pt-24 pb-6 overflow-visible w-screen">
          <aside className="w-[298px] flex-shrink-0 max-h-[660px] flex flex-col">
            <FilterPanel
              url={url}
              onUrlChange={setUrl}
              selectedEntities={selectedEntities}
              onEntitiesChange={setSelectedEntities}
              onAnalyze={handleAnalyzeUrl}
              isLoading={scrapeLoading}
            />
          </aside>

          <div className="flex-1 flex flex-col gap-3 overflow-visible">
            <div className="flex-shrink-0 h-[550px]">
              <ChatArea messages={messages} />
            </div>
            <div className="flex-shrink-0 h-[100px]">
              <InputArea onSend={handleSendMessage} isLoading={chatLoading} />
            </div>
          </div>
        </main>

        <div className="flex-1 px-6 pb-6 overflow-visible w-screen">
          <ResultsTable exhibitors={exhibitors} />
        </div>
      </div>
    </div>
  );
}

