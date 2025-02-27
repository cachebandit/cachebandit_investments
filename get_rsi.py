import logging
import download_data
#from list_stock import owned, sp500, nasdaq, alert_list

logging.basicConfig(
    filename='data_download.log',  # Log file name
    level=logging.ERROR,  # Log level
    format='%(asctime)s - %(levelname)s - %(message)s'  # Log message format
)

oversold = []
overbought = []
error_symbols = []
sorted_oversold = []
sorted_overbought = []


def calculate_rsi(data, window=14):
    try:
        if data.empty:
            return 'N/A'
        
        delta = data['Close'].diff(1)
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)

        # Use Wilder's exponential moving average method
        avg_gain = gain.ewm(com=window-1, min_periods=window).mean()
        avg_loss = loss.ewm(com=window-1, min_periods=window).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return rsi.iloc[-1] if not rsi.empty else 'N/A'
    except Exception as e:
        print(f"Error in RSI calculation: {e}")
        return 'N/A'


def pull_rsi_data(stock):
    if '.' in stock:
        stock = stock.replace('.', '-')

    try:
        data = download_data.download_data(stock, period="1y", interval="1d", auto_adjust=True)
        if data is None:
            # Add symbols that failed to the error list
            error_symbols.append(stock + ': ERROR ON DOWNLOAD')
            return None
        # Check if DataFrame is empty after download
        if data.empty:
            if stock not in error_symbols:
                error_symbols.append(stock)
                return None
            
        data['RSI'] = calculate_rsi(data)
        
        # Get the latest date
        latest_date = data.index[-1]
        
        # Get the latest RSI value
        latest_rsi = data['RSI'].iloc[-1]
        
        # Format and print the output
        print(f"{stock} - {latest_date.strftime('%Y-%m-%d')} - RSI: {latest_rsi:.2f}")
        
        if latest_rsi < 30:
            if stock not in oversold:
                oversold.append({"symbol": stock, "market_cap": download_data.market_cap(stock), "rsi": latest_rsi})
    
        elif latest_rsi > 70:
            if stock not in overbought:
                overbought.append({"symbol": stock, "market_cap": download_data.market_cap(stock), "rsi": latest_rsi})

        print('-' * 50)

        # Highlight overbought or oversold conditions

        

    except Exception as e:
        error_message = f"Error processing data for {stock}. Error: {e}"
        print(error_message)

def format_cap(stock):
    return f"{stock['market_cap'] / 1_000_000_000:.2f}B"

# Fetch data and calculate RSI for each stock in the lists
def search_individual():
    stock = 'MDT'
    pull_rsi_data(stock)
    return sorted_overbought, sorted_oversold, error_symbols

def search_owned():
    for stock in owned:    
        pull_rsi_data(stock)

def search_list():
    for stock in sp500:
    #for stock in nasdaq:
        pull_rsi_data(stock)

def search_alert():
    alert_rsi_list = []
    for stock in alert_list:
        pull_rsi_data(stock)
        #alert_rsi_list.append([stock, rsi])
    return alert_rsi_list


#    download_data.industry_info(stock)


if __name__ == "__main__":
    search_individual()
    #search_owned()
    #search_list()
    #search_alert()
    sorted_overbought = sorted(overbought, key=lambda x: x['market_cap'], reverse=True)
    sorted_oversold = sorted(oversold, key=lambda x: x['market_cap'], reverse=True)

    print('OVERBOUGHT STOCKS: ')
    for stock in sorted_overbought:
        print(f"Symbol: {stock['symbol']}, Market Cap: {format_cap(stock)}, RSI: {stock['rsi']:.2f}")
    print()
    print('OVERSOLD STOCKS: ' )
    for stock in sorted_oversold:
        print(f"Symbol: {stock['symbol']}, Market Cap: {format_cap(stock)}, RSI: {stock['rsi']:.2f}")
    print()
    print('ERROR STOCKS: ' + str(error_symbols))

