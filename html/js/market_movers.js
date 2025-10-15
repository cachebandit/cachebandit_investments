import { 
    formatMarketCap, 
    formatValue, 
    formatChange, 
    formatPercentChange, 
    formatRsi, 
    getColorForChange, 
    getTrailingPeColor, 
    getForwardPeColor, 
    getRsiBackgroundStyle
} from './utils.js';

import { showInfoPopup } from './popup.js';
import { showChartPopup } from './chart.js';
import { getCategoryData } from './dataSource.js';

// Main JavaScript functionality for the Market Movers page

document.addEventListener('DOMContentLoaded', function() {
    // Initial load - use cache
    fetchMarketMoversData();

    // Setup popup handling for info icons
    document.addEventListener('click', function(event) {
        if (event.target.closest('.popup')) {
            return; // Don't close if clicking inside popup
        }
        
        const popups = document.querySelectorAll('.popup');
        popups.forEach(popup => {
            popup.style.display = 'none';
        });
    });
});

async function fetchMarketMoversData() {
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

        // Update the last updated timestamp
        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }

        // Filter and sort stocks
        const movers = allStocks.filter(s => s['Percent Change'] !== null && s['Percent Change'] !== undefined && !isNaN(s['Percent Change']));

        const topGainers = movers
            .filter(s => s['Percent Change'] > 0)
            .sort((a, b) => b['Percent Change'] - a['Percent Change']);

        const topDecliners = movers
            .filter(s => s['Percent Change'] < 0)
            .sort((a, b) => a['Percent Change'] - b['Percent Change']);

        // Render the tables
        renderMoversTable('top-gainers-container', topGainers);
        renderMoversTable('top-decliners-container', topDecliners);

    } catch (error) {
        console.error('Error fetching market movers data:', error);
    }
}

function renderMoversTable(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous content

    if (data.length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = 'No market data available for this category.';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.marginTop = '20px';
        noDataMessage.style.padding = '0 20px';
        container.appendChild(noDataMessage);
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="company-name">Company Name</th>
            <th class="close">Price</th>
            <th class="percent-change" style="width: 12%;">% Change</th>
            <th class="change">Change</th>
            <th class="rsi">RSI</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');
    data.forEach(stock => {
        const row = document.createElement('tr');
        row.setAttribute('data-symbol', stock.Symbol || stock.symbol);
        
        const priceChangeColor = getColorForChange(stock['Percent Change']);
        const percentChangeColor = getColorForChange(stock['Percent Change']);
        const rsiColor = getRsiBackgroundStyle(stock.RSI);
        const trailingPeColor = getTrailingPeColor(stock["Trailing PE"] || stock.trailingPE);
        const forwardPeColor = getForwardPeColor(stock["Forward PE"] || stock.forwardPE, stock["Trailing PE"] || stock.trailingPE);
        const logoUrl = stock.stockUrl;

        row.innerHTML = `
            <td class="company-name">
                <div class="company-cell-content chart-clickable" data-symbol="${stock.Symbol || stock.symbol}">
                <span class="star-icon ${stock.flag ? 'active' : ''}"
                      data-symbol="${stock.Symbol || stock.symbol}" 
                      onclick="toggleFlag(event, '${stock.Symbol || stock.symbol}', this)">
                    ★
                </span>
                <button class="info-icon" 
                        data-stock-name="${stock.Name || stock.name}"
                        data-fifty-two-week-high="${stock.fiftyTwoWeekHigh || 'N/A'}"
                        data-current-price="${stock.Close ? stock.Close.toFixed(2) : 'N/A'}"
                        data-fifty-two-week-low="${stock.fiftyTwoWeekLow || 'N/A'}"
                        data-earnings-date="${stock.earningsDate || 'N/A'}"
                        title="${stock.stock_description || 'No description available'}"
                        data-trailing-pe="${stock['Trailing PE'] || stock.trailingPE || 'N/A'}"
                        data-forward-pe="${stock['Forward PE'] || stock.forwardPE || 'N/A'}"
                        data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                        data-market-cap="${formatMarketCap(stock['Market Cap'] || stock.marketCap)}"
                        data-dividend-yield="${stock.dividendYield || 'N/A'}"
                        data-total-revenue="${stock.totalRevenue || 'N/A'}"
                        data-net-income="${stock.netIncomeToCommon || 'N/A'}"
                        data-profit-margins="${stock.profitMargins || 'N/A'}"
                        data-trailing-pe-color="${trailingPeColor}"
                        data-forward-pe-color="${forwardPeColor}"
                        data-url="${logoUrl}">
                    <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                </button>
                <img src="${logoUrl}" alt="${stock.Name || stock.name} Logo" onerror="console.log('Failed to load image:', '${logoUrl}'); this.style.display='none'" 
                    style="width: 20px; height: 20px;"/>
                <span class="company-text">${stock.Name || stock.name}</span>
                </div>
            </td>
            <td class="close">${stock.Close != null ? formatValue(stock.Close) : '-'}</td>
            <td class="percent-change" style="background-color: ${percentChangeColor};">${stock['Percent Change'] !== undefined ? formatPercentChange(stock['Percent Change']) : '-'}</td>
            <td class="change" style="background-color: ${priceChangeColor};">${stock['Price Change'] !== undefined ? formatChange(stock['Price Change']) : '-'}</td>
            <td class="rsi" style="background-color: ${rsiColor};">${stock.RSI !== undefined ? formatRsi(stock.RSI) : '-'}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add event listeners after the section is added to the DOM
    container.querySelectorAll('.chart-clickable').forEach(clickableCell => {
        clickableCell.addEventListener('click', function(event) {
            // Prevent click from triggering on the star or info icon
            if (event.target.closest('.star-icon') || event.target.closest('.info-icon')) {
                return;
            }
            const symbol = this.dataset.symbol;
            if (symbol) showChartPopup(symbol);
        });
    });
    
    container.querySelectorAll('.info-icon').forEach(infoIcon => {
        infoIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            showInfoPopup(this);
        });
    });
}

window.toggleFlag = function(event, symbol, element) {
    event.stopPropagation();
    const newFlag = !element.classList.contains('active');
    
    fetch('/api/update_flag', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            symbol: symbol,
            flag: newFlag
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            element.classList.toggle('active');
        }
    })
    .catch(error => console.error('Error:', error));
};

function importDependencies() {
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
        import { showInfoPopup } from './popup.js';
        import { showChartPopup } from './chart.js';
        import { 
            formatMarketCap, formatValue, formatChange, formatPercentChange, formatRsi, 
            getColorForChange, getTrailingPeColor, getForwardPeColor, getRsiBackgroundStyle
        } from './utils.js';

        // Expose functions to global scope if needed by inline handlers
        window.showInfoPopup = showInfoPopup;
        window.showChartPopup = showChartPopup;
    `;
    document.head.appendChild(script);
}

importDependencies();