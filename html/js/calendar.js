import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';
import { getCategoryData } from './dataSource.js';
import { getTrailingPeColor, getForwardPeColor } from './utils.js';

let currentDate = new Date();
let cachedMonthsData = {}; // Cache for multiple months of data, e.g., {'2024-6': data}

function getRsiColorClass(rsi) {
    if (!rsi || rsi === 'N/A') return 'rsi-neutral';
    rsi = parseFloat(rsi);
    if (rsi >= 70) return 'rsi-overbought'; // Red for overbought
    if (rsi >= 65) return 'rsi-high'; // Orange for high
    if (rsi <= 30) return 'rsi-oversold'; // Green for oversold
    if (rsi <= 35) return 'rsi-low'; // Yellow for low
    return 'rsi-neutral'; // Gray for neutral
}

async function fetchEarningsData(month, year) {
    const cacheKey = `${year}-${month}`;
    if (cachedMonthsData[cacheKey]) {
        return cachedMonthsData[cacheKey];
    }

    try {
        const categoriesToFetch = [
            'Owned', 'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);

        const earningsData = {};
        const processedSymbols = new Set();
        let lastUpdated = '';

        results.forEach(responseData => {
            const items = responseData.items || responseData.data || [];
            // Grab the timestamp from the first valid response
            if (!lastUpdated && (responseData.updated_at || responseData.last_updated)) {
                lastUpdated = responseData.updated_at || responseData.last_updated;
            }

            items.forEach(stock => {
                const symbol = stock.Symbol || stock.symbol;
                if (processedSymbols.has(symbol)) return;
                processedSymbols.add(symbol);

                const earningsDate = stock.earningsDate;
                if (earningsDate) {
                    if (!earningsData[earningsDate]) earningsData[earningsDate] = [];
                    earningsData[earningsDate].push(stock);
                }
            });
        });

        // Update the last updated timestamp in the UI
        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }

        cachedMonthsData[cacheKey] = earningsData;
        return earningsData;
    } catch (error) {
        console.error('Error fetching earnings data:', error);
        return {};
    }
}

function renderCalendar(earningsData = {}) {
    // --- Calculate the start and end of the week (Monday to Friday) ---
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const startOfWeek = new Date(currentDate);
    // Adjust date to the Monday of the current week
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(currentDate.getDate() + diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday

    // --- Update header to show the week's date range ---
    const weekDisplay = document.getElementById('current-week');
    if (weekDisplay) {
        weekDisplay.textContent =
            `${startOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' })}, ${endOfWeek.getFullYear()}`;
    }

    const calendarContainer = document.getElementById('calendar-container');
    calendarContainer.innerHTML = '';

    // --- Render day headers (Mon-Fri) ---
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        calendarContainer.appendChild(dayHeader);
    });

    const today = new Date(); // Get today's date once before the loop

    // --- Render the 5 day cells for the week ---
    for (let i = 0; i < 5; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);

        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        // Highlight the current day
        if (currentDay.getDate() === today.getDate() &&
            currentDay.getMonth() === today.getMonth() &&
            currentDay.getFullYear() === today.getFullYear()) {
            cell.classList.add('today');
        }

        // Format date string to match API response format (MM-DD-YYYY)
        const dateStr = `${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}-${currentDay.getFullYear()}`;

        // Add day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = currentDay.getDate();
        cell.appendChild(dayNumber);

        // Add earnings information if available for this date
        if (earningsData[dateStr]) {
            const earningsContainer = document.createElement('div');
            earningsContainer.className = 'earnings-container';

            // Group companies by timing
            const bmoCompanies = earningsData[dateStr].filter(company => company.earningsTiming === 'BMO');
            const amcCompanies = earningsData[dateStr].filter(company => company.earningsTiming === 'AMC');

            // Before Hours Section
            if (bmoCompanies.length > 0) {
                const bmoSection = document.createElement('div');
                bmoSection.className = 'timing-section';

                const bmoHeader = document.createElement('div');
                bmoHeader.className = 'timing-header';
                bmoHeader.textContent = 'Before Market Open';
                bmoHeader.style.fontSize = '10px';
                bmoHeader.style.fontWeight = '600';
                bmoHeader.style.color = '#6c757d';
                bmoHeader.style.textTransform = 'uppercase';
                bmoHeader.style.padding = '4px 0 2px 4px';
                bmoHeader.style.borderBottom = '1px solid #e9ecef';
                bmoSection.appendChild(bmoHeader);
                
                bmoCompanies.forEach(company => {
                    const itemContainer = document.createElement('div');

                    const companyDiv = document.createElement('div');
                    companyDiv.className = 'earnings-item bmo';
                    const stockSymbol = company.symbol || company.Symbol;
                    companyDiv.title = `${stockSymbol} - Before Hours`;
                    companyDiv.dataset.symbol = stockSymbol;

                    // Data for info popup
                    const trailingPE = company['Trailing PE'] || company.trailingPE;
                    const forwardPE = company['Forward PE'] || company.forwardPE;
                    const trailingPeColor = trailingPE ? getTrailingPeColor(trailingPE) : 'inherit';
                    const forwardPeColor = forwardPE ? getForwardPeColor(forwardPE, trailingPE) : 'inherit';
                    const stockName = company.name || company.Name;
                    const stockClose = company.close || company.Close;

                    companyDiv.innerHTML = `
                        <img src="${company.stockUrl}" class="earnings-logo" alt="${stockName} logo" onerror="this.style.display='none'"/>
                        <span>${stockName}</span>
                    `;

                    const marketDataDiv = document.createElement('div');
                    marketDataDiv.className = 'market-data';

                    // Format price and changes
                    const price = stockClose ? `$${stockClose.toFixed(2)}` : 'N/A';
                    const priceChange = company['Price Change'] ?? company.priceChange;
                    const percentChange = company['Percent Change'] ?? company.percentChange;
                    const rsi = company.RSI ?? company.rsi;
                    const formattedPriceChange = (priceChange != null) ? priceChange.toFixed(2) : 'N/A';
                    const formattedPercentChange = (percentChange != null) ? percentChange.toFixed(2) : 'N/A';

                    marketDataDiv.innerHTML = `
                        <span>${price}</span>
                        <span class="${priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : ''}">
                            ${formattedPriceChange} (${formattedPercentChange}%)
                        </span>
                        <span class="${getRsiColorClass(rsi)}">RSI: ${(rsi != null) ? parseFloat(rsi).toFixed(1) : 'N/A'}</span>
                    `;

                    itemContainer.appendChild(companyDiv);
                    itemContainer.appendChild(marketDataDiv);
                    bmoSection.appendChild(itemContainer);
                });

                earningsContainer.appendChild(bmoSection);
            }

            // After Hours Section
            if (amcCompanies.length > 0) {
                const amcSection = document.createElement('div');
                amcSection.className = 'timing-section';

                const amcHeader = document.createElement('div');
                amcHeader.className = 'timing-header';
                amcHeader.textContent = 'After Market Close';
                amcHeader.style.fontSize = '10px';
                amcHeader.style.fontWeight = '600';
                amcHeader.style.color = '#6c757d';
                amcHeader.style.textTransform = 'uppercase';
                amcHeader.style.padding = '4px 0 2px 4px';
                amcHeader.style.borderBottom = '1px solid #e9ecef';
                amcSection.appendChild(amcHeader);
                
                amcCompanies.forEach(company => {
                    const itemContainer = document.createElement('div');

                    const companyDiv = document.createElement('div');
                    companyDiv.className = 'earnings-item amc';
                    const stockSymbol = company.symbol || company.Symbol;
                    companyDiv.title = `${stockSymbol} - After Hours`;
                    companyDiv.dataset.symbol = stockSymbol;

                    // Data for info popup
                    const trailingPE = company['Trailing PE'] || company.trailingPE;
                    const forwardPE = company['Forward PE'] || company.forwardPE;
                    const trailingPeColor = trailingPE ? getTrailingPeColor(trailingPE) : 'inherit';
                    const forwardPeColor = forwardPE ? getForwardPeColor(forwardPE, trailingPE) : 'inherit';
                    const stockName = company.name || company.Name;
                    const stockClose = company.close || company.Close;

                    companyDiv.innerHTML = `
                        <img src="${company.stockUrl}" class="earnings-logo" alt="${stockName} logo" onerror="this.style.display='none'"/>
                        <span>${stockName}</span>
                    `;

                    const marketDataDiv = document.createElement('div');
                    marketDataDiv.className = 'market-data';

                    // Format price and changes
                    const price = stockClose ? `$${stockClose.toFixed(2)}` : 'N/A';
                    const priceChange = company['Price Change'] ?? company.priceChange;
                    const percentChange = company['Percent Change'] ?? company.percentChange;
                    const rsi = company.RSI ?? company.rsi;
                    const formattedPriceChange = (priceChange != null) ? priceChange.toFixed(2) : 'N/A';
                    const formattedPercentChange = (percentChange != null) ? percentChange.toFixed(2) : 'N/A';

                    marketDataDiv.innerHTML = `
                        <span>${price}</span>
                        <span class="${priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : ''}">
                            ${formattedPriceChange} (${formattedPercentChange}%)
                        </span>
                        <span class="${getRsiColorClass(rsi)}">RSI: ${(rsi != null) ? parseFloat(rsi).toFixed(1) : 'N/A'}</span>
                    `;

                    itemContainer.appendChild(companyDiv);
                    itemContainer.appendChild(marketDataDiv);
                    amcSection.appendChild(itemContainer);
                });

                earningsContainer.appendChild(amcSection);
            }

            cell.appendChild(earningsContainer);
            cell.classList.add('has-earnings');
        }

        calendarContainer.appendChild(cell);
    }
}

// Event listeners for navigation
document.getElementById('prev-week').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 7);
    updateCalendar();
});

document.getElementById('next-week').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 7);
    updateCalendar();
});

const calendarContainer = document.getElementById('calendar-container');
if (calendarContainer) {
    calendarContainer.addEventListener('click', function(event) {
        const earningsItem = event.target.closest('.earnings-item');
        if (earningsItem && earningsItem.dataset.symbol) {
            showChartPopup(earningsItem.dataset.symbol);
        }
    });
}

// Function to update calendar with earnings data
async function updateCalendar() {
    // Calculate the start and end of the week to be displayed
    const dayOfWeek = currentDate.getDay();
    const startOfWeek = new Date(currentDate);
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(currentDate.getDate() + diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);

    const startMonth = startOfWeek.getMonth();
    const startYear = startOfWeek.getFullYear();
    const endMonth = endOfWeek.getMonth();
    const endYear = endOfWeek.getFullYear();

    const startMonthKey = `${startYear}-${startMonth}`;
    const endMonthKey = `${endYear}-${endMonth}`;

    // Fetch data for the start month if it's not already in our cache
    if (!cachedMonthsData[startMonthKey]) {
        cachedMonthsData[startMonthKey] = await fetchEarningsData(startMonth, startYear);
    }

    let earningsData = { ...cachedMonthsData[startMonthKey] };

    // If the week spans two different months, fetch for the second month (if not cached) and merge
    if (startMonthKey !== endMonthKey) {
        if (!cachedMonthsData[endMonthKey]) {
            cachedMonthsData[endMonthKey] = await fetchEarningsData(endMonth, endYear);
        }
        earningsData = { ...earningsData, ...cachedMonthsData[endMonthKey] };
    }

    renderCalendar(earningsData);
}

// Initial calendar render
updateCalendar();