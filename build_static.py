# build_static.py
from __future__ import annotations
from pathlib import Path
import json
from subprocess import run
from datetime import datetime
import shutil

SITE_ROOT = Path("site")
HTML_DIR  = SITE_ROOT / "html"
DATA_DIR  = HTML_DIR / "data"
CACHE_FP  = Path("cache/stock_data.json")  # cache written by your server job

# The categories your UI expects (must match what's rendered on watchlist/Market Movers/RSI/PE pages)
ACTIVE_CATEGORIES = [
    "Owned",
    "Information Technology",
    "Financial Services",
    "Industrials",
    "Energy & Utilities",
    "Healthcare",
    "Communication Services",
    "Real Estate",
    "Consumer Staples",
    "Consumer Discretionary",
    "ETFs",
]

def load_cache():
    if not CACHE_FP.exists():
        raise FileNotFoundError(f"Cache not found: {CACHE_FP}")
    with open(CACHE_FP, "r") as f:
        return json.load(f)

def copy_assets():
    """Copies all contents of the local 'html' directory to the build 'site/html' directory."""
    # First, ensure the destination directory is clean to avoid stale files
    if HTML_DIR.exists():
        shutil.rmtree(HTML_DIR)
    
    source_dir = Path("html")
    if source_dir.is_dir():
        run(["cp", "-r", f"{source_dir}/.", str(HTML_DIR)])

def normalize_stock_fields(s: dict) -> dict:
    """
    Make sure each stock has the keys your JS uses:
      Symbol/Name, Market Cap, Open/High/Low/Close, Price Change, Percent Change, RSI,
      Trailing PE/Forward PE/EV/EBITDA, stockUrl, earningsDate/earningsTiming, category/industry, flag
    If some are missing in cache, leave them as-is; the UI already has defensive fallbacks.
    """
    return s

def build_payload(category: str, items: list, updated_at: str) -> dict:
    return {
        "category": category,
        "updated_at": updated_at,
        "items": [normalize_stock_fields(s) for s in items]
    }

def add_cache_buster(version_str: str):
    """
    Adds a cache-busting query string to assets in all HTML files.
    This ensures browsers fetch the new version after a deployment.
    """
    print(f"Adding cache-buster version: {version_str}")
    for html_file in HTML_DIR.glob("*.html"):
        content = html_file.read_text()
        # Replace in both preload links and image sources
        content = content.replace('href="cachebandit_logo.png"', f'href="cachebandit_logo.png?v={version_str}"')
        content = content.replace('src="cachebandit_logo.png"', f'src="cachebandit_logo.png?v={version_str}"')
        html_file.write_text(content)

def main():
    # 1) Prep dirs
    HTML_DIR.mkdir(parents=True, exist_ok=True) # Ensure site/html exists
    copy_assets() # Clean and copy source assets first
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 2) Load cache
    cache = load_cache()

    # Expected cache structure example:
    # {
    #   "data": { "category_Owned": [ {...stocks...} , ... ] },
    #   "last_updated": "10/14 02:00 PM"
    # }
    updated_at = cache.get("last_updated") or datetime.now().strftime("%m/%d %I:%M %p")
    cached_categories = cache.get("data") or {}

    # 3) Build each category JSON
    for cat in ACTIVE_CATEGORIES:
        items = cached_categories.get(f"category_{cat}", [])

        if cat == "Owned":
            # alphabetical by symbol
            items = sorted(items, key=lambda x: (x.get("Symbol") or x.get("symbol") or "").lower())
        else:
            # sort by market cap desc where available
            def cap(x):
                v = x.get("Market Cap")
                try:
                    return float(v) if v not in (None, "N/A") else 0.0
                except Exception:
                    return 0.0
            items = sorted(items, key=cap, reverse=True)

        payload = build_payload(cat, items, updated_at)
        (DATA_DIR / f"{cat}.json").write_text(json.dumps(payload, indent=2))

    # 4) Add cache-buster to static assets
    version_str = datetime.now().strftime("%Y%m%d%H%M%S")
    add_cache_buster(version_str)

    # 4) Make sure a simple redirect index exists (optional nicety)
    idx = SITE_ROOT / "index.html"
    if not idx.exists():
        idx.write_text('<meta http-equiv="refresh" content="0; url=html/watchlist.html" />')

    print("Static build complete -> site/html/data/*.json")

if __name__ == "__main__":
    main()
