import { scrapePage } from "./scraper";

export async function scrapeMultiplePages(baseUrl: string, maxPages = 5) {
  const results: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const url = `${baseUrl}?page=${i}`;

    console.log(`Scraping page ${i}`);

    const html = await scrapePage(url);
    results.push(html);

    // rate limiting
    await new Promise((res) => setTimeout(res, 1500));
  }

  return results;
}