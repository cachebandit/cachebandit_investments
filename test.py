import yfinance as yf

# List of potential tickers for Sony
tickers = ["BX"]
for ticker in tickers:
    print(yf.Ticker(ticker).info)
"""
for ticker in tickers:
    print(f"\nFetching historical data for {ticker}...")
    data = yf.Ticker(ticker).history(period="1y", interval="1d")
    if data.empty:
        print(f"{ticker}: No historical data found. It may be delisted or inactive.")
    else:
        print(f"Historical data for {ticker}:\n{data}\n")
        """
