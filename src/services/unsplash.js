const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

async function translateToEnglish(text) {
    try {
        const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=no|en`
        );
        if (!res.ok) return text;
        const data = await res.json();
        return data.responseData?.translatedText || text;
    } catch {
        return text;
    }
}

/**
 * Translates the dish name to English, then searches Unsplash for food photos.
 * Returns up to `count` image URLs (regular size).
 */
export async function fetchDinnerImages(dishName, count = 5) {
    if (!dishName || !ACCESS_KEY) return [];

    const englishName = await translateToEnglish(dishName);
    const query = encodeURIComponent(`${englishName} food`);
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=${count}&orientation=landscape&client_id=${ACCESS_KEY}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).map(photo => photo.urls.regular);
}
