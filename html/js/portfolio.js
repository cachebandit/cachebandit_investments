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

// Main JavaScript functionality for the Portfolio page

document.addEventListener('DOMContentLoaded', function() {
    // Initial load - use cache
    fetchPortfolioData();

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

    // Add event listener to the search input
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterTable(this.value);
            clearSearch.style.display = this.value ? 'inline' : 'none';
        });
    }

    // Add event listener to the clear search button
    if (clearSearch) {
        clearSearch.addEventListener('click', function() {
            searchInput.value = '';
            filterTable('');
            clearSearch.style.display = 'none';
        });
    }
});

async function fetchPortfolioData() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    const category = 'Owned';

    try {
        const responseData = await getCategoryData(category);
        
        // Handle both local server format (data) and static build format (items)
        const data = responseData.items || responseData.data || [];
        
        // Render the category data
        renderPortfolio(data);
        
    } catch (error) {
        console.error('Error fetching portfolio data:', error);
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

function renderPortfolio(data) {
    const container = document.getElementById('stock-table-container');
    container.innerHTML = ''; // Clear previous content

    if (data.length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = 'Your portfolio is empty. Add stocks from the Watchlist by clicking the star icon.';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.marginTop = '20px';
        container.appendChild(noDataMessage);
        return;
    }

    // Clear the container now that we have data to render
    document.querySelectorAll('.section').forEach(section => section.remove());

    const section = document.createElement('div');
    section.className = 'section';

    const categoryHeading = document.createElement('h2');
    categoryHeading.textContent = 'Owned';
    section.appendChild(categoryHeading);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="company-name">Company Name</th>
            <th class="symbol">Symbol</th>
            <th class="market-cap">Market Cap</th>
            <th class="open">Open</th>
            <th class="high">High</th>
            <th class="low">Low</th>
            <th class="close">Close</th>
            <th class="change">Change</th>
            <th class="percent-change">% Change</th>
            <th class="rsi">RSI</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');
    data.forEach(stock => {
        const row = document.createElement('tr');
        row.setAttribute('data-symbol', stock.Symbol);
        row.setAttribute('data-category', 'Owned');
        row.setAttribute('data-industry', stock.industry || 'Uncategorized');
        
        const priceChangeColor = getColorForChange(stock['Percent Change']);
        const percentChangeColor = getColorForChange(stock['Percent Change']);
        const rsiColor = getRsiBackgroundStyle(stock.RSI);
        const trailingPeColor = getTrailingPeColor(stock["Trailing PE"]);
        const forwardPeColor = getForwardPeColor(stock["Forward PE"], stock["Trailing PE"]);
        const logoUrl = stock["stockUrl"];

        row.innerHTML = `
            <td class="company-name">
                <div class="company-cell-content">
                <span class="star-icon ${stock.flag ? 'active' : ''}" 
                      data-symbol="${stock.Symbol}" 
                      onclick="toggleFlag(event, '${stock.Symbol}', this)">
                    ★
                </span>
                <button class="info-icon" 
                        data-stock-name="${stock.Name}"
                        data-fifty-two-week-high="${stock['fiftyTwoWeekHigh'] || 'N/A'}"
                        data-current-price="${stock['Close'] ? stock['Close'].toFixed(2) : 'N/A'}"
                        data-fifty-two-week-low="${stock['fiftyTwoWeekLow'] || 'N/A'}"
                        data-earnings-date="${stock['earningsDate'] || 'N/A'}"
                        title="${stock.stock_description || 'No description available'}"
                        data-trailing-pe="${stock['Trailing PE'] || 'N/A'}"
                        data-forward-pe="${stock['Forward PE'] || 'N/A'}"
                        data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                        data-trailing-pe-color="${trailingPeColor}"
                        data-forward-pe-color="${forwardPeColor}"
                        data-url="${logoUrl}">
                    <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                </button>
                <img src="${logoUrl}" alt="${stock.Name} Logo" onerror="console.log('Failed to load image:', '${logoUrl}'); this.style.display='none'" 
                    style="width: 20px; height: 20px;"/>
                <span class="company-text">${stock.Name}</span>
                </div>
            </td>
            <td class="symbol" style="cursor: pointer; color: blue; text-decoration: underline;" data-symbol="${stock.Symbol}">${stock.Symbol}</td>
            <td class="market-cap">${formatMarketCap(stock['Market Cap'])}</td>
            <td class="open">${stock.Open !== undefined ? formatValue(stock.Open) : '-'}</td>
            <td class="high">${stock.High !== undefined ? formatValue(stock.High) : '-'}</td>
            <td class="low">${stock.Low !== undefined ? formatValue(stock.Low) : '-'}</td>
            <td class="close">${stock.Close !== undefined ? formatValue(stock.Close) : '-'}</td>
            <td class="change" style="background-color: ${priceChangeColor};">${stock['Price Change'] !== undefined ? formatChange(stock['Price Change']) : '-'}</td>
            <td class="percent-change" style="background-color: ${percentChangeColor};">${stock['Percent Change'] !== undefined ? formatPercentChange(stock['Percent Change']) : '-'}</td>
            <td class="rsi" style="background-color: ${rsiColor};">${stock.RSI !== undefined ? formatRsi(stock.RSI) : '-'}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    section.appendChild(table);

    container.appendChild(section);
    
    // Add event listeners after the section is added to the DOM
    section.querySelectorAll('.symbol').forEach(symbolCell => {
        symbolCell.addEventListener('click', function(event) {
            event.preventDefault();
            const symbol = this.getAttribute('data-symbol');
            showChartPopup(symbol);
        });
    });
    
    section.querySelectorAll('.info-icon').forEach(infoIcon => {
        infoIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            showInfoPopup(this);
        });
    });
}

function filterTable(query) {
    const searchTerm = query.toLowerCase();
    const rows = document.querySelectorAll('.section table tbody tr');

    rows.forEach(row => {
        const symbol = row.querySelector('.symbol').textContent.toLowerCase();
        const name = row.querySelector('.company-name').textContent.toLowerCase();
        
        if (symbol.includes(searchTerm) || name.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
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
            // Instead of just toggling the class, we'll remove the row
            // as it no longer belongs in the "Owned" portfolio view.
            const row = element.closest('tr');
            if (row) {
                row.style.transition = 'opacity 0.5s ease';
                row.style.opacity = '0';
                setTimeout(() => row.remove(), 500);
            }
        }
    })
    .catch(error => console.error('Error:', error));
};

// Since this JS file will be loaded from portfolio.html, we need to import these functions
// so they are available in the global scope for inline event handlers.

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