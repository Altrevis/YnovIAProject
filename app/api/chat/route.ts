import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const llm = createOpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: llm('local-model'),
    system: `Tu es un assistant IA conversationnel spécialisé dans les salons professionnels et l'extraction de données d'entreprises.
Réponds en français de façon concise et utile.
Si l'utilisateur mentionne une URL, dis-lui que tu vas l'analyser automatiquement dès qu'il l'envoie dans le chat.`,
    messages,
  });

  return result.toDataStreamResponse();
}
