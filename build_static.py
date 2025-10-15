from __future__ import annotations
import json, time, random, math
from subprocess import run
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List
import yfinance as yf
import pandas as pd

# --- Constants ---
SITE_ROOT = Path("site")
HTML_DIR = SITE_ROOT / "html"
DATA_DIR = HTML_DIR / "data"

# --- Setup and Helpers ---
def load_categories_from_json(filepath='list_watchlist.json') -> Dict[str, List[str]]:
    """Loads categories and symbols from the master JSON file."""
    categories: Dict[str, List[str]] = {"Owned": []}
    try:
        with open(filepath, 'r') as f:
            data = json.load(f).get("Categories", {})
        
        for category_name, industries in data.items():
            categories.setdefault(category_name, [])
            
            for industry_name, stocks in industries.items():
                for stock in stocks:
                    symbol = stock.get("symbol")
                    if not symbol: continue
                    symbol = symbol.upper()
                    
                    if stock.get("flag", False):
                        categories["Owned"].append(symbol)
                    
                    if symbol not in categories[category_name]:
                        categories[category_name].append(symbol)
    except Exception as e:
        print(f"Error loading JSON: {e}")
    return categories

def copy_assets():
    """Copies all contents of the local 'html' directory to the build 'site/html' directory."""
    source_dir = Path("html")
    if source_dir.is_dir():
        run(["cp", "-r", f"{source_dir}/.", str(HTML_DIR)])

def chunked(lst, n): 
    for i in range(0, len(lst), n): 
        yield lst[i:i+n]

def backoff_sleep(sec):
    time.sleep(sec + random.uniform(0, 1.5))

def safe_download(tickers: List[str], period="1y", interval="1d"):
    wait = 10
    while True:
        try:
            return yf.download(
                tickers, period=period, interval=interval,
                threads=False, group_by="ticker",
                auto_adjust=False, progress=False
            )
        except Exception as e:
            msg = str(e)
            if "429" in msg or "Too Many" in msg or "blocked" in msg or "403" in msg:
                backoff_sleep(wait); wait = min(wait*2, 120)
            else:
                backoff_sleep(3)

def calculate_rsi(data, window=14):
    """Calculate RSI using Wilder's Smoothing to match TradingView's calculation."""
    if data is None or data.empty or len(data) < window + 1:
        return None
    
    delta = data['Close'].diff(1)
    gain = delta.where(delta > 0, 0.0).iloc[1:]
    loss = -delta.where(delta < 0, 0.0).iloc[1:]

    if gain.empty or loss.empty: return None

    avg_gain = gain.iloc[:window].mean()
    avg_loss = loss.iloc[:window].mean()

    for i in range(window, len(gain)):
        avg_gain = (avg_gain * (window - 1) + gain.iloc[i]) / window
        avg_loss = (avg_loss * (window - 1) + loss.iloc[i]) / window
    
    if avg_loss == 0:
        rsi = 100.0 if avg_gain > 0 else None
    else:
        rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))

    return rsi if rsi is not None and not (math.isnan(rsi) or math.isinf(rsi)) else None

def summarize_prices(df, tickers: List[str]):
    out = {}
    if isinstance(df.columns, pd.MultiIndex):
        for t in tickers:
            if t in df:
                sub = df[t]
                close = sub["Close"].dropna()
                if not close.empty:
                    out[t] = {
                        "price": float(close.iloc[-1]),
                        "rsi14": calculate_rsi(sub),
                        "yrsi14": calculate_rsi(sub.iloc[:-1])
                    }
    else:
        if not tickers or df.empty: return out
        close = df["Close"].dropna()
        if not close.empty:
            t = tickers[0]
            out[t] = {
                "price": float(close.iloc[-1]),
                "rsi14": calculate_rsi(df),
                "yrsi14": calculate_rsi(df.iloc[:-1])
            }
    return out

def fetch_fast_info(sym: str):
    wait = 10
    while True:
        try:
            fi = yf.Ticker(sym).fast_info
            # Use .info instead of .fast_info to get all data, including earnings dates.
            info = yf.Ticker(sym).info

            # Extract earnings date and timing
            earnings_timestamp = info.get('earningsTimestamp')
            earnings_timing = 'TBA'
            earnings_date = None
            if earnings_timestamp:
                date_obj = datetime.fromtimestamp(earnings_timestamp)
                earnings_date = date_obj.strftime('%m-%d-%Y')
                earnings_timing = 'BMO' if date_obj.hour < 12 else 'AMC'

            return {
                "exchange": getattr(fi, "exchange", None),
                "currency": getattr(fi, "currency", None),
                "marketCap": getattr(fi, "market_cap", None),
                "trailingPE": getattr(fi, "trailing_pe", None),
                "exchange": info.get("exchange"),
                "currency": info.get("currency"),
                "marketCap": info.get("marketCap"),
                "trailingPE": info.get("trailingPE"),
                "earningsDate": earnings_date,
                "earningsTiming": earnings_timing,
            }
        except Exception as e:
            msg = str(e)
            if "429" in msg or "Too Many" in msg or "blocked" in msg or "403" in msg:
                backoff_sleep(wait); wait = min(wait*2, 120)
            else:
                backoff_sleep(3)

def build_category_payload(category: str, tickers: List[str], data_cache: Dict):
    """Assembles the JSON payload for a category using pre-fetched data."""
    items = [data_cache[t] for t in tickers if t in data_cache]
    return {
        "category": category,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "items": items,
    }

# --- Build Process ---
if __name__ == "__main__":
    # 1. Create directories and copy assets
    SITE_ROOT.mkdir(exist_ok=True)
    HTML_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    print("1. Copying assets...")
    copy_assets()

    # 2. Load categories and all unique symbols from JSON
    print("2. Loading categories from JSON...")
    CATEGORIES = load_categories_from_json()
    ALL_SYMBOLS = sorted(list(set(s for syms in CATEGORIES.values() for s in syms)))

    # 3. Fetch data for ALL unique symbols ONCE and store in a cache
    print(f"3. Fetching data for {len(ALL_SYMBOLS)} unique symbols...")
    data_cache = {}

    # Fetch prices and RSI in batches
    price_map = {}
    for i, grp in enumerate(chunked(ALL_SYMBOLS, 40)):
        print(f"  - Fetching price batch {i+1}...")
        df = safe_download(grp)
        price_map.update(summarize_prices(df, grp))
        backoff_sleep(1.5)

    # Fetch metadata individually (with pacing) and combine into a single data_cache
    for i, t in enumerate(ALL_SYMBOLS):
        print(f"  - Fetching metadata for {t} ({i+1}/{len(ALL_SYMBOLS)})...")
        meta = fetch_fast_info(t)
        p = price_map.get(t, {})
        data_cache[t] = {**{"symbol": t}, **p, **meta}

    # 4. Build each category's JSON file using the cached data
    print("4. Building category files...")
    for cat, syms in CATEGORIES.items():
        payload = build_category_payload(cat, syms, data_cache)
        (DATA_DIR / f"{cat}.json").write_text(json.dumps(payload, indent=2))

    # 5. Create a root index.html to redirect to the correct start page
    idx = SITE_ROOT / "index.html"
    if not idx.exists():
        idx.write_text('<meta http-equiv="refresh" content="0; url=html/watchlist.html" />')
    
    print("\nBuild complete! The static site is in the 'site/' directory.")