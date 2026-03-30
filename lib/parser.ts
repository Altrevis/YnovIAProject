import * as cheerio from 'cheerio';

export function extractPageContent(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, noscript, iframe').remove();

  // Meta / OG tags
  const title        = $('title').text().trim();
  const ogSiteName   = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const ogTitle      = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const metaDesc     = $('meta[name="description"]').attr('content')?.trim() || '';
  const ogDesc       = $('meta[property="og:description"]').attr('content')?.trim() || '';
  const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() || '';
  const ogImage      = $('meta[property="og:image"]').attr('content')?.trim() || '';

  // All hrefs (social links, mailto, tel)
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^(https?:\/\/|mailto:|tel:)/.test(href)) links.push(href);
  });

  // Body text
  $('header, nav, footer, aside').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 4000);

  return [
    `URL: ${baseUrl}`,
    `Titre: ${title}`,
    ogSiteName   ? `Nom du site (OG): ${ogSiteName}` : '',
    ogTitle      ? `Titre OG: ${ogTitle}` : '',
    metaDesc     ? `Meta description: ${metaDesc}` : '',
    ogDesc       ? `Description OG: ${ogDesc}` : '',
    metaKeywords ? `Mots-clés: ${metaKeywords}` : '',
    ogImage      ? `Image/Logo OG: ${ogImage}` : '',
    links.length  ? `Liens trouvés:\n${links.slice(0, 60).join('\n')}` : '',
    `Texte de la page:\n${bodyText}`,
  ].filter(Boolean).join('\n\n');
}