export async function fetchWebsite(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
        },
    });

    console.log("STATUS:", res.status);
    console.log("res : ", res);

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
}