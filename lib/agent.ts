import { scrapePage } from "./tools/scraper";
import { extractExhibitors } from "./tools/extractor";

export async function runScraper(url: string) {
  console.log("Scraping started...");

  const html = await scrapePage(url);

  console.log("Extracting data...");

  const exhibitors = await extractExhibitors(html);

  return exhibitors;
}