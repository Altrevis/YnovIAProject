export function formatEntreprise(data: any) {
    console.log('📦 Données formatées:', data);
    return {
        entreprise: {
            nom: data.nom,
            country: data.country,
            website: data.website,
        },
    };
}