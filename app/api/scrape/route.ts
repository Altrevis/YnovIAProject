import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Autorise jusqu'à 120 secondes pour les pages SPA (Playwright prend ~30-40s)
export const maxDuration = 120;
import {
  scrapeUrl,
  fetchAllListingPages,
  enrichCards,
  extractFromDetailPage,
  extractMwcDetailPage,
  isMwcExhibitorPage,
  extractAlgoliaConfig,
  discoverApiEndpoints,
  tryJsonEndpoint,
  isExhibitorLike,
  type Exhibitor,
  type AlgoliaConfig,
} from '@/lib/scraper';
import { fetchWebsite } from '@/lib/api';

// ─── LLM agentique ────────────────────────────────────────────────────────────
const llm = createOpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

// ─── Direct mapping from raw API JSON (no AI, no hallucination) ───────────────

function mapRawToExhibitor(raw: Record<string, unknown>): Exhibitor {
  // Exact match, puis fallback case-insensitive (gère les variantes camelCase comme DisplayName)
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = raw[k];
      if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    // Fallback case-insensitive
    const lk = keys.map(k => k.toLowerCase());
    for (const [rk, rv] of Object.entries(raw)) {
      if (lk.includes(rk.toLowerCase()) && typeof rv === 'string' && rv.trim()) return rv.trim();
    }
    return 'N/A';
  };

  // Handles { country: { name: "France" } } nested objects
  const getCountry = (): string => {
    const direct = get('pays', 'country', 'countryName', 'nation', 'countryCode',
      'country_name', 'country_code', 'paysLabel', 'paysName');
    if (direct !== 'N/A') return direct;
    for (const k of ['country', 'pays', 'nation', 'location']) {
      const v = raw[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        const name = o.name ?? o.label ?? o.code ?? o.isoCode ?? o.iso;
        if (name && typeof name === 'string') return name;
      }
    }
    return 'N/A';
  };

  const cats = (() => {
    for (const k of ['categories', 'tags', 'interests', 'sectors', 'themes', 'types',
      'thematic', 'thematics', 'sector', 'industries', 'topics', 'domains', 'solutions']) {
      const v = raw[k];
      if (Array.isArray(v)) {
        return v
          .map(x => {
            if (typeof x === 'string') return x;
            if (typeof x === 'object' && x !== null) {
              const o = x as Record<string, unknown>;
              return o.name ?? o.label ?? o.title ?? o.value ?? '';
            }
            return '';
          })
          .filter(Boolean)
          .join(', ') || 'N/A';
      }
      if (typeof v === 'string' && v) return v;
    }
    return 'N/A';
  })();

  return {
    nom: get('nom', 'name', 'title', 'company', 'exhibitor', 'companyName', 'organisationName',
      'organizationName', 'displayName', 'exhibitorName', 'brandName', 'label', 'firmName', 'companyLabel'),
    description: get('description', 'desc', 'about', 'summary', 'content', 'body', 'text',
      'shortDescription', 'longDescription', 'profileDescription', 'exhibitorDescription',
      'companyDescription', 'pitch', 'presentation', 'bio'),
    siteWeb: get('siteWeb', 'website', 'url', 'web', 'site', 'homepage', 'websiteUrl', 'siteUrl',
      'siteurl', 'companyWebsite', 'officialWebsite', 'externalUrl', 'webUrl', 'websiteLink'),
    logo: get('logo', 'image', 'thumbnail', 'photo', 'avatar', 'logoUrl', 'imageUrl',
      'picture', 'companyLogo', 'logoSrc', 'exhibitorLogo', 'profileImage', 'squareLogoUrl',
      'logoImageUrl', 'companyImage', 'mediaUrl'),
    stand: get('stand', 'booth', 'hall', 'location', 'emplacement', 'standNumber', 'boothNumber',
      'standNo', 'hallStand', 'boothId', 'standId', 'hallNumber', 'pavillon', 'pavilion',
      'boothLocation', 'standLocation', 'standLabel'),
    pays: getCountry(),
    linkedin: get('linkedin', 'linkedinUrl', 'linkedin_url', 'linkedIn', 'linkedInUrl',
      'linkedinProfile', 'linkedInProfile', 'linkedinLink'),
    twitter: get('twitter', 'twitterUrl', 'twitter_url', 'x', 'xUrl', 'twitterHandle',
      'twitterProfile', 'twitterLink'),
    categories: cats,
    email: get('email', 'mail', 'emailAddress', 'contactEmail', 'email_address',
      'companyEmail', 'businessEmail', 'contactMail'),
    telephone: get('telephone', 'phone', 'tel', 'phoneNumber', 'contactPhone',
      'phone_number', 'mobile', 'mobileNumber', 'companyPhone', 'contactTel'),
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

// ─── Nettoyage des champs partagés (organisateur du salon) ───────────────────
// Si un LinkedIn, Twitter, email ou téléphone apparaît chez >25% des exposants,
// c'est celui du salon (présent dans le footer de chaque page détail) → on l'efface.
function decontaminateSharedFields(exhibitors: Exhibitor[]): Exhibitor[] {
  if (exhibitors.length < 3) return exhibitors;

  const toRemove = new Map<keyof Exhibitor, Set<string>>();

  // linkedin/twitter/email/telephone: remove if shared by ≥25% of exhibitors (organizer footer)
  for (const field of ['linkedin', 'twitter', 'email', 'telephone'] as (keyof Exhibitor)[]) {
    const counts = new Map<string, number>();
    for (const e of exhibitors) {
      const v = e[field];
      if (v && v !== 'N/A') counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const dominated = new Set<string>();
    for (const [val, count] of counts) {
      if (count / exhibitors.length >= 0.25) dominated.add(val);
    }
    if (dominated.size > 0) toRemove.set(field, dominated);
  }

  // siteWeb: if more than 4 exhibitors share the same URL it's the organizer's site, not the company's
  {
    const counts = new Map<string, number>();
    for (const e of exhibitors) {
      if (e.siteWeb && e.siteWeb !== 'N/A') counts.set(e.siteWeb, (counts.get(e.siteWeb) ?? 0) + 1);
    }
    const dominated = new Set<string>();
    for (const [val, count] of counts) {
      if (count > 4) dominated.add(val);
    }
    if (dominated.size > 0) toRemove.set('siteWeb', dominated);
  }

  if (toRemove.size === 0) return exhibitors;

  return exhibitors.map(e => {
    const cleaned = { ...e };
    for (const [field, vals] of toRemove) {
      if (vals.has(cleaned[field] ?? '')) (cleaned as Record<string, string>)[field] = 'N/A';
    }
    return cleaned;
  });
}

// ─── Handler Algolia ──────────────────────────────────────────────────────────
// Algolia nécessite un POST avec un body JSON — un GET retourne toujours 400.
// On détecte l'URL, liste les index disponibles, et fait la requête correctement.

async function queryAlgoliaWithConfig(config: AlgoliaConfig): Promise<Exhibitor[] | null> {
  const { appId, apiKey, indexName } = config;

  const headers = {
    'X-Algolia-API-Key': apiKey,
    'X-Algolia-Application-Id': appId,
    'Content-Type': 'application/json',
  };

  // Build the list of indexes to try: named index first, then common fallbacks
  const candidates = [indexName, 'exhibitors', 'companies', 'participants', 'startups', 'products', 'brands']
    .filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

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

async function queryAlgolia(rawUrl: string): Promise<Exhibitor[] | null> {
  const parsed = new URL(rawUrl);
  const apiKey = parsed.searchParams.get('x-algolia-api-key');
  const appId  = parsed.searchParams.get('x-algolia-application-id');
  if (!apiKey || !appId) return null;
  return queryAlgoliaWithConfig({ appId, apiKey, indexName: '' });
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
      const exhibitors = decontaminateSharedFields(jsonData.map(mapRawToExhibitor));
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
      const clean = decontaminateSharedFields(exhibitors);
      return Response.json({ type: 'list', exhibitors: clean, count: clean.length, source: 'algolia' });
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

  // ─── Outils disponibles pour l'agent ─────────────────────────────────────────
  // L'agent décide QUE appeler et QUAND réessayer. Les outils extraient sans halluciner.

  const agentTools = {
    scrape_listing_page: tool({
      description: `Scrape une page liste d'exposants et retourne tous les exposants trouvés.
Utilise les stratégies disponibles dans l'ordre : JSON intercepté Playwright → DOM Playwright → cards cheerio + enrichissement → embedded JSON.
Retourne les champs : nom, logo, description, siteWeb, stand, pays, linkedin, twitter, categories, email, telephone.`,
      parameters: z.object({
        url: z.string().describe("URL de la page liste à scraper (utilise l'URL originale par défaut)"),
      }),
      execute: async ({ url: listUrl }) => {
        try {
          const c = await scrapeUrl(listUrl);

          // Priorité 0 : credentials Algolia détectés dans le HTML → interrogation API directe
          // (plus fiable que Playwright : pas de blocage anti-bot, pas de timeout JS)
          const algoliaConfig = extractAlgoliaConfig(c.html);
          if (algoliaConfig) {
            console.log('🔑 Algolia config found in page HTML:', algoliaConfig.appId, algoliaConfig.indexName);
            const exhibitors = await queryAlgoliaWithConfig(algoliaConfig);
            if (exhibitors && exhibitors.some(e => e.nom !== 'N/A')) {
              const clean = decontaminateSharedFields(exhibitors);
              return { success: true, count: clean.length, source: 'algolia-from-page', exhibitors: clean };
            }
          }

          // Priorité 1 : JSON XHR intercepté par Playwright
          if (c.interceptedJson.length > 0) {
            const best = c.interceptedJson
              .filter(arr => arr.some(isExhibitorLike))
              .sort((a, b) => b.length - a.length)[0];
            if (best) {
              const exhibitors = best.map(mapRawToExhibitor);
              if (exhibitors.some(e => e.nom !== 'N/A'))
                return { success: true, count: exhibitors.length, source: 'playwright-intercepted', exhibitors: decontaminateSharedFields(exhibitors) };
            }
          }

          // Priorité 2 : cards extraites du DOM vivant par Playwright
          if (c.playwrightCards.length >= 2) {
            const cards = c.playwrightCards.map(pc => ({
              card: {
                nom: pc.name, logo: pc.logo || 'N/A',
                categories: (pc.categories && pc.categories !== '#') ? pc.categories : 'N/A',
                siteWeb: pc.href || 'N/A',
                stand: 'N/A', pays: 'N/A', linkedin: 'N/A', twitter: 'N/A',
                description: 'N/A', email: 'N/A', telephone: 'N/A',
              },
              detailUrl: (pc.href && pc.href !== '#') ? pc.href : null,
            }));
            const enriched = await enrichCards(cards);
            const hasDeepData = enriched.some(e =>
              e.description !== 'N/A' || e.pays !== 'N/A' || e.email !== 'N/A' ||
              e.telephone !== 'N/A' || e.stand !== 'N/A' || e.linkedin !== 'N/A',
            );
            if (!isFooterContaminated(enriched) && hasDeepData) {
              const clean = decontaminateSharedFields(enriched.map(({ _detailUrl: _, ...rest }) => rest as Exhibitor));
              return { success: true, count: clean.length, source: 'playwright-dom', exhibitors: clean };
            }
          }

          // Priorité 3 : cards cheerio avec pagination + enrichissement détail
          const { allCards } = await fetchAllListingPages(c.html, listUrl);
          if (allCards.length >= 2) {
            const enriched = await enrichCards(allCards);
            if (!isFooterContaminated(enriched)) {
              const clean = decontaminateSharedFields(enriched.map(({ _detailUrl: _, ...rest }) => rest as Exhibitor));
              return { success: true, count: clean.length, source: 'cheerio+detail', exhibitors: clean };
            }
          }

          // Priorité 4 : JSON embarqué (__NEXT_DATA__, ld+json)
          if (c.embeddedJSON.length >= 2) {
            const exhibitors = decontaminateSharedFields((c.embeddedJSON as Record<string, unknown>[]).map(mapRawToExhibitor));
            if (exhibitors.some(e => e.nom !== 'N/A'))
              return { success: true, count: exhibitors.length, source: 'json-embedded', exhibitors };
          }

          // Priorité 5 : broad JSON (plateformes non-standard)
          if (c.broadJson.length > 0) {
            const candidates = c.broadJson.filter(arr => arr.length >= 5).sort((a, b) => b.length - a.length);
            for (const arr of candidates) {
              const exhibitors = decontaminateSharedFields(arr.map(mapRawToExhibitor));
              if (exhibitors.some(e => e.nom !== 'N/A'))
                return { success: true, count: exhibitors.length, source: 'playwright-broad-json', exhibitors };
            }
          }

          return {
            success: false, count: 0,
            message: 'Aucune donnée trouvée. La page est peut-être une SPA. Essaie discover_api_endpoints.',
            discoveredEndpoints: discoverApiEndpoints(c.html, listUrl),
          };
        } catch (e) {
          return { success: false, count: 0, message: String(e) };
        }
      },
    }),

    scrape_exhibitor_page: tool({
      description: `Scrape la page profil d'un seul exposant.
Extrait : nom, logo, description, siteWeb, stand, pays, linkedin, twitter, categories, email, telephone.
Utilise quand l'URL pointe vers la page d'une entreprise spécifique (pas une liste).`,
      parameters: z.object({
        url: z.string().describe("URL de la page profil d'un exposant"),
      }),
      execute: async ({ url: detailUrl }) => {
        try {
          const html = await fetchWebsite(detailUrl);
          // MWC Barcelona has a distinctive page structure — use dedicated parser
          const data = isMwcExhibitorPage(detailUrl)
            ? extractMwcDetailPage(html, detailUrl)
            : extractFromDetailPage(html, detailUrl);
          const { _detailUrl: _, ...clean } = data;
          return { success: true, exhibitor: clean };
        } catch (e) {
          return { success: false, message: String(e) };
        }
      },
    }),

    fetch_api_endpoint: tool({
      description: `Interroge un endpoint API JSON qui retourne des données d'exposants.
Utilise après discover_api_endpoints ou quand l'URL ressemble à une API REST.
Retourne les exposants avec mappage automatique des champs.`,
      parameters: z.object({
        url: z.string().describe("URL de l'endpoint API JSON à interroger"),
      }),
      execute: async ({ url: apiUrl }) => {
        try {
          const data = await tryJsonEndpoint(apiUrl);
          if (!data || data.length < 1)
            return { success: false, count: 0, message: 'Endpoint vide ou format non reconnu' };
          const exhibitors = data.map(mapRawToExhibitor);
          if (!exhibitors.some(e => e.nom !== 'N/A'))
            return { success: false, count: 0, message: 'Données présentes mais aucun nom d\'exposant identifié' };
          return { success: true, count: exhibitors.length, source: 'api-endpoint', exhibitors };
        } catch (e) {
          return { success: false, count: 0, message: String(e) };
        }
      },
    }),

    discover_api_endpoints: tool({
      description: `Analyse le code source d'une page pour découvrir des endpoints API JSON cachés.
Indispensable pour les SPAs (React, Vue, Angular) qui chargent les données dynamiquement.
Retourne une liste d'URLs candidates à passer ensuite à fetch_api_endpoint.`,
      parameters: z.object({
        url: z.string().describe("URL de la page dont on veut analyser les scripts"),
      }),
      execute: async ({ url: pageUrl }) => {
        try {
          const html = await fetchWebsite(pageUrl);
          const endpoints = discoverApiEndpoints(html, pageUrl);
          return { found: endpoints.length > 0, endpoints };
        } catch (e) {
          return { found: false, endpoints: [], message: String(e) };
        }
      },
    }),
  };

  // ─── Agent agentique ──────────────────────────────────────────────────────────
  // L'agent choisit ses outils, évalue les résultats, réessaie si nécessaire.
  // Il n'invente jamais de données : toute extraction passe par les outils.
  try {
    const agentResult = await generateText({
      model: llm('local-model'),
      tools: agentTools,
      maxSteps: 5,
      system: `Tu es un agent de scraping web spécialisé dans les salons professionnels et annuaires d'exposants.
Ton unique mission : extraire TOUTES les données d'exposants disponibles à cette URL.

STRATÉGIE (dans cet ordre) :
1. Si l'URL ressemble à une liste d'exposants → appelle scrape_listing_page.
2. Si l'URL ressemble à la page d'une entreprise → appelle scrape_exhibitor_page.
3. Si scrape_listing_page retourne success:false avec un message SPA →
   appelle discover_api_endpoints, puis fetch_api_endpoint pour chaque URL trouvée.
4. Arrête-toi dès qu'un outil retourne success:true avec count > 0 ou un exhibitor valide.

RÈGLE ABSOLUE : Tu ne génères JAMAIS de données textuelles toi-même.
Toute donnée retournée DOIT provenir d'un outil. N'invente rien.`,
      prompt: `URL cible : ${url}\n\nHint détection : isListing=${ctx.isListing}, rawCards=${ctx.rawCards.length}, playwrightCards=${ctx.playwrightCards.length}, interceptedJson=${ctx.interceptedJson.length}`,
    });

    // Collecte tous les résultats d'outils réussis (du plus récent au plus ancien)
    const allToolResults = agentResult.steps.flatMap(s => s.toolResults ?? []).reverse();

    for (const tr of allToolResults) {
      const out = tr.result as Record<string, unknown>;
      if (!out?.success) continue;

      if ('exhibitors' in out && Array.isArray(out.exhibitors) && (out.exhibitors as unknown[]).length > 0) {
        return Response.json({
          type: 'list',
          exhibitors: out.exhibitors,
          count: (out.exhibitors as unknown[]).length,
          source: out.source ?? 'agent',
        });
      }

      if ('exhibitor' in out && out.exhibitor) {
        return Response.json({ type: 'single', exhibitor: out.exhibitor, source: 'agent' });
      }
    }

    return Response.json({
      type: 'list',
      exhibitors: [],
      count: 0,
      error: 'L\'agent n\'a pas pu extraire de données. Ce site est probablement une SPA protégée.\n\n💡 Astuce : Ouvrez les DevTools (F12 → Réseau → Fetch/XHR), rechargez la page, copiez l\'URL de la requête qui renvoie les exposants en JSON — puis soumettez cette URL ici.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isBlocked = /403|429|RATE_LIMIT|cloudflare|captcha/i.test(msg);
    return Response.json(
      {
        error: isBlocked
          ? `Le site "${new URL(url).hostname}" bloque les robots (protection Cloudflare ou anti-bot). Essayez :\n1. Ouvrez la page dans votre navigateur\n2. Ouvrez les DevTools (F12) → onglet Réseau → filtre Fetch/XHR\n3. Rechargez la page et copiez l'URL de la requête API qui renvoie les exposants en JSON\n4. Soumettez cette URL API ici`
          : `Impossible de scraper "${url}"\nErreur : ${msg}`,
      },
      { status: 502 },
    );
  }
}
