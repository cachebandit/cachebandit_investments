import { getForwardPeColor, getTrailingPeColor } from './utils.js';
function showInfoPopup(button) { // eslint-disable-line no-unused-vars
    const stockName = button.getAttribute('data-stock-name');

    const description = button.getAttribute('title');
    const trailingPE = parseFloat(button.getAttribute('data-trailing-pe')).toFixed(2);
    const forwardPE = parseFloat(button.getAttribute('data-forward-pe')).toFixed(2);
    const evEbitda = parseFloat(button.getAttribute('data-ev-ebitda')).toFixed(2);
    const currentPrice = parseFloat(button.getAttribute('data-current-price'));
    const forwardPeColor = getForwardPeColor(forwardPE, trailingPE);
    const trailingPeColor = getTrailingPeColor(trailingPE);
    const fiftyTwoWeekHigh = parseFloat(button.getAttribute('data-fifty-two-week-high'));
    const fiftyTwoWeekLow = parseFloat(button.getAttribute('data-fifty-two-week-low'));
    const earningsDate = button.getAttribute('data-earnings-date');
    const logoUrl = button.getAttribute('data-url');
    const marketCap = button.getAttribute('data-market-cap');
    const dividendYield = parseFloat(button.getAttribute('data-dividend-yield'));
    const totalRevenue = parseFloat(button.getAttribute('data-total-revenue'));
    const netIncome = parseFloat(button.getAttribute('data-net-income'));
    const profitMargins = parseFloat(button.getAttribute('data-profit-margins'));

    // Format values
    const formattedCurrentPrice = currentPrice ? currentPrice.toFixed(2) : 'N/A';
    const formattedHigh = fiftyTwoWeekHigh ? fiftyTwoWeekHigh.toFixed(2) : 'N/A';
    const formattedLow = fiftyTwoWeekLow ? fiftyTwoWeekLow.toFixed(2) : 'N/A';
    const formattedEarningsDate = earningsDate ? earningsDate : 'N/A';
    const formattedDividendYield = dividendYield ? `${dividendYield.toFixed(2)}%` : 'N/A';
    const formattedRevenue = totalRevenue ? `$${(totalRevenue / 1_000_000_000).toFixed(2)}B` : 'N/A';
    const formattedNetIncome = netIncome ? `$${(netIncome / 1_000_000_000).toFixed(2)}B` : 'N/A';
    const formattedProfitMargins = profitMargins ? `${(profitMargins * 100).toFixed(2)}%` : 'N/A';

    // Calculate bar chart values
    const netMarginBarWidth = profitMargins ? Math.abs(profitMargins * 100) : 0;
    const netMarginBarColor = netIncome >= 0 ? 'var(--price-up-color)' : 'var(--price-down-color)';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';

    // ★ ADD: pin popup to top so its top edge never moves
    overlay.style.alignItems = 'flex-start';
    overlay.style.paddingTop = '5vh';

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'info-popup';
    popup.style.backgroundColor = 'white';
    popup.style.padding = '15px';
    popup.style.borderRadius = '5px';
    popup.style.width = '80%';
    popup.style.maxWidth = '600px';
    popup.style.position = 'relative';

    // ★ ADD: make the popup its own scroll container (prevents page shift)
    popup.style.maxHeight = '80vh';
    popup.style.overflowY = 'auto';

    // ★ ADD: lock page scroll while popup open (so only popup scrolls)
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Calculate position of the current price on the line
    const position = ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;

    // Create content for the popup
    const content = `
        <h3 style="display: flex; align-items: center;">
            <img src="${logoUrl}" alt="${stockName} Logo" onerror="this.style.display='none'" 
                style="width: 40px; height: 40px; margin-right: 10px; margin-left: 10px; margin-bottom: 10px;"/>
            <span>${stockName}</span>
            <span style="font-size: 12px; margin-left: auto;">Earnings Date: ${formattedEarningsDate}</span>
        </h3>
        <div style="font-size: 14px; margin: 15px 0;">
            <span style=""><strong>Market Cap:</strong> ${marketCap}</span>
            <span style="margin-left: 20px;"><strong>Dividend Yield (TTM):</strong> ${formattedDividendYield}</span>
        </div>
        <div class="description-container" style="position: relative;">
            <div class="popup-description">${description}</div>
            <button class="expand-description-btn" style="display: none;">More ▼</button>
        </div>
        <div style="font-size: 14px; margin: 15px 0;">
            <span style="color: ${trailingPeColor};"><strong>Trailing PE:</strong> ${trailingPE}</span>
            <span style="margin-left: 20px; color: ${forwardPeColor};"><strong>Forward PE:</strong> ${forwardPE}</span>
            <span style="margin-left: 20px;"><strong>EV/EBITDA:</strong> ${evEbitda}</span>
        </div>
        <div style="display: flex; align-items: center; margin: 15px 0; font-size: 14px;">
            <span style=""><strong>Revenue:</strong> ${formattedRevenue}</span>
            <span style="margin-left: 20px;"><strong>Net Margin:</strong> ${formattedNetIncome}</span>
            <span style="margin-left: 20px;"><strong>Net Margin %:</strong> ${formattedProfitMargins}</span>
        </div>
        <div class="popup-chart">
            <div class="chart-row">
                <div class="chart-label">Revenue</div>
                <div class="chart-bar-container"><div class="chart-bar" style="width: 100%; background-color: var(--accent-color);"></div></div>
            </div>
            <div class="chart-row">
                <div class="chart-label">Net Margin</div>
                <div class="chart-bar-container"><div class="chart-bar" style="width: ${netMarginBarWidth}%; background-color: ${netMarginBarColor};"></div></div>
            </div>
        </div>
        <div style="display: flex; align-items: center; margin: 15px 0 0 0; font-size: 14px;">
            <div style="margin-right: 10px;"><strong>52 Week Low: $${formattedLow}</strong></div>
            <div style="flex-grow: 1; position: relative;">
                <hr style="border: 1px solid #ccc;"/>
                <div style="position: absolute; left: ${position}%; top: 50%; transform: translate(-50%, -50%); color: blue;">
                    <strong style="font-size: 16px; line-height: 1;">&#9670;</strong>
                </div>
            </div>
            <div style="margin-left: 10px;"><strong>52 Week High: $${formattedHigh}</strong></div>
        </div>
        <div style="text-align: center; margin-top: 2px;">
            <strong style="font-size: 14px;"><strong>Current Price:</strong> $${formattedCurrentPrice}</strong>
        </div>
    `;

    popup.innerHTML = content;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // --- Add logic for expandable description button ---
    const descriptionContainer = popup.querySelector('.description-container');
    if (descriptionContainer) {
        const descriptionElement = descriptionContainer.querySelector('.popup-description');
        const expandBtn = descriptionContainer.querySelector('.expand-description-btn');

        // Use a small timeout to allow the browser to render and calculate element heights
        setTimeout(() => {
            const isOverflowing = descriptionElement.scrollHeight > descriptionElement.clientHeight;
            
            if (isOverflowing) {
                expandBtn.style.display = 'block';

                expandBtn.addEventListener('click', () => {
                    // Capture the element’s position before changing layout
                    const prevTop = descriptionElement.getBoundingClientRect().top;
                    const wasExpanded = descriptionElement.classList.contains('expanded');

                    // Toggle expanded/collapsed state
                    descriptionElement.classList.toggle('expanded');
                    const isExpanded = !wasExpanded;

                    // Keep the description visually anchored in the same place
                    const nextTop = descriptionElement.getBoundingClientRect().top;
                    popup.scrollTop += (nextTop - prevTop);

                    // Button text
                    expandBtn.innerHTML = isExpanded ? 'Less ▲' : 'More ▼';

                    if (!isExpanded) {
                        // On collapse, reset ONLY the description scroll to top (don’t move the whole popup)
                        descriptionElement.scrollTop = 0;
                    }
                });
            }
        }, 10); // A minimal delay is sufficient
    }

    // Close popup when clicking outside
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            document.body.removeChild(overlay);

            // ★ ADD: restore page scroll when closing
            document.body.style.overflow = previousBodyOverflow || '';
        }
    });
}

export { showInfoPopup };
