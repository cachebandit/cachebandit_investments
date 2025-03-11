export function loadTickerTape(symbols) {
    // Remove existing widget script if present
    document.querySelectorAll('#owned-ticker-tape script').forEach(el => el.remove());

    // Create new script element
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
        "symbols": symbols,
        "showSymbolLogo": true,
        "isTransparent": false,
        "displayMode": "compact",
        "colorTheme": "light",
        "locale": "en"
    });

    // Append script to container
    document.querySelector("#owned-ticker-tape .tradingview-widget-container__widget").appendChild(script);
}

export function loadMarketTrendsWidget() {
    // Remove existing widget script if present
    document.querySelectorAll('#market-trends-widget script').forEach(el => el.remove());

    // Create new script element
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-tickers.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
        "symbols": [
            {
                "proName": "BITSTAMP:BTCUSD",
                "title": "Bitcoin"
            },
            {
                "description": "Dow Jones Industrial Average",
                "proName": "FOREXCOM:DJI"
            },
            {
                "proName": "FOREXCOM:SPXUSD",
                "title": "S&P 500 Index"
            },
            {
                "description": "Nasdaq 100",
                "proName": "NASDAQ:NDX"
            },
            {
                "description": "QQQ",
                "proName": "NASDAQ:QQQ"
            },
            {
                "proName": "AMEX:VOO",
                "title": "VOO"
            }
        ],
        "isTransparent": true,
        "showSymbolLogo": true,
        "colorTheme": "light",
        "locale": "en"
    });

    // Append script to container
    document.querySelector("#market-trends-widget .tradingview-widget-container__widget").appendChild(script);
}