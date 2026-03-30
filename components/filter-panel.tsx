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
    <div style={{
      background: `linear-gradient(135deg, var(--bg-card), var(--bg-secondary))`,
      borderColor: 'rgba(102, 71, 252, 0.2)',
    }} className="text-white p-8 rounded-2xl shadow-2xl border backdrop-blur-sm h-full flex flex-col transition-colors duration-200">
      <div className="flex items-center gap-2 mb-8">
        <Globe size={24} style={{ color: 'var(--accent)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Filtrer l'analyse</h2>
      </div>
      
      <div className="space-y-6 flex-1 flex flex-col overflow-y-auto pb-4 filter-scrollbar pr-2">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            URL à analyser
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-main)',
              borderColor: 'rgba(102, 71, 252, 0.3)',
            }}
            className="w-full px-4 py-2 rounded-lg border-2 placeholder-opacity-50 focus:ring-2 focus:outline-none transition-all text-sm placeholder-current"
            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(235, 110, 166, 0.7)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(102, 71, 252, 0.3)'}
          />
        </div>

        {/* Entity Type Filter */}
        <div>
          <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
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
                style={
                  entityType === option.value
                    ? {
                        background: `linear-gradient(135deg, #6647fc, #eb6ea6)`,
                        color: 'var(--text-main)',
                        boxShadow: '0 8px 20px rgba(235, 110, 166, 0.3)',
                        transform: 'scale(1.05)',
                      }
                    : {
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        borderColor: 'rgba(102, 71, 252, 0.3)',
                      }
                }
                className="px-3 py-3 rounded-lg font-semibold transition-all duration-200 flex flex-col items-center gap-2 text-sm border-2"
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Sources à analyser
          </label>
          <div className="space-y-2">
            {['LinkedIn', 'Twitter', 'Website', 'Email', 'Google'].map((source) => (
              <label key={source} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--primary)',
                  }}
                  className="w-4 h-4 rounded border-2"
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{source}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !url.trim()}
          style={{
            background: isAnalyzing || !url.trim() 
              ? 'var(--bg-secondary)' 
              : `linear-gradient(135deg, #6647fc, #eb6ea6)`,
            color: 'var(--text-main)',
            opacity: isAnalyzing || !url.trim() ? 0.5 : 1,
            boxShadow: isAnalyzing || !url.trim() ? 'none' : '0 8px 20px rgba(235, 110, 166, 0.3)',
          }}
          className="w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 text-sm"
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
