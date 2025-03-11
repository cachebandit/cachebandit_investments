import json
import re


def format_watchlist(name):
    if not name:
        return ""

    name = name.split(",")[0].strip()
    formatted_name = re.sub(r"^(the)\s+", "", name.lower())
    formatted_name = re.sub(r"[\.\'!]", "", formatted_name)
    formatted_name = re.sub(r"\b(inc|corporation|corp|ltd|limited|s\.a\.\b|n\.v\.\b|a\/s|na\/sv|plc|p\.l\.c\.\b|company|& company|manufacturing|holdings|holding|se|systems|& co|communications|motor|co|ag|nv|com|technology|technologies|service|mobil|companies|incorporated|group|international|sa|laboratories)\b", "", formatted_name)
    formatted_name = formatted_name.replace("&", "and").strip()
    
    # Handle 'and' at the end or inside the name
    formatted_name = re.sub(r"-and$", "", formatted_name)
    formatted_name = re.sub(r"(?<!-)and(?!-)", "and", formatted_name)
    
    # Remove '.com'
    formatted_name = re.sub(r"\.com", "", formatted_name)
    
    formatted_name = re.sub(r"\s+", "-", formatted_name)
    return f"https://s3-symbol-logo.tradingview.com/{formatted_name}.svg"

def get_stock_name(symbol, stock_data):
    for category in stock_data['data']['data'].values():
        for stock in category:
            if stock['Symbol'] == symbol:
                return stock['Name']
    return ''


def update_watchlist(json_file, cache_file):
    with open(json_file, 'r') as file:
        target_file = json.load(file)

    with open(cache_file, 'r') as file:
        stock_data = json.load(file)

    for category_name, subcategories in target_file['Categories'].items():
        for subcategory_name, stocks in subcategories.items():
            for stock in stocks:
                symbol = stock.get('symbol', '')
                if symbol:
                    name = get_stock_name(symbol, stock_data)
                    if name:
                        stock['Name'] = name
                        if not stock.get('stockUrl'):
                            stock['stockUrl'] = format_watchlist(name)
                    else:
                        stock['Name'] = stock.get('Name', '')
                        stock['stockUrl'] = stock.get('stockUrl', '')

    with open(json_file, 'w') as file:
        json.dump(target_file, file, indent=4)


if __name__ == "__main__":
    json_file = 'list_watchlist.json'
    cache_file = 'cache/stock_data.json'
    update_watchlist(json_file, cache_file)
    print(f"Updated {json_file} with names and URLs for all stocks.")
