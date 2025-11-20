// Detect local dev
const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

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

    // --- Deployed (GitHub Pages) logic ---
    // On the static site, each category has its own JSON file.
    const url = `data/${encodeURIComponent(category)}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to fetch static data for ${category}: ${res.status}`);
    }
    const payload = await res.json();
    // The static build wraps items in a different structure, so we normalize it here.
    return { data: payload.items, last_updated: payload.updated_at };
}