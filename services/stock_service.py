import yfinance as yf
import json
import logging
from datetime import datetime
import math
from zoneinfo import ZoneInfo
from models.stock_cache import StockCache
import pandas as pd
from services.volatility_service import get_vol_signal_fields

# Custom exception to signal yfinance/API rate limit errors
class RateLimitError(Exception):
    """Raised when yfinance (or the upstream API) returns a 429 / rate limit error."""
    pass

# Initialize cache
cache = StockCache()

def _first(*vals):
    for v in vals:
        if v is not None:
            return v
    return None

def _num(x):
    try:
        return float(x)
    except Exception:
        return None

def _pct_num(x):
    """Accept decimal (0.0145) or percentage (1.45) and normalize to percent."""
    v = _num(x)
    if v is None:
        return None
    # yfinance can return 0.09 for 0.09% or 0.0009 for 0.09%.
    # If the value is already > 1, it's likely a mis-scaled percentage (e.g., 9.45 for 0.0945%).
    # We will treat any value > 1 as needing division by 100.
    if v > 1:
        return v / 100.0
    else: # if it's a decimal like 0.0009, convert to percent
        return v * 100.0

def _expense_ratio_pct(x):
    """
    Expense ratio is often returned as a percentage (e.g., 0.03 for 0.03%).
    We only need to scale it if it's returned as a whole number.
    """
    v = _num(x)
    if v is None:
        return None
    return v / 100.0 if v > 1.0 else v

def _load_info_safe(t):
    info = {}
    try:
        # yfinance>=0.2 fast_info is cheap
        fi = getattr(t, "fast_info", None)
        if fi:
            try:
                info.update(dict(fi))
            except Exception:
                pass
        # fall back to full info for ETF fields
        try:
            base = t.info or {}
            if isinstance(base, dict):
                info.update(base)
        except Exception:
            pass
    except Exception:
        pass
    return info

def get_etf_fund_stats(ticker_obj):
    info = _load_info_safe(ticker_obj)

    return {
        "price": _first(_num(info.get("last_price")), _num(info.get("regularMarketPrice"))),
        "netAssets": _first(_num(info.get("totalAssets")), _num(info.get("totalAssetsUSD")), _num(info.get("netAssets"))),
        "nav": _first(_num(info.get("navPrice")), _num(info.get("nav"))),
        "sharesOutstanding": _num(info.get("sharesOutstanding")),
        "expenseRatioAnnual": _expense_ratio_pct(info.get("netExpenseRatio")),
        "dividendYieldTTM": _pct_num(_first(info.get('trailingAnnualDividendYield'), info.get('yield'))),
        "ytdReturnPct": _num(info.get("ytdReturn")),
        "fiftyTwoWeekLow": _num(info.get("fiftyTwoWeekLow")),
        "fiftyTwoWeekHigh": _num(info.get("fiftyTwoWeekHigh"))
    }

def _to_pct(num):
    try:
        # yfinance often gives 0.0795 for 7.95% (VOO sample you posted).
        # Show as 7.95 with 2dp on the FE.
        return float(num) * 100.0
    except Exception:
        return None

def fetch_etf_top_holdings(symbol: str):
    """
    Always returns list[ {symbol,name,weight(float%)} ] or []
    """
    try:
        t = yf.Ticker(symbol)

        # Newer API: funds_data.top_holdings (DataFrame)
        fd = getattr(t, "funds_data", None)
        th = getattr(fd, "top_holdings", None) if fd is not None else None
        if th is not None and hasattr(th, "iterrows"):
            out = []
            for idx, row in th.iterrows():
                out.append({
                    "symbol": str(idx),
                    "name": str(row.get("Name", "")),
                    "weight": _to_pct(row.get("Holding Percent"))
                })
            if out:
                return out

        # Fallbacks seen across yfinance versions
        for attr in ("fund_holdings", "fund_holding"):
            fh = getattr(t, attr, None)
            if isinstance(fh, list):
                return [{
                    "symbol": (h.get("symbol") or h.get("ticker") or ""),
                    "name":   (h.get("shortName") or h.get("longName") or h.get("name") or ""),
                    "weight": _to_pct(h.get("holdingPercent") or h.get("weight") or h.get("heldPercent")),
                } for h in fh]
            if isinstance(fh, dict) and "holdings" in fh:
                return [{
                    "symbol": (h.get("symbol") or h.get("ticker") or ""),
                    "name":   (h.get("shortName") or h.get("longName") or h.get("name") or ""),
                    "weight": _to_pct(h.get("holdingPercent") or h.get("weight") or h.get("heldPercent")),
                } for h in fh["holdings"]]

    except Exception:
        # swallow and return empty; server must not 500
        pass
    return []

def _clean_value(value):
    """Converts NaN to None, otherwise returns value."""
    # Check for NaN, which can be a float. math.isnan() will fail on non-floats.
    if isinstance(value, float) and math.isnan(value):
        return None
    return value

def load_watchlist_data():
    """Load watchlist data from JSON file and create the 'Owned' category"""
    try:
        with open('list_watchlist.json', 'r') as file:
            data = json.load(file)
            categories = data.get("Categories", {})

            owned_stocks = []
            # This will hold the final structure: { "CategoryName": [stocks] }
            api_categories = {}

            # Process each category and its industries
            for category_name, industries in categories.items():
                non_owned_stocks_in_category = []
                for industry_name, stocks in industries.items():
                    for stock in stocks:
                        # Add context to each stock object
                        stock_with_context = {
                            **stock,
                            'category': category_name,
                            'industry': industry_name
                        }
                        if stock.get("flag", False):
                            owned_stocks.append(stock_with_context)
                        else:
                            non_owned_stocks_in_category.append(stock_with_context)
                
                if non_owned_stocks_in_category:
                    api_categories[category_name] = non_owned_stocks_in_category

            # Add the "Owned" category to the filtered categories
            api_categories["Owned"] = owned_stocks
            return api_categories

    except Exception as e:
        logging.error(f"Error loading watchlist data: {e}")
        return {}

# Global watchlist data, including the dynamically created "Owned" category
watchlist_data = load_watchlist_data()

def _is_etf_category(c: str) -> bool:
    return (c or "").strip().lower() in ("etf", "etfs")

def _etf_holdings_cache_key(sym):
    return f"etf_holdings::{sym.upper()}"

def _add_holdings_to_etfs(items):
    for item in items:
        sym = item.get("Symbol") or item.get("symbol")
        if not sym:
            item["holdings"] = []
            continue

        key = _etf_holdings_cache_key(sym)
        holdings = cache.get(key)
        if holdings is None:
            holdings = fetch_etf_top_holdings(sym)
            cache.set(key, holdings)  # 24h TTL
        item["holdings"] = holdings
    return items

def fetch_category_data(category, refresh=False):
    """Fetch data for a specific category from the watchlist using batch requests."""
    category_data = load_watchlist_data().get(category, [])
    if not category_data:
        return []

    symbols = [stock_info["symbol"] for stock_info in category_data]
    if not symbols:
        return []
    
    # Batch fetch detailed info (prices, RSI)
    detailed_data = fetch_detailed_info(symbols)

    # Batch fetch company info
    try:
        tickers = yf.Tickers(' '.join(symbols))
    except Exception as e:
        # Detect rate limit from yfinance/requests and raise a specific error so caller can respond
        msg = str(e)
        if '429' in msg or 'Too Many Requests' in msg or 'rate limit' in msg.lower():
            raise RateLimitError(msg)
        logging.error(f"Error creating yf.Tickers for symbols {symbols}: {e}")
        tickers = None

    result_data = []

    for stock_info in category_data:
        symbol = stock_info["symbol"]

        # Get market data first, which should be reliable
        market_data = detailed_data.get(symbol, {})

        try:
            # Then, try to get the company info, which can sometimes fail
            ticker_obj = tickers.tickers.get(symbol)
            info = ticker_obj.info if ticker_obj else {}
        except Exception as e:
            # If this error is a rate-limit, propagate a RateLimitError so the handler returns 429
            msg = str(e)
            if '429' in msg or 'Too Many Requests' in msg or 'rate limit' in msg.lower():
                raise RateLimitError(msg)
            logging.warning(f"Could not fetch .info for {symbol}: {e}. Using fallback.")
            info = {} # Use an empty dict if info fails, but we still have market_data
            ticker_obj = None

        # Get earnings timestamp
        earnings_timestamp = info.get('earningsTimestamp')
        earningsTiming = 'TBA'
        earningsDate = None
        if earnings_timestamp:
            # Convert UTC timestamp from yfinance to US/Central to correctly determine BMO/AMC
            utc_date = datetime.fromtimestamp(earnings_timestamp, tz=ZoneInfo("UTC"))
            ct_date = utc_date.astimezone(ZoneInfo("US/Central"))
            earningsDate = ct_date.strftime('%m-%d-%Y')
            earningsTiming = 'BMO' if ct_date.hour < 12 else 'AMC'
        
        # For ETFs, yfinance often uses 'totalAssets' instead of 'marketCap'.
        # We will prioritize 'netAssets', then 'totalAssets', and finally 'marketCap'.
        if _is_etf_category(category):
            market_cap_raw = info.get('netAssets') or info.get('totalAssets')
        else:
            market_cap_raw = info.get('marketCap')

        # Assemble the final stock object, ensuring market_data is always included
        final_stock = {
            'Symbol': symbol,
            'Name': info.get('longName', stock_info.get('Name', 'Unknown')),
            'Market Cap': _clean_value(round(market_cap_raw / 1_000_000, 2)) if market_cap_raw else 'N/A',
            'Trailing PE': _clean_value(info.get('trailingPE')),
            'Forward PE': _clean_value(info.get('forwardPE')),
            'dividendYield': _clean_value(info.get('dividendYield')),
            'totalRevenue': _clean_value(info.get('totalRevenue')),
            'netIncomeToCommon': _clean_value(info.get('netIncomeToCommon')),
            'profitMargins': _clean_value(info.get('profitMargins')),
            'EV/EBITDA': _clean_value(info.get('enterpriseToEbitda')),
            'flag': stock_info.get("flag", False),
            'category': stock_info.get('category', category),
            'industry': stock_info.get('industry', None),
            'stock_description': info.get('longBusinessSummary'),
            'fiftyTwoWeekHigh': _clean_value(info.get('fiftyTwoWeekHigh')),
            'fiftyTwoWeekLow': _clean_value(info.get('fiftyTwoWeekLow')),
            'earningsDate': earningsDate,
            'beta': _clean_value(info.get('beta')), # Add this line
            'earningsTiming': earningsTiming,
            'stockUrl': stock_info.get("stockUrl", None),
            'exchangeName': info.get('exchange'),
            # Unpack the detailed data dictionary
            **market_data 
        }
        result_data.append(final_stock)
        
        # Attach fund stats for ETFs
        if _is_etf_category(category) and ticker_obj:
            final_stock["fund_stats"] = get_etf_fund_stats(ticker_obj)
            final_stock["stock_description"] = info.get('longBusinessSummary')

    # If the category is ETFs, enrich the data with holdings information.
    if _is_etf_category(category):
        result_data = _add_holdings_to_etfs(result_data)

    # Sort based on category type
    if category == "Owned":
        # Sort "Owned" category alphabetically by ticker
        _sort_by_symbol(result_data)
    else:
        # Sort other categories by market cap (descending)
        _sort_by_market_cap(result_data)

    return result_data

def _get_category_stocks(category, refresh=False):
    """Helper to get stock list, reloading from file if refreshing."""
    current_watchlist = load_watchlist_data() if refresh else watchlist_data
    return current_watchlist.get(category, [])

def fetch_detailed_info(symbols):
    """Fetch detailed info including RSI and price changes for a list of symbols in a batch."""
    if not symbols:
        return {}

    detailed_data = {}
    try:
        # Batch download 1 year of daily data for standard calculations (RSI-14, ATR)
        hist_data_daily = yf.download(symbols, period="1y", interval="1d", progress=False, group_by='ticker')

        # Batch download 3 months of hourly data for the RSI(3) calculation
        hist_data_hourly = yf.download(symbols, period="3mo", interval="1h", progress=False, group_by='ticker')

        for symbol in symbols:
            try:
                # Access the DataFrames for the specific symbol
                # yfinance returns a dict-like object when group_by='ticker'
                symbol_hist_daily = hist_data_daily[symbol] if symbol in hist_data_daily else None
                symbol_hist_hourly = hist_data_hourly[symbol] if symbol in hist_data_hourly else None
                
                # Check for valid data
                if symbol_hist_daily is None or symbol_hist_daily.empty or symbol_hist_daily['Close'].isnull().all():
                    logging.warning(f"No valid historical data for {symbol}, skipping detailed info.")
                    continue

                # Find the last valid (non-NaN) Close price
                valid_indices = symbol_hist_daily.index[symbol_hist_daily['Close'].notna()]
                if len(valid_indices) < 2:
                    logging.warning(f"Insufficient valid data for {symbol} (need at least 2 valid prices)")
                    continue
                
                # Get the latest valid row
                latest_idx = valid_indices[-1]
                latest_data = symbol_hist_daily.loc[latest_idx]
                
                # Get the previous close (the row immediately before the latest, whether it has data or not)
                # This ensures we compare consecutive trading days even if there are gaps
                latest_position = symbol_hist_daily.index.get_loc(latest_idx)
                if latest_position > 0:
                    previous_idx = symbol_hist_daily.index[latest_position - 1]
                    previous_close = symbol_hist_daily.loc[previous_idx, 'Close']
                    # If the immediate previous row is NaN, skip back until we find a valid close
                    rows_skipped = 0
                    while pd.isna(previous_close) and latest_position > 1:
                        rows_skipped += 1
                        latest_position -= 1
                        previous_idx = symbol_hist_daily.index[latest_position - 1]
                        previous_close = symbol_hist_daily.loc[previous_idx, 'Close']
                else:
                    logging.warning(f"No previous data point for {symbol}")
                    continue

                # Calculate price changes with validation
                current_close = latest_data['Close']
                
                if pd.notna(current_close) and pd.notna(previous_close):
                    price_change = float(current_close - previous_close)
                    
                    # If we skipped any rows (NaN values), it means there are missing trading days
                    if rows_skipped > 0:
                        percent_change = "yfinance Missing Data"
                        logging.warning(f"{symbol} missing data - skipped {rows_skipped} rows between {previous_idx.strftime('%Y-%m-%d')} and {latest_idx.strftime('%Y-%m-%d')}")
                    else:
                        percent_change = float((price_change / previous_close * 100)) if previous_close != 0 else None
                else:
                    price_change = None
                    percent_change = None
                
                # Calculate volatility signals using the new service
                signal_fields = get_vol_signal_fields(symbol_hist_daily, symbol_hist_hourly)
                
                # Check for missing data points (NaN values in Close column)
                missing_data = symbol_hist_daily['Close'].isna().sum() > 0

                detailed_data[symbol] = {
                    'Open': _clean_value(latest_data.get('Open')),
                    'Close': _clean_value(current_close),
                    'High': _clean_value(latest_data.get('High')),
                    'Low': _clean_value(latest_data.get('Low')),
                    'Price Change': _clean_value(price_change),
                    'Percent Change': _clean_value(percent_change),
                    'ATR': signal_fields.get('atr'),
                    'ATR_Percent': signal_fields.get('atr_percent'),
                    'RSI1H': signal_fields.get('RSI1H'),
                    'RSI': calculate_rsi(symbol_hist_daily),
                    'RSI_has_missing_data': bool(missing_data),
                    'yRSI': calculate_rsi(symbol_hist_daily.iloc[:-1]) # RSI of the day before
                }
            except Exception as e:
                logging.error(f"Error processing symbol {symbol}: {e}", exc_info=True)
                continue

    except Exception as e:
        # If yfinance or the upstream HTTP client responds with a rate-limit 429, bubble up a RateLimitError
        msg = str(e)
        if '429' in msg or 'Too Many Requests' in msg or 'rate limit' in msg.lower():
            raise RateLimitError(msg)
        logging.error(f"Error in batch fetch_detailed_info for symbols {symbols}: {e}")

    return detailed_data

def calculate_rsi(data, window=14):
    """
    Calculate the Relative Strength Index (RSI) to match TradingView's calculation.
    TradingView's RSI uses a specific variant of EMA (Wilder's Smoothing) which
    is seeded with a Simple Moving Average (SMA).
    """
    try:
        # We need at least `window` periods of changes, which means `window + 1` data points.
        if data.empty or len(data) < window + 1:
            return 'N/A'

        delta = data['Close'].diff(1)
        
        # Separate gains and losses, drop the first NaN value from diff()
        gain = delta.where(delta > 0, 0.0).iloc[1:]
        loss = -delta.where(delta < 0, 0.0).iloc[1:]

        # Calculate initial average gain and loss using SMA for the first `window` periods.
        avg_gain = gain.iloc[:window].mean()
        avg_loss = loss.iloc[:window].mean()

        # Apply Wilder's smoothing for the rest of the periods.
        for i in range(window, len(gain)):
            avg_gain = (avg_gain * (window - 1) + gain.iloc[i]) / window
            avg_loss = (avg_loss * (window - 1) + loss.iloc[i]) / window
        
        if avg_loss == 0:
            rsi = 100.0 if avg_gain > 0 else float('nan')
        else:
            rs = avg_gain / avg_loss
            rsi = 100.0 - (100.0 / (1.0 + rs))

        if math.isnan(rsi) or math.isinf(rsi):
            return 'N/A'
        return rsi
    except Exception as e:
        logging.error(f"Error in RSI calculation: {e}")
        return 'N/A'

def _sort_by_symbol(stock_list):
    """Sorts a list of stocks alphabetically by symbol."""
    stock_list.sort(key=lambda x: x.get('Symbol', '').strip().lower())

def _sort_by_market_cap(stock_list):
    """Sorts a list of stocks by market cap in descending order."""
    stock_list.sort(key=lambda x: (float(x.get('Market Cap', 0)) if x.get('Market Cap') != 'N/A' else 0), reverse=True)

def update_stock_flag(symbol, new_flag):
    """Update the flag in list_watchlist.json and intelligently update the in-memory cache."""
    try:
        with open('list_watchlist.json', 'r') as f:
            data = json.load(f)

        original_category = None
        stock_found = False
        # Find the stock, get its original category, and update its flag
        for category_name, industries in data.get('Categories', {}).items():
            for industry_name, stocks in industries.items():
                for stock in stocks:
                    if stock.get('symbol') == symbol:
                        original_category = category_name
                        stock['flag'] = new_flag
                        stock_found = True
                        break
                if stock_found: break
            if stock_found: break
        
        if not stock_found:
            logging.warning(f"Could not find symbol {symbol} to update flag in list_watchlist.json.")
            return False

        with open('list_watchlist.json', 'w') as f:
            json.dump(data, f, indent=4)

        # --- Now, update the live cache without re-fetching from yfinance ---
        source_cache_key = f"category_{original_category}"
        owned_cache_key = "category_Owned"
        stock_to_move = None

        # Determine source and destination lists in the cache
        source_list_key = owned_cache_key if not new_flag else source_cache_key
        dest_list_key = owned_cache_key if new_flag else source_cache_key

        source_list = cache.get(source_list_key)
        if source_list:
            for i, stock_data in enumerate(source_list):
                if stock_data['Symbol'] == symbol:
                    stock_to_move = source_list.pop(i)
                    break
        
        if stock_to_move:
            stock_to_move['flag'] = new_flag
            dest_list = cache.get(dest_list_key)
            if dest_list is None:
                dest_list = []
                cache.data[dest_list_key] = dest_list # Add new list to cache data directly
            
            dest_list.append(stock_to_move)

            # Sort the destination list to place the new item correctly
            if dest_list_key == owned_cache_key:
                _sort_by_symbol(dest_list)
            else:
                _sort_by_market_cap(dest_list)

            cache.save() # Save the modified cache to disk
            logging.info(f"Moved {symbol} in cache and updated flag.")

        # Finally, reload the watchlist structure for consistency
        global watchlist_data
        watchlist_data = load_watchlist_data()

        return True
    except Exception as e:
        logging.error(f"Error updating flag for {symbol}: {e}")
        return False

def fetch_earnings_data(month, year):
    """Fetch earnings calendar data from cached stock data"""
    try:
        # Load cached stock data
        with open('cache/stock_data.json', 'r') as f:
            cached_data = json.load(f)

        earnings_data = {}
        data = cached_data.get('data', {})
        
        for category_data in data.values():
            for stock in category_data:
                earnings_date = stock.get('earningsDate')
                
                if not earnings_date:
                    continue
                    
                try:
                    date_obj = datetime.strptime(earnings_date, '%m-%d-%Y')
                    
                    if date_obj.month == month and date_obj.year == year:
                        date_str = date_obj.strftime('%m-%d-%Y')
                        
                        if date_str not in earnings_data:
                            earnings_data[date_str] = []
                            
                        earnings_data[date_str].append({
                            'symbol': stock['Symbol'],
                            'name': stock['Name'],
                            'earningsTiming': stock.get('earningsTiming', 'TBA'),
                            'stockUrl': stock.get('stockUrl', ''),
                            'close': stock.get('Close'),
                            'priceChange': stock.get('Price Change'),
                            'percentChange': stock.get('Percent Change'),
                            'rsi': stock.get('RSI')
                        })
                        
                except (ValueError, TypeError) as e:
                    logging.error(f"Error parsing date {earnings_date} for {stock.get('Symbol')}: {e}")
                    continue

        return earnings_data
        
    except Exception as e:
        logging.error(f"Error fetching earnings data: {e}")
        return {}