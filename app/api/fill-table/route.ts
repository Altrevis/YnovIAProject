import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';

interface Exhibitor {
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
  telephone: string;
}

function asValue(v: unknown): string {
  if (typeof v !== 'string') return 'N/A';
  const s = v.trim();
  return s.length > 0 ? s : 'N/A';
}

/**
 * Scrape une URL et retourne les données formatées pour remplir le tableau
 * Peut être appelé par le chat ou directement
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required and must be a string' },
        { status: 400 }
      );
    }

    console.log('📊 Scraping for table:', url);
    const context = await scrapeUrl(url);

    // context.rawCards a la forme: { card: Partial<Exhibitor>, detailUrl }
    const fromRawCards: Exhibitor[] = (context.rawCards || []).map((item, index) => {
      const c = item?.card ?? {};
      return {
        id: `exhibitor-${index}-${Date.now()}`,
        nom: asValue(c.nom),
        description: asValue(c.description),
        siteWeb: asValue(c.siteWeb),
        logo: asValue(c.logo),
        stand: asValue(c.stand),
        pays: asValue(c.pays),
        linkedin: asValue(c.linkedin),
        twitter: asValue(c.twitter),
        categories: asValue(c.categories),
        email: asValue(c.email),
        telephone: asValue(c.telephone),
      };
    });

    // Fallback: utiliser les cards Playwright si rawCards est vide/inutilisable
    const fromPlaywright: Exhibitor[] = (context.playwrightCards || []).map((p, index) => ({
      id: `playwright-${index}-${Date.now()}`,
      nom: asValue(p?.name),
      description: 'N/A',
      siteWeb: asValue(p?.href),
      logo: asValue(p?.logo),
      stand: 'N/A',
      pays: 'N/A',
      linkedin: 'N/A',
      twitter: 'N/A',
      categories: asValue(p?.categories),
      email: 'N/A',
      telephone: 'N/A',
    }));

    const hasUsefulRaw = fromRawCards.some((e) => e.nom !== 'N/A' || e.siteWeb !== 'N/A' || e.logo !== 'N/A');
    const exhibitors: Exhibitor[] = hasUsefulRaw ? fromRawCards : fromPlaywright;

    console.log(`✅ Formatted ${exhibitors.length} exhibitors for table`);

    return NextResponse.json(
      {
        success: true,
        url,
        count: exhibitors.length,
        exhibitors,
        source: context.usedPlaywright ? 'playwright' : 'static',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Fill table error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
