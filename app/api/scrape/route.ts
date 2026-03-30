import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Autorise jusqu'à 120 secondes pour les pages SPA (Playwright prend ~30-40s)
export const maxDuration = 120;
import {
  scrapeUrl,
  fetchAllListingPages,
  enrichCards,
  buildSinglePageContext,
  extractFromDetailPage,
  discoverApiEndpoints,
  tryJsonEndpoint,
  isExhibitorLike,
  type Exhibitor,
} from '@/lib/scraper';

const llm = createOpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

// ─── Prompt anti-hallucination strict ─────────────────────────────────────────

const FIELDS_SCHEMA = `{
  "nom": "...",
  "description": "...",
  "siteWeb": "...",
  "logo": "...",
  "stand": "...",
  "pays": "...",
  "linkedin": "...",
  "twitter": "...",
  "categories": "...",
  "email": "...",
  "telephone": "..."
}`;

const ANTI_HALLUCINATION = `
RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE :
1. N'invente AUCUNE information. Chaque valeur retournée DOIT être literalement présente dans le texte fourni.
2. Si une information n'est pas explicitement dans le texte, écris "N/A". JAMAIS de supposition, jamais de complétion.
3. Ne génère pas de données vraisemblables. Une donnée "probable" mais non présente = "N/A".
4. Les URLs (siteWeb, logo, linkedin, twitter) doivent être copiées mot pour mot depuis les liens trouvés.
5. Une description inventée ou paraphrasée = "N/A". Utilise uniquement le texte vu dans la page.
6. Retourne UNIQUEMENT le JSON demandé. Pas de commentaire, pas de markdown, pas de texte autour.`;

const SINGLE_SYSTEM = `Tu es un extracteur de données d'entreprises. Tu reçois le contenu brut d'une page web.
Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans texte autour.
Champs à remplir :
${FIELDS_SCHEMA}
${ANTI_HALLUCINATION}`;

// ─── Parse JSON depuis la réponse Mistral ──────────────────────────────────────

function extractJSON(text: string): unknown | null {
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const md = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md) { try { return JSON.parse(md[1].trim()); } catch {} }
  const arr = t.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  const obj = t.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  return null;
}

// ─── Post-traitement : remplace les "N/A" déjà connus par des données cheerio ─

function mergeWithCheerio(
  fromMistral: Partial<Exhibitor>,
  fromCheerio: Partial<Exhibitor>,
): Exhibitor {
  const BLANK: Exhibitor = {
    nom: 'N/A', description: 'N/A', siteWeb: 'N/A', logo: 'N/A',
    stand: 'N/A', pays: 'N/A', linkedin: 'N/A', twitter: 'N/A',
    categories: 'N/A', email: 'N/A', telephone: 'N/A',
  };
  const result: Exhibitor = { ...BLANK };
  const keys = Object.keys(BLANK) as (keyof Exhibitor)[];
  for (const k of keys) {
    const m = (fromMistral as Record<string, string>)[k] ?? 'N/A';
    const c = (fromCheerio as Record<string, string>)[k] ?? 'N/A';
    // Cheerio est prioritaire car il ne peut pas halluciner
    result[k] = (c && c !== 'N/A') ? c : (m && m !== 'N/A' ? m : 'N/A');
  }
  return result;
}

// ─── Direct mapping from raw API JSON (no AI, no hallucination) ───────────────

function mapRawToExhibitor(raw: Record<string, unknown>): Exhibitor {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = raw[k];
      if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return 'N/A';
  };
  const cats = (() => {
    for (const k of ['categories', 'tags', 'interests', 'sectors', 'themes', 'types']) {
      const v = raw[k];
      if (Array.isArray(v)) {
        return v
          .map(x => (typeof x === 'object' && x !== null ? (x as { name?: string }).name ?? '' : String(x)))
          .filter(Boolean)
          .join(', ') || 'N/A';
      }
      if (typeof v === 'string' && v) return v;
    }
    return 'N/A';
  })();
  return {
    nom: get('nom', 'name', 'title', 'company', 'exhibitor', 'companyName', 'organisationName', 'label'),
    description: get('description', 'desc', 'about', 'summary', 'content', 'body', 'text'),
    siteWeb: get('siteWeb', 'website', 'url', 'web', 'site', 'homepage', 'websiteUrl', 'siteurl'),
    logo: get('logo', 'image', 'thumbnail', 'photo', 'avatar', 'logoUrl', 'imageUrl', 'picture'),
    stand: get('stand', 'booth', 'hall', 'location', 'emplacement', 'standNumber', 'boothNumber', 'standNo', 'hallStand'),
    pays: get('pays', 'country', 'countryName', 'nation', 'countryCode'),
    linkedin: get('linkedin', 'linkedinUrl', 'linkedin_url', 'linkedIn'),
    twitter: get('twitter', 'twitterUrl', 'twitter_url', 'x', 'xUrl'),
    categories: cats,
    email: get('email', 'mail', 'emailAddress', 'contactEmail'),
    telephone: get('telephone', 'phone', 'tel', 'phoneNumber', 'contactPhone'),
  };
}

// ─── Détection de contamination par le footer ────────────────────────────────────
// Si >50% des résultats partagent le même numéro de téléphone ou le même pays,
// ils proviennent tous du pied de page du site et ne sont pas de vrais exposants.
function isFooterContaminated(exhibitors: Exhibitor[]): boolean {
  if (exhibitors.length < 2) return false;

  const phoneCounts = new Map<string, number>();
  for (const e of exhibitors) {
    if (e.telephone !== 'N/A') {
      phoneCounts.set(e.telephone, (phoneCounts.get(e.telephone) ?? 0) + 1);
    }
  }
  for (const count of phoneCounts.values()) {
    if (count / exhibitors.length >= 0.5) return true;
  }

  // Noms qui ressemblent à des titres de page plutôt qu'à des noms d'entreprises
  const pageTitleLike = exhibitors.filter(e =>
    e.nom !== 'N/A' && (
      e.nom.split(' ').length > 6 ||
      /^(become|exhibitors? at|gsma|pavilion|digital planet|inscription|register|member|visit|book|explore)/i.test(e.nom)
    ),
  );
  return pageTitleLike.length / exhibitors.length >= 0.4;
}

// ─── Handler Algolia ──────────────────────────────────────────────────────────
// Algolia nécessite un POST avec un body JSON — un GET retourne toujours 400.
// On détecte l'URL, liste les index disponibles, et fait la requête correctement.

async function queryAlgolia(rawUrl: string): Promise<Exhibitor[] | null> {
  const parsed = new URL(rawUrl);
  const apiKey = parsed.searchParams.get('x-algolia-api-key');
  const appId  = parsed.searchParams.get('x-algolia-application-id');
  if (!apiKey || !appId) return null;

  const headers = {
    'X-Algolia-API-Key': apiKey,
    'X-Algolia-Application-Id': appId,
    'Content-Type': 'application/json',
  };

  // 1. Liste tous les index disponibles pour trouver celui des exposants
  let indexName: string | null = null;
  try {
    const listRes = await fetch(`https://${appId}-dsn.algolia.net/1/indexes`, { headers });
    if (listRes.ok) {
      const data = await listRes.json() as { items?: { name: string }[] };
      const items = data.items ?? [];
      // Préférence : index avec mot-clé exhibitor/company/participant/startup
      const preferred = items.find(i =>
        /exhibitor|company|compan|participant|startup|stand|brand|product/i.test(i.name),
      );
      indexName = preferred?.name ?? items[0]?.name ?? null;
    }
  } catch { /* on essaie quand même avec un index générique */ }

  // Si on n'a pas trouvé l'index, on essaie des noms communs
  const candidates = indexName
    ? [indexName]
    : ['exhibitors', 'companies', 'participants', 'startups', 'products', 'brands'];

  for (const idx of candidates) {
    try {
      const res = await fetch(
        `https://${appId}-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=${apiKey}&x-algolia-application-id=${appId}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requests: [{
              indexName: idx,
              params: new URLSearchParams({
                hitsPerPage: '1000',
                page: '0',
                attributesToRetrieve: '*',
              }).toString(),
            }],
          }),
        },
      );
      if (!res.ok) continue;
      const data = await res.json() as { results?: { hits?: Record<string, unknown>[] }[] };
      const hits = data.results?.[0]?.hits;
      if (hits && hits.length >= 1) {
        return hits.map(mapRawToExhibitor);
      }
    } catch { continue; }
  }

  return null;
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json();
  const url: string = body?.url ?? '';

  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json({ error: 'URL invalide' }, { status: 400 });
  }

  // ── JSON direct : l'URL pointe directement vers un fichier .json ou une API JSON ───
  // Cas fréquent : l'utilisateur copie l'URL d'une requête XHR depuis DevTools.
  // On essaie de l'interpréter directement comme données exposants avant tout le reste.
  if (/\.json(\?|$)/i.test(url) || /\/api\//i.test(url)) {
    const jsonData = await tryJsonEndpoint(url);
    if (jsonData && jsonData.length >= 1) {
      const exhibitors = jsonData.map(mapRawToExhibitor);
      const hasRealData = exhibitors.some(e => e.nom !== 'N/A');
      if (hasRealData) {
        return Response.json({ type: 'list', exhibitors, count: exhibitors.length, source: 'direct-json' });
      }
    }
    // Si c'est un .json mais pas de données exposants reconnaissables → erreur claire
    if (/\.json(\?|$)/i.test(url)) {
      return Response.json(
        { error: `L'URL JSON soumise ne contient pas de données d'exposants reconnaissables.\n\nCette URL semble pointer vers une ressource tierce (cookie consent, analytics, configuration, etc.).\n\n💡 Dans les DevTools (F12 → Réseau → XHR/Fetch), cherchez plutôt une requête dont la réponse contient des champs comme "name", "company", "stand", "country", etc.` },
        { status: 422 },
      );
    }
  }

  // ── Algolia : détecté avant tout autre traitement ─────────────────────────
  // L'URL Algolia requiert un POST avec body JSON — un simple fetch GET retourne 400.
  if (/algolia\.net\/1\/indexes/i.test(url)) {
    const exhibitors = await queryAlgolia(url);
    if (exhibitors && exhibitors.length > 0) {
      return Response.json({ type: 'list', exhibitors, count: exhibitors.length, source: 'algolia' });
    }
    return Response.json(
      { error: 'Impossible de récupérer les données Algolia. L\'index est peut-être vide ou l\'API key manque de permissions.' },
      { status: 502 },
    );
  }

  let ctx;
  try {
    ctx = await scrapeUrl(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isBlocked = /403|429|RATE_LIMIT|cloudflare|captcha/i.test(msg);
    return Response.json(
      {
        error: isBlocked
          ? `Le site "${new URL(url).hostname}" bloque les robots (protection Cloudflare ou anti-bot). Essayez :\n1. Ouvrez la page dans votre navigateur\n2. Ouvrez les DevTools (F12) → onglet Réseau → filtre Fetch/XHR\n3. Rechargez la page et copiez l'URL de la requête API qui renvoie les exposants en JSON\n4. Soumettez cette URL API ici`
          : `Impossible de récupérer "${url}"\nErreur : ${msg}`,
      },
      { status: 502 },
    );
  }

  const { isListing, rawCards, embeddedJSON, interceptedJson, playwrightCards, html } = ctx;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAS 1 : PAGE LISTE D'EXPOSANTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (isListing) {
    // 1a. JSON intercepté par Playwright (requêtes XHR/fetch réelles) — priorité maximale
    // On filtre pour ne garder que les arrays dont les objets ressemblent à des exposants,
    // et on vérifie qu'au moins un champ réel a été extrait (pas tout N/A).
    if (interceptedJson.length > 0) {
      const exhibitorArrays = interceptedJson
        .filter(arr => arr.some(isExhibitorLike))
        .sort((a, b) => b.length - a.length);
      const best = exhibitorArrays[0];
      if (best) {
        const exhibitors = best.map(mapRawToExhibitor);
        const hasRealData = exhibitors.some(e => e.nom !== 'N/A');
        if (hasRealData) {
          return Response.json({ type: 'list', exhibitors, count: exhibitors.length, source: 'playwright-intercepted' });
        }
      }
    }

    // 1a'. Cards extraites directement du DOM vivant par Playwright (page.evaluate)
    // C'est l'équivalent de BeautifulSoup sur le DOM rendu — 0 hallucination
    if (playwrightCards.length >= 2) {
      const cards = playwrightCards.map((c) => ({
        card: {
          nom: c.name,
          logo: c.logo || 'N/A',
          categories: c.categories || 'N/A',
          siteWeb: c.href || 'N/A',
          stand: 'N/A', pays: 'N/A', linkedin: 'N/A', twitter: 'N/A',
          description: 'N/A', email: 'N/A', telephone: 'N/A',
        },
        detailUrl: c.href || null,
      }));
      const enriched = await enrichCards(cards);
      if (!isFooterContaminated(enriched)) {
        const clean = enriched.map(({ _detailUrl: _, ...rest }) => rest as Exhibitor);
        return Response.json({ type: 'list', exhibitors: clean, count: clean.length, source: 'playwright-dom' });
      }
    }

    // 1b. Pagination + collecte toutes les pages
    let allCards = rawCards;
    if (rawCards.length > 0) {
      const { allCards: paginated } = await fetchAllListingPages(html, url);
      if (paginated.length > rawCards.length) allCards = paginated;
    }

    // 1b. Si on a des cards avec liens → enrichissement depuis pages détail (cheerio, sans IA)
    if (allCards.length >= 2) {
      const enriched = await enrichCards(allCards);
      // Vérifie que les données ne viennent pas du pied de page du site (même tel, même pays, noms génériques)
      if (!isFooterContaminated(enriched)) {
        const clean = enriched.map(({ _detailUrl: _, ...rest }) => rest as Exhibitor);
        return Response.json({
          type: 'list',
          exhibitors: clean,
          count: clean.length,
          source: 'cheerio+detail',
        });
      }
      // Contaminé → le site est probablement une SPA, on continue vers la découverte d'API
    }

    // 1c. Découverte d'API dans les scripts de la page (SPA/React/Vue)
    //     Mappage direct sans IA → zéro hallucination
    const apiEndpoints = discoverApiEndpoints(html, url);
    for (const apiUrl of apiEndpoints) {
      const jsonData = await tryJsonEndpoint(apiUrl);
      if (jsonData && jsonData.length >= 2) {
        const exhibitors = jsonData.map(mapRawToExhibitor);
        return Response.json({
          type: 'list',
          exhibitors,
          count: exhibitors.length,
          source: 'api-discovered',
        });
      }
    }

    // 1d. JSON embarqué dans les scripts de la page (ex: __NEXT_DATA__, ld+json)
    if (embeddedJSON.length >= 2) {
      const compact = JSON.stringify(embeddedJSON).substring(0, 8000);
      try {
        const { text } = await generateText({
          model: llm('local-model'),
          system: `Tu es un extracteur de données. Tu reçois des données JSON brutes d'un site de salon professionnel.
Retourne UNIQUEMENT un tableau JSON valide d'objets ayant exactement ces champs :
${FIELDS_SCHEMA}
${ANTI_HALLUCINATION}`,
          prompt: `URL: ${url}\n\nDonnées JSON brutes trouvées dans la page (ne retourne que ce qui est dedans) :\n${compact}`,
          maxTokens: 8000,
        });
        const data = extractJSON(text);
        if (Array.isArray(data) && data.length >= 1) {
          return Response.json({ type: 'list', exhibitors: data as Exhibitor[], count: data.length, source: 'json-embedded' });
        }
      } catch { /* fall through */ }
    }

    // Aucune donnée trouvée → le site est probablement une SPA (chargement JS dynamique)
    return Response.json({
      type: 'list',
      exhibitors: [],
      count: 0,
      error: 'Aucun exposant trouvé. Ce site charge ses données via JavaScript dynamique (SPA) et ne peut pas être scrappé directement.\n\n💡 Astuce : Ouvrez les DevTools du navigateur (F12 → onglet "Réseau" → filtre "Fetch/XHR"), rechargez la page, et copiez l\'URL de la requête API qui charge la liste des exposants — puis soumettez cette URL API ici.',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAS 2 : PAGE DÉTAIL D'UNE ENTREPRISE
  // ═══════════════════════════════════════════════════════════════════════════

  // 2a. Extraction cheerio directe (fiable, sans IA)
  const cheerioData = extractFromDetailPage(html, url);

  // 2b. Mistral complète UNIQUEMENT les champs que cheerio n'a pas pu remplir
  const missingFields = (Object.entries(cheerioData) as [string, string][])
    .filter(([k, v]) => k !== '_detailUrl' && v === 'N/A')
    .map(([k]) => k);

  if (missingFields.length > 0) {
    const context = buildSinglePageContext(html, url);
    try {
      const { text } = await generateText({
        model: llm('local-model'),
        system: SINGLE_SYSTEM,
        prompt: `${context}\n\nLes champs suivants n'ont pas pu être extraits automatiquement. Retourne UNIQUEMENT un JSON avec ces champs (les autres mets "N/A") : ${missingFields.join(', ')}`,
        maxTokens: 1000,
      });
      const mistralData = extractJSON(text) as Partial<Exhibitor> | null;
      if (mistralData && typeof mistralData === 'object' && !Array.isArray(mistralData)) {
        const merged = mergeWithCheerio(mistralData, cheerioData);
        const { _detailUrl: _, ...clean } = merged;
        return Response.json({ type: 'single', exhibitor: clean, source: 'cheerio+mistral' });
      }
    } catch { /* fall through */ }
  }

  const { _detailUrl: _, ...clean } = { ...cheerioData } as Exhibitor & { _detailUrl?: string };
  return Response.json({ type: 'single', exhibitor: clean, source: 'cheerio' });
}
