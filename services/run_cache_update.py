from .stock_service import fetch_category_data, cache, _is_etf_category

# These categories must match the ones used by the UI and build_static.py
ACTIVE_CATEGORIES = [
    "Owned",
    "Information Technology",
    "Financial Services",
    "Industrials",
    "Energy & Utilities",
    "Healthcare",
    "Communication Services",
    "Real Estate",
    "Consumer Staples",
    "Consumer Discretionary",
    "ETFs",
]

def main():
    print("Starting cache refresh process...")
    
    # Start the refresh operation. This tells the cache to use temporary storage
    # and prevents saving the file after every category.
    cache.start_refresh()

    for category in ACTIVE_CATEGORIES:
        print(f"  - Fetching data for: {category}")
        data = fetch_category_data(category)
        
        # Use the correct cache key format
        if _is_etf_category(category):
            key = "etfs:saved_stock_info:v2"
        else:
            key = f"stocks:saved_stock_info:{category.strip()}"
        cache.set(key, data)

    # Commit the refresh. This replaces the old cache data with the new data
    # and saves the entire file once with an updated timestamp.
    cache.commit_refresh()
    print("Cache refresh complete. File 'cache/stock_data.json' has been updated.")

if __name__ == "__main__":
    main()