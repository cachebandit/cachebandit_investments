document.addEventListener('DOMContentLoaded', function() {
    loadRsiData();
});

async function loadRsiData() {
    try {
        const response = await fetch('/api/all_stock_data');
        if (!response.ok) {
            throw new Error('Failed to load cached stock data.');
        }
        const cachedData = await response.json();
        
        let allStocks = [];
        Object.values(cachedData.data).forEach(category => {
            allStocks = allStocks.concat(category);
        });

        const stocksWithRsi = allStocks.filter(stock => 
            stock.rsi !== null && stock.rsi !== 'N/A' && !isNaN(parseFloat(stock.rsi))
        );

        const sortByMarketCap = (a, b) => {
            const capA = a['Market Cap'] === 'N/A' ? 0 : parseFloat(a['Market Cap']);
            const capB = b['Market Cap'] === 'N/A' ? 0 : parseFloat(b['Market Cap']);
            return capB - capA; // Descending order
        };

        // --- Categorize stocks based on RSI and yRSI ---
        const oversold = stocksWithRsi
            .filter(s => parseFloat(s.rsi) <= 30)
            .sort(sortByMarketCap);

        const overbought = stocksWithRsi
            .filter(s => parseFloat(s.rsi) >= 70)
            .sort(sortByMarketCap);

        const stocksWithYRsi = stocksWithRsi.filter(s => s.yRSI !== null && s.yRSI !== 'N/A' && !isNaN(parseFloat(s.yRSI)));

        // Was not oversold yesterday, now in the 30-40 band
        const enteringOversold = stocksWithYRsi
            .filter(s => s.yRSI > 30 && s.rsi > 30 && s.rsi <= 40)
            .sort(sortByMarketCap);

        // Was oversold yesterday, now in the 30-40 band
        const exitingOversold = stocksWithYRsi
            .filter(s => s.yRSI <= 30 && s.rsi > 30 && s.rsi <= 40)
            .sort(sortByMarketCap);

        // Was overbought yesterday, now in the 60-70 band
        const exitingOverbought = stocksWithYRsi
            .filter(s => s.yRSI >= 70 && s.rsi < 70 && s.rsi >= 60)
            .sort(sortByMarketCap);

        // --- Render all tables ---
        renderList('overbought-list', overbought);
        renderList('oversold-list', oversold);
        renderList('entering-oversold-list', enteringOversold);
        renderList('exiting-oversold-list', exitingOversold);
        renderList('exiting-overbought-list', exitingOverbought);

    } catch (error) {
        console.error('Error loading RSI data:', error);
    }
}

function renderList(containerId, stocks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (stocks.length === 0) {
        container.innerHTML = '<p style="padding: 10px; color: #6c757d; font-size: 14px;">No stocks in this category.</p>';
        return;
    }

    const itemsHtml = stocks.map(stock => {
        const rsi = parseFloat(stock.rsi).toFixed(2);
        const close = stock.Close ? `$${parseFloat(stock.Close).toFixed(2)}` : 'N/A';
        const priceChange = stock['Price Change'] ? stock['Price Change'].toFixed(2) : 'N/A';
        const percentChange = stock['Percent Change'] ? `${parseFloat(stock['Percent Change']).toFixed(2)}%` : 'N/A';
        const changeColor = stock['Percent Change'] > 0 ? 'price-up' : (stock['Percent Change'] < 0 ? 'price-down' : '');

        let rsiClass = '';
        const rsiValue = parseFloat(rsi);
        if (rsiValue >= 70) rsiClass = 'rsi-deep-overbought';       // Green
        else if (rsiValue >= 65) rsiClass = 'rsi-entering-overbought'; // Yellow
        else if (rsiValue <= 30) rsiClass = 'rsi-deep-oversold';       // Red
        else if (rsiValue <= 35) rsiClass = 'rsi-entering-oversold'; // Orange

        return `
            <div class="rsi-item">
                <div class="rsi-company-info">
                    <img src="${stock.stockUrl}" class="rsi-logo" alt="${stock.Name} logo" onerror="this.style.display='none'"/>
                    <span class="company-name-text">${stock.Name}</span>
                </div>
                <div class="rsi-market-data">
                    <span>${close}</span>
                    <span class="${changeColor}">${priceChange} (${percentChange})</span>
                    <span class="${rsiClass}">RSI: ${rsi}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = itemsHtml;
}
