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
            filtered_categories = {}

            # Process each category and its industries
            for category, industry in categories.items():
                filtered_stocks = []
                for industry, stocks in industry.items():
                    for stock in stocks:
                        if stock.get("flag", False):  # Check if flag is true
                            owned_stocks.append({
                                **stock,  # Include all stock data
                                'category': category,  # Preserve the original category
                                'industry': industry,  # Add the industry
                                'stockUrl': stock.get("stockUrl", None)
                            })  # Add to owned category
                        else:
                            filtered_stocks.append({
                                **stock,
                                'category': category,
                                'industry': industry,
                                'stockUrl': stock.get("stockUrl", None)
                            })  # Keep in original category if not owned

                # Store filtered stocks for each category
                filtered_categories[category] = filtered_stocks

            # Add the "Owned" category to the filtered categories
            filtered_categories["Owned"] = owned_stocks
            return filtered_categories

    except Exception as e:
        logging.error(f"Error loading watchlist data: {e}")
        return {}

# Global watchlist data, including the dynamically created "Owned" category
watchlist_data = load_watchlist_data()

def fetch_category_data(category):
    """Fetch data for a specific category from the watchlist"""
    # Retrieve the category's stocks from the loaded JSON data
    category_data = watchlist_data.get(category, [])
    result_data = []

    for stock_info in category_data:
        symbol = stock_info["symbol"]
        flag = stock_info.get("flag", False)  # Get the flag status from JSON
        stockUrl = stock_info.get("stockUrl", None)  # Get the alternative name, if available

        # Retrieve data from yfinance for each symbol
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Get market data along with other data
            market_data = fetch_detailed_info([symbol]).get(symbol, {})
            
            # Get earnings timestamp
            earnings_timestamp = info.get('earningsTimestamp')
            
            # Determine earnings timing
            earningsTiming = 'TBA'
            earningsDate = None
            
            if earnings_timestamp:
                date_obj = datetime.fromtimestamp(earnings_timestamp)
                earningsDate = date_obj.strftime('%m-%d-%Y')
                earningsTiming = 'BMO' if date_obj.hour < 12 else 'AMC'
            
            # Add to result data
            result_data.append({
                'Symbol': symbol,
                'Name': info.get('longName', 'Unknown'),
                'Market Cap': round(info.get('marketCap', 0) / 1_000_000, 2) if info.get('marketCap') else 'N/A',
                'Trailing PE': info.get('trailingPE', None),
                'Forward PE': info.get('forwardPE', None),
                'EV/EBITDA': info.get('enterpriseToEbitda', None),
                'flag': flag,
                'category': stock_info.get('category', category),
                'industry': stock_info.get('industry', None),
                'stock_description': info.get('longBusinessSummary'),
                'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', None),
                'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', None),
                'close': market_data.get('Close'),
                'priceChange': market_data.get('Price Change'),
                'percentChange': market_data.get('Percent Change'),
                'rsi': market_data.get('RSI'),
                'earningsDate': earningsDate,
                'earningsTiming': earningsTiming,
                'stockUrl': stockUrl,
                'exchangeName': info.get('exchange')
            })

        except Exception as e:
            logging.error(f"Error fetching data for {symbol}: {e}")
            result_data.append({
                'Symbol': symbol,
                'Name': 'Unknown',
                'Market Cap': 'N/A',
                'flag': flag,
                'Trailing PE': None,
                'Forward PE': None,
                'EV/EBITDA': None,
                'category': None,
                'industry': None,
                'stock_description': None,
                'fiftyTwoWeekHigh': None,
                'fiftyTwoWeekLow': None,
                'earningsDate': None,
                'exchangeName': None,
                'stockUrl': stockUrl
            })

    return result_data

def fetch_detailed_info(symbols):
    """Fetch detailed info including RSI and price changes"""
    detailed_data = {}
    
    for stock in symbols:
        symbol_data = yf.Ticker(stock)
        
        try:
            hist_data = symbol_data.history(period="1y", interval="1d")
            hist_data_yesterday = hist_data.iloc[:-1]
            if not hist_data.empty:
                latest_data = hist_data.iloc[-1]
                previous_close = hist_data.iloc[-2]['Close'] if len(hist_data) > 1 else None
                open_price = latest_data['Open']
                close_price = latest_data['Close']
                high_price = latest_data['High']
                low_price = latest_data['Low']
                
                if previous_close is not None:
                    price_change = close_price - previous_close
                    percent_change = (price_change / previous_close) * 100 if previous_close != 0 else 0
                else:
                    price_change = percent_change = None
            else:
                open_price = close_price = high_price = low_price = price_change = percent_change = None
        except Exception as e:
            logging.error(f"Error fetching historical data for {stock}: {e}")
            open_price = close_price = high_price = low_price = price_change = percent_change = None

        try:
            rsi = calculate_rsi(hist_data)
            yesterday_rsi = calculate_rsi(hist_data_yesterday)
        except Exception as e:
            logging.error(f"Error calculating RSI for {stock}: {e}")
            rsi = 'N/A'
            yesterday_rsi = 'N/A'

        detailed_data[stock] = {
            'Open': open_price,
            'Close': close_price,
            'High': high_price,
            'Low': low_price,
            'Price Change': price_change,
            'Percent Change': percent_change,
            'RSI': rsi,
            'yRSI': yesterday_rsi
        }

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

def update_stock_flag(symbol, new_flag):
    """Update the flag status for a stock in the watchlist"""
    try:
        with open('list_watchlist.json', 'r') as f:
            data = json.load(f)
            
        # Update the flag for the matching symbol
        for category in data['Categories'].values():
            for subcategory in category.values():
                for stock in subcategory:
                    if stock.get('symbol') == symbol:
                        stock['flag'] = new_flag
                        break
        
        with open('list_watchlist.json', 'w') as f:
            json.dump(data, f, indent=4)
            
        # Reload the watchlist data after update
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
                            'close': stock.get('close'),
                            'priceChange': stock.get('priceChange'),
                            'percentChange': stock.get('percentChange'),
                            'rsi': stock.get('rsi')
                        })
                        
                except (ValueError, TypeError) as e:
                    logging.error(f"Error parsing date {earnings_date} for {stock.get('Symbol')}: {e}")
                    continue

        return earnings_data
        
    except Exception as e:
        logging.error(f"Error fetching earnings data: {e}")
        return {}