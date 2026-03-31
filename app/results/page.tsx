'use client';

import Link from 'next/link';
import { ArrowLeft, Download, Copy } from 'lucide-react';
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
];

export default function ResultsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const downloadCSV = () => {
    const headers = ['ID', 'Nom', 'Type', 'Email', 'Téléphone', 'Source', 'Date Analyse'];
    const rows = mockData.map((row) => [
      row.id,
      row.nom,
      row.type,
      row.email,
      row.phone,
      row.source,
      row.dateAnalyse,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `resultats-analyse-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const downloadExcel = () => {
    // Pour une vraie implémentation, utiliser une lib comme xlsx
    alert('Export Excel: nécessite une libraire côté client (xlsx)');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, var(--bg-main), var(--bg-secondary))' }} className="min-h-screen transition-colors duration-300">
      {/* Header */}
      <header style={{ background: 'linear-gradient(90deg, #6647fc, #eb6ea6)' }} className="text-white px-8 py-5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 transform hover:scale-110"
            >
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold">Résultats de l'analyse</h1>
          </div>
          <div className="text-sm opacity-90 font-medium">
            {mockData.length} résultats trouvés
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6647fc, #eb6ea6)' }}
          >
            <Download size={20} />
            CSV
          </button>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6647fc, #eb6ea6)' }}
          >
            <Download size={20} />
            Excel
          </button>
        </div>

        {/* Table */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--primary)' }} className="rounded-2xl shadow-xl border overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: 'linear-gradient(90deg, rgba(102,71,252,0.12), rgba(235,110,166,0.12))', borderColor: 'var(--primary)' }} className="border-b transition-colors duration-300">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Nom</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Type</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Email</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Téléphone</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Source</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--text-main)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockData.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b transition-all duration-200 ${
                      index % 2 === 0 ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-main)]'
                    }`}
                    style={{ borderColor: 'rgba(102, 71, 252, 0.12)' }}
                  >
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--text-main)' }}>{row.nom}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          row.type === 'Personne'
                            ? 'bg-[rgba(102,71,252,0.14)] text-[var(--primary)]'
                            : 'bg-[rgba(235,110,166,0.16)] text-[var(--primary-dark)]'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.email}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.phone}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.source}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.dateAnalyse}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => copyToClipboard(row.nom, row.id)}
                        className="p-2 rounded-lg transition-all duration-200"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {copiedId === row.id ? (
                          <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>Copié!</span>
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <div style={{ backgroundColor: 'var(--bg-card)', borderLeftColor: 'var(--primary)' }} className="rounded-xl shadow-lg p-6 border-l-4 transition-colors duration-300">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-main)' }}>{mockData.length}</p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', borderLeftColor: '#eb6ea6' }} className="rounded-xl shadow-lg p-6 border-l-4 transition-colors duration-300">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Entreprises</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-main)' }}>
              {mockData.filter((r) => r.type === 'Entreprise').length}
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', borderLeftColor: 'var(--primary-dark)' }} className="rounded-xl shadow-lg p-6 border-l-4 transition-colors duration-300">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Personnes</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-main)' }}>
              {mockData.filter((r) => r.type === 'Personne').length}
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', borderLeftColor: 'var(--gradient-end)' }} className="rounded-xl shadow-lg p-6 border-l-4 transition-colors duration-300">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sources</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-main)' }}>
              {new Set(mockData.map((r) => r.source)).size}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
