from http.server import SimpleHTTPRequestHandler
import json
import os
from urllib.parse import urlparse, parse_qs
import logging

from config import CHART_ENDPOINT, STOCK_INFO_ENDPOINT, COMMIT_REFRESH_ENDPOINT
from services.stock_service import fetch_category_data, fetch_detailed_info, cache

class ChartRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler for stock chart and data requests"""
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)

        # Handle chart data request
        if parsed_path.path == CHART_ENDPOINT:
            self._handle_chart_data(query_params)
        
        # Combined endpoint for stock data and detailed info
        elif parsed_path.path == STOCK_INFO_ENDPOINT:
            self._handle_stock_info(query_params)

        # Add a new endpoint to commit refresh
        elif parsed_path.path == COMMIT_REFRESH_ENDPOINT:
            self._handle_commit_refresh()

        # Serve static files like HTML, JS, CSS
        elif parsed_path.path.startswith('/html/'):
            self._serve_static_file(parsed_path.path)
        else:
            self.send_error(404, "Page not found")

    def _handle_chart_data(self, query_params):
        """Handle chart data requests"""
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