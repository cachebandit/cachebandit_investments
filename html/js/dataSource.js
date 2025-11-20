// Detect local dev
const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

let staticCache = null;

async function fetchStaticCache() {
    if (staticCache) return staticCache;
    try {
        const res = await fetch('/cache/stock_data.json');
        if (!res.ok) throw new Error(`Failed to fetch static cache: ${res.status}`);
        staticCache = await res.json();
        return staticCache;
    } catch (error) {
        console.error("Error fetching static cache:", error);
        return { data: {}, last_updated: "N/A" };
    }
}

export async function getCategoryData(category, { refresh = false, scope } = {}) {
    if (isLocal()) {
        const url = `/saved_stock_info?category=${encodeURIComponent(category)}&refresh=${refresh}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
            let body = "";
            try { body = await res.text(); } catch {}
            throw new Error(`API ${res.status} for ${url}${body ? ` — ${body}` : ""}`);
        }
        return res.json();
    }

    // --- Deployed environment logic ---
    const cache = await fetchStaticCache();
    let categoryKey;

    if (category === 'ETFs') {
        categoryKey = 'etfs:saved_stock_info:v2';
    } else {
        categoryKey = `stocks:saved_stock_info:${category.trim()}`;
    }

    const data = cache.data[categoryKey] || [];
    return { data: data, last_updated: cache.last_updated };
}