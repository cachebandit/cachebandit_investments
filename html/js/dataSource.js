// Detect local dev
const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

let staticCache = null;

async function fetchStaticCache() {
    if (staticCache) return staticCache;
    try {
        const res = await fetch('cache/stock_data.json');
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

    // --- Deployed environment logic (GitHub Pages) ---
    const cache = await fetchStaticCache();
    const root = cache.data || cache || {};
    const trimmed = category.trim();

    let key;

    if (trimmed === 'ETFs') {
        // Prefer new ETF key if present, otherwise fallback to category_ETFs
        if ('etfs:saved_stock_info:v2' in root) {
            key = 'etfs:saved_stock_info:v2';
        } else {
            key = 'category_ETFs';
        }
    } else {
        // Try new-style key first
        const kNew = `stocks:saved_stock_info:${trimmed}`;
        const kOld = `category_${trimmed}`;
        if (kNew in root) {
            key = kNew;
        } else {
            key = kOld;
        }
    }

    const data = (root && root[key]) || [];
    const lastUpdated = cache.last_updated || cache.updated_at || 'N/A';

    return { data, last_updated: lastUpdated };
}