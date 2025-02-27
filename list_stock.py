import pandas as pd
import download_data
import json

owned = [
    'AAPL', 
    'AMZN', 
    'CRWD', 
    'CVS', 
    'CVX', 
    'DIS', 
    'HUM', 
    'JNJ', 
    'LULU', 
    'MDB', 
    'META', 
    'MMM', 
    'MSFT', 
    'NKE', 
    'NVDA', 
    'QQQ', 
    'SNOW', 
    'SONY', 
    'TGT', 
    'TSLA', 
    'UNH', 
    'WBA'
    ]

alert_list = [
    'SONY',
    'COST'
    ]

sp500_url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies#S&P_500_component_stocks"
sp500_tables = pd.read_html(sp500_url)
sp500_df = sp500_tables[0]
sp500 = sp500_df['Symbol'].tolist()

sp500GICS = sp500_df[['Symbol', 'GICS Sector']]

nasdaq_url = "https://en.wikipedia.org/wiki/Nasdaq-100"
nasdaq_tables = pd.read_html(nasdaq_url)
nasdaq_df = nasdaq_tables[4]
nasdaq = nasdaq_df['Ticker'].tolist()

#Organizes S&P500 by Sector
def organize_by_sector():
    organized_dict = {}

    for _, row in sp500GICS.iterrows():
        symbol = row['Symbol']
        if '.' in symbol:
            symbol = symbol.replace('.', '-')
        sector = row['GICS Sector']
        print(symbol)
        market_cap = download_data.market_cap(symbol)
        company_name = download_data.company_name(symbol)

        if sector not in organized_dict:
            organized_dict[sector] = []
        
        if market_cap is not None:
            organized_dict[sector].append({'symbol': symbol, 'company_name': company_name, 'market_cap': market_cap})


    # Sort companies within each sector by market capitalization in descending order
    for sector in organized_dict:
        organized_dict[sector] = sorted(organized_dict[sector], key=lambda x: x['market_cap'], reverse=True)

    return organized_dict

#Takes Organized S&P500 List and Puts Into JSON 
def sp500_json():
    sp500_gics_json = json.dumps(organize_by_sector(), indent = 4)
    file_path = 'sp500_gics_json.json'

    # Write the pretty-printed JSON to the file
    with open(file_path, 'w') as file:
        file.write(sp500_gics_json)

    print(f"JSON has been written to {file_path}")

#Takes JSON and Converts Back To List
def sp500_list():
    with open('sp500_gics_json.json', 'r') as file:
        data = json.load(file)

    symbols = [item for item in data['Industrials']]
    print(symbols)


if __name__ == "__main__":
    #sp500_json()
    sp500_list()

