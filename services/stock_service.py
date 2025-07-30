import yfinance as yf
import json
import logging
from datetime import datetime
from models.stock_cache import StockCache

# Initialize cache
cache = StockCache()

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

def fetch_category_data(category):
    """Fetch data for a specific category from the watchlist using batch requests."""
    # Retrieve the category's stocks from the loaded JSON data
    category_data = watchlist_data.get(category, [])
    if not category_data:
        return []

    symbols = [stock_info["symbol"] for stock_info in category_data]
    if not symbols:
        return []
    
    # Batch fetch detailed info (prices, RSI)
    detailed_data = fetch_detailed_info(symbols)

    # Batch fetch company info
    tickers = yf.Tickers(' '.join(symbols))
    result_data = []

    for stock_info in category_data:
        symbol = stock_info["symbol"]

        # Get market data first, which should be reliable
        market_data = detailed_data.get(symbol, {})

        try:
            # Then, try to get the company info, which can sometimes fail
            info = tickers.tickers[symbol].info
        except Exception as e:
            logging.warning(f"Could not fetch .info for {symbol}: {e}. Using fallback.")
            info = {} # Use an empty dict if info fails, but we still have market_data

        # Get earnings timestamp
        earnings_timestamp = info.get('earningsTimestamp')
        earningsTiming = 'TBA'
        earningsDate = None
        if earnings_timestamp:
            date_obj = datetime.fromtimestamp(earnings_timestamp)
            earningsDate = date_obj.strftime('%m-%d-%Y')
            earningsTiming = 'BMO' if date_obj.hour < 12 else 'AMC'
        
        # Assemble the final stock object, ensuring market_data is always included
        final_stock = {
            'Symbol': symbol,
            'Name': info.get('longName', stock_info.get('Name', 'Unknown')),
            'Market Cap': round(info.get('marketCap', 0) / 1_000_000, 2) if info.get('marketCap') else 'N/A',
            'Trailing PE': info.get('trailingPE', None),
            'Forward PE': info.get('forwardPE', None),
            'EV/EBITDA': info.get('enterpriseToEbitda', None),
            'flag': stock_info.get("flag", False),
            'category': stock_info.get('category', category),
            'industry': stock_info.get('industry', None),
            'stock_description': info.get('longBusinessSummary'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', None),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', None),
            'earningsDate': earningsDate,
            'earningsTiming': earningsTiming,
            'stockUrl': stock_info.get("stockUrl", None),
            'exchangeName': info.get('exchange'),
            # Unpack the detailed data dictionary
            **market_data 
        }
        result_data.append(final_stock)

    return result_data

def fetch_detailed_info(symbols):
    """Fetch detailed info including RSI and price changes for a list of symbols in a batch."""
    if not symbols:
        return {}

    detailed_data = {}
    try:
        # Batch download historical data. `group_by='ticker'` is convenient.
        hist_data = yf.download(symbols, period="1y", interval="1d", progress=False, group_by='ticker')

        for symbol in symbols:
            # Access the DataFrame for the specific symbol
            symbol_hist = hist_data.get(symbol)
            
            # Check for valid data
            if symbol_hist is None or symbol_hist.empty or symbol_hist['Close'].isnull().all():
                logging.warning(f"No valid historical data for {symbol}, skipping detailed info.")
                continue

            latest_data = symbol_hist.iloc[-1]
            previous_close = symbol_hist.iloc[-2]['Close'] if len(symbol_hist) > 1 else None

            price_change = (latest_data['Close'] - previous_close) if previous_close is not None else None
            percent_change = (price_change / previous_close * 100) if price_change is not None and previous_close != 0 else None
            
            detailed_data[symbol] = {
                'Open': latest_data['Open'],
                'Close': latest_data['Close'],
                'High': latest_data['High'],
                'Low': latest_data['Low'],
                'Price Change': price_change,
                'Percent Change': percent_change,
                'RSI': calculate_rsi(symbol_hist),
                'yRSI': calculate_rsi(symbol_hist.iloc[:-1]) # RSI of the day before
            }
    except Exception as e:
        logging.error(f"Error in batch fetch_detailed_info for symbols {symbols}: {e}")

    return detailed_data

def calculate_rsi(data, window=14):
    """Calculate the Relative Strength Index (RSI)"""
    try:
        if data.empty:
            return 'N/A'
        
        delta = data['Close'].diff(1)
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)

        # Use Wilder's exponential moving average method
        avg_gain = gain.ewm(com=window-1, min_periods=window).mean()
        avg_loss = loss.ewm(com=window-1, min_periods=window).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return rsi.iloc[-1] if not rsi.empty else 'N/A'
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