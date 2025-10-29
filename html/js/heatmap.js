document.addEventListener('DOMContentLoaded', function() {
    loadHeatmapWidget();
});

function loadHeatmapWidget() {
    const container = document.getElementById('heatmap-widget-container');
    if (!container) return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
        "exchanges": [],
        "dataSource": "AllUSA",
        "grouping": "sector",
        "blockSize": "market_cap_basic",
        "blockColor": "change",
        "locale": "en",
        "symbolUrl": "javascript:void(0);", // Explicitly prevent any navigation on click
        "colorTheme": "light",
        "hasTopBar": true,
        "isDataSetEnabled": true,
        "isZoomEnabled": true,
        "hasSymbolInfo": true,
        "width": "100%",
        "height": "100%"
    });

    container.appendChild(script);
}