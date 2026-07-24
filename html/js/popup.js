import { getForwardPeColor, getTrailingPeColor } from './utils.js';
function showInfoPopup(button) { // eslint-disable-line no-unused-vars
    // Close any existing popup before opening a new one
    const existingOverlay = document.querySelector('.info-overlay');
    if (existingOverlay) {
        document.body.removeChild(existingOverlay);
        // Restore body overflow from the existing popup if needed
        if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
        }
    }

    const stockName = button.getAttribute('data-stock-name');
    const beta = button.getAttribute('data-beta');
    const atrPercent = button.getAttribute('data-atr-percent');
    const symbol = button.closest('[data-symbol]')?.dataset.symbol || '';
    const atr = parseFloat(button.getAttribute('data-atr'));
    const rsi = button.getAttribute('data-rsi');
    
    // Parse stop price and anchor price, handling null/undefined/empty values
    const stopPriceAttr = button.getAttribute('data-stop-price');
    const anchorPriceAttr = button.getAttribute('data-anchor-price');
    const stopPrice = (stopPriceAttr && stopPriceAttr !== '') ? parseFloat(stopPriceAttr) : null;
    const anchorPrice = (anchorPriceAttr && anchorPriceAttr !== '') ? parseFloat(anchorPriceAttr) : null;

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
    const formattedBeta = beta ? parseFloat(beta).toFixed(2) : 'N/A';
    const formattedAtrPercent = atrPercent ? `${parseFloat(atrPercent).toFixed(2)}%` : 'N/A';
    const formattedLow = fiftyTwoWeekLow ? fiftyTwoWeekLow.toFixed(2) : 'N/A';
    const formattedEarningsDate = earningsDate ? earningsDate : 'N/A';
    const formattedDividendYield = dividendYield ? `${dividendYield.toFixed(2)}%` : 'N/A';
    const formattedRevenue = totalRevenue ? `$${(totalRevenue / 1_000_000_000).toFixed(2)}B` : 'N/A';
    const formattedNetIncome = netIncome ? `$${(netIncome / 1_000_000_000).toFixed(2)}B` : 'N/A';
    const formattedProfitMargins = profitMargins ? `${(profitMargins * 100).toFixed(2)}%` : 'N/A';
    const formattedRsi = rsi && !isNaN(parseFloat(rsi)) ? parseFloat(rsi).toFixed(2) : 'N/A';

    // RSI Stop Loss / Sell Price Logic
    let stopLossHtml = '';
    if (stopPrice !== null && !isNaN(stopPrice) && anchorPrice !== null && !isNaN(anchorPrice)) {
        const label = 'Suggested Sell Price (Overbought)';
        const statusColor = 'var(--price-up-color)';
        const details = `<div style="font-size: 18px; font-weight: 800; margin: 4px 0;">$${stopPrice.toFixed(2)}</div><div style="font-size: 11px; color: #666;">Anchor Price: $${anchorPrice.toFixed(2)}</div>`;
        stopLossHtml = `<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 4px solid ${statusColor}; border-radius: 4px;"><div style="font-weight: bold; font-size: 13px; color: #444;">${label}</div>${details}</div>`;
    }

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
        <div style="display: flex; align-items: flex-start; margin-bottom: 15px; gap: 15px;">
            <img src="${logoUrl}" alt="${stockName} Logo" onerror="this.style.display='none'" 
                style="width: 60px; height: 60px; border-radius: 6px; flex-shrink: 0;"/>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${stockName}</h3>
                </div>
                <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Current Price</div>
                        <div style="font-size: 24px; font-weight: 700; color: var(--price-up-color);">$${formattedCurrentPrice}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">RSI (14)</div>
                        <div style="font-size: 20px; font-weight: 700; color: black;">${formattedRsi}</div>
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                            <span style="color: #666; white-space: nowrap;">$${formattedLow}</span>
                            <div style="flex-grow: 1; position: relative; height: 12px; display: flex; align-items: center;">
                                <hr style="border: 0.5px solid #eee; width: 100%; margin: 0;"/><div style="position: absolute; left: ${position}%; top: 50%; transform: translate(-50%, -50%); color: blue;"><strong style="font-size: 14px; line-height: 1;">&#9670;</strong></div>
                            </div>
                            <span style="color: #666; white-space: nowrap;">$${formattedHigh}</span>
                        </div>
                        <div style="font-size: 11px; color: black; font-weight: bold; margin-bottom: 4px; text-align: center;">52 Week Range</div>
                    </div>
                </div>
            </div>
        </div>
        <div style="font-size: 14px; margin: 15px 0 5px 0;">
            <span style=""><strong>Market Cap:</strong> ${marketCap}</span>
            <span style="margin-left: 20px;"><strong>Dividend Yield (TTM):</strong> ${formattedDividendYield}</span>
            <span style="margin-left: 20px; font-weight: bold; color: black;">Earnings: ${formattedEarningsDate}</span>
        </div>
        <div style="font-size: 14px; margin: 5px 0 15px 0;">
            <span style=""><strong>Beta (5Y Monthly):</strong> ${formattedBeta}</span>
            <span style="margin-left: 20px;"><strong>ATR (14D)%:</strong> ${formattedAtrPercent}</span>
        </div>
        ${stopLossHtml}
        <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 4px solid var(--price-down-color); border-radius: 4px;">
            <div style="font-weight: bold; font-size: 13px; color: #444; margin-bottom: 10px;">Stop Loss</div>
            <div style="display: flex; gap: 15px;">
                <div style="flex: 0 0 auto; max-width: 140px;">
                    <div style="font-size: 11px; color: #666; font-weight: 500; margin-bottom: 6px;">Buy Price</div>
                    <div style="display: flex; align-items: center; background-color: #e7f3ff; border: 1px solid #b8d6f3; border-radius: 4px; padding: 0 4px 0 8px; line-height: 1.4; position: relative;">
                        <span style="font-size: 18px; font-weight: 800; color: black; margin-right: 4px;">$</span>
                        <input type="number" id="buyPriceInput" value="${currentPrice.toFixed(2)}" style="border: none; background: transparent; font-size: 18px; font-weight: 800; color: black; font-family: inherit; width: 100%; padding: 6px 0; outline: none; -moz-appearance: textfield;" step="0.01" inputmode="decimal" />
                        <button id="setStopLossBtn" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; font-weight: bold; cursor: pointer; margin-left: 6px; flex-shrink: 0;">Set</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; position: relative;">
                    <div style="font-size: 11px; color: #666; font-weight: 500; margin-bottom: 6px;">Suggested Stop Loss</div>
                    <div id="stopLossOutput" style="padding: 6px 0; font-size: 18px; font-weight: 800; color: black; line-height: 1.4;">$${(currentPrice - (atr * 1.5)).toFixed(2)}</div>
                </div>
            </div>
        </div>
        <div class="description-container" style="position: relative;">
            <style>
                /* Hide the spin buttons on number inputs for Webkit browsers */
                #buyPriceInput::-webkit-outer-spin-button,
                #buyPriceInput::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            </style>
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
        <div style="text-align: center; margin-top: 2px; display: none;">
            <strong style="font-size: 14px;"><strong>Current Price:</strong> $${formattedCurrentPrice}</strong>
        </div>
    `;

    popup.innerHTML = content;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // --- Add logic for stop loss calculator ---
    const buyPriceInput = popup.querySelector('#buyPriceInput');
    const stopLossOutput = popup.querySelector('#stopLossOutput');
    
    const setStopLossBtn = popup.querySelector('#setStopLossBtn');

    if (buyPriceInput && stopLossOutput && setStopLossBtn && atr) {
        const ATR_MULTIPLIER = 1.5;
        let hasBeenCleared = false;

        buyPriceInput.addEventListener('focus', () => {
            // Clear the input on focus for easy replacement
            buyPriceInput.value = '';
            hasBeenCleared = false; // Reset flag on each focus
        });
        
        // On the first key press, clear the input value if not already cleared
        buyPriceInput.addEventListener('keydown', (e) => {
            if (!hasBeenCleared) {
                buyPriceInput.value = '';
                hasBeenCleared = true;
            }
            // Press Enter to click the Set button
            if (e.key === 'Enter') {
                e.preventDefault();
                setStopLossBtn.click();
            }
        });

        // Calculate and display the stop loss only when the button is clicked
        setStopLossBtn.addEventListener('click', () => {
            const buyPrice = parseFloat(buyPriceInput.value);
            if (!isNaN(buyPrice)) {
                const stopLoss = (buyPrice - (atr * ATR_MULTIPLIER)).toFixed(2);
                stopLossOutput.textContent = `$${stopLoss}`;
            }
        });
    }

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
