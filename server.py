from http.server import HTTPServer, SimpleHTTPRequestHandler
import logging
import os
import subprocess
import socket
from handlers.request_handler import ChartRequestHandler
from config import PORT

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

def kill_existing_process(port):
    """Kill any process running on the specified port"""
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
    # Change to the project root directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Ensure cache directory exists
    os.makedirs('cache', exist_ok=True)
    
    # Kill any existing process on the port
    kill_existing_process(PORT)
    
    # Start the server
    server_address = ('localhost', PORT)
    httpd = HTTPServer(server_address, ChartRequestHandler)
    print(f"Serving on http://localhost:{PORT}/html/watchlist.html")
    httpd.serve_forever()