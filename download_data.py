import yfinance as yf
from yfinance.exceptions import YFInvalidPeriodError
import logging
import json

def download_data(stock, period, interval, auto_adjust):
    try:
        # Attempt to download data
        print(f"Downloading data for {stock} with period '{period}', interval '{interval}', auto_adjust={auto_adjust}...")
        data = yf.download(stock, period=period, interval=interval, auto_adjust=auto_adjust)
        print(f"Data for {stock} downloaded successfully.")
        return data
    
    except YFInvalidPeriodError as e:
        logging.error(f"Invalid period for {stock}. Error: {e}")
        print(f"Invalid period for {stock}. Error logged.")
    
    except (ValueError, KeyError) as e:
        logging.error(f"Error with parameters or key for {stock}. Error: {e}")
        print(f"Error with parameters or key for {stock}. Error logged.")
    
    except Exception as e:
        logging.error(f"Failed to download data for {stock}. Error: {e}")
        print(f"Failed to download data for {stock}. Error logged.")
    return None

#Grabs All Stock Info
def download_stock_info(stock):
    stock_info = yf.Ticker(stock).info
    return stock_info

# Grabs the Industy for Any Given Stock Symbol
def industry_info(stock):
    industry = download_stock_info(stock).get('industryKey', 'None')
    ticker = download_stock_info(stock).get('symbol')
    print(ticker + ', ' + industry)

#Grabs Market Cap 
def market_cap(stock):
    mCap = download_stock_info(stock).get('marketCap')
    return mCap

#Grabs Companies Name
def company_name(stock):
    name = download_stock_info(stock).get('shortName')
    return name

#Grabs All Info From yfinance and Puts Into JSON
def get_company_info():
    #ADD SYMBOL HERE
    ticker = 'UNH'
    yf_info_json = json.dumps(download_stock_info(ticker), indent = 4)
    file_path = 'yf_info_json.json'

    # Write the pretty-printed JSON to the file
    with open(file_path, 'w') as file:
        file.write(yf_info_json)

    print(f"JSON has been written to {file_path}")


if __name__ == "__main__":
    get_company_info()