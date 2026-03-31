'use client';

import { useRef, useState, useEffect, type FormEvent } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exhibitor {
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

interface ScrapeResult {
  type?: 'list' | 'single';
  exhibitors?: Exhibitor[];
  exhibitor?: Exhibitor;
  count?: number;
  error?: string;
  source?: string;
}

interface TextMsg {
  id: string;
  kind: 'text';
  role: 'user' | 'assistant';
  content: string;
}

interface ScrapeMsg {
  id: string;
  kind: 'scrape';
  role: 'assistant';
  userUrl: string;
  isLoading: boolean;
  result?: ScrapeResult;
}

type UIMessage = TextMsg | ScrapeMsg;

// ─── Field definitions ────────────────────────────────────────────────────────

const FIELDS: { label: string; key: keyof Exhibitor }[] = [
  { label: 'Nom', key: 'nom' },
  { label: 'Stand', key: 'stand' },
  { label: 'Pays', key: 'pays' },
  { label: 'Catégories', key: 'categories' },
  { label: 'Email', key: 'email' },
  { label: 'Téléphone', key: 'telephone' },
  { label: 'Site Web', key: 'siteWeb' },
  { label: 'LinkedIn', key: 'linkedin' },
  { label: 'Twitter / X', key: 'twitter' },
  { label: 'Description', key: 'description' },
  { label: 'Logo', key: 'logo' },
];

// ─── Export helpers ───────────────────────────────────────────────────────────

function toCSV(rows: Exhibitor[]): string {
  const header = FIELDS.map(f => `"${f.label}"`).join(',');
  const body = rows.map(row =>
    FIELDS.map(f => `"${(row[f.key] || 'N/A').replace(/"/g, '""')}"`).join(','),
  );
  return '\uFEFF' + [header, ...body].join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadExcelXML(rows: Exhibitor[], filename: string) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const header = FIELDS.map(f => `<Cell><Data ss:Type="String">${esc(f.label)}</Data></Cell>`).join('');
  const dataRows = rows.map(row => {
    const cells = FIELDS.map(
      f => `<Cell><Data ss:Type="String">${esc(row[f.key] || 'N/A')}</Data></Cell>`,
    ).join('');
    return `<Row>${cells}</Row>`;
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Worksheet ss:Name="Exposants"><Table><Row>${header}</Row>${dataRows.join('')}</Table></Worksheet>` +
    `</Workbook>`;

  downloadBlob(xml, filename, 'application/vnd.ms-excel;charset=utf-8;');
}

// ─── Sortable, filterable exhibitor table ─────────────────────────────────────

type SortDir = 'asc' | 'desc';

function ExhibitorTable({ exhibitors }: { exhibitors: Exhibitor[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Exhibitor>('nom');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = exhibitors.filter(e =>
    FIELDS.some(f => (e[f.key] || '').toLowerCase().includes(search.toLowerCase())),
  );

  const sorted = [...filtered].sort((a, b) => {
    const va = (a[sortKey] || '').toLowerCase();
    const vb = (b[sortKey] || '').toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (key: keyof Exhibitor) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const chevron = (key: keyof Exhibitor) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const slug = `exposants_${Date.now()}`;

  const isLink = (v: string) => v !== 'N/A' && /^https?:\/\//.test(v);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          ✅ {exhibitors.length} exposant{exhibitors.length > 1 ? 's' : ''} extraits
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => downloadBlob(toCSV(sorted), `${slug}.csv`, 'text/csv;charset=utf-8;')}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => downloadExcelXML(sorted, `${slug}.xls`)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            ⬇ Excel
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un exposant…"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
      />

      <p className="text-xs text-zinc-400">
        {filtered.length} résultat{filtered.length > 1 ? 's' : ''} — cliquez sur un en-tête pour trier
      </p>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              {FIELDS.slice(0, 8).map(({ label, key }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none uppercase tracking-wide"
                >
                  {label}{chevron(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((ex, i) => (
              <tr
                key={i}
                className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                {FIELDS.slice(0, 8).map(({ key }) => {
                  const val = ex[key] || 'N/A';
                  return (
                    <td key={key} className="px-3 py-2 text-zinc-800 dark:text-zinc-200 max-w-[200px] break-words">
                      {isLink(val) ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[180px]"
                          title={val}
                        >
                          {val.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : (
                        <span className={val === 'N/A' ? 'text-zinc-400' : ''}>{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <p className="text-center py-6 text-sm text-zinc-400">Aucun résultat</p>
        )}
      </div>
    </div>
  );
}

// ─── Single exhibitor card ────────────────────────────────────────────────────

function SingleCard({ exhibitor }: { exhibitor: Exhibitor }) {
  const slug = (exhibitor.nom || 'entreprise').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const isLink = (v: string) => v !== 'N/A' && /^https?:\/\//.test(v);

  return (
    <div className="flex flex-col gap-3 w-full">
      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✅ Extraction terminée</p>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden w-full">
        <table className="w-full text-sm">
          <tbody>
            {FIELDS.map(({ label, key }) => {
              const val = exhibitor[key] || 'N/A';
              return (
                <tr key={key} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400 w-40 bg-zinc-50 dark:bg-zinc-900 text-xs uppercase tracking-wide whitespace-nowrap">
                    {label}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100 break-all">
                    {isLink(val) ? (
                      <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        {val}
                      </a>
                    ) : (
                      <span className={val === 'N/A' ? 'text-zinc-400' : ''}>{val}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => downloadBlob(toCSV([exhibitor]), `${slug}.csv`, 'text/csv;charset=utf-8;')}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
        >
          ⬇ CSV
        </button>
        <button
          onClick={() => downloadExcelXML([exhibitor], `${slug}.xls`)}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
        >
          ⬇ Excel
        </button>
      </div>
    </div>
  );
}

// ─── Message renderer ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: UIMessage }) {
  if (msg.kind === 'text' && msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black break-all">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === 'text' && msg.role === 'assistant') {
    if (!msg.content) {
      return (
        <div className="flex justify-start">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-500 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            Réflexion…
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === 'scrape') {
    if (msg.isLoading) {
      return (
        <div className="flex justify-start">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              <span>Analyse en cours… (peut prendre 30-60s pour les sites dynamiques)</span>
            </div>
            <span className="text-xs truncate max-w-[300px] opacity-60">{msg.userUrl}</span>
          </div>
        </div>
      );
    }

    const { result } = msg;
    if (!result) return null;

    if (result.error && (!result.exhibitors || result.exhibitors.length === 0)) {
      return (
        <div className="flex justify-start">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 text-sm text-red-700 dark:text-red-300 max-w-[80%]">
            ❌ {result.error}
          </div>
        </div>
      );
    }

    if (result.type === 'list' && result.exhibitors) {
      return (
        <div className="flex justify-start w-full">
          <div className="w-full">
            <ExhibitorTable exhibitors={result.exhibitors} />
          </div>
        </div>
      );
    }

    if (result.type === 'single' && result.exhibitor) {
      return (
        <div className="flex justify-start w-full">
          <div className="w-full">
            <SingleCard exhibitor={result.exhibitor} />
          </div>
        </div>
      );
    }
  }

  return null;
}

// ─── Main Chat component ──────────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
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

    const userMsg: TextMsg = { id: `u-${Date.now()}`, kind: 'text', role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const urlMatch = text.match(/https?:\/\/[^\s]+/);

    if (urlMatch) {
      // ── Scraping mode ──────────────────────────────────────────────────────
      const scrapeId = `s-${Date.now()}`;
      const scrapeMsg: ScrapeMsg = { id: scrapeId, kind: 'scrape', role: 'assistant', userUrl: urlMatch[0], isLoading: true };
      console.log('URL détectée :', urlMatch[0]);
      setMessages(prev => [...prev, scrapeMsg]);
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlMatch[0] }),
        });
        console.log('Status API:', res.status);
        const result: ScrapeResult = await res.json();
        setMessages(prev =>
          prev.map(m => m.id === scrapeId ? { ...m, isLoading: false, result } as ScrapeMsg : m),
        );
        console.log('Résultat brut API:', result);
      } catch {
        setMessages(prev =>
          prev.map(m =>
            m.id === scrapeId
              ? { ...m, isLoading: false, result: { error: 'Erreur réseau. Vérifiez votre connexion.' } } as ScrapeMsg
              : m,
          ),
        );
      }
    } else {
      // ── Conversation mode (streaming) ──────────────────────────────────────
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: TextMsg = { id: assistantId, kind: 'text', role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMsg]);

      try {
        const history = messages
          .filter((m): m is TextMsg => m.kind === 'text')
          .map(m => ({ role: m.role, content: m.content }));
        history.push({ role: 'user', content: text });

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
                      m.id === assistantId
                        ? { ...(m as TextMsg), content: (m as TextMsg).content + token }
                        : m,
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
            m.id === assistantId ? { ...(m as TextMsg), content: 'Erreur de connexion au modèle.' } : m,
          ),
        );
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto h-[86vh]">
      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-8">
            <div className="text-5xl">🕷️</div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                Scraper d&apos;exposants IA
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
                Collez l&apos;URL d&apos;une page de liste d&apos;exposants.
                L&apos;IA extraira automatiquement tous les contacts et les affichera dans un tableau téléchargeable.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm w-full">
              {['Nom', 'Stand / Emplacement', 'Pays', 'Catégories', 'Email', 'Téléphone', 'LinkedIn', 'Twitter / X'].map(f => (
                <span key={f} className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-center">{f}</span>
              ))}
            </div>
            <p className="text-xs text-zinc-400 mt-2">Vous pouvez aussi poser des questions en texte libre.</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Collez une URL de salon (ex : https://…/exhibitors) ou posez une question"
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
