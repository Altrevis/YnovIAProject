import { scrapeUrl } from '@/lib/scraper';

// Regex pour détecter les URLs dans les messages
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\]]+/gi;

/**
 * Scrape tous les URLs trouvées dans un message utilisateur
 * et enrichit le message avec le contexte scraped
 */
async function enrichMessageWithScrapedContent(message: string): Promise<string> {
  const urls = message.match(URL_REGEX) || [];
  if (urls.length === 0) return message;

  console.log(`🔗 Found ${urls.length} URL(s) to scrape`);
  
  let enrichedContent = message + '\n\n[SCRAPED CONTEXT]\n';
  
  for (const url of urls) {
    try {
      console.log(`📥 Scraping: ${url}`);
      const context = await scrapeUrl(url);
      
      // Construire un résumé du contexte scraped
      const cardCount = context.rawCards?.length || 0;
      const jsonCount = context.embeddedJSON?.length || 0;
      
      enrichedContent += `\n### ${url}\n`;
      enrichedContent += `- Found: ${cardCount} cards, ${jsonCount} embedded datasets\n`;
      
      // Inclure un extrait des premières cartes
      if (context.rawCards && context.rawCards.length > 0) {
        enrichedContent += `- Sample data:\n`;
        context.rawCards.slice(0, 3).forEach((card, i) => {
          enrichedContent += `  ${i + 1}. ${card.nom || 'N/A'} (${card.categories || 'N/A'})\n`;
        });
      }
      
      // Inclure des données JSON si présentes
      if (context.embeddedJSON && context.embeddedJSON.length > 0) {
        enrichedContent += `- Embedded JSON dataset with ${context.embeddedJSON[0].length} items\n`;
      }
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Scraping failed for ${url}:`, msg);
      enrichedContent += `\n### ${url}\n- Status: Failed to scrape (${msg})\n`;
    }
  }
  
  enrichedContent += '\n[END SCRAPED CONTEXT]\n';
  return enrichedContent;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Chat request received');

    // Enrichir le dernier message utilisateur avec du contenu scraped
    const enrichedMessages = [...messages];
    for (let i = enrichedMessages.length - 1; i >= 0; i--) {
      if (enrichedMessages[i].role === 'user') {
        console.log('📝 Processing user message for URLs...');
        enrichedMessages[i].content = await enrichMessageWithScrapedContent(enrichedMessages[i].content);
        break;
      }
    }

    console.log('Sending enriched chat request to LM Studio...');

    // Stream response directly to client
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        messages: enrichedMessages.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
        stream: true,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LM Studio error:', response.status, error);
      return new Response(
        JSON.stringify({ error: `LM Studio error: ${response.status} - ${error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ LM Studio connected, streaming response...');

    // Return the streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
