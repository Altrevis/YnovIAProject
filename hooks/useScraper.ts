import { useState } from 'react';

export interface Exhibitor {
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

interface ScrapeResponse {
  type: 'list' | 'single';
  exhibitors?: Exhibitor[];
  exhibitor?: Exhibitor;
  error?: string;
  source?: string;
  count?: number;
}

export function useScraper() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (url: string): Promise<Exhibitor[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ScrapeResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Map API response to Exhibitor format with id
      const exhibitors = (data.exhibitors || (data.exhibitor ? [data.exhibitor] : [])).map(
        (e: Exhibitor, idx: number) => ({
          id: e.id || `exhibitor-${idx}-${Date.now()}`,
          nom: e.nom,
          description: e.description,
          siteWeb: e.siteWeb,
          logo: e.logo,
          stand: e.stand,
          pays: e.pays,
          linkedin: e.linkedin,
          twitter: e.twitter,
          categories: e.categories,
          email: e.email,
          phone: e.phone || e.email, // fallback for missing phone
        })
      );

      return exhibitors;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { scrape, loading, error };
}
