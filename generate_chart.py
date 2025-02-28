import yfinance as yf

def get_chart_data(symbol):
    try:
        stock = yf.Ticker(symbol)
        hist_data = stock.history(period="1y")
        
        if hist_data.empty:
            raise ValueError(f"No data for {symbol}")

        hist_data.reset_index(inplace=True)
        labels = hist_data['Date'].dt.strftime('%Y-%m-%d').tolist()
        open_values = hist_data['Open'].round(2).tolist()
        high_values = hist_data['High'].round(2).tolist()
        low_values = hist_data['Low'].round(2).tolist()
        close_values = hist_data['Close'].round(2).tolist()

        company_name = stock.info.get('longName', symbol)

        return {
            'labels': labels,
            'open': open_values,
            'high': high_values,
            'low': low_values,
            'close': close_values,
            'companyName': company_name
        }

    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return None

