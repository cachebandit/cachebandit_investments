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
                                'industry': industry  # Add the industry
                            })  # Add to owned category
                        else:
                            filtered_stocks.append({
                                **stock,
                                'category': category,
                                'industry': industry
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

        # Retrieve data from yfinance for each symbol
        try:
            symbol_data = yf.Ticker(symbol)
            info = symbol_data.info
            
            # Ensure essential fields are present
            marketcap = info.get('marketCap')
            name = info.get('longName', 'Unknown')
            trailing_pe = info.get('trailingPE', None)
            forward_pe = info.get('forwardPE', None)
            enterprise_to_ebitda = info.get('enterpriseToEbitda', None)
            stock_description = info.get('longBusinessSummary')
            fiftyTwoWeekHigh = info.get('fiftyTwoWeekHigh', None)
            fiftyTwoWeekLow = info.get('fiftyTwoWeekLow', None)
            earningsDate = info.get('earningsTimestampStart', None)
            exchangeName = info.get('fullExchangeName', None)
            earningsDate = datetime.fromtimestamp(earningsDate).strftime('%m-%d-%Y') if earningsDate else None

            # Format market cap in millions, if available
            format_marketcap = round(marketcap / 1_000_000, 2) if marketcap else 'N/A'

            # Append formatted data for each stock, including the original category
            result_data.append({
                'Symbol': symbol,
                'Name': name,
                'Market Cap': format_marketcap,
                'Trailing PE': trailing_pe,
                'Forward PE': forward_pe,
                'EV/EBITDA': enterprise_to_ebitda,
                'flag': flag,
                'category': stock_info.get('category', category),
                'industry': stock_info.get('industry', None),
                'stock_description': stock_description,
                'fiftyTwoWeekHigh': fiftyTwoWeekHigh,
                'fiftyTwoWeekLow': fiftyTwoWeekLow,
                "earningsDate": earningsDate,
                'exchangeName': exchangeName
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
                'category': category,
                'industry': None,
                'stock_description': None,
                'fiftyTwoWeekHigh': None,
                'fiftyTwoWeekLow': None,
                "earningsDate": None
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