import * as cheerio from 'cheerio';
import { fetchWebsite, fetchWebsiteRendered, type PlaywrightCard } from './api';

export interface Exhibitor {
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
  /** internal – url vers la page détail, non exporté UI */
  _detailUrl?: string;
}

const BLANK: Exhibitor = {
  nom: 'N/A', description: 'N/A', siteWeb: 'N/A', logo: 'N/A',
  stand: 'N/A', pays: 'N/A', linkedin: 'N/A', twitter: 'N/A',
  categories: 'N/A', email: 'N/A', telephone: 'N/A',
};

// ─── Configuration ─────────────────────────────────────────────────────────────
const MAX_PAGES = 5;   // pages de liste max à suivre
const MAX_DETAIL_FETCH = 150; // pages détail à fetcher (couvre les grandes listes)
const DETAIL_BATCH = 6;   // requêtes simultanées max

// ─── URL helpers ───────────────────────────────────────────────────────────────

export function resolveUrl(href: string, base: string): string {
  if (!href || href === '#' || href.startsWith('javascript:') || href === 'N/A') return 'N/A';
  if (href.startsWith('http')) return href.split(/[?#]/)[0] || href;
  if (href.startsWith('//')) return 'https:' + href;
  try {
    const u = new URL(base);
    if (href.startsWith('/')) return u.origin + href;
    return new URL(href, u).href;
  } catch {
    return href;
  }
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export function extractNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);

  // 1. rel="next"
  const relNext = $('link[rel="next"], a[rel="next"]').attr('href');
  if (relNext) return resolveUrl(relNext, currentUrl);

  // 2. Bouton/lien « page suivante »
  const nextSelectors = [
    'a[class*="next"]:not([class*="prev"])',
    'a[aria-label*="next" i]',
    'a[aria-label*="suivant" i]',
    'a[title*="next" i]',
    'a[title*="suivant" i]',
    '.pagination a:last-child',
    'nav[class*="paginat"] a:last-child',
    '[class*="paginat"] [class*="next"]',
    '[class*="paginat"] [class*="suivant"]',
  ];

  for (const sel of nextSelectors) {
    const href = $(sel).first().attr('href');
    if (href && href !== '#') {
      const resolved = resolveUrl(href, currentUrl);
      if (resolved !== currentUrl) return resolved;
    }
  }

  return null;
}

// ─── Embedded JSON extraction ──────────────────────────────────────────────────

export function isExhibitorLike(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj as object).map(k => k.toLowerCase());
  // Anchored at start: prevents 'groupname', 'firstname', 'username' from matching 'name'.
  // 'GroupName' (CookieLaw) starts with 'group', not 'name' → correctly excluded.
  const hasStrongKey = keys.some(k =>
    /^(name|nom|company|exhibitor|stand|booth|brand|organization|organisation|participant)/i.test(k),
  );
  if (hasStrongKey) return true;
  // Accept if 2+ soft-match fields are present together (URL + description, email + city, etc.)
  const softCount = keys.filter(k =>
    /^(description|desc|website|url|linkedin|email|twitter|phone|telephone|logo|image|category|sector|pays|country|city|title)/i.test(k),
  ).length;
  return softCount >= 2;
}

function findExhibitorArray(val: unknown, visited = new WeakSet<object>(), depth = 0): unknown[] {
  if (depth > 10 || val === null || typeof val !== 'object') return [];
  const obj = val as object;
  if (visited.has(obj)) return [];
  visited.add(obj);

  if (Array.isArray(val)) {
    if (val.length >= 2 && val.every(isExhibitorLike)) return val;
    for (const item of val) {
      const found = findExhibitorArray(item, visited, depth + 1);
      if (found.length >= 2) return found;
    }
    return [];
  }

  const priority = ['exhibitors', 'companies', 'participants', 'stands', 'exposants', 'items', 'data', 'results', 'list'];
  const rec = val as Record<string, unknown>;
  for (const key of priority) {
    if (key in rec) {
      const found = findExhibitorArray(rec[key], visited, depth + 1);
      if (found.length >= 2) return found;
    }
  }
  for (const key of Object.keys(rec)) {
    if (priority.includes(key)) continue;
    const found = findExhibitorArray(rec[key], visited, depth + 1);
    if (found.length >= 2) return found;
  }
  return [];
}

export function extractEmbeddedJSON(html: string): unknown[] {
  const $ = cheerio.load(html);
  let best: unknown[] = [];

  const tryParse = (text: string) => {
    const t = text.trim();
    if (!t) return;
    try {
      const json = JSON.parse(t);
      const found = findExhibitorArray(json);
      if (found.length > best.length) best = found;
    } catch { }
  };

  $('script').each((_, el) => {
    const $el = $(el);
    const type = $el.attr('type') || '';
    const id = $el.attr('id') || '';
    const raw = $el.html() || '';
    if (!raw.trim()) return;

    if (type === 'application/ld+json' || id === '__NEXT_DATA__') { tryParse(raw); return; }

    if (raw.length > 200 && /exhibitor|company|participant|stand|exposant|booth/i.test(raw)) {
      const m = raw.match(/(?:=|:)\s*(\[[\s\S]{50,}\]|\{[\s\S]{50,}\})/);
      if (m) tryParse(m[1]);
    }
  });

  return best;
}

// ─── Cheerio : extraction fiable sans IA ──────────────────────────────────────
// Extrait uniquement ce qui est littéralement dans la page HTML

function pickFirst(...vals: (string | undefined | null)[]): string {
  for (const v of vals) {
    const s = (v || '').trim().replace(/\s+/g, ' ');
    if (s && s.length > 0) return s;
  }
  return 'N/A';
}

function firstLink($: cheerio.CheerioAPI, pattern: RegExp): string {
  let found = 'N/A';
  $('a[href]').each((_, el) => {
    if (found !== 'N/A') return false;
    const href = $(el).attr('href') || '';
    if (pattern.test(href)) { found = href; }
  });
  return found;
}

/**
 * Extrait les données structurées depuis une page détail d'exposant.
 * Ne retourne QUE ce qui est littéralement présent dans le HTML.
 */
export function extractFromDetailPage(html: string, detailUrl: string): Partial<Exhibitor> {
  const $ = cheerio.load(html);

  // Version sans header/nav/footer/aside : évite de ramasser les liens du salon
  // (LinkedIn du salon, pays du siège social du salon, etc.)
  const $c = cheerio.load(html);
  $c('header, nav, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  // ── Nom ──────────────────────────────────────────────────────────────────
  const nom = pickFirst(
    $('h1').first().text(),
    $('meta[property="og:site_name"]').attr('content'),
    $('meta[property="og:title"]').attr('content'),
    $('title').text().split(/[-|]/)[0],
  );

  // ── Logo ─────────────────────────────────────────────────────────────────
  // On cherche d'abord un <img> explicitement nommé « logo » dans le contenu,
  // puis un conteneur .logo > img, et seulement en dernier recours og:image
  // (qui est souvent le banner promotionnel du salon, pas le logo exposant).
  const logoSelectors = [
    'img[class*="logo"]', 'img[class*="Logo"]',
    'img[id*="logo"]', 'img[id*="Logo"]',
    'img[alt*="logo"]', 'img[alt*="Logo"]',
    'img[src*="logo"]', 'img[src*="Logo"]',
    '.logo img', '#logo img',
    '[class*="logo"] img', '[id*="logo"] img',
  ];
  let logoSrc = '';
  for (const sel of logoSelectors) {
    const el = $(sel).first();
    logoSrc = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || el.attr('data-original') || '';
    if (logoSrc) break;
  }
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const logo = pickFirst(logoSrc, ogImage);
  const logoResolved = logo !== 'N/A' ? resolveUrl(logo, detailUrl) : 'N/A';

  // ── Description ───────────────────────────────────────────────────────────
  // Priorité : section "Information" ou "About", puis meta desc
  const infoSection =
    $('[class*="description"],[class*="about"],[class*="information"],[class*="profil"],[class*="content"]')
      .first().text().trim().replace(/\s+/g, ' ');

  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

  // Prends metas ou section si elle a du texte > 20 chars et < 1500 chars
  const descCandidate = (infoSection.length > 20 && infoSection.length < 1500)
    ? infoSection
    : metaDesc;
  const description = descCandidate.length > 10 ? descCandidate.substring(0, 600) : 'N/A';

  // ── Stand / Location ──────────────────────────────────────────────────────
  // Cherche un élément dédié, puis regex dans le texte entier
  const standEl = $(
    '[class*="stand"],[class*="hall"],[class*="location"],[class*="booth"],[class*="pavilion"],[class*="emplacement"]',
  ).first().text().trim().replace(/\s+/g, ' ');

  const pageText = $('body').text().replace(/\s+/g, ' ');
  const standRegex = pageText.match(
    /\b(Hall\s+[\w\d]+[\s,/]+Stand\s+[\w\d]+|Stand\s+[\w\d]+|Booth\s+[\w\d]+|Hall\s+[\w\d]+|Pavillon\s+[\w\d]+)\b/i,
  );

  const stand = pickFirst(
    standEl.length > 2 && standEl.length < 80 ? standEl : null,
    standRegex?.[0],
  );

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailHref = firstLink($c, /^mailto:/i);
  const email = emailHref !== 'N/A' ? emailHref.replace(/^mailto:/i, '').split('?')[0].trim() : 'N/A';

  // ── Téléphone ─────────────────────────────────────────────────────────────
  const contentText = $c('body').text().replace(/\s+/g, ' ');
  const telHref = firstLink($c, /^tel:/i);
  const telRegex = contentText.match(/(?:\+|00)\d[\d\s\-().]{6,18}\d/);
  const telephone = telHref !== 'N/A'
    ? telHref.replace(/^tel:/i, '').trim()
    : (telRegex?.[0]?.trim() || 'N/A');

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  // Cherche d'abord dans la zone de contenu (sans header/footer du salon)
  // pour éviter de ramasser le LinkedIn du salon lui-même.
  let linkedin = firstLink($c, /linkedin\.com\/(?:company|in)\//i);
  if (linkedin === 'N/A') linkedin = firstLink($, /linkedin\.com\/(?:company|in)\//i);

  // ── Twitter / X ───────────────────────────────────────────────────────────
  let twitter = firstLink($c, /(?:twitter\.com|x\.com)\//i);
  if (twitter === 'N/A') twitter = firstLink($, /(?:twitter\.com|x\.com)\//i);

  // ── Site web externe ──────────────────────────────────────────────────────
  // Cherche un lien explicitement libellé "Website" ou "Site web" ou qui pointe vers un domaine externe
  let siteWeb = 'N/A';
  const baseOrigin = (() => { try { return new URL(detailUrl).origin; } catch { return ''; } })();

  $('a[href]').each((_, el) => {
    if (siteWeb !== 'N/A') return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const label = $a.text().toLowerCase().replace(/\s+/g, ' ').trim();
    const title = ($a.attr('title') || '').toLowerCase();

    if (!href.startsWith('http')) return;

    const isExternal = baseOrigin && !href.startsWith(baseOrigin);
    const isLabelledWebsite =
      /website|site web|visit|web\b/i.test(label) ||
      /website|site/i.test(title);

    if (isExternal && isLabelledWebsite) {
      siteWeb = href.split(/[?#]/)[0];
    }
  });

  // ── Pays ─────────────────────────────────────────────────────────────────
  // Cherche dans la zone de contenu pour éviter les pays du salon (siège, etc.).
  const countryEl = $c(
    '[class*="country"],[class*="pays"],[itemprop="addressCountry"],[itemprop="countryName"]',
  ).first().text().trim();

  const paysRegex = contentText.match(
    /\b(France|Germany|Deutschland|United Kingdom|UK|USA|United States|Spain|Espagne|Italy|Italie|Belgium|Belgique|Netherlands|Pays-Bas|Switzerland|Suisse|Japan|Japon|China|Chine|South Korea|Canada|Brazil|Brésil|India|Inde|Australia|Australie|Sweden|Suède|Norway|Norvège|Denmark|Danemark|Finland|Finlande|Portugal|Austria|Autriche|Poland|Pologne|Czech Republic|Romania|Roumanie|Turkey|Turquie|UAE|Émirats|Singapore|Singapour|Israel|Israël|Ireland|Irlande|Luxembourg|Hong Kong|Morocco|Maroc|Tunisia|Tunisie|Algeria|Algérie|South Africa|Afrique du Sud)\b/,
  );

  const pays = pickFirst(
    countryEl.length > 0 && countryEl.length < 60 ? countryEl : null,
    paysRegex?.[0],
  );

  // ── Catégories / Intérêts ─────────────────────────────────────────────────
  // Utilise la zone de contenu ($c) pour éviter les catégories de navigation.
  // Supprimé [class*="label"] (trop générique, capture les labels de formulaire).
  const catEls = $c(
    '[class*="tag"],[class*="categor"],[class*="interest"],[class*="badge"],[class*="chip"],[class*="thematic"],[class*="sector"],[class*="domain"],[class*="topic"],[class*="expertise"],[class*="solution"],[class*="product-type"]',
  );
  const categories = catEls
    .map((_, el) => $c(el).text().trim().replace(/\s+/g, ' '))
    .get()
    .filter(t => t.length > 1 && t.length < 80)
    .filter((v, i, a) => a.indexOf(v) === i)   // deduplicate
    .slice(0, 15)
    .join(', ') || 'N/A';

  return {
    nom,
    description,
    siteWeb,
    logo: logoResolved,
    stand,
    pays,
    linkedin,
    twitter,
    categories,
    email,
    telephone,
    _detailUrl: detailUrl,
  };
}

// ─── Cheerio card extraction (listing page) ────────────────────────────────────

const CARD_SELECTORS = [
  '[class*="exhibitor-card"]', '[class*="ExhibitorCard"]', '[class*="exhibitor_card"]',
  '[class*="company-card"]', '[class*="CompanyCard"]',
  '[class*="participant-card"]', '[class*="ParticipantCard"]',
  '[class*="booth-card"]',
  '[class*="exhibitor-item"]', '[class*="exhibitor_item"]',
  '[class*="company-item"]',
  'article[class]',
  '[class*="card"][class*="exhib"]',
  '[class*="card"][class*="company"]',
];

/**
 * Extrait les cards d'exposants d'une page liste.
 * Retourne { card, detailUrl } — seuls les champs visibles sur la card sont remplis.
 */
export function extractExhibitorCards(
  html: string,
  baseUrl: string,
): { card: Partial<Exhibitor>; detailUrl: string | null }[] {
  const $ = cheerio.load(html);
  const items: { card: Partial<Exhibitor>; detailUrl: string | null }[] = [];
  const seen = new Set<string>();

  const addCard = (
    name: string,
    logo: string,
    stand: string,
    detailHref: string,
    categories: string,
  ) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const detailUrl = detailHref ? resolveUrl(detailHref, baseUrl) : null;
    // siteWeb sur la card = détailUrl (la vraie page de la card sur le salon)
    // Il sera enrichi plus tard depuis la page détail
    items.push({
      card: { ...BLANK, nom: name, logo, stand, siteWeb: detailUrl ?? 'N/A', categories },
      detailUrl,
    });
  };

  // Strategy 1 — sélecteurs CSS connus
  for (const sel of CARD_SELECTORS) {
    const els = $(sel);
    if (els.length < 2) continue;

    els.each((_, el) => {
      const $el = $(el);

      const name = [
        $el.find('h1,h2,h3,h4,h5,h6').first().text(),
        $el.find('[class*="name"],[class*="Name"],[class*="title"],[class*="Title"],[class*="company"],[class*="Company"]').first().text(),
        $el.find('[itemprop="name"]').first().text(),
        $el.find('strong').first().text(),
      ].map(s => s.trim().replace(/\s+/g, ' ')).find(s => s.length > 0 && s.length < 120) || '';

      if (!name) return;

      const imgEl = $el.find('img').first();
      const logo = resolveUrl(
        imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '',
        baseUrl,
      );

      const standEl = $el.find('[class*="stand"],[class*="hall"],[class*="location"],[class*="booth"],[class*="pavilion"]').first().text().trim();
      const standRe = $el.text().match(/\b(Hall\s+[\w\d]+[\s,/]+Stand\s+[\w\d]+|Stand\s+[\w\d]+|Booth\s+[\w\d]+|Hall\s+[\w\d]+)/i);
      const stand = pickFirst(
        standEl.length > 0 && standEl.length < 80 ? standEl : null,
        standRe?.[0],
      );

      const href = $el.find('a[href]').first().attr('href') || $el.closest('a').attr('href') || '';

      const categories = $el
        .find('[class*="tag"],[class*="category"],[class*="interest"],[class*="badge"],[class*="label"],[class*="chip"]')
        .map((_, t) => $(t).text().trim())
        .get()
        .filter(t => t.length > 0 && t.length < 60)
        .join(', ') || 'N/A';

      addCard(name, logo, stand, href, categories);
    });

    if (items.length >= 3) break;
    items.length = 0;
    seen.clear();
  }

  // ── Strategy B : Classe CSS la plus répétée ──────────────────────────────────
  // Trouve la classe qui apparaît le plus souvent dans le DOM (hors classes utilitaires).
  // Sur une page liste, la classe de la card est répétée N fois. Sur une page détail, rien ne se répète.
  if (items.length === 0) {
    const classCounts = new Map<string, number>();
    $('[class]').each((_, el) => {
      const cls = ($(el).attr('class') || '').split(/\s+/);
      for (const c of cls) {
        if (c.length < 3) continue;
        // Ignore classes utilitaires Tailwind / Bootstrap / communes
        if (/^(flex|grid|col|row|block|inline|hidden|text-|bg-|p-|m-|w-|h-|border|rounded|shadow|hover:|focus:|sm:|md:|lg:|xl:|dark:|container|wrapper|inner|outer|section|layout|page|content|main|header|footer|nav|menu|item|link|btn|button|icon|image|img|span|div|ul|li|sr-only|absolute|relative|fixed|sticky|overflow|space-|gap-|z-|font-|leading-|tracking-|opacity-|transition|duration|ease)/.test(c)) continue;
        classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
      }
    });

    // Trie par fréquence décroissante, essaie les 10 classes les plus fréquentes
    const ranked = [...classCounts.entries()]
      .filter(([, n]) => n >= 4)
      .sort((a, b) => b[1] - a[1]);

    for (const [cls] of ranked.slice(0, 10)) {
      // CSS.escape n'existe pas en Node.js — on échappe manuellement les caractères spéciaux
      const escaped = cls.replace(/([^\w-])/g, '\\$1');
      const els = $(`.${escaped}`);
      if (els.length < 4) continue;

      const tryItems: typeof items = [];
      const trySeen = new Set<string>();

      els.each((_, el) => {
        const $el = $(el);
        const name = [
          $el.find('h1,h2,h3,h4,h5,h6').first().text(),
          $el.find('[class*="name"],[class*="Name"],[class*="title"],[class*="Title"],[class*="company"],[class*="Company"]').first().text(),
          $el.find('[itemprop="name"]').first().text(),
          $el.find('strong').first().text(),
          // data-content-name sur img : format "index|uuid|Name"
          (() => {
            const raw = $el.find('img[data-content-name]').first().attr('data-content-name') || '';
            const parts = raw.split('|');
            return parts.length >= 3 ? parts.slice(2).join('|') : '';
          })(),
        ].map(s => s.trim().replace(/\s+/g, ' ')).find(s => s.length > 1 && s.length < 120);

        if (!name) return;
        const key = name.toLowerCase();
        if (trySeen.has(key)) return;
        trySeen.add(key);

        const imgEl = $el.find('img').first();
        const logo = resolveUrl(
          imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '',
          baseUrl,
        );
        const standEl = $el.find('[class*="stand"],[class*="hall"],[class*="booth"],[class*="location"],[class*="pavilion"]').first().text().trim();
        const standRe = $el.text().match(/\b(Hall\s+[\w\d]+[\s,/]+Stand\s+[\w\d]+|Stand\s+[\w\d]+|Booth\s+[\w\d]+|Hall\s+[\w\d]+)/i);
        const stand = pickFirst(
          standEl.length > 0 && standEl.length < 80 ? standEl : null,
          standRe?.[0],
        );
        const href = $el.find('a[href]').first().attr('href') || $el.closest('a').attr('href') || '';
        const categories = $el
          .find('[class*="tag"],[class*="category"],[class*="interest"],[class*="badge"],[class*="chip"],[class*="sector"]')
          .map((_, t) => $(t).text().trim())
          .get()
          .filter(t => t.length > 0 && t.length < 60)
          .join(', ') || 'N/A';

        const detailUrl = href ? resolveUrl(href, baseUrl) : null;
        tryItems.push({
          card: { ...BLANK, nom: name, logo, stand, siteWeb: detailUrl ?? 'N/A', categories },
          detailUrl,
        });
      });

      if (tryItems.length >= 4) return tryItems;
    }
  }

  // ── Strategy C : Lignes de tableau ───────────────────────────────────────────
  if (items.length === 0) {
    let bestTable: typeof items = [];

    $('table').each((_, table) => {
      const $table = $(table);
      const headerCells = $table.find('thead th, thead td, tr:first-child th').map((_, th) => $(th).text().toLowerCase().trim()).get();
      const rows = $table.find('tbody tr');
      if (rows.length < 3) return;

      const nameIdx = headerCells.findIndex(h => /name|nom|company|soci[eé]t[eé]|entreprise|exhibitor|sponsor/i.test(h));
      const standIdx = headerCells.findIndex(h => /stand|hall|booth|location|emplacement/i.test(h));
      const countryIdx = headerCells.findIndex(h => /country|pays|nation/i.test(h));
      const catIdx = headerCells.findIndex(h => /categ|sector|tag|type|industry/i.test(h));

      const tableItems: typeof items = [];
      const tableSeen = new Set<string>();

      rows.each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        let name = '';
        if (nameIdx >= 0) {
          name = $(cells[nameIdx])?.text().trim() || '';
        } else {
          // Heuristique : première cellule contenant du texte de longueur raisonnable
          cells.each((_, cell) => {
            if (name) return false;
            const t = $(cell).text().trim();
            if (t.length > 2 && t.length < 120) name = t;
          });
        }
        if (!name || name.length < 2) return;
        const key = name.toLowerCase();
        if (tableSeen.has(key)) return;
        tableSeen.add(key);

        const stand = standIdx >= 0 ? ($(cells[standIdx])?.text().trim() || 'N/A') : 'N/A';
        const pays = countryIdx >= 0 ? ($(cells[countryIdx])?.text().trim() || 'N/A') : 'N/A';
        const cats = catIdx >= 0 ? ($(cells[catIdx])?.text().trim() || 'N/A') : 'N/A';
        const href = $row.find('a[href]').first().attr('href') || '';
        const logo = resolveUrl($row.find('img').first().attr('src') || '', baseUrl);
        const detailUrl = href ? resolveUrl(href, baseUrl) : null;

        tableItems.push({
          card: { ...BLANK, nom: name, logo, stand, pays, categories: cats, siteWeb: detailUrl ?? 'N/A' },
          detailUrl,
        });
      });

      if (tableItems.length > bestTable.length) bestTable = tableItems;
    });

    if (bestTable.length >= 3) return bestTable;
  }

  // ── Strategy D : Liens vers pages profil (pattern URL uniforme) ───────────────
  // Cherche des liens qui suivent tous le même préfixe de chemin (ex: /exhibitor/slug)
  // Seuil réduit à 5 pour accepter les petits salons
  if (items.length === 0) {
    const PROFILE_PATH_RE = /\/(exhibitors?|companies|compan(?:y|ies)|participants?|exposants?|members?|profiles?|stands?|booths?|sponsors?|fournisseurs?|partenaires?|appearances?|startups?|attendees?|speakers?)\/[^?#]*/i;
    const GENERIC_SLUG_RE = /^(all|list|pages?\d*|search|filter|directory|map|plan|hall|pavilion|pavilions|become|register|about|contact|faq|login|logout|newsletter|join|apply|submit|terms|privacy|cookie|news|press|media|agenda|program|schedule|keynote|award)/i;

    const profileLinks: { name: string; logo: string; href: string }[] = [];

    $('a[href]').each((_, el) => {
      const $el = $(el);
      const raw = $el.attr('href') || '';
      if (!raw) return;
      const full = raw.startsWith('http') ? raw : resolveUrl(raw, baseUrl);
      const match = full.match(PROFILE_PATH_RE) || raw.match(PROFILE_PATH_RE);
      if (!match) return;
      // Extrait le dernier segment du chemin pour vérifier si c'est un slug générique
      const slug = (full.split('?')[0] || '').replace(/\/$/, '').split('/').pop() || '';
      if (!slug || GENERIC_SLUG_RE.test(slug)) return;

      const imgEl = $el.find('img').first();
      const name = (imgEl.attr('alt') || $el.text()).trim().replace(/\s+/g, ' ');
      if (!name || name.length < 2 || name.length > 120) return;

      const logo = resolveUrl(imgEl.attr('src') || imgEl.attr('data-src') || '', baseUrl);
      profileLinks.push({ name, logo, href: raw });
    });

    if (profileLinks.length >= 5) {
      for (const { name, logo, href } of profileLinks) {
        addCard(name, logo, 'N/A', href, 'N/A');
      }
    }
  }

  // ── Strategy F : data-content-name attribute ─────────────────────────────────
  // Certaines plateformes (Web Summit, etc.) encodent les données dans
  // data-content-name="{index}|{uuid}|{Company Name}" sur les <img>.
  if (items.length === 0) {
    $('img[data-content-name]').each((_, el) => {
      const $img = $(el);
      const raw = $img.attr('data-content-name') || '';
      const parts = raw.split('|');
      // Format attendu: "1|uuid|Company Name"
      const name = (parts.length >= 3 ? parts.slice(2).join('|') : parts[parts.length - 1] || '').trim();
      if (!name || name.length < 2 || name.length > 120) return;

      const logo = resolveUrl($img.attr('src') || $img.attr('data-src') || '', baseUrl);

      // Remonte jusqu'au container (figure, article, ou élément avec classe Item/Card/Wrapper)
      const $container = $img.closest('figure, article, [class*="Item"], [class*="Card"], [class*="Wrapper"]');
      const href = $container.find('a[href]').first().attr('href')
        || $img.closest('a').attr('href')
        || '';

      // Catégorie : trouve le premier <span> ou <p> court dans le container
      const categories = $container.find('span, p')
        .map((_, sel) => $(sel).text().trim())
        .get()
        .filter(t => t.length > 1 && t.length < 80 && t !== name)
        .slice(0, 5)
        .join(', ') || 'N/A';

      addCard(name, logo, 'N/A', href, categories);
    });
  }

  // ── Strategy E : Liste simple <ul>/<ol> – liens avec préfixe commun ───────────
  // Pour les annuaires minimalistes : <ul><li><a href="/company/acme">Acme</a></li>...
  if (items.length === 0) {
    $('ul, ol').each((_, listEl) => {
      if (items.length >= 4) return false;
      const $list = $(listEl);
      const listItems = $list.children('li');
      if (listItems.length < 4) return;

      const hrefs: string[] = [];
      listItems.each((_, li) => {
        const href = $(li).find('a[href]').first().attr('href') || '';
        if (href && href !== '#') hrefs.push(href);
      });
      if (hrefs.length < 4) return;

      // Vérifie que les liens partagent un préfixe commun (même dossier)
      const getPrefix = (h: string) => {
        const p = (h.startsWith('http') ? new URL(h).pathname : h).split('/').slice(0, -1).join('/');
        return p;
      };
      const prefixCounts = new Map<string, number>();
      for (const h of hrefs) {
        const p = getPrefix(h);
        if (p && p !== '/') prefixCounts.set(p, (prefixCounts.get(p) ?? 0) + 1);
      }
      const commonPrefix = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!commonPrefix || commonPrefix[1] < Math.ceil(hrefs.length * 0.6)) return;

      // Exclut les menus de navigation courants (trop courts ou mots réservés)
      if (/^\/(fr|en|de|es|it|pt|nl|about|contact|news|blog|home|accueil|legal|terms|privacy)\/$/i.test(commonPrefix[0] + '/')) return;

      listItems.each((_, li) => {
        const $li = $(li);
        const $a = $li.find('a[href]').first();
        const href = $a.attr('href') || '';
        if (!href || getPrefix(href) !== commonPrefix[0]) return;

        const imgEl = $li.find('img').first();
        const name = (imgEl.attr('alt') || $a.text() || $li.text()).trim().replace(/\s+/g, ' ');
        if (!name || name.length < 2 || name.length > 120) return;

        const logo = resolveUrl(imgEl.attr('src') || imgEl.attr('data-src') || '', baseUrl);
        addCard(name, logo, 'N/A', href, 'N/A');
      });
    });
  }

  return items;
}

// ─── Enrichissement en parallèle (pages détail) ────────────────────────────────

async function fetchDetailBatch(
  batch: { card: Partial<Exhibitor>; detailUrl: string }[],
): Promise<Exhibitor[]> {
  return Promise.all(
    batch.map(async ({ card, detailUrl }) => {
      try {
        const html = await fetchWebsite(detailUrl);
        const detail = extractFromDetailPage(html, detailUrl);
        // Fusion : données détail prioritaires, sauf si la card avait déjà mieux
        return {
          ...BLANK,
          ...detail,
          // Conserve le nom de la card si le détail n'a rien trouvé de mieux
          nom: detail.nom !== 'N/A' ? detail.nom : (card.nom ?? 'N/A'),
          // Stand souvent plus précis sur la card du salon
          stand: card.stand !== 'N/A' ? card.stand : (detail.stand ?? 'N/A'),
          // Logo : préférer la page détail (meilleure qualité)
          logo: detail.logo !== 'N/A' ? detail.logo : (card.logo ?? 'N/A'),
          // Catégories souvent visibles sur le salon
          categories: card.categories !== 'N/A' ? card.categories : (detail.categories ?? 'N/A'),
        } as Exhibitor;
      } catch {
        // Si la page détail est inaccessible, on garde les données de la card
        return { ...BLANK, ...card } as Exhibitor;
      }
    }),
  );
}

// ─── Pagination : collecte toutes les pages d'une liste ───────────────────────

export async function fetchAllListingPages(
  firstHtml: string,
  firstUrl: string,
): Promise<{ allCards: { card: Partial<Exhibitor>; detailUrl: string | null }[]; pagesCount: number }> {
  let html = firstHtml;
  let url = firstUrl;
  const allCards: { card: Partial<Exhibitor>; detailUrl: string | null }[] = [];
  const seenUrls = new Set<string>([firstUrl]);
  let page = 0;

  while (page < MAX_PAGES) {
    const cards = extractExhibitorCards(html, url);
    allCards.push(...cards);
    page++;

    const nextUrl = extractNextPageUrl(html, url);
    if (!nextUrl || seenUrls.has(nextUrl)) break;
    seenUrls.add(nextUrl);

    try {
      html = await fetchWebsite(nextUrl);
      url = nextUrl;
    } catch {
      break;
    }
  }

  return { allCards, pagesCount: page };
}

// ─── Pipeline d'enrichissement complet ────────────────────────────────────────

export async function enrichCards(
  rawCards: { card: Partial<Exhibitor>; detailUrl: string | null }[],
): Promise<Exhibitor[]> {
  const withUrl = rawCards.filter(c => c.detailUrl !== null) as { card: Partial<Exhibitor>; detailUrl: string }[];
  const noUrl = rawCards.filter(c => c.detailUrl === null).map(c => ({ ...BLANK, ...c.card } as Exhibitor));

  const toFetch = withUrl.slice(0, MAX_DETAIL_FETCH);
  const enriched: Exhibitor[] = [];

  for (let i = 0; i < toFetch.length; i += DETAIL_BATCH) {
    const batch = toFetch.slice(i, i + DETAIL_BATCH);
    const results = await fetchDetailBatch(batch);
    enriched.push(...results);
  }

  // Les cartes au-delà de MAX_DETAIL_FETCH : on les garde sans enrichissement
  const notFetched = withUrl.slice(MAX_DETAIL_FETCH).map(c => ({ ...BLANK, ...c.card } as Exhibitor));

  return [...enriched, ...notFetched, ...noUrl];
}

// ─── Heuristic listing detection ──────────────────────────────────────────────

export function isListingPage(url: string, html: string, cardsCount: number): boolean {
  if (cardsCount >= 3) return true;

  // Mots-clés dans l'URL
  if (/exhibitor|exposant|directory|participant|companies|stands|booth|salon|liste|members?|sponsors?|fournisseur|annuaire|startups?|appearances?|attendees?/i.test(url)) return true;

  const $ = cheerio.load(html);

  // Mots-clés dans le titre ou h1
  const titleH1 = ($('title').text() + ' ' + $('h1').first().text()).toLowerCase();
  if (/exhibitor|exposant|directory|participant|companies|stands|liste des|salon|membres|annuaire|fournisseur/i.test(titleH1)) return true;

  // Tableau de données avec 4+ lignes → probablement un annuaire
  let hasDataTable = false;
  $('table').each((_, table) => {
    if ($(table).find('tbody tr').length >= 4) hasDataTable = true;
  });
  if (hasDataTable) return true;

  // Liste avec 8+ liens partageant un préfixe commun → annuaire de profils
  const allLiLinks: string[] = [];
  $('ul li a[href], ol li a[href]').each((_, a) => {
    const h = $(a).attr('href') || '';
    if (h && h !== '#' && !h.startsWith('javascript')) allLiLinks.push(h);
  });
  if (allLiLinks.length >= 8) {
    const prefixMap = new Map<string, number>();
    for (const h of allLiLinks) {
      const p = (h.startsWith('http') ? (() => { try { return new URL(h).pathname; } catch { return h; } })() : h)
        .split('/').slice(0, -1).join('/');
      if (p && p !== '/') prefixMap.set(p, (prefixMap.get(p) ?? 0) + 1);
    }
    const top = [...prefixMap.values()].sort((a, b) => b - a)[0] ?? 0;
    if (top >= 8) return true;
  }

  return false;
}

// ─── Context textuel pour Mistral (fallback uniquement) ───────────────────────

export function buildSinglePageContext(html: string, url: string): string {
  const $ = cheerio.load(html);
  $('script,style,noscript,iframe,svg').remove();

  const title = $('title').text().trim();
  const ogName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || '';

  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const h = $(el).attr('href') || '';
    if (/^(https?:|mailto:|tel:|linkedin\.com|twitter\.com|x\.com)/i.test(h)) links.push(h);
  });

  $('header,nav,footer,aside').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);

  return [
    `URL: ${url}`,
    `Titre: ${title}`,
    ogName ? `Nom (OG): ${ogName}` : '',
    metaDesc ? `Description meta: ${metaDesc}` : '',
    ogImage ? `Logo/Image: ${ogImage}` : '',
    links.length ? `Liens présents dans la page:\n${links.slice(0, 60).join('\n')}` : '',
    `Texte brut de la page:\n${bodyText}`,
  ].filter(Boolean).join('\n\n');
}

// ─── API endpoint discovery (for SPAs) ────────────────────────────────────────

/**
 * Scans the page HTML for potential JSON API endpoint URLs.
 * Tries Craft CMS/Statamic ?format=json, common /api/ paths, and fetch() calls in scripts.
 */
export function discoverApiEndpoints(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const candidates: string[] = [];
  const add = (u: string) => {
    if (!u || seen.has(u)) return;
    try { new URL(u); seen.add(u); candidates.push(u); } catch { }
  };

  const cleanBase = baseUrl.split('?')[0];

  // Craft CMS / Statamic: ?format=json returns the entry as JSON
  add(`${cleanBase}?format=json`);
  // Generic .json variant
  add(`${cleanBase}.json`);

  // Common API path prefixes
  try {
    const u = new URL(baseUrl);
    const path = u.pathname;
    add(`${u.origin}/api${path}`);
    add(`${u.origin}/api/v1${path}`);
    add(`${u.origin}/api/v2${path}`);
    // Next.js ISR data routes
    add(`${u.origin}/_next/data/${path.replace(/\/$/, '')}.json`);
  } catch { /* invalid URL */ }

  // Scan inline scripts for fetch() / XHR calls with exhibitor-like paths
  const scriptBlob: string[] = [];
  $('script:not([src])').each((_, el) => {
    const t = $(el).html() || '';
    if (t.length > 100) scriptBlob.push(t);
  });
  const allScripts = scriptBlob.join('\n');

  const regexps = [
    /fetch\(['"`]([^'"`\s]{5,200})['"`,]/gi,
    /url:\s*['"`]([^'"`\s]{5,200})['"`,]/gi,
    /['"`]((?:https?:\/\/[^'"`\s]{5,200}|\/api\/[^'"`\s]{3,200}))['"`,]/gi,
  ];
  for (const re of regexps) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(allScripts)) !== null) {
      const path = m[1];
      if (/exhibitor|company|compan|participant|sponsor|search|directory|exposant/i.test(path)) {
        try { const resolved = resolveUrl(path, baseUrl); if (resolved !== 'N/A') add(resolved); } catch { }
      }
    }
  }

  return candidates.slice(0, 8);
}

/**
 * Tries fetching a URL expecting a JSON array of exhibitor-like objects.
 * Returns the raw array if valid and exhibitor-like, null otherwise.
 */
export async function tryJsonEndpoint(apiUrl: string): Promise<Record<string, unknown>[] | null> {
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json') && !ct.includes('javascript')) return null;
    const data = await res.json() as unknown;
    // Navigate common wrapper shapes: {data: [...]} {results: [...]} {exhibitors: [...]} etc.
    let arr: unknown = data;
    if (!Array.isArray(arr)) {
      const d = data as Record<string, unknown>;
      arr = d?.data ?? d?.results ?? d?.items ?? d?.exhibitors
        ?? d?.entries ?? d?.companies ?? d?.participants ?? d?.sponsors ?? null;
    }
    if (!Array.isArray(arr) || arr.length < 2) return null;
    if (!arr.some(isExhibitorLike)) return null;
    return arr as Record<string, unknown>[];
  } catch {
    return null;
  }
}

// ─── Exports finaux ────────────────────────────────────────────────────────────

export interface ScrapeContext {
  isListing: boolean;
  rawCards: { card: Partial<Exhibitor>; detailUrl: string | null }[];
  embeddedJSON: unknown[];
  /** Tableaux JSON capturés par Playwright en interceptant les requêtes réseau */
  interceptedJson: Record<string, unknown>[][];
  /** Toutes les arrays JSON ≥10 items capturées (même non-exhibitor-like) */
  broadJson: Record<string, unknown>[][];
  /** Cards extraites directement du DOM vivant par Playwright (jamais hors SPA) */
  playwrightCards: PlaywrightCard[];
  html: string;
  url: string;
  /** true si le HTML a été rendu via Playwright (SPA) */
  usedPlaywright: boolean;
}

/**
 * Détecte si le HTML semble être un shell SPA vide (peu de texte visible, peu de liens).
 */
function hasUsableListingData(html: string, url: string): boolean {
  const cards = extractExhibitorCards(html, url);
  const embedded = extractEmbeddedJSON(html);

  return cards.length >= 5 || embedded.length > 0;
}

function isSpaShell(html: string): boolean {
  const $ = cheerio.load(html);
  $('script,style,noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const linkCount = $('a[href]').length;
  // Moins de 200 caractères de texte visible ET moins de 10 liens → shell vide
  return text.length < 200 && linkCount < 10;
}

export async function scrapeUrl(url: string): Promise<ScrapeContext> {
  let html: string;
  let interceptedJson: Record<string, unknown>[][] = [];
  let broadJson: Record<string, unknown>[][] = [];
  let playwrightCards: PlaywrightCard[] = [];
  let usedPlaywright = false;

  // -------------------------
  // 1. Fetch initial HTML
  // -------------------------
  try {
    html = await fetchWebsite(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Fallback direct Playwright si blocage réseau / anti-bot
    if (/403|429|RATE_LIMIT|cloudflare/i.test(msg)) {
      const rendered = await fetchWebsiteRendered(url);

      return {
        isListing: true,
        rawCards: extractExhibitorCards(rendered.html, url),
        embeddedJSON: extractEmbeddedJSON(rendered.html),
        interceptedJson: rendered.interceptedJson,
        broadJson: rendered.broadJson,
        playwrightCards: rendered.playwrightCards,
        html: rendered.html,
        url,
        usedPlaywright: true,
      };
    }

    throw e;
  }

  // -------------------------
  // 2. Détection listing
  // -------------------------
  const rawCards = extractExhibitorCards(html, url);
  const embeddedJSON = extractEmbeddedJSON(html);
  const isListing = isListingPage(url, html, rawCards.length);

  // -------------------------
  // 3. Fonction utilitaire
  // -------------------------
  function hasUsableListingData(html: string, url: string): boolean {
    const cards = extractExhibitorCards(html, url);
    const embedded = extractEmbeddedJSON(html);

    return cards.length >= 5 || embedded.length > 0;
  }

  // -------------------------
  // 4. Décision Playwright unique
  // -------------------------
  const shouldUsePlaywright =
    isListing && !hasUsableListingData(html, url);

  if (shouldUsePlaywright) {
    console.log('🚀 No usable data → forcing Playwright');

    try {
      const rendered = await fetchWebsiteRendered(url);

      html = rendered.html;
      interceptedJson = rendered.interceptedJson;
      broadJson = rendered.broadJson;
      playwrightCards = rendered.playwrightCards;
      usedPlaywright = true;
    } catch (e) {
      console.log('❌ Playwright failed, fallback to static HTML');
    }
  }

  // -------------------------
  // 5. Re-extraction après Playwright si utilisé
  // -------------------------
  const finalRawCards = extractExhibitorCards(html, url);
  const finalEmbeddedJSON = extractEmbeddedJSON(html);

  // -------------------------
  // 6. Logs debug
  // -------------------------
  console.log('--- SCRAPER DEBUG ---');
  console.log('URL:', url);
  console.log('Used Playwright:', usedPlaywright);
  console.log('Cards:', finalRawCards.length);
  console.log('Embedded JSON:', finalEmbeddedJSON.length);

  // -------------------------
  // 7. Return final context
  // -------------------------
  return {
    isListing,
    rawCards: finalRawCards,
    embeddedJSON: finalEmbeddedJSON,
    interceptedJson,
    broadJson,
    playwrightCards,
    html,
    url,
    usedPlaywright,
  };
}