import yfinance as yf

# List of potential tickers for Sony
tickers = ["SONY", "6758.T", "SNE"]  # 6758.T is the ticker for Sony on the Tokyo Stock Exchange

for ticker in tickers:
    print(f"\nFetching historical data for {ticker}...")
    data = yf.Ticker(ticker).history(period="1y", interval="1d")
    if data.empty:
        print(f"{ticker}: No historical data found. It may be delisted or inactive.")
    else:
        print(f"Historical data for {ticker}:\n{data}\n")