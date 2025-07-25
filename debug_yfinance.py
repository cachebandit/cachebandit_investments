import yfinance as yf
from datetime import datetime
import json

def inspect_yfinance_data():
    # Fetch data
    ticker = yf.Ticker("MA")
    info = ticker.info
    
    # Get earnings timestamp
    earnings_timestamp = info.get('earningsTimestamp')
    
    if earnings_timestamp:
        date_obj = datetime.fromtimestamp(earnings_timestamp)
        time_str = date_obj.strftime('%H:%M:%S')
        
        # Determine if BMO or AMC
        timing = 'BMO' if date_obj.hour < 12 else 'AMC'
        
        print(f"\n=== Earnings Timing for {ticker.ticker} ===")
        print(f"Date: {date_obj.strftime('%Y-%m-%d')}")
        print(f"Time: {time_str}")
        print(f"Timing Classification: {timing}")
    else:
        print(f"\nNo earnings timestamp found for {ticker.ticker}")

    # Print raw timestamp for verification
    print(f"\nRaw earnings timestamp: {earnings_timestamp}")

if __name__ == "__main__":
    inspect_yfinance_data()