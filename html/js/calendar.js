import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';

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
    try {
        const response = await fetch(`/api/earnings?month=${month + 1}&year=${year}`);
        if (!response.ok) throw new Error('Failed to fetch earnings data');
        return await response.json();
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
                bmoHeader.textContent = 'Before Hours';
                bmoSection.appendChild(bmoHeader);
                
                bmoCompanies.forEach(company => {
                    const itemContainer = document.createElement('div');

                    const companyDiv = document.createElement('div');
                    companyDiv.className = 'earnings-item bmo';
                    companyDiv.title = `${company.symbol} - Before Hours`;
                    companyDiv.dataset.symbol = company.symbol;

                    // Data for info popup
                    const trailingPeColor = company['Trailing PE'] ? getTrailingPeColor(company['Trailing PE']) : 'inherit';
                    const forwardPeColor = company['Forward PE'] ? getForwardPeColor(company['Forward PE'], company['Trailing PE']) : 'inherit';

                    companyDiv.innerHTML = `
                        <button class="info-icon" 
                                data-stock-name="${company.name}"
                                data-fifty-two-week-high="${company.fiftyTwoWeekHigh || 'N/A'}"
                                data-current-price="${company.close ? company.close.toFixed(2) : 'N/A'}"
                                data-fifty-two-week-low="${company.fiftyTwoWeekLow || 'N/A'}"
                                data-earnings-date="${company.earningsDate || 'N/A'}"
                                title="${company.stock_description || 'No description available'}"
                                data-trailing-pe="${company['Trailing PE'] || 'N/A'}"
                                data-forward-pe="${company['Forward PE'] || 'N/A'}"
                                data-ev-ebitda="${company['EV/EBITDA'] || 'N/A'}"
                                data-trailing-pe-color="${trailingPeColor}"
                                data-forward-pe-color="${forwardPeColor}"
                                data-url="${company.stockUrl}">
                            <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                        </button>
                        <img src="${company.stockUrl}" class="earnings-logo" alt="${company.name} logo" onerror="this.style.display='none'"/>
                        <span>${company.name}</span>
                    `;

                    const marketDataDiv = document.createElement('div');
                    marketDataDiv.className = 'market-data';

                    // Format price and changes
                    const price = company.close ? `$${company.close.toFixed(2)}` : 'N/A';
                    const priceChange = company.priceChange !== null ? company.priceChange.toFixed(2) : 'N/A';
                    const percentChange = company.percentChange !== null ? company.percentChange.toFixed(2) : 'N/A';
                    const rsi = company.rsi ? company.rsi.toFixed(1) : 'N/A';

                    marketDataDiv.innerHTML = `
                        <span>${price}</span>
                        <span class="${company.priceChange > 0 ? 'price-up' : company.priceChange < 0 ? 'price-down' : ''}">
                            ${priceChange} (${percentChange}%)
                        </span>
                        <span class="${getRsiColorClass(rsi)}">RSI: ${rsi}</span>
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
                amcHeader.textContent = 'After Hours';
                amcSection.appendChild(amcHeader);
                
                amcCompanies.forEach(company => {
                    const itemContainer = document.createElement('div');

                    const companyDiv = document.createElement('div');
                    companyDiv.className = 'earnings-item amc';
                    companyDiv.title = `${company.symbol} - After Hours`;
                    companyDiv.dataset.symbol = company.symbol;

                    // Data for info popup
                    const trailingPeColor = company['Trailing PE'] ? getTrailingPeColor(company['Trailing PE']) : 'inherit';
                    const forwardPeColor = company['Forward PE'] ? getForwardPeColor(company['Forward PE'], company['Trailing PE']) : 'inherit';

                    companyDiv.innerHTML = `
                        <button class="info-icon" 
                                data-stock-name="${company.name}"
                                data-fifty-two-week-high="${company.fiftyTwoWeekHigh || 'N/A'}"
                                data-current-price="${company.close ? company.close.toFixed(2) : 'N/A'}"
                                data-fifty-two-week-low="${company.fiftyTwoWeekLow || 'N/A'}"
                                data-earnings-date="${company.earningsDate || 'N/A'}"
                                title="${company.stock_description || 'No description available'}"
                                data-trailing-pe="${company['Trailing PE'] || 'N/A'}"
                                data-forward-pe="${company['Forward PE'] || 'N/A'}"
                                data-ev-ebitda="${company['EV/EBITDA'] || 'N/A'}"
                                data-trailing-pe-color="${trailingPeColor}"
                                data-forward-pe-color="${forwardPeColor}"
                                data-url="${company.stockUrl}">
                            <img src="info.png" alt="Info" style="width: 16px; height: 16px; border: none;"/>
                        </button>
                        <img src="${company.stockUrl}" class="earnings-logo" alt="${company.name} logo" onerror="this.style.display='none'"/>
                        <span>${company.name}</span>
                    `;

                    const marketDataDiv = document.createElement('div');
                    marketDataDiv.className = 'market-data';

                    // Format price and changes
                    const price = company.close ? `$${company.close.toFixed(2)}` : 'N/A';
                    const priceChange = company.priceChange !== null ? company.priceChange.toFixed(2) : 'N/A';
                    const percentChange = company.percentChange !== null ? company.percentChange.toFixed(2) : 'N/A';
                    const rsi = company.rsi ? company.rsi.toFixed(1) : 'N/A';

                    marketDataDiv.innerHTML = `
                        <span>${price}</span>
                        <span class="${company.priceChange > 0 ? 'price-up' : company.priceChange < 0 ? 'price-down' : ''}">
                            ${priceChange} (${percentChange}%)
                        </span>
                        <span class="${getRsiColorClass(rsi)}">RSI: ${rsi}</span>
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
        const infoIcon = event.target.closest('.info-icon');
        if (infoIcon) {
            event.stopPropagation();
            showInfoPopup(infoIcon);
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