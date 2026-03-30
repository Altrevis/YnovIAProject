export function formatEntreprise(data: any) {
    return {
        entreprise: {
            nom: data.nom,
            country: data.country,
            website: data.website,
        },
    };
}