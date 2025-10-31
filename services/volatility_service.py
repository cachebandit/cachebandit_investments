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
    Classic RSI but with a short window (3-day).
    Uses Wilder-style smoothing for avg gains/losses.
    """
    delta = close_prices.diff()

    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Wilder-style smoothing: same idea as ATR (EMA with alpha=1/window)
    avg_gain = gain.ewm(alpha=1/window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/window, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
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
      - rsi3m
    """

    result = {
        "atr": 'N/A',
        "atr_percent": 'N/A',
        "rsi3m": 'N/A'
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
            rsi_series = calculate_rsi_series(hourly_df['Close'], window=3)
            rsi_latest = rsi_series.iloc[-1]
            if pd.notna(rsi_latest):
                result["rsi3m"] = round(float(rsi_latest), 2)
        except Exception as e:
            logging.error(f"RSI(3) calc error: {e}")

    return result