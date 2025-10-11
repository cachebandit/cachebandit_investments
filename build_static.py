from __future__ import annotations
import json, time, random
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List
import yfinance as yf
import pandas as pd

# ---- Configure your categories (match what your UI uses) ----
CATEGORIES: Dict[str, List[str]] = {
    "Owned": ["AAPL","MSFT","GOOGL"],
    "IT": ["NVDA","AMD","AVGO","CRM"],
    "Industrials": ["CAT","UNP","GE","ETN"],
    # add the rest of your categories here
}

SITE_ROOT = Path("site")
HTML_DIR = SITE_ROOT / "html"
DATA_DIR = HTML_DIR / "data"

HTML_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

def copy_assets():
    """Copies all contents of the local 'html' directory to the build 'site/html' directory."""
    source_dir = Path("html")
    if not source_dir.is_dir(): return
    subprocess.run(["cp", "-r", f"{source_dir}/.", str(HTML_DIR)])

def chunked(lst, n): 
    for i in range(0, len(lst), n): 
        yield lst[i:i+n]

def backoff_sleep(sec):
    time.sleep(sec + random.uniform(0, 1.5))

def safe_download(tickers: List[str], period="6mo", interval="1d"):
    wait = 10
    while True:
        try:
            return yf.download(tickers, period=period, interval=interval,
                               threads=False, group_by="ticker",
                               auto_adjust=False, progress=False)
        except Exception as e:
            if "429" in str(e) or "Too Many" in str(e):
                backoff_sleep(wait); wait = min(wait * 2, 900)
            else:
                backoff_sleep(3)

def compute_rsi(close: pd.Series, window: int = 14):
    if close is None or len(close) < window + 1: return None
    d = close.diff()
    up = d.clip(lower=0).rolling(window).mean()
    down = (-d.clip(upper=0)).rolling(window).mean().replace(0, 1e-9)
    rsi = 100 - (100 / (1 + (up / down)))
    v = float(rsi.iloc[-1])
    return round(v, 2) if pd.notna(v) else None

def summarize_prices(df, tickers: List[str]):
    out = {}
    if isinstance(df.columns, pd.MultiIndex):
        for t in tickers:
            if t in df:
                sub = df[t]; close = sub["Close"].dropna()
                out[t] = {"price": float(close.iloc[-1]) if len(close) else None,
                          "rsi14": compute_rsi(close)}
    else:
        close = df["Close"].dropna(); t = tickers[0]
        out[t] = {"price": float(close.iloc[-1]) if len(close) else None,
                  "rsi14": compute_rsi(close)}
    return out

def fetch_fast_info(t):
    wait = 10
    while True:
        try:
            fi = yf.Ticker(t).fast_info
            return {
                "exchange": getattr(fi, "exchange", None),
                "currency": getattr(fi, "currency", None),
                "marketCap": getattr(fi, "market_cap", None),
                "trailingPE": getattr(fi, "trailing_pe", None),
            }
        except Exception as e:
            if "429" in str(e) or "Too Many" in str(e):
                backoff_sleep(wait); wait = min(wait * 2, 900)
            else:
                backoff_sleep(3)

def build_category(category: str, tickers: List[str]):
    price_map = {}
    for grp in chunked(tickers, 40):  # gentle batch size
        df = safe_download(grp, period="6mo", interval="1d")
        price_map.update(summarize_prices(df, grp))
        backoff_sleep(1.5)

    meta = {t: fetch_fast_info(t) for t in tickers}

    items = []
    for t in tickers:
        p = price_map.get(t, {}); m = meta.get(t, {})
        items.append({
            "symbol": t,
            "price": p.get("price"),
            "rsi14": p.get("rsi14"),
            "exchange": m.get("exchange"),
            "currency": m.get("currency"),
            "marketCap": m.get("marketCap"),
            "trailingPE": m.get("trailingPE"),
        })
    return {
        "category": category,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "items": items,
    }

# --- Build Process ---
# 1. Copy all assets from local 'html' folder to the 'site/html' folder
copy_assets()

# 2. Fetch data and create the JSON files inside 'site/html/data/'
for cat, syms in CATEGORIES.items():
    payload = build_category(cat, syms)
    (DATA_DIR / f"{cat}.json").write_text(json.dumps(payload, indent=2))

# 3. Create a root index.html to redirect to the correct start page
idx = SITE_ROOT / "index.html"
if not idx.exists():
    idx.write_text('<meta http-equiv="refresh" content="0; url=html/watchlist.html" />')
