import yfinance as yf
import list_watchlist
import get_rsi

def fetch_watchlist_data():
    # Combine all watchlist categories
    formatted_watchlist = format_watchlist(
        list_watchlist.owned + 
        list_watchlist.military_defense + 
        list_watchlist.semiconductors + 
        list_watchlist.banks + 
        list_watchlist.dividends
    )
    return {'stocks': formatted_watchlist}

def format_watchlist(watchlist):
    formatted_watchlist = []
    for stock in watchlist:
        symbol = yf.Ticker(stock)
        info = symbol.info
        
        marketcap = info.get('marketCap', 0)
        format_marketcap = round(marketcap / 1_000_000, 2)
        name = info.get('longName', 'Unknown')
        
        try:
            hist_data = symbol.history(period="1y", interval="1d")
            if not hist_data.empty:
                latest_data = hist_data.iloc[-1]
                open_price = latest_data['Open']
                high_price = latest_data['High']
                low_price = latest_data['Low']
                close_price = latest_data['Close']
                price_change = close_price - open_price
                percent_change = (price_change / open_price) * 100 if open_price != 0 else 0
                rsi = get_rsi.calculate_rsi(hist_data)  # Pass historical data to RSI calculation
            else:
                open_price = high_price = low_price = close_price = price_change = percent_change = rsi = None
        except Exception as e:
            print(f"Error retrieving data for {stock} ({symbol}): {e}")
            open_price = high_price = low_price = close_price = price_change = percent_change = rsi = None
        
        formatted_watchlist.append({
            'Symbol': stock,
            'Name': name,
            'Market Cap': format_marketcap,
            'Open': open_price,
            'High': high_price,
            'Low': low_price,
            'Close': close_price,
            'Price Change': price_change,
            'Percent Change': percent_change,
            'RSI': rsi
        })
    
    return formatted_watchlist
