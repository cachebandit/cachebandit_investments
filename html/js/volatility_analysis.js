import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';
import { getCategoryData } from './dataSource.js';
import { formatMarketCap } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    loadVolatilityData();
});

async function loadVolatilityData() {
    try {
        const categoriesToFetch = [
            'Owned', 'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);
        
        let allStocks = [];
        const processedSymbols = new Set();
        let lastUpdated = '';

        results.forEach(responseData => {
            const items = responseData.items || responseData.data || [];
            if (!lastUpdated && (responseData.updated_at || responseData.last_updated)) {
                lastUpdated = responseData.updated_at || responseData.last_updated;
            }

            items.forEach(stock => {
                const symbol = stock.Symbol || stock.symbol;
                if (!processedSymbols.has(symbol)) {
                    allStocks.push(stock);
                    processedSymbols.add(symbol);
                }
            });
        });

        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }

        // 1. Filter for stocks with ATR% >= 2%
        const highAtrStocks = allStocks
            .filter(stock => stock.ATR_Percent !== null && stock.ATR_Percent !== 'N/A' && parseFloat(stock.ATR_Percent) >= 2)
            .sort((a, b) => parseFloat(b.ATR_Percent) - parseFloat(a.ATR_Percent)); // Sort all by highest ATR% first

        // 2. Split the high ATR stocks into oversold and overbought lists based on RSI(1h)
        const oversoldStocks = highAtrStocks.filter(stock => 
            stock.RSI1H !== null && stock.RSI1H !== 'N/A' && parseFloat(stock.RSI1H) <= 30
        );

        const overboughtStocks = highAtrStocks.filter(stock => 
            stock.RSI1H !== null && stock.RSI1H !== 'N/A' && parseFloat(stock.RSI1H) >= 70
        );

        renderList('oversold-list', oversoldStocks);
        renderList('overbought-list', overboughtStocks);

        // Add event listeners for popups
        const gridContainer = document.querySelector('.volatility-grid-container');
        if (gridContainer) {
            gridContainer.addEventListener('click', function(event) {
                const infoIcon = event.target.closest('.info-icon');
                if (infoIcon) {
                    event.stopPropagation();
                    // The showInfoPopup function expects the button element itself,
                    // which now has all the necessary data attributes.
                    showInfoPopup(infoIcon);
                    return; // Prevent the chart popup from also opening
                }
                const rsiItem = event.target.closest('.rsi-item');
                if (rsiItem) {
                    if (rsiItem && rsiItem.dataset.symbol) {
                        showChartPopup(rsiItem.dataset.symbol);
                    }
                }
            });
        }

    } catch (error) {
        console.error('Error loading Volatility data:', error);
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
        const rsi1h = stock.RSI1H !== 'N/A' ? parseFloat(stock.RSI1H).toFixed(2) : 'N/A';
        const atr = stock.ATR !== 'N/A' ? parseFloat(stock.ATR).toFixed(2) : 'N/A';
        const atrPercent = stock.ATR_Percent !== 'N/A' ? `${parseFloat(stock.ATR_Percent).toFixed(2)}%` : 'N/A';
        const close = stock.Close ? `$${parseFloat(stock.Close).toFixed(2)}` : 'N/A';
        const priceChange = stock['Price Change'] ? stock['Price Change'].toFixed(2) : 'N/A';
        const percentChange = stock['Percent Change'] ? `${parseFloat(stock['Percent Change']).toFixed(2)}%` : 'N/A';
        const changeColorClass = stock['Percent Change'] > 0 ? 'price-up' : (stock['Percent Change'] < 0 ? 'price-down' : '');

        let rsi1hClass = '';
        if (rsi1h <= 15) rsi1hClass = 'rsi-deep-oversold';
        else if (rsi1h >= 85) rsi1hClass = 'rsi-deep-overbought';

        return `
            <div class="rsi-item" data-symbol="${stock.Symbol || stock.symbol}">
                <div class="rsi-company-info">
                    <button class="info-icon" 
                            data-stock-symbol="${stock.Symbol || stock.symbol}"
                            data-stock-name="${stock.Name || stock.name}"
                            data-fifty-two-week-high="${stock.fiftyTwoWeekHigh || 'N/A'}"
                            data-current-price="${stock.Close ? stock.Close.toFixed(2) : 'N/A'}"
                            data-fifty-two-week-low="${stock.fiftyTwoWeekLow || 'N/A'}"
                            data-earnings-date="${stock.earningsDate || 'N/A'}"
                            data-atr-percent="${stock.ATR_Percent || 'N/A'}"
                            data-beta="${stock.beta || 'N/A'}"
                            title="${stock.stock_description || 'No description available'}"
                            data-trailing-pe="${stock['Trailing PE'] || stock.trailingPE || 'N/A'}"
                            data-forward-pe="${stock['Forward PE'] || stock.forwardPE || 'N/A'}"
                            data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                            data-market-cap="${formatMarketCap(stock['Market Cap'] || stock.marketCap)}"
                            data-dividend-yield="${stock.dividendYield || 'N/A'}"
                            data-total-revenue="${stock.totalRevenue || 'N/A'}"
                            data-net-income="${stock.netIncomeToCommon || 'N/A'}"
                            data-profit-margins="${stock.profitMargins || 'N/A'}"
                            data-url="${stock.stockUrl}">
                        <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                    </button>
                    <img src="${stock.stockUrl}" class="rsi-logo" alt="${stock.Name || stock.name} logo" onerror="this.style.display='none'"/>
                    <span class="company-name-text">${stock.Name || stock.name}</span>
                </div>
                <div class="volatility-data-grid">
                    <div class="metric-item price-metric">
                        <span class="metric-label">Price</span>
                        <span class="metric-value">${close}</span>
                    </div>
                    <div class="metric-item change-metric">
                        <span class="metric-label">Change</span>
                        <span class="metric-value ${changeColorClass}">${priceChange} (${percentChange})</span>
                    </div>
                    <div class="metric-item atr-metric">
                        <span class="metric-label">ATR%</span>
                        <span class="metric-value">${atrPercent}</span>
                    </div>
                    <div class="metric-item rsi-metric">
                        <span class="metric-label">RSI(1h)</span>
                        <span class="metric-value ${rsi1hClass}">${rsi1h}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = itemsHtml;
}