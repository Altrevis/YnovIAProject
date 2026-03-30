import { scrapeExhibitors } from "@/lib/scraper";
import { extractExhibitors } from "@/lib/ai-agent";

export async function POST(req: Request) {
  const { url } = await req.json();

  const html = await scrapeExhibitors(url);
  const exhibitors = await extractExhibitors(html);

  return Response.json({ exhibitors });
}