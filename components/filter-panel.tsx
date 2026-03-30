'use client';

import { useState } from 'react';
import { Globe, BarChart3, Zap } from 'lucide-react';

export default function FilterPanel() {
  const [url, setUrl] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    console.log('Analyzing:', { url, entityType });
    setTimeout(() => setIsAnalyzing(false), 1500);
  };

  return (
    <div className="bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 text-white p-8 rounded-2xl shadow-2xl border border-slate-500/30 backdrop-blur-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <Globe size={24} className="text-blue-400" />
        <h2 className="text-xl font-bold">Filtrer l'analyse</h2>
      </div>
      
      <div className="space-y-6 flex-1 flex flex-col overflow-y-auto pb-4 filter-scrollbar pr-2">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-200">
            URL à analyser
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-2 rounded-lg bg-slate-800/60 text-white placeholder-slate-400 border-2 border-slate-500/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:outline-none transition-all backdrop-blur-sm text-sm"
          />
        </div>

        {/* Entity Type Filter */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-slate-200">
            Type d'entité
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'all', label: 'Tous', emoji: '🔄' },
              { value: 'person', label: 'Personne', emoji: '👤' },
              { value: 'company', label: 'Entreprise', emoji: '🏢' },
              { value: 'product', label: 'Produit', emoji: '📦' },
              { value: 'location', label: 'Localisation', emoji: '📍' },
              { value: 'organization', label: 'Organisation', emoji: '🏛️' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setEntityType(option.value)}
                className={`px-3 py-3 rounded-lg font-semibold transition-all duration-200 flex flex-col items-center gap-2 text-sm ${
                  entityType === option.value
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                    : 'bg-slate-700/60 text-slate-200 hover:bg-slate-600 border-2 border-slate-600/50'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-200">
            Sources à analyser
          </label>
          <div className="space-y-2">
            {['LinkedIn', 'Twitter', 'Website', 'Email', 'Google'].map((source) => (
              <label key={source} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded bg-slate-800 border-slate-600"
                />
                <span className="text-sm text-slate-200">{source}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Analyze Button - sticky at bottom on scroll */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !url.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-500 disabled:to-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 text-sm"
        >
          {isAnalyzing ? (
            <>
              <Zap size={20} className="animate-pulse" />
              Analyse en cours...
            </>
          ) : (
            <>
              <BarChart3 size={20} />
              Analyser
            </>
          )}
        </button>
      </div>
    </div>
  );
}
