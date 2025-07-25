let currentDate = new Date();

function getRsiColorClass(rsi) {
    if (!rsi || rsi === 'N/A') return 'rsi-neutral';
    rsi = parseFloat(rsi);
    if (rsi >= 70) return 'rsi-overbought';    // Red for overbought
    if (rsi >= 65) return 'rsi-high';          // Orange for high
    if (rsi <= 30) return 'rsi-oversold';      // Green for oversold
    if (rsi <= 35) return 'rsi-low';           // Yellow for low
    return 'rsi-neutral';                       // Gray for neutral
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
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    document.getElementById('current-month').textContent = 
        `${firstDay.toLocaleString('default', { month: 'long' })} ${year}`;
    
    const calendarContainer = document.getElementById('calendar-container');
    calendarContainer.innerHTML = '';
    
    // Update day headers to only show weekdays
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        calendarContainer.appendChild(dayHeader);
    });

    // Calculate first Monday if month starts on weekend
    let firstWeekday = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (firstWeekday === 0) firstWeekday = 1; // If Sunday, start from Monday
    if (firstWeekday === 6) firstWeekday = 1; // If Saturday, start from Monday of next week

    // Add empty cells for days before the first weekday
    for (let i = 1; i < firstWeekday; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarContainer.appendChild(emptyCell);
    }

    // Add days of the month (excluding weekends)
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDay = new Date(year, month, day);
        const dayOfWeek = currentDay.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        // Format date string to match API response format (MM-DD-YYYY)
        const dateStr = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
        
        // Add day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
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
                    companyDiv.textContent = company.name;
                    companyDiv.title = `${company.symbol} - Before Hours`;
                    
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
                    companyDiv.textContent = company.name;
                    companyDiv.title = `${company.symbol} - After Hours`;
                    
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
document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendar();
});

// Function to update calendar with earnings data
async function updateCalendar() {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const earningsData = await fetchEarningsData(month, year);
    renderCalendar(earningsData);
}

// Initial calendar render
updateCalendar();