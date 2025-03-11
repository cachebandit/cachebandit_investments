// Chart functionality

function showChartPopup(symbol) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'chart-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'chart-popup';
    popup.style.backgroundColor = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '5px';
    popup.style.width = '80%';
    popup.style.height = '80%';
    popup.style.position = 'relative';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '1001';
    
    // Create TradingView widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    
    // Create widget div
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 32px)';
    widgetDiv.style.width = '100%';

    // Add elements to the DOM
    widgetContainer.appendChild(widgetDiv);
    popup.appendChild(closeButton);
    popup.appendChild(widgetContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Create and add the script element for the TradingView widget
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    
    // Set the widget configuration
    const widgetConfig = {
        "autosize": true,
        "symbol": symbol, // Use the symbol passed to the function
        "timezone": "America/Chicago",
        "theme": "light",
        "style": "1",
        "locale": "en",
        "range": "12M",
        "allow_symbol_change": true,
        "calendar": false,
        "studies": [
            "STD;RSI"
        ],
        "support_host": "https://www.tradingview.com"
    };
    
    // Convert the config to a string and assign it to the script's text content
    script.text = JSON.stringify(widgetConfig);
    
    // Append the script to the widget container
    widgetContainer.appendChild(script);
    
    // Close popup when clicking the close button
    closeButton.addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    
    // Close popup when clicking outside
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
} 

export { showChartPopup };