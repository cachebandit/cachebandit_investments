import yfinance as yf
import pandas as pd

# Import the calculation functions from your services
from services.stock_service import calculate_rsi
from services.volatility_service import calculate_rsi_series

# List of potential tickers for Sony
ticker_symbol = "meta"
ticker = yf.Ticker(ticker_symbol)

print(f"--- Testing RSI Calculations for {ticker_symbol} ---")

# --- Calculate 14-day RSI (Daily Chart) ---
print("\nFetching 1 year of daily data for 14-day RSI...")
hist_daily = ticker.history(period="1y", interval="1d")

if not hist_daily.empty:
    # This function is called from stock_service.py
    rsi_14d = calculate_rsi(hist_daily, window=14)
    print(f"Calculated 14-day RSI (Daily): {rsi_14d:.2f}" if isinstance(rsi_14d, float) else f"Calculated 14-day RSI (Daily): {rsi_14d}")
else:
    print("Could not fetch daily data.")


# --- Calculate 3-period RSI (Hourly Chart) ---
print("\nFetching 3 months of hourly data for 1-hour RSI...")
hist_hourly = ticker.history(period="3mo", interval="1h")

if not hist_hourly.empty:
    # This function is called from volatility_service.py and returns a Series
    rsi_1h_series = calculate_rsi_series(hist_hourly['Close'], window=3)
    
    if not rsi_1h_series.empty and pd.notna(rsi_1h_series.iloc[-1]):
        rsi_1h_latest = rsi_1h_series.iloc[-1]
        print(f"Calculated 3-period RSI (1-hour): {rsi_1h_latest:.2f}")
    else:
        print("Could not calculate 1-hour RSI from the data.")
else:
    print("Could not fetch hourly data.")
