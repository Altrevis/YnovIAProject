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
    system: `Tu es un assistant IA conversationnel. Réponds en français, de façon concise et directe.`,
    messages,
    maxTokens: 600,
  });

  console.log('📨 Messages reçus:', messages);
  return result.toDataStreamResponse();
}
