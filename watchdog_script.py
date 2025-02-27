import time
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class WatchlistHandler(FileSystemEventHandler):
    def __init__(self, regenerate_command):
        self.regenerate_command = regenerate_command

    def on_modified(self, event):
        if event.src_path.endswith(".py"):
            print(f"File changed: {event.src_path}. Regenerating HTML...")
            subprocess.run(self.regenerate_command, shell=True)
            print("HTML regenerated.")

def start_observer():
    path = "."  # Directory to watch
    regenerate_command = "python generate_chart.py"

    event_handler = WatchlistHandler(regenerate_command)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    print("Monitoring for file changes...")

    return observer

if __name__ == "__main__":
    observer = start_observer()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down observer...")
    finally:
        observer.stop()
        observer.join()
