'use client';

import Link from 'next/link';
import { ChevronRight, TrendingUp } from 'lucide-react';

interface PreviewRow {
  nom: string;
  type: 'Personne' | 'Entreprise';
  email: string;
}

const previewData: PreviewRow[] = [
  {
    nom: 'Jean Dupont',
    type: 'Personne',
    email: 'jean.dupont@example.com',
  },
  {
    nom: 'Tech Solutions Inc',
    type: 'Entreprise',
    email: 'contact@techsolutions.fr',
  },
  {
    nom: 'Marie Martin',
    type: 'Personne',
    email: 'marie.martin@example.com',
  },
];

export default function ResultPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <TrendingUp size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Résultats de l'analyse</h3>
          </div>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
            {previewData.length} résultats
          </span>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-gray-900">{row.nom}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        row.type === 'Personne'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Button */}
        <Link
          href="/results"
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
        >
          Voir les détails complets
          <ChevronRight size={20} />
        </Link>
      </div>
    </div>
  );
}
