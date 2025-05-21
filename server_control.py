import subprocess
import sys
import os
import signal

PORT = 8000
SCRIPT_NAME = 'server.py'
LOG_FILE = 'server_control.log'  # Log file to capture server output

def start_server():
    """Start the server."""
    print("Starting server...")
    try:
        # Use Popen with os setsid to detach the process from the terminal
        with open(LOG_FILE, 'w') as log_file:
            process = subprocess.Popen(
                ['python3', SCRIPT_NAME],
                stdout=log_file,
                stderr=log_file,
                preexec_fn=os.setsid  # This detaches the process so it doesn't get killed when the script exits
            )
        print(f"Server started on port {PORT} with PID {process.pid}")
    except Exception as e:
        print(f"Error starting server: {e}")

def stop_server():
    """Stop the server."""
    print("Stopping server...")
    try:
        result = subprocess.run(['lsof', '-ti', f':{PORT}'], capture_output=True, text=True)
        pids = result.stdout.strip().split('\n')
        for pid in pids:
            if pid:
                subprocess.run(['kill', '-9', pid])
                print(f"Killed process {pid} on port {PORT}")
    except Exception as e:
        print(f"Error stopping server: {e}")

def restart_server():
    """Restart the server."""
    stop_server()
    start_server()

def status_server():
    """Check if the server is running."""
    result = subprocess.run(['lsof', '-ti', f':{PORT}'], capture_output=True, text=True)
    if result.stdout.strip():
        pids = result.stdout.strip().split('\n')
        for pid in pids:
            print(f"Server is running on port {PORT} with PID {pid}")
    else:
        print("Server is not running")

def main():
    if len(sys.argv) != 2:
        print("Usage: server_control.py [start|stop|restart|status]")
        sys.exit(1)

    command = sys.argv[1]
    if command == 'start':
        start_server()
    elif command == 'stop':
        stop_server()
    elif command == 'restart':
        restart_server()
    elif command == 'status':
        status_server()
    else:
        print("Invalid command. Use [start|stop|restart|status]")

if __name__ == "__main__":
    main()
