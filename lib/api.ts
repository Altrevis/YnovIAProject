import { chromium } from '@playwright/test';

// User-Agents récents à rotation pour éviter le blocage
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchWebsite(url: string, retries = 2): Promise<string> {
  const attempt = async (): Promise<string> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': randomUA(),
          'Accept-Encoding': 'gzip, deflate',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1',
        },
        redirect: 'follow',
      });

      if (res.status === 429) throw new Error('RATE_LIMIT');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  };

  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt();
    } catch (err) {
      const isLast = i === retries;
      if (isLast) throw err;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }

  throw new Error('fetchWebsite: unreachable');
}

export interface PlaywrightCard {
  name: string;
  logo: string;
  categories: string;
  href: string;
}

export interface RenderedResult {
  /** HTML complet après exécution du JavaScript */
  html: string;
  /** Réponses XHR/fetch JSON interceptées pendant le chargement */
  interceptedJson: Record<string, unknown>[][];
  /** Toutes les arrays JSON ≥10 items capturées (même non-exhibitor-like) */
  broadJson: Record<string, unknown>[][];
  /** Cards extraites directement du DOM vivant via page.evaluate() */
  playwrightCards: PlaywrightCard[];
}

/**
 * Charge une URL dans un vrai navigateur headless Chromium (Playwright),
 * attend que les requêtes réseau se calment, puis renvoie :
 *   - le HTML final rendu (après exécution JS)
 *   - les réponses JSON d'API interceptées pendant le chargement
 */
export async function fetchWebsiteRendered(url: string): Promise<RenderedResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'DNT': '1',
      },
    });

    // Supprime navigator.webdriver et autres marqueurs de détection bot
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    const page = await context.newPage();
    const interceptedJson: Record<string, unknown>[][] = [];
    const broadJson: Record<string, unknown>[][] = [];

    // Intercepte toutes les réponses XHR/fetch qui renvoient du JSON
    page.on('response', async (response) => {
      try {
        const ct = response.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        const reqUrl = response.url();
        // Ignore les analytics, tracking, cookie consent, CDN tiers non métier
        if (/google|gtm|analytics|onetrust|cookielaw|cookiebot|didomi|axeptio|usercentrics|quantcast|cookie|sentry|hotjar|segment|hubspot|facebook|twitter|linkedin\.com\/li\/|doubleclick|adform|criteo|intercom|zendesk/i.test(reqUrl)) return;
        if (!response.ok()) return;

        const body = await response.json() as unknown;

        // Vérifie qu'un objet ressemble à des données d'exposant
        // (ancré en début de clé pour éviter 'GroupName' → 'name', 'firstname', etc.)
        const looksLikeExhibitor = (o: unknown): boolean => {
          if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
          const ks = Object.keys(o as object).map(k => k.toLowerCase());
          const strong = ks.some(k =>
            /^(name|nom|company|exhibitor|stand|booth|brand|organization|organisation|participant)/i.test(k),
          );
          if (strong) return true;
          const soft = ks.filter(k =>
            /^(description|website|url|linkedin|email|phone|logo|category|country|city|title)/i.test(k),
          ).length;
          return soft >= 2;
        };

        const findArray = (val: unknown, depth = 0): Record<string, unknown>[] | null => {
          if (depth > 4 || val === null || typeof val !== 'object') return null;
          if (Array.isArray(val) && val.length >= 2 && typeof val[0] === 'object') {
            return val as Record<string, unknown>[];
          }
          for (const v of Object.values(val as object)) {
            const found = findArray(v, depth + 1);
            if (found && found.length >= 2) return found;
          }
          return null;
        };

        const arr = findArray(body);
        if (arr && arr.length >= 2 && arr.some(looksLikeExhibitor)) {
          interceptedJson.push(arr);
        }
        // Capture élargie : toute array ≥10 items (même sans critère exposant)
        // utile pour les plateformes avec des noms de champs non-standard
        if (arr && arr.length >= 10) {
          broadJson.push(arr);
        }
      } catch { /* ignorer les erreurs de parsing */ }
    });

    // Navigue — domcontentloaded est plus fiable que networkidle sur les SPAs avec polling continu
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Attend que du contenu visible apparaisse (liste ou texte principal)
    // ou jusqu'à 10s si rien ne correspond
    await Promise.race([
      page.waitForSelector('img[data-content-name], [class*="card"], [class*="Card"], [class*="item"], article, li a', { timeout: 10_000 }).catch(() => null),
      page.waitForTimeout(10_000),
    ]);

    // Délai supplémentaire pour laisser les XHR terminer
    await page.waitForTimeout(2000);

    // Scroll progressif pour déclencher le lazy loading (pas de limite de hauteur)
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let totalHeight = 0;
        const distance = 600;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await page.waitForTimeout(1500);

    const html = await page.content();

    // ── Extraction DOM directe (équivalent BeautifulSoup sur DOM vivant) ──────────
    // Tourne dans le contexte navigateur : voit le DOM complètement rendu après JS.
    // Beaucoup plus fiable que de re-parser le HTML statique avec cheerio.
    const playwrightCards: PlaywrightCard[] = await page.evaluate((base: string) => {
      const cards: Array<{ name: string; logo: string; categories: string; href: string }> = [];
      const seen = new Set<string>();

      const resolveUrl = (href: string) => {
        if (!href) return '';
        if (href.startsWith('http')) return href;
        try { return new URL(href, base).href; } catch { return href; }
      };

      const add = (name: string, logo: string, categories: string, href: string) => {
        const key = name.toLowerCase().trim();
        if (!key || key.length < 2 || key.length > 120 || seen.has(key)) return;
        seen.add(key);
        cards.push({ name: name.trim(), logo: resolveUrl(logo), categories, href: resolveUrl(href) });
      };

      // ── Stratégie 1 : data-content-name sur img (Web Summit, etc.) ──────────────
      document.querySelectorAll('img[data-content-name]').forEach((img) => {
        const raw = (img as HTMLImageElement).dataset.contentName || '';
        const parts = raw.split('|');
        const name = (parts.length >= 3 ? parts.slice(2).join('|') : parts[parts.length - 1] || '').trim();
        if (!name) return;
        const container = img.closest('figure, article, [class*="Item"], [class*="Card"], [class*="Wrapper"], li');
        const anchor = container?.querySelector('a[href]') || img.closest('a');
        const href = (anchor as HTMLAnchorElement | null)?.getAttribute('href') || '';
        const logo = (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || '';
        const spans = Array.from((container || img.parentElement)?.querySelectorAll('span, p') || []);
        const categories = spans
          .map((s) => s.textContent?.trim() || '')
          .filter((t) => t && t.length > 1 && t.length < 80 && t !== name)
          .slice(0, 5).join(', ') || 'N/A';
        add(name, logo, categories, href);
      });

      if (cards.length >= 4) return cards;

      // ── Stratégie 2 : liens vers pages profil (pattern URL commun) ────────────────
      const PROFILE_RE = /\/(exhibitors?|companies|participants?|appearances?|startups?|attendees?|speakers?|members?|profiles?|stands?|booths?|sponsors?|fournisseurs?)\/[^?#]+/i;
      const GENERIC_RE = /^(all|list|page|search|filter|directory|map|about|contact|faq|login|register|join)$/i;

      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!PROFILE_RE.test(href)) return;
        const slug = href.replace(/\/$/, '').split('/').pop() || '';
        if (GENERIC_RE.test(slug)) return;

        const img = a.querySelector('img') as HTMLImageElement | null
          || (a.closest('[class]')?.querySelector('img') as HTMLImageElement | null);
        const name = (img?.alt || a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!name || name.length < 2 || name.length > 120) return;

        const container = a.closest('[class*="item"], [class*="card"], [class*="Item"], [class*="Card"], figure, article, li');
        const catEl = container?.querySelector('span, [class*="categ"], [class*="tag"], [class*="sector"], [class*="badge"]');
        const categories = catEl?.textContent?.trim() || 'N/A';
        const logo = img?.src || img?.dataset?.src || '';
        add(name, logo, categories, href);
      });

      if (cards.length >= 4) return cards;

      // ── Stratégie 3 : classe CSS la plus répétée (card générique) ─────────────
      const classCounts = new Map<string, number>();
      document.querySelectorAll('[class]').forEach((el) => {
        const cls = (el.getAttribute('class') || '').split(/\s+/);
        cls.forEach((c) => {
          if (c.length < 3) return;
          if (/^(flex|grid|col|row|block|hidden|text-|bg-|p-|m-|w-|h-|border|rounded|shadow|container|wrapper|inner|outer|section|layout|page|content|main|header|footer|nav|menu|btn|icon|sr-only|absolute|relative|fixed|z-)/.test(c)) return;
          classCounts.set(c, (classCounts.get(c) || 0) + 1);
        });
      });
      const topClasses = [...classCounts.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 10);

      for (const [cls] of topClasses) {
        const els = document.querySelectorAll(`.${CSS.escape(cls)}`);
        if (els.length < 4) continue;
        const tryCards: typeof cards = [];
        const trySeen = new Set<string>();
        els.forEach((el) => {
          const img = el.querySelector('img') as HTMLImageElement | null;
          const nameEl = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="Title"],[class*="name"],[class*="Name"]');
          const name = (img?.alt || nameEl?.textContent || img?.dataset?.contentName?.split('|').slice(2).join('|') || '').trim().replace(/\s+/g, ' ');
          if (!name || name.length < 2 || name.length > 120 || trySeen.has(name.toLowerCase())) return;
          trySeen.add(name.toLowerCase());
          const anchor = el.querySelector('a[href]') as HTMLAnchorElement | null;
          const href = anchor?.getAttribute('href') || '';
          const logo = img?.src || img?.dataset?.src || '';
          const catEl = el.querySelector('span,[class*="categ"],[class*="tag"],[class*="badge"]');
          const categories = catEl?.textContent?.trim() || 'N/A';
          tryCards.push({ name, logo: resolveUrl(logo), categories, href: resolveUrl(href) });
        });
        if (tryCards.length >= 4) { tryCards.forEach((c) => cards.push(c)); break; }
      }

      return cards;
    }, url);

    await context.close();

    return { html, interceptedJson, broadJson, playwrightCards };
  } finally {
    await browser.close();
  }
}
