import pandas as pd
import numpy as np
import logging

def calculate_atr_series(df, window=14):
    """
    Return a full ATR series using Wilder's smoothing.
    df must have columns: 'High', 'Low', 'Close'
    """
    high = df['High']
    low = df['Low']
    close = df['Close']

    # True Range components
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()

    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    # Wilder's smoothing = EMA with alpha = 1/window
    atr = true_range.ewm(alpha=1/window, adjust=False).mean()
    return atr


def calculate_atr_latest(df, window=14):
    """
    Convenience: returns the latest ATR value (float) or 'N/A' if not enough data.
    """
    if df.empty or len(df) < window:
        return 'N/A'

    try:
        atr_series = calculate_atr_series(df, window=window)
        return atr_series.iloc[-1]
    except Exception as e:
        logging.error(f"Error in ATR calculation: {e}")
        return 'N/A'


def calculate_rsi_series(close_prices, window=3):
    """
    Calculate the Relative Strength Index (RSI) to match TradingView's calculation.
    This version returns the entire series of RSI values, seeding the initial
    average with an SMA, which is critical for matching platform values.
    """
    if close_prices.empty or len(close_prices) < window + 1:
        return pd.Series(dtype=float)

    delta = close_prices.diff()

    gain = delta.where(delta > 0, 0.0).iloc[1:]
    loss = -delta.where(delta < 0, 0.0).iloc[1:]

    # Create series to store average gains and losses
    avg_gain = pd.Series(index=gain.index, dtype=float)
    avg_loss = pd.Series(index=loss.index, dtype=float)

    # Calculate initial average gain and loss using SMA for the first `window` periods.
    avg_gain.iloc[window-1] = gain.iloc[:window].mean()
    avg_loss.iloc[window-1] = loss.iloc[:window].mean()

    # Apply Wilder's smoothing for the rest of the periods.
    for i in range(window, len(gain)):
        avg_gain.iloc[i] = (avg_gain.iloc[i-1] * (window - 1) + gain.iloc[i]) / window
        avg_loss.iloc[i] = (avg_loss.iloc[i-1] * (window - 1) + loss.iloc[i]) / window

    # Calculate RS and RSI
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    return rsi


def get_vol_signal_fields(daily_df, hourly_df):
    """
    Calculates volatility and timing signals.
    
    Args:
        daily_df: DataFrame with daily data for ATR calculation.
        hourly_df: DataFrame with hourly data for RSI(3) calculation.

    Returns dict with:
      - atr
      - atr_percent
      - RSI1H
    """

    result = {
        "atr": 'N/A',
        "atr_percent": 'N/A',
        "RSI1H": 'N/A'
    }

    # --- ATR & ATR% (from daily data) ---
    if daily_df is not None and not daily_df.empty:
        atr_val = calculate_atr_latest(daily_df, window=14)
        latest_close = daily_df['Close'].iloc[-1] if 'Close' in daily_df and len(daily_df['Close']) else None

        if isinstance(atr_val, (int, float)) and latest_close and latest_close != 0:
            atr_pct = (atr_val / latest_close) * 100
            result["atr"] = round(float(atr_val), 4)
            result["atr_percent"] = round(float(atr_pct), 2)

    # --- RSI(3) (from hourly data) ---
    if hourly_df is not None and not hourly_df.empty:
        try:
            rsi_series = calculate_rsi_series(hourly_df['Close'], window=14)
            rsi_latest = rsi_series.iloc[-1]
            if pd.notna(rsi_latest):
                result["RSI1H"] = round(float(rsi_latest), 2)
        except Exception as e:
            logging.error(f"RSI(3) calc error: {e}")

    return result