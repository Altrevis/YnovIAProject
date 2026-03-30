export function parseWebsite(html: string, url: string) {
    const getTitle = html.match(/<title>(.*?)<\/title>/i)?.[1] || "N/A";

    return {
        nom: getTitle,
        country: "Unknown", // on verra après pour améliorer
        website: url,
    };
}