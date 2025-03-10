from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs
import subprocess
import os
import yfinance as yf
from generate_chart import get_chart_data
import logging
from datetime import datetime

PORT = 8000
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Modify the BasicCache class to add a temporary storage mechanism
class StockCache:
    def __init__(self):
        # Create cache directory if it doesn't exist
        os.makedirs('cache', exist_ok=True)
        self.cache_file = 'cache/stock_data.json'
        self.data = {}
        self.temp_data = {}  # Temporary storage for refresh operations
        self.is_refreshing = False  # Flag to track refresh operations
        self.last_updated = datetime.now().strftime('%m/%d %H:%M')  # Initialize with current time
        self._load()
    
    def _load(self):
        """Load cache from file if it exists"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    self.data = json.load(f)
                print(f"Cache loaded with {len(self.data)} entries")
            except Exception as e:
                print(f"Error loading cache: {e}")
                self.data = {}
    
    def save(self):
        """Save cache to file"""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.data, f)
            print(f"Cache saved with {len(self.data)} entries")
            
            # Update the last updated timestamp
            self.last_updated = datetime.now().strftime('%m/%d %H:%M')  # Format: MM/DD HH:MM
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    def get(self, key):
        """Get item from cache"""
        return self.data.get(key)
    
    def set(self, key, value):
        """Set item in cache and save"""
        if self.is_refreshing:
            # During refresh, store in temp_data
            self.temp_data[key] = value
            print(f"Temporarily stored {key} during refresh")
        else:
            # Normal operation, store directly in data
            self.data[key] = value
            self.save()
    
    def start_refresh(self):
        """Start a refresh operation"""
        self.is_refreshing = True
        self.temp_data = {}
        print("Started refresh operation")
    
    def commit_refresh(self):
        """Commit the refresh operation"""
        if self.is_refreshing and self.temp_data:
            # Replace cache data with temp data
            self.data = self.temp_data
            self.temp_data = {}
            self.is_refreshing = False
            self.save()
            print("Committed refresh operation")
            return True
        return False

# Initialize cache
cache = StockCache()

class ChartRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)

        # Handle chart data request
        if parsed_path.path == '/get_chart_data':
            symbol = query_params.get('symbol', [None])[0]
            if symbol:
                chart_data = get_chart_data(symbol)
                if chart_data:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(chart_data).encode())
                else:
                    self.send_error(500, "Error fetching chart data")
            else:
                self.send_error(400, "Symbol not provided")
        
        # Combined endpoint for stock data and detailed info
        elif parsed_path.path == '/saved_stock_info':
            category = query_params.get('category', [None])[0]
            refresh = query_params.get('refresh', ['false'])[0].lower() == 'true'
            is_first = query_params.get('first', ['false'])[0].lower() == 'true'
            is_last = query_params.get('last', ['false'])[0].lower() == 'true'

            if category:
                # Create a cache key for this category
                cache_key = f"category_{category}"
                
                # If this is a refresh request and the first category, start refresh
                if refresh and is_first:
                    cache.start_refresh()
                
                # Check if we should use cached data or refresh
                if refresh or cache.get(cache_key) is None:
                    print(f"Fetching fresh data for category: {category}")
                    
                    # Fetch and return stock data for the specified category
                    category_data = fetch_category_data(category)
                    symbols_list = [stock['Symbol'] for stock in category_data]
                    detailed_data = fetch_detailed_info(symbols_list)

                    # Combine category data with detailed data
                    for stock in category_data:
                        symbol = stock['Symbol']
                        if symbol in detailed_data:
                            stock.update(detailed_data[symbol])

                    # Sort the "Owned" category alphabetically by stock symbol
                    if category == "Owned":
                        category_data.sort(key=lambda x: x['Symbol'].strip().lower())
                    else:
                        # Sort other categories by market cap
                        try:
                            category_data.sort(key=lambda x: (float(x['Market Cap']) if x['Market Cap'] != 'N/A' else 0), reverse=True)
                        except (ValueError, TypeError):
                            # If sorting by market cap fails, sort by symbol
                            category_data.sort(key=lambda x: x['Symbol'].strip().lower())
                    
                    # Save to cache
                    cache.set(cache_key, category_data)
                    
                    # If this is the last category in a refresh, commit the changes
                    if refresh and is_last:
                        cache.commit_refresh()
                else:
                    print(f"Using cached data for category: {category}")
                    category_data = cache.get(cache_key)

                # Include the last_updated timestamp in the response
                response_data = {
                    'data': category_data,
                    'last_updated': cache.last_updated
                }

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode())
            else:
                self.send_error(400, "Category not provided")

        # Add a new endpoint to commit refresh
        elif parsed_path.path == '/commit_refresh':
            success = cache.commit_refresh()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode())

        # Serve static files like HTML, JS, CSS
        elif parsed_path.path.startswith('/html/'):
            file_path = os.path.join('.', parsed_path.path.lstrip('/'))
            if os.path.isfile(file_path):
                self.send_response(200)
                if file_path.endswith('.html'):
                    self.send_header('Content-type', 'text/html')
                elif file_path.endswith('.js'):
                    self.send_header('Content-type', 'application/javascript')
                elif file_path.endswith('.css'):
                    self.send_header('Content-type', 'text/css')
                elif file_path.endswith('.png'):
                    self.send_header('Content-type', 'image/png')
                else:
                    self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Content-Length', str(os.path.getsize(file_path)))
                self.end_headers()
                with open(file_path, 'rb') as file:
                    self.wfile.write(file.read())
            else:
                self.send_error(404, "File not found")
        else:
            self.send_error(404, "Page not found")

# Fetch data for a specific category from JSON data
def fetch_category_data(category):
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
                'stock_description':stock_description,
                'fiftyTwoWeekHigh': fiftyTwoWeekHigh,
                'fiftyTwoWeekLow': fiftyTwoWeekLow,
                "earningsDate": earningsDate
            })

        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
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


# Load `list_watchlist.json` data and create the "Owned" category
def load_watchlist_data():
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
        print(f"Error loading watchlist data: {e}")
        return {}

# Global watchlist data, including the dynamically created "Owned" category
watchlist_data = load_watchlist_data()


# Fetch detailed info including RSI and price changes
def fetch_detailed_info(symbols):
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
            print(f"Error fetching historical data for {stock}: {e}")
            open_price = close_price = high_price = low_price = price_change = percent_change = None

        try:
            rsi = calculate_rsi(hist_data)
            yesterday_rsi = calculate_rsi(hist_data_yesterday)
        except Exception as e:
            print(f"Error calculating RSI for {stock}: {e}")
            rsi = 'N/A'

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
        print(f"Error in RSI calculation: {e}")
        return 'N/A'

def kill_existing_process(port):
    try:
        result = subprocess.run(['lsof', '-ti', f':{port}'], capture_output=True, text=True)
        pids = result.stdout.strip().split('\n')
        for pid in pids:
            if pid:
                subprocess.run(['kill', '-9', pid])
                print(f"Killed process {pid} on port {port}")
    except Exception as e:
        print(f"Error killing process on port {port}: {e}")

if __name__ == "__main__":
    kill_existing_process(PORT)
    with HTTPServer(('localhost', PORT), ChartRequestHandler) as server:
        print(f"Server running on port {PORT}")
        server.serve_forever()
