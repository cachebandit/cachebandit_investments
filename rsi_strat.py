import yfinance as yf
import pandas as pd

def calculate_rsi(data, window=14):
    """
    Calculate the RSI (Relative Strength Index) for a given dataset.
    Args:
        data (pd.DataFrame): DataFrame containing at least the 'Close' column.
        window (int): The window size for the RSI calculation. Default is 14.
    Returns:
        pd.Series: A Series with the RSI values for each date.
    """
    try:
        if data.empty:
            return pd.Series(dtype='float64')
        
        delta = data['Close'].diff(1)
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)

        # Use Wilder's exponential moving average method
        avg_gain = gain.ewm(com=window-1, min_periods=window).mean()
        avg_loss = loss.ewm(com=window-1, min_periods=window).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return rsi
    except Exception as e:
        print(f"Error in RSI calculation: {e}")
        return pd.Series(dtype='float64')

def fetch_stock_data(ticker):
    """
    Fetches historical stock data for the given ticker for the past year.
    Args:
        ticker (str): The stock ticker symbol (e.g., 'AAPL' for Apple Inc.).
    Returns:
        pd.DataFrame: A DataFrame with the stock's historical data.
    """
    try:
        stock_data = yf.download(ticker, period="1y", interval="1d")
        if stock_data.empty:
            print(f"No data found for the ticker: {ticker}")
            return pd.DataFrame()
        return stock_data
    except Exception as e:
        print(f"Error fetching stock data: {e}")
        return pd.DataFrame()

def get_rsi_trend(rsi_series):
    """
    Determines whether each day's RSI is increasing or decreasing compared to the previous day.
    Args:
        rsi_series (pd.Series): A Series containing RSI values.
    Returns:
        pd.Series: A Series with values 'up' or 'down' indicating the RSI trend.
    """
    trend = rsi_series.diff().apply(lambda x: 'up' if x > 0 else 'down' if x < 0 else 'same')
    return trend

def find_crossing_rsi_occurrences(stock_data, rsi_value, trend_direction):
    """
    Finds occurrences where the RSI passes the given value in the specified direction.
    Args:
        stock_data (pd.DataFrame): DataFrame containing historical stock data with RSI and trend.
        rsi_value (float): The RSI value to check for.
        trend_direction (str): The trend direction ('up' or 'down') of interest.
    Returns:
        pd.DataFrame: A DataFrame with matching occurrences, including the date, price, RSI, and trend.
    """
    if trend_direction == 'up':
        matches = stock_data[(stock_data['RSI_Trend'] == 'up') &
                             (stock_data['RSI'] > rsi_value) &
                             (stock_data['RSI'].shift(1) <= rsi_value)]
    elif trend_direction == 'down':
        matches = stock_data[(stock_data['RSI_Trend'] == 'down') &
                             (stock_data['RSI'] < rsi_value) &
                             (stock_data['RSI'].shift(1) >= rsi_value)]
    else:
        matches = pd.DataFrame()

    return matches[['Close', 'RSI', 'RSI_Trend']]

def get_rsi_trend_data(ticker):
    """
    Fetches stock data, calculates RSI, determines its trend, and finds occurrences where the RSI
    crosses its current value in the same direction.
    Args:
        ticker (str): The stock ticker symbol.
    Returns:
        dict: A dictionary with current RSI, trend, and past occurrences.
    """
    stock_data = fetch_stock_data(ticker)
    if stock_data.empty:
        return None
    
    stock_data['RSI'] = calculate_rsi(stock_data)
    stock_data['RSI_Trend'] = get_rsi_trend(stock_data['RSI'])
    
    current_rsi = stock_data['RSI'].iloc[-1]
    current_trend = stock_data['RSI_Trend'].iloc[-1]
    
    matching_occurrences = find_crossing_rsi_occurrences(stock_data, current_rsi, current_trend)
    occurrences = matching_occurrences.to_dict('records')
    
    return {
        "current_rsi": round(current_rsi, 2),
        "current_trend": current_trend,
        "occurrences": occurrences
    }
