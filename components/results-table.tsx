'use client';

import { TrendingUp, Download, Copy, Search, Filter } from 'lucide-react';
import { useState } from 'react';

interface DataRow {
  id: string;
  nom: string;
  type: 'Personne' | 'Entreprise';
  email: string;
  phone: string;
  source: string;
  dateAnalyse: string;
}

const mockData: DataRow[] = [
  {
    id: '1',
    nom: 'Jean Dupont',
    type: 'Personne',
    email: 'jean.dupont@example.com',
    phone: '+33 6 12 34 56 78',
    source: 'LinkedIn',
    dateAnalyse: '2024-03-30',
  },
  {
    id: '2',
    nom: 'Tech Solutions Inc',
    type: 'Entreprise',
    email: 'contact@techsolutions.fr',
    phone: '+33 1 23 45 67 89',
    source: 'Website',
    dateAnalyse: '2024-03-30',
  },
  {
    id: '3',
    nom: 'Marie Martin',
    type: 'Personne',
    email: 'marie.martin@example.com',
    phone: '+33 6 98 76 54 32',
    source: 'Twitter',
    dateAnalyse: '2024-03-30',
  },
  {
    id: '4',
    nom: 'Digital Agency Pro',
    type: 'Entreprise',
    email: 'hello@digitalagency.fr',
    phone: '+33 2 34 56 78 90',
    source: 'Google',
    dateAnalyse: '2024-03-30',
  },
  {
    id: '5',
    nom: 'Pierre Leclerc',
    type: 'Personne',
    email: 'pierre.leclerc@example.com',
    phone: '+33 7 11 22 33 44',
    source: 'Email',
    dateAnalyse: '2024-03-30',
  },
];

export default function ResultsTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const downloadCSV = () => {
    const headers = ['Nom', 'Type', 'Email', 'Téléphone', 'Source', 'Date'];
    const rows = mockData.map((row) => [
      row.nom,
      row.type,
      row.email,
      row.phone,
      row.source,
      row.dateAnalyse,
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
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <TrendingUp size={20} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Résultats</h3>
          <span className="bg-white/20 text-white px-2 py-1 rounded-lg text-xs font-bold">
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
                className="absolute right-10 bg-white/90 text-blue-600 placeholder-gray-400 border-2 border-white rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            )}
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchText('');
              }}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 text-white relative z-10"
            >
              <Search size={18} />
            </button>
          </div>
          <button className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 text-white">
            <Filter size={18} />
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-blue-600 font-bold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-sm"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full">
          <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Type</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Source</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockData.map((row, index) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{row.nom}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap inline-block ${
                      row.type === 'Personne'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.source}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.dateAnalyse}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => copyToClipboard(row.email, row.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-800"
                  >
                    {copiedId === row.id ? (
                      <span className="text-xs text-green-600 font-bold whitespace-nowrap">Copié!</span>
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
