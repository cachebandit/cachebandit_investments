// Detect local dev
const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

// Safe base path on Pages (handles /<repo>/subpath)
const BASE = location.pathname.replace(/\/[^/]*$/, "");

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
}