import { streamText } from 'ai';
import { ollama } from 'ollama-ai-provider';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: ollama('llama3.2'),
    messages,
  });

  return result.toDataStreamResponse();
}
