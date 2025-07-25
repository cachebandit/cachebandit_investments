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

// Main JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Get reference to the refresh button
    const refreshButton = document.getElementById('refresh-button');
    
    // Add click event listener to the refresh button
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            this.setAttribute('data-refreshing', 'true'); // Set the refreshing flag
            fetchWatchlistData(); // Call the function to fetch data
        });
    }
    
    // Initial load - use cache
    fetchWatchlistData();

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

async function fetchWatchlistData() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    // Clear only the existing stock data sections, not the entire container
    document.querySelectorAll('.section').forEach(section => section.remove());

    const categories = [
        'Owned',
        'Information Technology',
        'Industrials',
        'Energy & Utilities',
        'Financial Services',
        'Healthcare',
        'Communication Services',
        'Real Estate',
        'Consumer Staples',
        'Consumer Discretionary'
    ];

    try {
        let lastUpdated = '';
        
        for (let category of categories) {
            // Determine if we should refresh the cache
            const refreshParam = document.getElementById('refresh-button').getAttribute('data-refreshing') === 'true' ? 'true' : 'false';
            
            const url = `/saved_stock_info?category=${encodeURIComponent(category)}&refresh=${refreshParam}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok.');
            const responseData = await response.json();
            
            // Extract the data and last_updated timestamp
            const data = responseData.data;
            lastUpdated = responseData.last_updated;
            
            // Render the category data
            renderCategory(category, data);
        }
        
        // Reset the refreshing flag
        document.getElementById('refresh-button').setAttribute('data-refreshing', 'false');
        
        // Update the last updated timestamp from the server
        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }
    } catch (error) {
        console.error('Error fetching watchlist data:', error);
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

function renderCategory(category, data) {
    if (data.length === 0) {
        return; // Skip rendering if there are no stocks in the category
    }

    const section = document.createElement('div');
    section.className = 'section';

    const categoryHeading = document.createElement('h2');
    categoryHeading.textContent = category;
    section.appendChild(categoryHeading);

    // Check if the category is "Owned"
    if (category === 'Owned') {
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
            row.setAttribute('data-category', category);
            row.setAttribute('data-industry', stock.industry || 'Uncategorized');
            
            const priceChangeColor = getColorForChange(stock['Percent Change']);
            const percentChangeColor = getColorForChange(stock['Percent Change']);
            const rsiColor = getRsiBackgroundStyle(stock.RSI);
            const trailingPeColor = getTrailingPeColor(stock["Trailing PE"]);
            const forwardPeColor = getForwardPeColor(stock["Forward PE"], stock["Trailing PE"]);
            const logoUrl = stock["stockUrl"];

            row.innerHTML = `
                <td class="company-name truncate">
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
                        style="width: 20px; height: 20px; margin-left: 10px;"/>
                    <span style="margin-left: 5pt;">${stock.Name}</span>
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

        // Add event listeners after the table is added to the DOM
        table.appendChild(thead);
        table.appendChild(tbody);
        section.appendChild(table);
    } else {
        // Organize stocks by industry for other categories
        const industries = {};

        // Organize stocks by industry
        data.forEach(stock => {
            const industry = stock.industry || 'Uncategorized';
            if (!industries[industry]) {
                industries[industry] = [];
            }
            industries[industry].push(stock);
        });

        // Create a table for each industry
        for (const [industry, stocks] of Object.entries(industries)) {
            if (stocks.length === 0) {
                continue; // Skip rendering if there are no stocks in the industry
            }

            const industrySection = document.createElement('div');
            industrySection.className = 'industry-section';

            const industryHeading = document.createElement('h3');
            industryHeading.textContent = industry;
            industrySection.appendChild(industryHeading);

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
            stocks.forEach(stock => {
                const row = document.createElement('tr');
                row.setAttribute('data-symbol', stock.Symbol);
                
                const priceChangeColor = getColorForChange(stock['Percent Change']);
                const percentChangeColor = getColorForChange(stock['Percent Change']);
                const rsiColor = getRsiBackgroundStyle(stock.RSI);
                const trailingPeColor = getTrailingPeColor(stock["Trailing PE"]);
                const forwardPeColor = getForwardPeColor(stock["Forward PE"], stock["Trailing PE"]);
                const logoUrl = stock["stockUrl"];

                row.innerHTML = `
                    <td class="company-name truncate">
                        <span class="star-icon ${stock.flag ? 'active' : ''}" 
                              data-symbol="${stock.Symbol}" 
                              onclick="toggleFlag(event, '${stock.Symbol}', this)">
                            ★
                        </span>
                        <button class="info-icon" 
                                data-stock-name="${stock.Name}"
                                title="${stock.stock_description || 'No description available'}"
                                data-fifty-two-week-high="${stock['fiftyTwoWeekHigh'] || 'N/A'}"
                                data-current-price="${stock['Close'] ? stock['Close'].toFixed(2) : 'N/A'}"
                                data-fifty-two-week-low="${stock['fiftyTwoWeekLow'] || 'N/A'}"
                                data-earnings-date="${stock['earningsDate'] || 'N/A'}"
                                data-trailing-pe="${stock['Trailing PE'] || 'N/A'}"
                                data-forward-pe="${stock['Forward PE'] || 'N/A'}"
                                data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                                data-trailing-pe-color="${trailingPeColor}"
                                data-forward-pe-color="${forwardPeColor}">
                            <img src="info.png" alt="Info" style="width: 20px; height: 20px; border: none;"/>
                        </button>
                        <img src="${logoUrl}" alt="${stock.Name} Logo" onerror="console.log('Failed to load image:', '${logoUrl}'); this.style.display='none'" 
                            style="width: 20px; height: 20px; margin-left: 10px;  "/>
                        <span style="margin-left: 5pt;">${stock.Name}</span>
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
            industrySection.appendChild(table);
            section.appendChild(industrySection);
        }
    }

    document.querySelector('.container').appendChild(section);
    
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
    // Get all sections including Owned
    const sections = document.querySelectorAll('.section');
    const searchTerm = query.toLowerCase();

    sections.forEach(section => {
        // Get all rows in the current section, including those in Owned
        const rows = section.querySelectorAll('table tbody tr');
        
        if (searchTerm === '') {
            // Show all rows when search is empty
            rows.forEach(row => {
                row.style.display = '';
            });
        } else {
            // Filter rows based on search term
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
    });
}

// Constants for table headers
const TABLE_HEADERS = `
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