import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const lmstudio = createOpenAI({
  baseURL: 'http://10.37.4.239:1234/v1',
  apiKey: 'lm-studio',
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: lmstudio('model'),
    messages,
  });

  return result.toDataStreamResponse();
}
