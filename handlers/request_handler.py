from http.server import SimpleHTTPRequestHandler
import json
import os
import traceback
from urllib.parse import urlparse, parse_qs
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from config import STOCK_INFO_ENDPOINT, COMMIT_REFRESH_ENDPOINT
from services.stock_service import fetch_category_data, fetch_detailed_info, cache as _cache, update_stock_flag, fetch_earnings_data, RateLimitError, watchlist_data, _is_etf_category, fetch_etf_top_holdings

log = logging.getLogger(__name__)

DEFAULT_TTL = 60 * 60 * 24  # 24h

def get_cache(key):
    try:
        return _cache.get(key)
    except Exception:
        log.exception("get_cache failed for key=%s", key)
        return None

def set_cache_safe(key, value, ttl_seconds=DEFAULT_TTL):
    """
    Calls your underlying StockCache.set(...) without using unsupported kwargs.
    Tries common signatures; NEVER passes 'timeout=' (your cache rejects it).
    """
    # 1) (key, value, ttl_seconds) positional
    try:
        return _cache.set(key, value, ttl_seconds)
    except TypeError:
        pass
    # 2) (key, value) only
    try:
        return _cache.set(key, value)
    except TypeError:
        pass
    # 3) Last resort – swallow (don’t crash the endpoint)
    log.error("set_cache_safe: unable to call StockCache.set for key=%s", key)
    return None

def _etf_holdings_cache_key(sym: str) -> str:
    return f"etf_holdings::{(sym or '').upper()}"

def _add_holdings_to_etfs(items, fetch_func):
    """Add top-holdings into each ETF item; never raise."""
    out = []
    for item in items or []:
        try:
            sym = item.get("Symbol") or item.get("symbol")
            if not sym:
                out.append(item); continue

            key = _etf_holdings_cache_key(sym)
            cached = get_cache(key)
            if cached is None:
                try:
                    holdings = fetch_func(sym)  # list[ {symbol,name,weight} ]
                    set_cache_safe(key, holdings, ttl_seconds=DEFAULT_TTL)
                except Exception:
                    log.exception("fetch_etf_top_holdings failed for %s", sym)
                    holdings = []
            else:
                holdings = cached
            item["holdings"] = holdings
        except Exception:
            log.exception("enrich holdings failed for item=%s", item.get("Symbol"))
        finally:
            out.append(item)
    return out

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

        try:
            # Use separate cache namespaces for ETFs vs stocks
            if _is_etf_category(category):
                cache_key = "etfs:saved_stock_info:v2"
            else:
                cache_key = f"stocks:saved_stock_info:{category.strip()}"

            # Try to serve from cache first if not a refresh request
            if not refresh:
                cached_data = get_cache(cache_key)
                if cached_data:
                    logging.info(f"Using cached data for category: {category}")
                    response_data = { 'data': cached_data, 'last_updated': _cache.last_updated }
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response_data).encode())
                    return

            # If refreshing or cache is empty, fetch data
            logging.info(f"Fetching fresh data for category: {category}")
            data = fetch_category_data(category, refresh=refresh)

            if _is_etf_category(category):
                data = _add_holdings_to_etfs(data, fetch_etf_top_holdings)

            set_cache_safe(cache_key, data, ttl_seconds=3600)
            
            # Format the timestamp consistently with the cache
            utc_now = datetime.now(ZoneInfo("UTC"))
            ct_time = utc_now.astimezone(ZoneInfo("US/Central"))
            last_updated_str = ct_time.strftime('%m/%d %I:%M %p CT')
            
            response_payload = {"data": data, "last_updated": last_updated_str}
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_payload).encode())

        except Exception as e:
            log.exception("handle_saved_stock_info failed")
            self.send_response(500)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"load_items failed: {e}".encode())

    def _handle_commit_refresh(self):
        """Handle commit refresh requests"""
        success = _cache.commit_refresh()
        
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