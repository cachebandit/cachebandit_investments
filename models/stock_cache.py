import os
import json
from datetime import datetime
import logging
from config import CACHE_DIR, CACHE_FILE
from zoneinfo import ZoneInfo

class StockCache:
    """Cache for storing stock data to reduce API calls"""
    
    def __init__(self):
        # Create cache directory if it doesn't exist
        os.makedirs(CACHE_DIR, exist_ok=True)
        self.cache_file = os.path.join(CACHE_DIR, CACHE_FILE)
        self.data = {}
        self.temp_data = {}  # Temporary storage for refresh operations
        self.is_refreshing = False  # Flag to track refresh operations
        self.last_updated = None  # Initialize as None
        self._load()
    
    def _load(self):
        """Load cache from file if it exists"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    cache_data = json.load(f)
                    
                    # Check if the cache data has the new format with metadata
                    if isinstance(cache_data, dict) and 'data' in cache_data and 'last_updated' in cache_data:
                        self.data = cache_data['data']
                        self.last_updated = cache_data['last_updated']
                    else:
                        # Old format - just data
                        self.data = cache_data
                        # Set a default timestamp
                        self.last_updated = datetime.now().strftime('%m/%d %I:%M %p')  # 12-hour format
                        
                logging.info(f"Cache loaded with {len(self.data)} entries")
            except Exception as e:
                logging.error(f"Error loading cache: {e}")
                self.data = {}
                self.last_updated = datetime.now().strftime('%m/%d %I:%M %p')  # 12-hour format
        else:
            # No cache file exists
            self.data = {}
            self.last_updated = datetime.now().strftime('%m/%d %I:%M %p')  # 12-hour format
    
    def save(self):
        """Save cache to file"""
        try:
            # Get current UTC time, convert to US/Central, and format it
            utc_now = datetime.now(ZoneInfo("UTC"))
            ct_time = utc_now.astimezone(ZoneInfo("US/Central"))
            self.last_updated = ct_time.strftime('%m/%d %I:%M %p CT')
            
            # Save both the data and the timestamp
            cache_data = {
                'data': self.data,
                'last_updated': self.last_updated
            }
            
            with open(self.cache_file, 'w') as f:
                json.dump(cache_data, f)
            logging.info(f"Cache saved with {len(self.data)} entries")
        except Exception as e:
            logging.error(f"Error saving cache: {e}")
    
    def get(self, key):
        """Get item from cache"""
        return self.data.get(key)
    
    def set(self, key, value):
        """Set item in cache and save"""
        if self.is_refreshing:
            # During refresh, store in temp_data
            self.temp_data[key] = value
            logging.debug(f"Temporarily stored {key} during refresh")
        else:
            # Normal operation, store directly in data
            self.data[key] = value
            self.save()
    
    def start_refresh(self):
        """Start a refresh operation"""
        self.is_refreshing = True
        self.temp_data = {}
        logging.info("Started refresh operation")
    
    def commit_refresh(self):
        """Commit the refresh operation"""
        if self.is_refreshing and self.temp_data:
            # Replace cache data with temp data
            self.data = self.temp_data
            self.temp_data = {}
            self.is_refreshing = False
            utc_now = datetime.now(ZoneInfo("UTC"))
            ct_time = utc_now.astimezone(ZoneInfo("US/Central"))
            self.last_updated = ct_time.strftime('%m/%d %I:%M %p CT')
            self.save()
            logging.info("Committed refresh operation")
            return True
        return False 