from http.server import SimpleHTTPRequestHandler
import json
import os
from urllib.parse import urlparse, parse_qs
import logging
from datetime import datetime

from config import STOCK_INFO_ENDPOINT, COMMIT_REFRESH_ENDPOINT
from services.stock_service import fetch_category_data, fetch_detailed_info, cache, update_stock_flag, fetch_earnings_data

class ChartRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler for stock chart and data requests"""
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)

        # Combined endpoint for stock data and detailed info
        if parsed_path.path == STOCK_INFO_ENDPOINT:
            self._handle_stock_info(query_params)

        # Add a new endpoint to commit refresh
        elif parsed_path.path == COMMIT_REFRESH_ENDPOINT:
            self._handle_commit_refresh()

        # Endpoint for earnings calendar data
        elif parsed_path.path == '/api/earnings':
            self._handle_earnings_request(query_params)

        # New endpoint to serve the entire cache file for RSI table
        elif parsed_path.path == '/api/all_stock_data':
            self._handle_all_stock_data()

        # Serve static files
        elif parsed_path.path.startswith('/html/'):
            self._serve_static_file(parsed_path.path)
        else:
            self.send_error(404, "Not found")


    def _handle_stock_info(self, query_params):
        """Handle stock info requests"""
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
                logging.info(f"Fetching fresh data for category: {category}")
                
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
                logging.info(f"Using cached data for category: {category}")
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

    def _handle_commit_refresh(self):
        """Handle commit refresh requests"""
        success = cache.commit_refresh()
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": success}).encode())

    def _handle_all_stock_data(self):
        """Serve the entire cached stock data file."""
        cache_path = os.path.join('cache', 'stock_data.json')
        try:
            with open(cache_path, 'rb') as f:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(f.read())
        except FileNotFoundError:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_message = {'error': 'Cache file not found. Please refresh data on the Watchlist page first.'}
            self.wfile.write(json.dumps(error_message).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def _handle_earnings_request(self, query_params):
        """Handle earnings calendar data requests"""
        try:
            month = int(query_params.get('month', [datetime.now().month])[0])
            year = int(query_params.get('year', [datetime.now().year])[0])
            
            # Get earnings data from your stock service
            earnings_data = fetch_earnings_data(month, year)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(earnings_data).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def _serve_static_file(self, path):
        """Serve static files"""
        file_path = os.path.join('.', path.lstrip('/'))
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

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/update_flag':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)
                
                symbol = data.get('symbol')
                new_flag = data.get('flag')
                
                if symbol is None or new_flag is None:
                    raise ValueError("Missing symbol or flag parameter")
                    
                success = update_stock_flag(symbol, new_flag)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode())
            except Exception as e:
                logging.error(f"Error updating flag: {e}")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode())
        else:
            self.send_error(404, "Endpoint not found")