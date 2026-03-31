export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url') ?? '';

  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return new Response('URL invalide', { status: 400 });
  }

  let origin = '';
  try {
    origin = new URL(imageUrl).origin;
  } catch {
    return new Response('URL invalide', { status: 400 });
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Referer': origin + '/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return new Response('Image non disponible', { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
      return new Response('Ressource non image', { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new Response('Erreur lors du chargement', { status: 502 });
  }
}
