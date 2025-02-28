from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs
import subprocess
import os
import yfinance as yf
from generate_chart import get_chart_data

PORT = 8000

# Load `list_watchlist.json` data and create the "Owned" category
def load_watchlist_data():
    try:
        with open('list_watchlist.json', 'r') as file:
            data = json.load(file)
            categories = data.get("Categories", {})

            owned_stocks = []
            filtered_categories = {}

            # Filter each category to separate owned stocks
            for category, stocks in categories.items():
                filtered_stocks = []
                for stock in stocks:
                    if stock.get("flag", False):  # Check if flag is true
                        owned_stocks.append({
                            **stock,  # Include all stock data
                            'category': category  # Preserve the original category
                        })  # Add to owned category
                    else:
                        filtered_stocks.append(stock)  # Keep in original category if not owned

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

            if category:
                # Fetch and return stock data for the specified category
                category_data = fetch_category_data(category)
                symbols_list = [stock['Symbol'] for stock in category_data]  # Get symbols for detailed info
                detailed_data = fetch_detailed_info(symbols_list)  # Fetch detailed info for all symbols

                # Combine category data with detailed data
                for stock in category_data:
                    symbol = stock['Symbol']
                    if symbol in detailed_data:
                        stock.update(detailed_data[symbol])  # Add detailed info to the stock data

                # Sort the "Owned" category alphabetically by stock symbol
                if category == "Owned":
                    category_data.sort(key=lambda x: x['Symbol'].strip().lower())  # Sort alphabetically by symbol
                else:
                    # Sort other categories by market cap
                    category_data.sort(key=lambda x: (x['Market Cap'] if x['Market Cap'] != 'N/A' else 0), reverse=True)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(category_data).encode())
            else:
                self.send_error(400, "Category not provided")

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
            
            # Format market cap in millions, if available
            format_marketcap = round(marketcap / 1_000_000, 2) if marketcap else 'N/A'

            # Append formatted data for each stock, including the original category
            result_data.append({
                'Symbol': symbol,
                'Name': name,
                'Market Cap': format_marketcap,
                'flag': flag,  # Include flag status for the frontend
                'category': stock_info.get('category', category)  # Add the original category
            })

        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            result_data.append({
                'Symbol': symbol,
                'Name': 'Unknown',
                'Market Cap': 'N/A',
                'flag': flag,
                'category': category  # Default to the requested category
            })

    return result_data

# Fetch detailed info including RSI and price changes
def fetch_detailed_info(symbols):
    detailed_data = {}
    
    for stock in symbols:
        symbol_data = yf.Ticker(stock)
        
        try:
            hist_data = symbol_data.history(period="1y", interval="1d")
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
            'RSI': rsi
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

#VERSION 2. Allows for dynamic updating list_watchlist.html

from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs
import subprocess
import os
import yfinance as yf
from generate_chart import get_chart_data
import os
import time

PORT = 8000


# Global variables for caching
watchlist_data = {}
watchlist_last_modified = 0

# Load `