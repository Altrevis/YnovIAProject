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
 * Extracteur spécifique pour les pages profil Web Summit (/appearances/...).
 * Lit directement l'objet appearanceDetailsTemplate dans __NEXT_DATA__.
 */
function extractWebSummitAppearance(html: string): Partial<Exhibitor> | null {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const pp = (json?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
    const template = (((pp?.data as Record<string, unknown>)?.page as Record<string, unknown>)
      ?.template as Record<string, unknown>)?.customPage as Record<string, unknown>;
    const tplArr = template?.appearanceDetailsTemplate;
    if (!Array.isArray(tplArr)) return null;

    const profileItem = (tplArr as Record<string, unknown>[]).find(
      (item: Record<string, unknown>) => item?.details !== undefined,
    );
    if (!profileItem) return null;

    const details = (profileItem.details ?? {}) as Record<string, unknown>;
    const urls = (profileItem.externalUrls ?? {}) as Record<string, unknown>;
    const image = (profileItem.image ?? {}) as Record<string, unknown>;
    const tags = (Array.isArray(profileItem.tags) ? profileItem.tags : []) as Record<string, unknown>[];

    const s = (v: unknown): string =>
      v && typeof v === 'string' && (v as string).trim() ? (v as string).trim() : 'N/A';

    // Logo : sourceUrl ou première entrée du srcSet
    const logoSrcSet = typeof image.srcSet === 'string'
      ? (image.srcSet as string).split(',')[0].trim().split(' ')[0]
      : '';
    const logo = s(image.sourceUrl) !== 'N/A' ? s(image.sourceUrl) : (logoSrcSet || 'N/A');

    // Catégories : tags sans le flag pays, sinon champ industry
    const catTags = tags
      .filter(t => t.icon !== 'ws-flag' && typeof t.name === 'string')
      .map(t => t.name as string);
    const categories = catTags.length > 0
      ? catTags.join(', ')
      : (s(details.industry) !== 'N/A' ? s(details.industry) : 'N/A');

    // Pays : tag avec icon ws-flag, sinon details.country
    const countryTag = tags.find(t => t.icon === 'ws-flag');
    const pays = (countryTag && s(countryTag.name) !== 'N/A')
      ? s(countryTag.name)
      : s(details.country);

    // Description : elevatorPitch (pitch court Web Summit) ou bio
    const description = s(details.elevatorPitch) !== 'N/A'
      ? s(details.elevatorPitch)
      : s(details.bio);

    // Twitter/X : Web Summit stocke Twitter dans le champ 'x'
    const twitter = s(urls.x) !== 'N/A' ? s(urls.x) : s(urls.twitter);

    return {
      nom: s(details.name),
      description,
      siteWeb: s(urls.website),
      logo,
      linkedin: s(urls.linkedin),
      twitter,
      categories,
      pays,
      stand: 'N/A',
      email: 'N/A',
      telephone: 'N/A',
    };
  } catch {
    return null;
  }
}

/**
 * Tente d'extraire un objet exposant unique depuis __NEXT_DATA__ (pages Next.js).
 * Retourne null si la page n'est pas Next.js ou si aucun objet pertinent n'est trouvé.
 */
function extractNextDataObj(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const pageProps = json?.props?.pageProps;
    if (!pageProps || typeof pageProps !== 'object') return null;
    const pp = pageProps as Record<string, unknown>;
    // Cherche d'abord sous des clés connues de pages profil
    for (const key of ['company', 'exhibitor', 'participant', 'appearance', 'startup', 'brand', 'profile', 'speaker', 'attendee', 'member']) {
      const val = pp[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
    }
    // Fallback : pageProps lui-même s'il ressemble à un exposant
    if (isExhibitorLike(pp)) return pp;
  } catch { /* JSON invalide ou absent */ }
  return null;
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
  // Priorité décroissante : img logo explicite → og:image → apple-touch-icon → favicon
  const logoSelectors = [
    'img[class*="logo"]', 'img[class*="Logo"]',
    'img[id*="logo"]',   'img[id*="Logo"]',
    'img[alt*="logo"]',  'img[alt*="Logo"]',
    'img[src*="logo"]',  'img[src*="Logo"]',
    '.logo img', '#logo img',
    '[class*="logo"] img', '[id*="logo"] img',
    '[class*="brand"] img', '[class*="Brand"] img',
    'header img', '.header img',
    '[class*="company"] img', '[class*="exhibitor"] img',
  ];
  let logoSrc = '';
  for (const sel of logoSelectors) {
    const el = $(sel).first();
    // Essaie src, data-src, data-lazy-src, data-original, et la 1ère entrée de srcset
    const srcset = el.attr('srcset') || '';
    const srcsetFirst = srcset ? srcset.split(',')[0].trim().split(' ')[0] : '';
    logoSrc = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || el.attr('data-original') || srcsetFirst || '';
    if (logoSrc && !logoSrc.startsWith('data:')) break;
  }
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  // Icône Apple touch (souvent le logo carré de l'entreprise)
  const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href')
    || $('link[rel="apple-touch-icon-precomposed"]').attr('href') || '';
  const faviconHref = $('link[rel="icon"][type="image/png"]').attr('href')
    || $('link[rel="shortcut icon"][type="image/png"]').attr('href') || '';
  const logo = pickFirst(
    logoSrc && !logoSrc.startsWith('data:') ? logoSrc : '',
    ogImage,
    appleTouchIcon,
    faviconHref,
  );
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
  // Cherche un lien explicitement libellé "Website" ou pointant vers un domaine externe
  let siteWeb = 'N/A';
  const baseOrigin = (() => { try { return new URL(detailUrl).origin; } catch { return ''; } })();

  // 1. Cherche via attribut rel="external" ou classe/id explicite
  const relExternal = $('a[rel="external"][href^="http"], a[class*="website"][href^="http"], a[class*="web-site"][href^="http"]').first().attr('href') || '';
  if (relExternal && (!baseOrigin || !relExternal.startsWith(baseOrigin))) {
    siteWeb = relExternal.split(/[?#]/)[0];
  }

  if (siteWeb === 'N/A') {
    $('a[href]').each((_, el) => {
      if (siteWeb !== 'N/A') return false;
      const $a = $(el);
      const href = $a.attr('href') || '';
      const label = $a.text().toLowerCase().replace(/\s+/g, ' ').trim();
      const title = ($a.attr('title') || '').toLowerCase();
      const ariaLabel = ($a.attr('aria-label') || '').toLowerCase();

      if (!href.startsWith('http')) return;

      const isExternal = baseOrigin && !href.startsWith(baseOrigin);
      const isLabelledWebsite =
        /website|site web|site officiel|visit|web\b|homepage|accueil/i.test(label) ||
        /website|site/i.test(title) ||
        /website|site web/i.test(ariaLabel);

      if (isExternal && isLabelledWebsite) {
        siteWeb = href.split(/[?#]/)[0];
      }
    });
  }

  // ── Pays ─────────────────────────────────────────────────────────────────
  // Cherche dans la zone de contenu pour éviter les pays du salon (siège, etc.).
  const countryEl = $c(
    '[class*="country"],[class*="pays"],[itemprop="addressCountry"],[itemprop="countryName"]',
  ).first().text().trim();

  const paysRegex = contentText.match(
    /\b(France|Germany|Deutschland|United Kingdom|UK|USA|United States of America|United States|Spain|Espagne|España|Italy|Italie|Italia|Belgium|Belgique|België|Netherlands|Pays-Bas|Nederland|Switzerland|Suisse|Schweiz|Svizzera|Japan|Japon|Japon|China|Chine|Chína|South Korea|Korea|République de Corée|Canada|Brazil|Brésil|Brasil|India|Inde|Australia|Australie|Sweden|Suède|Sverige|Norway|Norvège|Norge|Denmark|Danemark|Danmark|Finland|Finlande|Suomi|Portugal|Austria|Autriche|Österreich|Poland|Pologne|Polska|Czech Republic|Czechia|Romania|Roumanie|România|Turkey|Turquie|Türkiye|UAE|United Arab Emirates|Émirats Arabes Unis|Émirats|Singapore|Singapour|Israel|Israël|Ireland|Irlande|Luxembourg|Hong Kong|Morocco|Maroc|Tunisia|Tunisie|Algeria|Algérie|South Africa|Afrique du Sud|Argentina|Argentine|Mexico|Mexique|Chile|Chili|Colombia|Colombie|Indonesia|Indonésie|Malaysia|Malaisie|Thailand|Thaïlande|Vietnam|Philippines|Pakistan|Egypt|Égypte|Nigeria|Kenya|Ghana|Senegal|Sénégal|Ivory Coast|Côte d'Ivoire|Cameroon|Cameroun|Croatia|Croatie|Serbia|Serbie|Hungary|Hongrie|Slovakia|Slovaquie|Ukraine|Greece|Grèce|Bulgaria|Bulgarie|Lithuania|Lituanie|Latvia|Lettonie|Estonia|Estonie|New Zealand|Nouvelle-Zélande|Iceland|Islande|Malta|Malte|Cyprus|Chypre|Qatar|Kuwait|Koweït|Saudi Arabia|Arabie Saoudite|Bahrain|Bahreïn|Jordan|Jordanie|Lebanon|Liban)\b/i,
  );

  const pays = pickFirst(
    countryEl.length > 0 && countryEl.length < 60 ? countryEl : null,
    paysRegex?.[0],
  );

  // ── Catégories / Intérêts ─────────────────────────────────────────────────
  // Utilise la zone de contenu ($c) pour éviter les catégories de navigation.
  const catEls = $c(
    '[class*="tag"],[class*="categor"],[class*="interest"],[class*="badge"],[class*="chip"],' +
    '[class*="thematic"],[class*="sector"],[class*="domain"],[class*="topic"],[class*="expertise"],' +
    '[class*="solution"],[class*="product-type"],[class*="keyword"],[class*="industry"],' +
    '[class*="activity"],[class*="filière"],[class*="vertical"],[class*="market"],' +
    '[data-tag],[data-category],[data-sector],[data-topic]',
  );
  const categories = catEls
    .map((_, el) => $c(el).text().trim().replace(/\s+/g, ' '))
    .get()
    .filter(t => t.length > 1 && t.length < 80)
    .filter((v, i, a) => a.indexOf(v) === i)   // deduplicate
    .slice(0, 15)
    .join(', ') || 'N/A';

  // ── Fallback __NEXT_DATA__ pour les pages Next.js ────────────────────────────
  // Priorité 1 : extracteur spécifique Web Summit (appearanceDetailsTemplate)
  // Priorité 2 : extracteur générique (pageProps.company / pageProps.exhibitor / etc.)
  // « prefer » : garde la valeur CSS si elle est réelle, sinon prend la valeur JSON.
  const prefer = (cssVal: string, jsonVal: string | undefined): string =>
    cssVal !== 'N/A' ? cssVal : (jsonVal && jsonVal !== 'N/A' ? jsonVal : 'N/A');

  const wsData = extractWebSummitAppearance(html);
  if (wsData) {
    return {
      nom:         prefer(nom,         wsData.nom),
      description: prefer(description, wsData.description),
      siteWeb:     prefer(siteWeb,     wsData.siteWeb),
      logo:        prefer(logoResolved, wsData.logo),
      stand,
      pays:        prefer(pays,        wsData.pays),
      linkedin:    prefer(linkedin,    wsData.linkedin),
      twitter:     prefer(twitter,     wsData.twitter),
      categories:  prefer(categories,  wsData.categories),
      email,
      telephone,
      _detailUrl: detailUrl,
    };
  }

  // Extracteur générique pour les autres sites Next.js
  const nextObj = extractNextDataObj(html);
  const nextFill = (current: string, ...keys: string[]): string => {
    if (current !== 'N/A' || !nextObj) return current;
    for (const k of keys) {
      const v = nextObj[k];
      if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    const lk = keys.map(k => k.toLowerCase());
    for (const [rk, rv] of Object.entries(nextObj)) {
      if (lk.includes(rk.toLowerCase()) && typeof rv === 'string' && rv.trim()) return rv.trim();
    }
    return 'N/A';
  };
  const nextCats = (() => {
    if (categories !== 'N/A' || !nextObj) return categories;
    for (const k of ['categories', 'tags', 'interests', 'sectors', 'themes', 'thematics', 'thematic', 'sector', 'topics', 'domains', 'solutions', 'industries']) {
      const v = nextObj[k];
      if (Array.isArray(v)) {
        const joined = v
          .map(x => {
            if (typeof x === 'string') return x;
            if (typeof x === 'object' && x !== null) {
              const o = x as Record<string, unknown>;
              return o.name ?? o.label ?? o.title ?? o.value ?? '';
            }
            return '';
          })
          .filter(Boolean)
          .join(', ');
        if (joined) return joined;
      }
      if (typeof v === 'string' && v) return v;
    }
    return 'N/A';
  })();

  const nextPays = (() => {
    const direct = nextFill(pays, 'country', 'pays', 'countryName', 'nation', 'country_name');
    if (direct !== 'N/A') return direct;
    if (!nextObj || pays !== 'N/A') return pays;
    for (const k of ['country', 'pays', 'nation', 'location']) {
      const v = nextObj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        const name = o.name ?? o.label ?? o.code;
        if (name && typeof name === 'string') return name;
      }
    }
    return pays;
  })();

  return {
    nom: nextFill(nom, 'name', 'nom', 'company', 'displayName', 'exhibitorName', 'companyName', 'brandName', 'title'),
    description: nextFill(description, 'description', 'desc', 'about', 'summary', 'shortDescription', 'longDescription', 'bio', 'pitch', 'presentation', 'profileDescription'),
    siteWeb: nextFill(siteWeb, 'website', 'url', 'siteWeb', 'websiteUrl', 'externalUrl', 'web', 'homepage'),
    logo: nextFill(logoResolved, 'logo', 'image', 'logoUrl', 'imageUrl', 'squareLogoUrl', 'thumbnail', 'photo', 'avatar'),
    stand: nextFill(stand, 'stand', 'booth', 'hall', 'standNumber', 'boothNumber', 'standId', 'boothId'),
    pays: nextPays,
    linkedin: nextFill(linkedin, 'linkedin', 'linkedinUrl', 'linkedIn', 'linkedInUrl', 'linkedinProfile'),
    twitter: nextFill(twitter, 'twitter', 'twitterUrl', 'x', 'xUrl', 'twitterProfile'),
    categories: nextCats,
    email: nextFill(email, 'email', 'mail', 'emailAddress', 'contactEmail', 'companyEmail', 'businessEmail'),
    telephone: nextFill(telephone, 'phone', 'telephone', 'tel', 'phoneNumber', 'contactPhone', 'mobile'),
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
      const srcset1 = (imgEl.attr('srcset') || '').split(',')[0].trim().split(' ')[0];
      const logo = resolveUrl(
        imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('data-original') || srcset1 || '',
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
      // Accented "catégories" → cat[eé]g to match both ASCII and accented variants
      const catIdx = headerCells.findIndex(h => /cat[eé]g|sector|tag|type|industry|filière|thematic/i.test(h));
      const emailIdx = headerCells.findIndex(h => /email|mail|courriel/i.test(h));
      const telIdx = headerCells.findIndex(h => /t[eé]l[eé]?phone|\bt[eé]l\b|phone|mobile/i.test(h));
      const linkedinIdx = headerCells.findIndex(h => /linkedin/i.test(h));
      const siteWebIdx = headerCells.findIndex(h => /site\s*web|website|\bsite\b|\bweb\b/i.test(h));

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

        // Email : extrait href mailto ou texte brut
        const emailCell = emailIdx >= 0 ? $(cells[emailIdx]) : null;
        const email = emailCell
          ? (emailCell.find('a[href^="mailto:"]').attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim()
            || emailCell.text().trim()
            || 'N/A')
          : 'N/A';

        // Téléphone : extrait href tel: ou texte brut
        const telCell = telIdx >= 0 ? $(cells[telIdx]) : null;
        const telephone = telCell
          ? (telCell.find('a[href^="tel:"]').attr('href')?.replace(/^tel:/i, '').trim()
            || telCell.text().trim()
            || 'N/A')
          : 'N/A';

        // LinkedIn : extrait href du lien
        const linkedinCell = linkedinIdx >= 0 ? $(cells[linkedinIdx]) : null;
        const linkedin = linkedinCell
          ? (linkedinCell.find('a[href]').attr('href')?.trim() || 'N/A')
          : 'N/A';

        // Site web : extrait href du lien dans la cellule dédiée
        const siteWebCell = siteWebIdx >= 0 ? $(cells[siteWebIdx]) : null;
        const siteWebFromCol = siteWebCell
          ? (siteWebCell.find('a[href^="http"]').attr('href')?.split(/[?#]/)[0].trim() || 'N/A')
          : 'N/A';

        // detailUrl : préférer un lien interne dans la cellule du nom, sinon 1er lien de la ligne
        const nameHref = nameIdx >= 0 ? ($(cells[nameIdx])?.find('a[href]').first().attr('href') || '') : '';
        const firstRowHref = $row.find('a[href]').first().attr('href') || '';
        const rawDetailHref = nameHref || firstRowHref;
        const baseOriginForTable = (() => { try { return new URL(baseUrl).origin; } catch { return ''; } })();
        const resolvedHref = rawDetailHref ? resolveUrl(rawDetailHref, baseUrl) : '';
        // N'utilise comme detailUrl qu'un lien interne au même domaine
        const detailUrl = resolvedHref && baseOriginForTable && resolvedHref.startsWith(baseOriginForTable)
          ? resolvedHref
          : null;

        const logo = resolveUrl($row.find('img').first().attr('src') || $row.find('img').first().attr('data-src') || '', baseUrl);

        tableItems.push({
          card: {
            ...BLANK,
            nom: name,
            logo,
            stand,
            pays,
            categories: cats,
            email,
            telephone,
            linkedin,
            siteWeb: siteWebFromCol !== 'N/A' ? siteWebFromCol : (detailUrl ?? 'N/A'),
          },
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
        // Use site-specific parsers when available
        const detail = isMwcExhibitorPage(detailUrl)
          ? extractMwcDetailPage(html, detailUrl)
          : extractFromDetailPage(html, detailUrl);
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

// ─── Algolia credential detection ─────────────────────────────────────────────

export interface AlgoliaConfig {
  appId: string;
  apiKey: string;
  indexName: string;
}

/**
 * Scans page HTML for Algolia credentials (application ID + search API key + index name).
 * Generic — works for any Algolia-powered site regardless of framework.
 *
 * Detection order:
 *   1. JSON inside data-props / data-settings / data-algolia / data-search-config attributes
 *   2. Individual data-algolia-* attributes on any element
 *   3. Inline <script> content (variable assignments and object literals)
 */
export function extractAlgoliaConfig(html: string): AlgoliaConfig | null {
  const $ = cheerio.load(html);
  let appId = '', apiKey = '', indexName = '';

  const s = (v: unknown): string => (v && typeof v === 'string' ? v.trim() : '');

  // Strategy 1 — JSON in data-* attributes
  $('[data-props],[data-settings],[data-algolia],[data-search-config],[data-widget-props]').each((_, el) => {
    if (appId && apiKey) return false;
    const $el = $(el);
    for (const attr of ['data-props', 'data-settings', 'data-algolia', 'data-search-config', 'data-widget-props']) {
      const raw = $el.attr(attr) || '';
      if (!raw || !/algolia/i.test(raw)) continue;
      try {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        appId    = appId    || s(obj.algoliaAppId)         || s(obj.appId)         || s(obj.applicationId) || s(obj.app_id);
        apiKey   = apiKey   || s(obj.algoliaSearchApiKey)  || s(obj.searchApiKey)  || s(obj.searchKey)     || s(obj.apiKey) || s(obj.api_key);
        indexName = indexName || s(obj.indexName)           || s(obj.index)         || s(obj.algoliaIndex)  || s(obj.index_name);
      } catch { /* malformed JSON, ignore */ }
    }
    // Also check flattened data-* attributes
    if (!appId)     appId     = $el.attr('data-algolia-app-id')     || $el.attr('data-app-id')         || '';
    if (!apiKey)    apiKey    = $el.attr('data-algolia-api-key')     || $el.attr('data-search-api-key') || '';
    if (!indexName) indexName = $el.attr('data-algolia-index')       || $el.attr('data-index-name')     || '';
  });

  // Strategy 2 — inline <script> scanning
  if (!appId || !apiKey) {
    $('script:not([src])').each((_, el) => {
      if (appId && apiKey) return false;
      const text = $(el).html() || '';
      if (!text || !/algolia/i.test(text) || text.length < 20) return;

      const appMatch = text.match(/(?:appId|applicationId|app_id)\s*[:=]\s*['"`]([A-Z0-9]{6,12})['"`]/i);
      const keyMatch = text.match(/(?:searchApiKey|searchOnlyApiKey|searchKey|apiKey|api_key)\s*[:=]\s*['"`]([a-f0-9]{20,40})['"`]/i);
      const idxMatch = text.match(/(?:indexName|index_name|index)\s*[:=]\s*['"`]([^'"`\s]{3,60})['"`]/i);

      if (appMatch && !appId)     appId     = appMatch[1];
      if (keyMatch && !apiKey)    apiKey    = keyMatch[1];
      if (idxMatch && !indexName) indexName = idxMatch[1];
    });
  }

  if (!appId || !apiKey) return null;
  return { appId, apiKey, indexName: indexName || 'exhibitors' };
}

// ─── MWC Barcelona specific parsers ───────────────────────────────────────────

/** Returns true if the URL points to an MWC Barcelona exhibitor detail page. */
export function isMwcExhibitorPage(url: string): boolean {
  return /mwcbarcelona\.com(?:\/[a-z]{2,3})?\/exhibitors\/[^?#]+/i.test(url);
}

/**
 * Parses an MWC Barcelona exhibitor detail page.
 * Relies on stable MWC-specific IDs: #exhibitor-header, #maincontent .wysiwyg,
 * and collapsible aside sections (#collapsible-content-social-links, #collapsible-content-interests).
 * Falls back to JSON-LD ProfilePage structured data.
 */
export function extractMwcDetailPage(html: string, detailUrl: string): Partial<Exhibitor> {
  const $ = cheerio.load(html);

  // ── JSON-LD ProfilePage (parsed first — structured data is the most reliable source) ──
  let jsonLdName = '', jsonLdDesc = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdName && jsonLdDesc) return false;
    try {
      const json = JSON.parse($(el).html() || '{}') as Record<string, unknown>;
      if (json['@type'] === 'ProfilePage') {
        const entity = (json.mainEntity ?? {}) as Record<string, unknown>;
        if (!jsonLdName) jsonLdName = String(entity.name || '').trim();
        if (!jsonLdDesc) jsonLdDesc = String(entity.description || '').trim();
      }
    } catch { /* malformed JSON-LD */ }
  });

  // ── Name ─────────────────────────────────────────────────────────────────────
  const nom = pickFirst(
    $('#exhibitor-header h1').text(),
    $('h1').first().text(),
    jsonLdName,
    $('meta[property="og:title"]').attr('content'),
  );

  // ── Logo ─────────────────────────────────────────────────────────────────────
  const logoRaw = pickFirst(
    $('#exhibitor-logo').attr('src'),
    $('#exhibitor-header img').first().attr('src'),
    $('img[id*="logo"], img[class*="logo"]').first().attr('src'),
    $('meta[property="og:image"]').attr('content'),
  );
  const logo = logoRaw !== 'N/A' ? resolveUrl(logoRaw, detailUrl) : 'N/A';

  // ── Stand / Location ──────────────────────────────────────────────────────────
  // MWC stores stands in #collapsible-content-locations > ul > li > a
  // Text is e.g. "Hall 5 Stand 5C30". Collect all stands (some exhibitors have multiple).
  const standLinks = $('#collapsible-content-locations li a')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(t => t.length > 0 && t.length < 80);
  const stand = standLinks.length > 0 ? standLinks.join(', ') : 'N/A';

  // ── Description ──────────────────────────────────────────────────────────────
  // Replace <br> tags with a space before extracting text so words don't run together.
  const wysiwyg = $('#maincontent .wysiwyg');
  wysiwyg.find('br').replaceWith(' ');
  const dMain = wysiwyg.text().replace(/\s+/g, ' ').trim();

  // Fallback candidates (in priority order after the primary path)
  const descCandidates: string[] = [];
  if (dMain.length > 10) descCandidates.push(dMain);

  if (!dMain || dMain.length <= 10) {
    // Any .wysiwyg inside <main>, <section>, <article>
    $('main .wysiwyg, section .wysiwyg, article .wysiwyg').each((_, el) => {
      $(el).find('br').replaceWith(' ');
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 10) { descCandidates.push(t); return false; }
    });

    // Content directly following an "Information" heading
    $('h2, h3').each((_, heading) => {
      if (/^\s*information\s*$/i.test($(heading).text())) {
        const next = $(heading).nextAll('div, p, section, article').first();
        const t = next.text().replace(/\s+/g, ' ').trim();
        if (t.length > 10) descCandidates.push(t);
        return false;
      }
    });

    // JSON-LD description
    if (jsonLdDesc.length > 10) descCandidates.push(jsonLdDesc);

    // Meta description — last resort
    const dMeta = $('meta[name="description"]').attr('content')?.trim() || '';
    if (dMeta.length > 10) descCandidates.push(dMeta);
  }

  const description = descCandidates.length > 0
    ? descCandidates.reduce((a, b) => a.length >= b.length ? a : b).substring(0, 800)
    : (jsonLdDesc.substring(0, 800) || 'N/A');

  // ── Website & social links ────────────────────────────────────────────────────
  // MWC's "Contact & Links" section uses FontAwesome icons to identify each link type.
  // fa-globe → website, fa-linkedin → LinkedIn, fa-x-twitter/fa-twitter → Twitter/X,
  // fa-youtube, fa-instagram, fa-facebook, fa-tiktok → ignored (not in our model).
  let siteWeb = 'N/A';
  let linkedin = 'N/A';
  let twitter = 'N/A';

  $('#collapsible-content-social-links li, [id*="social-links"] li, [id*="contact-links"] li').each((_, li) => {
    const $li = $(li);
    const $a = $li.find('a[href]').first();
    const href = $a.attr('href') || '';
    if (!href) return;
    // Identify link type by the icon class on the <i> element inside the <li>
    const iconClass = $li.find('i[class*="fa-"]').attr('class') || '';
    if (/fa-globe/i.test(iconClass) && siteWeb === 'N/A') {
      siteWeb = href.split(/[?#]/)[0];
    } else if (/fa-linkedin/i.test(iconClass) && linkedin === 'N/A') {
      linkedin = href.split(/[?#]/)[0];
    } else if (/fa-x-twitter|fa-twitter/i.test(iconClass) && twitter === 'N/A') {
      twitter = href.split(/[?#]/)[0];
    }
  });

  // Fallback for linkedin/twitter if not found via icon (generic link scan)
  if (linkedin === 'N/A') linkedin = firstLink($, /linkedin\.com\/(?:company|in)\//i);
  if (twitter === 'N/A')  twitter  = firstLink($, /(?:twitter\.com|x\.com)\//i);

  // ── Categories / Interests ────────────────────────────────────────────────────
  const catEls = $('#collapsible-content-interests a, [id*="interests"] a, [id*="categories"] a');
  const categories = catEls
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 0 && t.length < 80)
    .join(', ') || 'N/A';

  return {
    nom,
    description,
    siteWeb,
    logo,
    stand,
    pays:      'N/A',
    linkedin,
    twitter,
    categories,
    email:     'N/A',
    telephone: 'N/A',
    _detailUrl: detailUrl,
  };
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