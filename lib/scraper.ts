import { chromium } from 'playwright';

export async function scrapeExhibitors(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  const html = await page.content();

  await browser.close();

  return html;
}