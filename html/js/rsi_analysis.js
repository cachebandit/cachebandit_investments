import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';
import { getTrailingPeColor, getForwardPeColor } from './utils.js';

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
        const processedSymbols = new Set();

        // The data is nested under keys like "category_Owned". We iterate through the values of the data object,
        // which are arrays of stocks, and flatten them into a single list.
        Object.values(cachedData.data).forEach(stockArray => {
            stockArray.forEach(stock => {
                if (stock && stock.Symbol && !processedSymbols.has(stock.Symbol)) {
                    allStocks.push(stock);
                    processedSymbols.add(stock.Symbol);
                }
            });
        });

        const stocksWithRsi = allStocks.filter(stock => 
            stock.RSI !== null && stock.RSI !== 'N/A' && !isNaN(parseFloat(stock.RSI))
        );

        const sortByMarketCap = (a, b) => {
            const capA = a['Market Cap'] === 'N/A' ? 0 : parseFloat(a['Market Cap']);
            const capB = b['Market Cap'] === 'N/A' ? 0 : parseFloat(b['Market Cap']);
            return capB - capA; // Descending order
        };

        // --- Categorize stocks based on RSI and yRSI ---
        const oversold = stocksWithRsi
            .filter(s => parseFloat(s.RSI) <= 30)
            .sort(sortByMarketCap);

        const overbought = stocksWithRsi
            .filter(s => parseFloat(s.RSI) >= 70)
            .sort(sortByMarketCap);

        const stocksWithYRsi = stocksWithRsi.filter(s => s.yRSI !== null && s.yRSI !== 'N/A' && !isNaN(parseFloat(s.yRSI)));

        // Was not oversold yesterday, now in the 30-35 band
        const enteringOversold = stocksWithYRsi
            .filter(s => s.yRSI > 30 && s.RSI > 30 && s.RSI <= 35)
            .sort(sortByMarketCap);

        // Was oversold yesterday, now in the 30-35 band
        const exitingOversold = stocksWithYRsi
            .filter(s => s.yRSI <= 30 && s.RSI > 30 && s.RSI <= 35)
            .sort(sortByMarketCap);

        // Was overbought yesterday, now in the 65-70 band
        const exitingOverbought = stocksWithYRsi
            .filter(s => s.yRSI >= 70 && s.RSI < 70 && s.RSI >= 65)
            .sort(sortByMarketCap);

        // --- Render all tables ---
        renderList('overbought-list', overbought);
        renderList('oversold-list', oversold);
        renderList('entering-oversold-list', enteringOversold);
        renderList('exiting-oversold-list', exitingOversold);
        renderList('exiting-overbought-list', exitingOverbought);

        // Add a single event listener to the grid container for chart popups
        const gridContainer = document.querySelector('.rsi-grid-container');
        if (gridContainer) {
            gridContainer.addEventListener('click', function(event) {
                const infoIcon = event.target.closest('.info-icon');
                if (infoIcon) {
                    event.stopPropagation();
                    showInfoPopup(infoIcon);
                } else {
                    const companyInfo = event.target.closest('.rsi-company-info');
                    if (companyInfo) {
                        const rsiItem = companyInfo.closest('.rsi-item');
                        if (rsiItem && rsiItem.dataset.symbol) {
                            showChartPopup(rsiItem.dataset.symbol);
                        }
                    }
                }
            });
        }

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
        const rsi = parseFloat(stock.RSI).toFixed(2);
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

        const trailingPeColor = stock['Trailing PE'] ? getTrailingPeColor(stock['Trailing PE']) : 'inherit';
        const forwardPeColor = stock['Forward PE'] ? getForwardPeColor(stock['Forward PE'], stock['Trailing PE']) : 'inherit';

        return `
            <div class="rsi-item" data-symbol="${stock.Symbol}">
                <div class="rsi-company-info">
                    <button class="info-icon" 
                            data-stock-name="${stock.Name}"
                            data-fifty-two-week-high="${stock.fiftyTwoWeekHigh || 'N/A'}"
                            data-current-price="${stock.Close ? stock.Close.toFixed(2) : 'N/A'}"
                            data-fifty-two-week-low="${stock.fiftyTwoWeekLow || 'N/A'}"
                            data-earnings-date="${stock.earningsDate || 'N/A'}"
                            title="${stock.stock_description || 'No description available'}"
                            data-trailing-pe="${stock['Trailing PE'] || 'N/A'}"
                            data-forward-pe="${stock['Forward PE'] || 'N/A'}"
                            data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                            data-trailing-pe-color="${trailingPeColor}"
                            data-forward-pe-color="${forwardPeColor}"
                            data-url="${stock.stockUrl}">
                        <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                    </button>
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
