import yfinance as yf
import json

# Define the ticker symbol you want to inspect
# Using AAPL as an example because it has a rich set of data.
ticker_symbol = "ibit"

# Create a Ticker object
ticker = yf.Ticker(ticker_symbol)

# Fetch the .info dictionary, which contains all available data
try:
    stock_info = ticker.info
    print(f"--- All Available yfinance Data for {ticker_symbol} ---")
    
    # Use json.dumps for pretty-printing the dictionary
    print(json.dumps(stock_info, indent=4))
    

except Exception as e:
    print(f"An error occurred while fetching data for {ticker_symbol}: {e}")
