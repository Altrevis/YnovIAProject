import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { fetchWebsite } from "@/lib/api";
import { parseWebsite } from "@/lib/parser";
import { formatEntreprise } from "@/lib/formatter";

const lmstudio = createOpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

export async function POST(req: Request) {
  try {
    const contents = await req.json();
    console.log(contents);
    const url = contents.messages
      .find((m: any) => m.content.startsWith('http'))
      ?.content
      .replace(/\s+/g, '');

    console.log(url);

    if (!url) {
      return Response.json(
        { error: "URL invalide" },
        { status: 400 }
      );
    }

    // 1. récupérer le site
    const html = await fetchWebsite(url);

    // 2. parser
    console.log("html: ", html, "\n");
    const parsed = parseWebsite(html, url);

    // 3. formatter
    console.log("parsed: ", parsed, "\n");
    const result = formatEntreprise(parsed);

    console.log("result: ", result, "\n");
    return Response.json(result);

  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
