'use client';

import { TrendingUp, Download, Copy, Search, Filter } from 'lucide-react';
import { useState } from 'react';

interface DataRow {
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
  phone: string;
}

const mockData: DataRow[] = [
  {
    id: '1',
    nom: 'Tech Solutions Inc',
    description: 'Entreprise de solutions technologiques',
    siteWeb: 'www.techsolutions.fr',
    logo: '🏢',
    stand: 'Hall A - Stand 101',
    pays: 'France',
    linkedin: 'linkedin.com/company/techsolutions',
    twitter: '@techsolutions',
    categories: 'Tech, SaaS',
    email: 'contact@techsolutions.fr',
    phone: '+33 1 23 45 67 89',
  },
  {
    id: '2',
    nom: 'Digital Agency Pro',
    description: 'Agence digitale spécialisée en marketing',
    siteWeb: 'www.digitalagency.fr',
    logo: '🎨',
    stand: 'Hall B - Stand 205',
    pays: 'France',
    linkedin: 'linkedin.com/company/digitalagency',
    twitter: '@dagencypro',
    categories: 'Marketing, Design',
    email: 'hello@digitalagency.fr',
    phone: '+33 2 34 56 78 90',
  },
  {
    id: '3',
    nom: 'CloudSync Solutions',
    description: 'Plateforme de synchronisation cloud',
    siteWeb: 'www.cloudsync.io',
    logo: '☁️',
    stand: 'Hall A - Stand 150',
    pays: 'Belgique',
    linkedin: 'linkedin.com/company/cloudsync',
    twitter: '@cloudsync_io',
    categories: 'Cloud, Infrastructure',
    email: 'info@cloudsync.io',
    phone: '+32 2 12 34 56',
  },
  {
    id: '4',
    nom: 'DataFlow Analytics',
    description: 'Analyse de données et business intelligence',
    siteWeb: 'www.dataflow.ai',
    logo: '📊',
    stand: 'Hall C - Stand 89',
    pays: 'Luxembourg',
    linkedin: 'linkedin.com/company/dataflow',
    twitter: '@dataflow_ai',
    categories: 'BI, Data Science',
    email: 'contact@dataflow.ai',
    phone: '+352 1 23 45 67',
  },
  {
    id: '5',
    nom: 'SecureNet Corp',
    description: 'Solutions de cybersécurité avancées',
    siteWeb: 'www.securenet.io',
    logo: '🔒',
    stand: 'Hall B - Stand 140',
    pays: 'France',
    linkedin: 'linkedin.com/company/securenet',
    twitter: '@securenet_io',
    categories: 'Sécurité, Cybersecurity',
    email: 'sales@securenet.io',
    phone: '+33 3 45 67 89 01',
  },
];

export default function ResultsTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const downloadCSV = () => {
    const headers = ['Nom', 'Description', 'Site Web', 'Logo', 'Stand', 'Pays', 'LinkedIn', 'Twitter/X', 'Catégories', 'Email', 'Téléphone'];
    const rows = mockData.map((row) => [
      row.nom,
      row.description,
      row.siteWeb,
      row.logo,
      row.stand,
      row.pays,
      row.linkedin,
      row.twitter,
      row.categories,
      row.email,
      row.phone,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `resultats-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderColor: 'rgba(102, 71, 252, 0.2)',
    }} className="rounded-2xl shadow-xl border overflow-hidden flex flex-col h-full transition-colors duration-200">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #6647fc, #eb6ea6)`,
        borderColor: 'rgba(102, 71, 252, 0.3)',
        boxShadow: '0 4px 12px rgba(235, 110, 166, 0.2)',
      }} className="flex items-center justify-between p-4 border-b flex-shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          }} className="p-2 rounded-lg">
            <TrendingUp size={20} style={{ color: '#ffffff' }} />
          </div>
          <h3 className="text-lg font-bold" style={{ color: '#ffffff' }}>Résultats</h3>
          <span style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'var(--text-main)',
          }} className="px-2 py-1 rounded-lg text-xs font-bold">
            {mockData.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            {isSearchOpen && (
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Rechercher..."
                autoFocus
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  color: 'var(--primary)',
                  borderColor: 'rgba(255, 255, 255, 0.95)',
                }}
                className="absolute right-10 border-2 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-white transition-colors duration-200 placeholder-opacity-50"
              />
            )}
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchText('');
              }}
              className="p-2 rounded-lg transition-all duration-200 relative z-10"
              style={{ color: '#ffffff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Search size={18} />
            </button>
          </div>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: '#ffffff' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Filter size={18} />
          </button>
          <div className="relative">
            <button
              onClick={() => setIsDownloadOpen((open) => !open)}
              aria-label="Téléchargement"
              aria-expanded={isDownloadOpen}
              className="p-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl bg-white/90 text-black hover:bg-white/95 dark:bg-gray-200/85 dark:text-black dark:hover:bg-gray-300/90"
            >
              <Download size={18} />
            </button>

            {isDownloadOpen && (
              <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border shadow-2xl overflow-hidden z-30"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'rgba(102, 71, 252, 0.2)',
                }}
              >
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm font-semibold transition-colors duration-200 hover:bg-[rgba(102,71,252,0.1)]"
                  style={{ color: 'var(--text-main)' }}
                  onClick={() => setIsDownloadOpen(false)}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm font-semibold transition-colors duration-200 hover:bg-[rgba(235,110,166,0.1)]"
                  style={{ color: 'var(--text-main)' }}
                  onClick={() => setIsDownloadOpen(false)}
                >
                  XLSX
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {isFilterOpen && (
        <div
          style={{
            background: `linear-gradient(135deg, rgba(102, 71, 252, 0.88), rgba(235, 110, 166, 0.88))`,
            borderColor: 'rgba(255, 255, 255, 0.22)',
          }}
          className="border-b p-4 flex-shrink-0 w-fit ml-auto pr-4 rounded-bl-2xl rounded-br-sm -mt-px transition-colors duration-200"
        >
          <div className="flex gap-6">
            {/* Filter: Type */}
            <div className="flex items-center gap-3">
              <label style={{ color: '#ffffff' }} className="text-sm font-medium whitespace-nowrap">Type:</label>
              <select style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', color: 'var(--primary)' }} className="px-3 py-1 rounded-lg border-none outline-none text-sm font-medium">
                <option>Tous</option>
                <option>Personne</option>
                <option>Entreprise</option>
              </select>
            </div>

            {/* Filter: Source */}
            <div className="flex items-center gap-3">
              <label style={{ color: '#ffffff' }} className="text-sm font-medium whitespace-nowrap">Source:</label>
              <select style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', color: 'var(--primary)' }} className="px-3 py-1 rounded-lg border-none outline-none text-sm font-medium transition-colors duration-200">
                <option>Tous</option>
                <option>LinkedIn</option>
                <option>Twitter</option>
                <option>Website</option>
                <option>Email</option>
                <option>Google</option>
              </select>
            </div>

            {/* Filter: Date Range */}
            <div className="flex items-center gap-3">
              <label style={{ color: '#ffffff' }} className="text-sm font-medium whitespace-nowrap">Date:</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="AAAA"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', color: 'var(--primary)' }}
                className="w-20 px-3 py-1 rounded-lg border-none outline-none text-sm font-medium transition-colors duration-200 placeholder:opacity-60"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full">
          <thead className="sticky top-0 transition-colors duration-200" style={{
            background: `linear-gradient(90deg, var(--bg-secondary), var(--bg-card))`,
            borderColor: 'rgba(102, 71, 252, 0.2)',
          }}>
            <tr className="border-b">
              <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap" style={{ color: 'var(--text-main)' }}>Nom</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Description</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Site Web</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Logo</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Stand</th>
              <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap" style={{ color: 'var(--text-main)' }}>Pays</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>LinkedIn</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Twitter/X</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Catégories</th>
              <th className="px-2 py-2 text-left text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>Email</th>
              <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap" style={{ color: 'var(--text-main)' }}>Téléphone</th>
              <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap" style={{ color: 'var(--text-main)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockData.map((row, index) => (
              <tr
                key={row.id}
                className="transition-all duration-200"
                style={{
                  backgroundColor: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  borderColor: 'rgba(102, 71, 252, 0.1)',
                }}
              >
                <td className="px-2 py-2 text-xs font-medium whitespace-nowrap truncate" style={{ color: 'var(--text-main)' }}>{row.nom}</td>
                <td className="px-2 py-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.description}</td>
                <td className="px-2 py-2 text-xs truncate" style={{ color: 'var(--accent)' }}>
                  <a href={`https://${row.siteWeb}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline transition-colors duration-200">
                    {row.siteWeb}
                  </a>
                </td>
                <td className="px-2 py-2 text-xs text-center truncate">{row.logo}</td>
                <td className="px-2 py-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.stand}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap truncate" style={{ color: 'var(--text-secondary)' }}>{row.pays}</td>
                <td className="px-2 py-2 text-xs truncate" style={{ color: 'var(--accent)' }}>
                  <a href={`https://${row.linkedin}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline transition-colors duration-200">
                    LinkedIn
                  </a>
                </td>
                <td className="px-2 py-2 text-xs whitespace-nowrap truncate" style={{ color: 'var(--accent)' }}>
                  <a href={`https://twitter.com/${row.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline transition-colors duration-200">
                    {row.twitter}
                  </a>
                </td>
                <td className="px-2 py-2 text-xs truncate">
                  <span className="inline-block px-1.5 py-0.5 rounded text-xs truncate" style={{
                    backgroundColor: 'rgba(102, 71, 252, 0.16)',
                    color: 'var(--primary)',
                    border: '1px solid rgba(102, 71, 252, 0.24)',
                  }}>
                    {row.categories}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.email}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap truncate" style={{ color: 'var(--text-secondary)' }}>{row.phone}</td>
                <td className="px-2 py-2 text-xs">
                  <button
                    onClick={() => copyToClipboard(row.email, row.id)}
                    className="p-2 rounded-lg transition-all duration-200"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--text-main)';
                      e.currentTarget.style.opacity = '0.5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {copiedId === row.id ? (
                      <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--accent)' }}>Copié!</span>
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
