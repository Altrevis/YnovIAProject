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
    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--primary)' }} className="rounded-2xl shadow-xl border overflow-hidden transition-colors duration-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'rgba(102,71,252,0.18)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #6647fc, #eb6ea6)' }}>
              <TrendingUp size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Résultats de l'analyse</h3>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: 'rgba(102,71,252,0.12)', color: 'var(--primary)' }}>
            {previewData.length} résultats
          </span>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Nom</th>
                <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, index) => (
                <tr
                  key={index}
                  className="border-b transition-colors"
                  style={{ borderColor: 'rgba(102,71,252,0.1)' }}
                >
                  <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-main)' }}>{row.nom}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        row.type === 'Personne'
                          ? 'bg-[rgba(102,71,252,0.14)] text-[var(--primary)]'
                          : 'bg-[rgba(235,110,166,0.16)] text-[var(--primary-dark)]'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Button */}
        <Link
          href="/results"
          className="w-full text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #6647fc, #eb6ea6)' }}
        >
          Voir les détails complets
          <ChevronRight size={20} style={{ color: '#ffffff' }} />
        </Link>
      </div>
    </div>
  );
}
