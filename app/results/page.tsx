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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white px-8 py-5 shadow-2xl">
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
            className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Download size={20} />
            CSV
          </button>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Download size={20} />
            Excel
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Nom</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Téléphone</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Source</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Actions</th>
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.nom}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          row.type === 'Personne'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.source}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.dateAnalyse}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => copyToClipboard(row.nom, row.id)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-800"
                      >
                        {copiedId === row.id ? (
                          <span className="text-xs text-green-600 font-bold">Copié!</span>
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
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Total</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{mockData.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium">Entreprises</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {mockData.filter((r) => r.type === 'Entreprise').length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Personnes</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {mockData.filter((r) => r.type === 'Personne').length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <p className="text-gray-600 text-sm font-medium">Sources</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {new Set(mockData.map((r) => r.source)).size}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
