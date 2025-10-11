// Detect local dev
const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

// Safe base path on Pages (handles /<repo>/subpath)
const BASE = location.pathname.replace(/\/[^/]*$/, "");

export async function getCategoryData(category, { refresh = false } = {}) {
  if (isLocal()) {
    const url = `/saved_stock_info?category=${encodeURIComponent(category)}&refresh=${refresh?"true":"false"}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
    return res.json();
  } else {
    const url = `${BASE}/data/${encodeURIComponent(category)}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Static ${res.status} for ${url}`);
    return res.json();
  }
}
