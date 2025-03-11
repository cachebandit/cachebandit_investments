from http.server import HTTPServer
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

def get_local_ip():
    """Get the local IP address of the machine"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.254.254.254', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

if __name__ == "__main__":
    # Ensure cache directory exists
    os.makedirs('cache', exist_ok=True)
    
    # Kill any existing process on the port
    kill_existing_process(PORT)
    
    # Get the local IP address
    local_ip = get_local_ip()
    
    # Start the server
    server_address = (local_ip, PORT)  # Bind to local network IP address
    httpd = HTTPServer(server_address, ChartRequestHandler)
    print(f"Serving on {local_ip}:{PORT}...")
    httpd.serve_forever()