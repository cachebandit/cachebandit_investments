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

// Main JavaScript functionality

function changeBg(pctChange) {
  if (pctChange === null || pctChange === undefined || !isFinite(pctChange)) {
    return "var(--hover-bg)";
  }
  const abs = Math.abs(pctChange);
  // Buckets: <1%, 1–3%, 3–6%, >=6%
  const green = ["#d4edda", "#a5d6a7", "#81c784", "#388e3c"];
  const red   = ["#ffe3e0", "#ffb3ad", "#ff7961", "#d74444"];
  const idx = abs < 1 ? 0 : abs < 3 ? 1 : abs < 6 ? 2 : 3;
  return pctChange >= 0 ? green[idx] : red[idx];
}

document.addEventListener('DOMContentLoaded', function() {
    const isLocal = () => ["localhost","127.0.0.1"].includes(location.hostname);

    // Get reference to the refresh button
    const refreshButton = document.getElementById('refresh-button');
    const buttonContainer = refreshButton ? refreshButton.closest('.button-container') : null;

    // Add click event listener to the refresh button
    if (isLocal() && buttonContainer) {
        buttonContainer.style.display = 'flex'; // Show the button only on localhost
        refreshButton.addEventListener('click', function() {
            this.setAttribute('data-refreshing', 'true'); // Set the refreshing flag
            fetchWatchlistData({ refresh: true, scope: 'watchlist' }); // Call the function to fetch data
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

async function fetchWatchlistData(opts = {}) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    const categories = [
        'Owned',
        'Information Technology',
        'Financial Services',
        'Industrials',
        'Energy & Utilities',
        'Healthcare',
        'Communication Services',
        'Real Estate',
        'Consumer Staples',
        'Consumer Discretionary'
    ];

    try {
        let lastUpdated = '';
        const isRefreshing = opts.refresh || false;

        for (const [index, category] of categories.entries()) {
            const responseData = await getCategoryData(category, { refresh: isRefreshing, scope: 'watchlist' });

            // Extract the data and last_updated timestamp
            // Handle both local server format (data, last_updated) and static build format (items, updated_at)
            const data = responseData.items || responseData.data || [];
            lastUpdated = responseData.updated_at || responseData.last_updated;

            // On the first successful data fetch (either initial load or refresh),
            // clear the old content before rendering the new data.
            if (index === 0 && (isRefreshing || document.querySelector('.section') === null)) {
                document.querySelectorAll('.section').forEach(section => section.remove());
            }
            
            // Render the category data
            renderCategory(category, data);
        }
        
        // Reset the refreshing flag
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton) {
            refreshButton.setAttribute('data-refreshing', 'false');
        }
        
        // Update the last updated timestamp from the server
        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }
    } catch (error) {
        console.error('Error fetching watchlist data:', error);        showRateLimitBanner(error.message, 15, true);
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

// Helper to show a dismissible rate-limit banner. `seconds` controls auto-dismiss timeout.
function showRateLimitBanner(message, seconds = 10, showRetry = true) {
    // Avoid duplicates
    if (document.getElementById('rate-limit-overlay')) return;

    // Ensure refresh flag and spinner are cleared
    const refreshBtn = document.getElementById('refresh-button');
    if (refreshBtn) refreshBtn.setAttribute('data-refreshing', 'false');
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.id = 'rate-limit-overlay';
    overlay.className = 'rate-limit-overlay';

    const modal = document.createElement('div');
    modal.className = 'rate-limit-modal';

    const content = document.createElement('div');
    content.className = 'message';
    content.textContent = message || 'Rate Limit Hit - Try Again Later';

    const sub = document.createElement('div');
    sub.className = 'subtext';
    sub.textContent = 'Try again in a few seconds.';
    content.appendChild(sub);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '8px';

    if (showRetry) {
        const retry = document.createElement('button');
        retry.className = 'cta';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => {
            // close and trigger a fresh fetch
            const ov = document.getElementById('rate-limit-overlay');
            if (ov) ov.remove();
            // set refreshing flag and call fetch
            if (refreshBtn) refreshBtn.setAttribute('data-refreshing', 'true');
            fetchWatchlistData();
        });
        controls.appendChild(retry);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        const ov = document.getElementById('rate-limit-overlay');
        if (ov) ov.remove();
    });
    controls.appendChild(closeBtn);

    modal.appendChild(content);
    modal.appendChild(controls);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (seconds && seconds > 0) {
        setTimeout(() => {
            const ov = document.getElementById('rate-limit-overlay');
            if (ov) ov.remove();
        }, seconds * 1000);
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
                <th class="market-cap">Market Cap</th>
                <th class="open">Open</th>
                <th class="high">High</th>
                <th class="low">Low</th>
                <th class="close">Close</th>
                <th class="change">Change</th>
                <th class="rsi">RSI</th>
            </tr>
        `;

        const tbody = document.createElement('tbody');
        data.forEach(stock => {
            const row = document.createElement('tr');
            row.setAttribute('data-symbol', stock.Symbol || stock.symbol);
            row.setAttribute('data-category', category);
            row.setAttribute('data-industry', stock.industry || 'Uncategorized');
            
            const rsiColor = getRsiBackgroundStyle(stock.RSI);
            const trailingPeColor = getTrailingPeColor(stock["Trailing PE"] || stock.trailingPE);
            const forwardPeColor = getForwardPeColor(stock["Forward PE"] || stock.forwardPE, stock["Trailing PE"] || stock.trailingPE);
            const logoUrl = stock.stockUrl;

            const industry = stock.industry || '—';

            // Combine Change and % Change
            const changeNum = parseFloat(stock['Price Change']);
            const pctChangeNum = parseFloat(stock['Percent Change']);
            const changeText = (isFinite(changeNum) && isFinite(pctChangeNum))
                ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${pctChangeNum >= 0 ? '+' : ''}${pctChangeNum.toFixed(2)}%)`
                : 'N/A';

            row.innerHTML = `
                <td class="company-name">
                    <div class="company-cell">
                        <span class="star-icon ${stock.flag ? 'active' : ''}" 
                              data-symbol="${stock.Symbol || stock.symbol}" 
                              onclick="toggleFlag(event, '${stock.Symbol || stock.symbol}', this)">★</span>
                        <button class="company-info-btn"
                                data-stock-name="${stock.Name || stock.name}"
                                data-fifty-two-week-high="${stock.fiftyTwoWeekHigh || 'N/A'}"
                                data-current-price="${stock.Close ? stock.Close.toFixed(2) : 'N/A'}"
                                data-fifty-two-week-low="${stock.fiftyTwoWeekLow || 'N/A'}"
                                data-earnings-date="${stock.earningsDate || 'N/A'}"
                                data-beta="${stock.beta || 'N/A'}"
                                data-atr-percent="${stock.ATR_Percent || 'N/A'}"
                                title="${stock.stock_description || 'No description available'}"
                                data-trailing-pe="${stock['Trailing PE'] || stock.trailingPE || 'N/A'}"
                                data-forward-pe="${stock['Forward PE'] || stock.forwardPE || 'N/A'}"
                                data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                                data-market-cap="${formatMarketCap(stock['Market Cap'] || stock.marketCap)}"
                                data-dividend-yield="${stock.dividendYield || 'N/A'}"
                                data-total-revenue="${stock.totalRevenue || 'N/A'}"
                                data-net-income="${stock.netIncomeToCommon || 'N/A'}"
                                data-profit-margins="${stock.profitMargins || 'N/A'}"
                                data-url="${logoUrl}"><img src="info.png" alt="Info"></button>
                        <img class="company-logo chart-clickable" src="${logoUrl}" alt="${stock.Name || stock.name} logo" onerror="this.style.display='none'" data-symbol="${stock.Symbol || stock.symbol}">
                        <div class="company-text-block">
                            <div class="company-name-line">
                                <span class="company-name-text chart-clickable" data-symbol="${stock.Symbol || stock.symbol}">${stock.Name || stock.name}</span>
                                <span class="ticker-chip">${stock.Symbol || stock.symbol}</span>
                            </div>
                            <div class="company-subline">${industry}</div>
                        </div>
                        <div class="market-cap-mobile">Market Cap: ${formatMarketCap(stock['Market Cap'] || stock.marketCap)}</div>
                    </div>
                </td>
                <td class="market-cap"><div class="badge-metric">${formatMarketCap(stock['Market Cap'] || stock.marketCap)}</div></td>
                <td class="open">${stock.Open != null ? formatValue(stock.Open) : '-'}</td>
                <td class="high">${stock.High != null ? formatValue(stock.High) : '-'}</td>
                <td class="low">${stock.Low != null ? formatValue(stock.Low) : '-'}</td>
                <td class="close">${stock.Close != null ? formatValue(stock.Close) : '-'}</td>
                <td class="change">
                  <div class="badge-change" style="background-color: ${isFinite(pctChangeNum) ? changeBg(pctChangeNum) : 'var(--hover-bg)'};">
                    ${changeText}
                  </div>
                </td>
                <td class="rsi"><div class="badge-metric" style="background-color: ${rsiColor};">${stock.RSI !== undefined ? formatRsi(stock.RSI) : '-'}</div></td>
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
                    <th class="market-cap">Market Cap</th>
                    <th class="open">Open</th>
                    <th class="high">High</th>
                    <th class="low">Low</th>
                    <th class="close">Close</th>
                    <th class="change">Change</th>
                    <th class="rsi">RSI</th>
                </tr>
            `;

            const tbody = document.createElement('tbody');
            stocks.forEach(stock => {
                const row = document.createElement('tr');
                row.setAttribute('data-symbol', stock.Symbol || stock.symbol);
                
                const rsiColor = getRsiBackgroundStyle(stock.RSI);
                const trailingPeColor = getTrailingPeColor(stock["Trailing PE"] || stock.trailingPE);
                const forwardPeColor = getForwardPeColor(stock["Forward PE"] || stock.forwardPE, stock["Trailing PE"] || stock.trailingPE);
                const logoUrl = stock.stockUrl;

                const industry = stock.industry || '—';

                // Combine Change and % Change
                const changeNum = parseFloat(stock['Price Change']);
                const pctChangeNum = parseFloat(stock['Percent Change']);
                const changeText = (isFinite(changeNum) && isFinite(pctChangeNum))
                    ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${pctChangeNum >= 0 ? '+' : ''}${pctChangeNum.toFixed(2)}%)`
                    : 'N/A';

                row.innerHTML = `
                    <td class="company-name">
                        <div class="company-cell">
                            <span class="star-icon ${stock.flag ? 'active' : ''}" 
                                  data-symbol="${stock.Symbol || stock.symbol}" 
                                  onclick="toggleFlag(event, '${stock.Symbol || stock.symbol}', this)">★</span>
                            <button class="company-info-btn"
                                    data-stock-name="${stock.Name || stock.name}"
                                    data-fifty-two-week-high="${stock.fiftyTwoWeekHigh || 'N/A'}"
                                    data-current-price="${stock.Close ? stock.Close.toFixed(2) : 'N/A'}"
                                    data-fifty-two-week-low="${stock.fiftyTwoWeekLow || 'N/A'}"
                                    data-earnings-date="${stock.earningsDate || 'N/A'}"
                                    data-beta="${stock.beta || 'N/A'}"
                                    data-atr-percent="${stock.ATR_Percent || 'N/A'}"
                                    title="${stock.stock_description || 'No description available'}"
                                    data-trailing-pe="${stock['Trailing PE'] || stock.trailingPE || 'N/A'}"
                                    data-forward-pe="${stock['Forward PE'] || stock.forwardPE || 'N/A'}"
                                    data-ev-ebitda="${stock['EV/EBITDA'] || 'N/A'}"
                                    data-market-cap="${formatMarketCap(stock['Market Cap'] || stock.marketCap)}"
                                    data-dividend-yield="${stock.dividendYield || 'N/A'}"
                                    data-total-revenue="${stock.totalRevenue || 'N/A'}"
                                    data-net-income="${stock.netIncomeToCommon || 'N/A'}"
                                    data-profit-margins="${stock.profitMargins || 'N/A'}"
                                    data-url="${logoUrl}"><img src="info.png" alt="Info"></button>
                            <img class="company-logo chart-clickable" src="${logoUrl}" alt="${stock.Name || stock.name} logo" onerror="this.style.display='none'" data-symbol="${stock.Symbol || stock.symbol}">
                            <div class="company-text-block">
                                <div class="company-name-line">
                                    <span class="company-name-text chart-clickable" data-symbol="${stock.Symbol || stock.symbol}">${stock.Name || stock.name}</span>
                                    <span class="ticker-chip">${stock.Symbol || stock.symbol}</span>
                                </div>
                            </div>
                            <div class="market-cap-mobile">Market Cap: ${formatMarketCap(stock['Market Cap'] || stock.marketCap)}</div>
                        </div>
                    </td>
                    <td class="market-cap"><div class="badge-metric">${formatMarketCap(stock['Market Cap'] || stock.marketCap)}</div></td>
                    <td class="open">${stock.Open != null ? formatValue(stock.Open) : '-'}</td>
                    <td class="high">${stock.High != null ? formatValue(stock.High) : '-'}</td>
                    <td class="low">${stock.Low != null ? formatValue(stock.Low) : '-'}</td>
                    <td class="close">${stock.Close != null ? formatValue(stock.Close) : '-'}</td>
                    <td class="change">
                      <div class="badge-change" style="background-color: ${isFinite(pctChangeNum) ? changeBg(pctChangeNum) : 'var(--hover-bg)'};">
                        ${changeText}
                      </div>
                    </td>
                    <td class="rsi"><div class="badge-metric" style="background-color: ${rsiColor};">${stock.RSI !== undefined ? formatRsi(stock.RSI) : '-'}</div></td>
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
    section.querySelectorAll('.chart-clickable').forEach(clickableElement => {
        clickableElement.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation(); // Prevent row click if any
            showChartPopup(this.dataset.symbol);
        });
    });
    
    section.querySelectorAll('.company-info-btn').forEach(infoIcon => {
        infoIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            showInfoPopup(this);
        });
    });
}

function filterTable(query) {
    const searchTerm = query.toLowerCase();
    const sections = document.querySelectorAll('.section');

    // If search is empty, show everything and exit
    if (searchTerm === '') {
        sections.forEach(section => {
            section.style.display = '';
            section.querySelectorAll('.industry-section').forEach(is => is.style.display = '');
            section.querySelectorAll('table tbody tr').forEach(row => row.style.display = '');
        });
        return;
    }

    // If there is a search term, filter
    sections.forEach(section => {
        let isSectionVisible = false;

        const industrySections = section.querySelectorAll('.industry-section');
        if (industrySections.length > 0) {
            // Handle categories with industries
            industrySections.forEach(industrySection => {
                const rows = industrySection.querySelectorAll('table tbody tr');
                let isIndustryVisible = false;

                rows.forEach(row => {
                    const name = row.querySelector('.company-name-text')?.textContent.toLowerCase() || '';
                    const symbol = row.querySelector('.ticker-chip')?.textContent.toLowerCase() || '';
                    
                    if (symbol.includes(searchTerm) || name.includes(searchTerm)) {
                        row.style.display = '';
                        isIndustryVisible = true;
                    } else {
                        row.style.display = 'none';
                    }
                });

                if (isIndustryVisible) {
                    industrySection.style.display = '';
                    isSectionVisible = true;
                } else {
                    industrySection.style.display = 'none';
                }
            });
        } else {
            // Handle "Owned" category
            const rows = section.querySelectorAll('table tbody tr');
            rows.forEach(row => {
                const name = row.querySelector('.company-name-text')?.textContent.toLowerCase() || '';
                const symbol = row.querySelector('.ticker-chip')?.textContent.toLowerCase() || '';
                
                if (symbol.includes(searchTerm) || name.includes(searchTerm)) {
                    row.style.display = '';
                    isSectionVisible = true;
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // Show or hide the entire section
        if (isSectionVisible) {
            section.style.display = '';
        } else {
            section.style.display = 'none';
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
            element.classList.toggle('active');
        }
    })
    .catch(error => console.error('Error:', error));
};