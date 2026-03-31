export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending chat request to LM Studio...');
    console.log('Messages:', messages);

    // Stream response directly to client
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        messages: messages.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
        stream: true,
        max_tokens: 600,
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

    console.log('LM Studio connected, streaming response...');

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
