import { getForwardPeColor, getTrailingPeColor } from './utils.js';
function showInfoPopup(button) {
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

    // Format values
    const formattedCurrentPrice = currentPrice ? currentPrice.toFixed(2) : 'N/A';
    const formattedHigh = fiftyTwoWeekHigh ? fiftyTwoWeekHigh.toFixed(2) : 'N/A';
    const formattedLow = fiftyTwoWeekLow ? fiftyTwoWeekLow.toFixed(2) : 'N/A';
    const formattedEarningsDate = earningsDate ? earningsDate : 'N/A';

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

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'info-popup';
    popup.style.backgroundColor = 'white';
    popup.style.padding = '15px';
    popup.style.borderRadius = '5px';
    popup.style.width = '80%';
    popup.style.maxWidth = '600px';
    popup.style.position = 'relative';

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
        <p style="font-size: 14px;">${description}</p>
        <p>
            <span style="color: ${trailingPeColor};"><strong>Trailing PE:</strong> ${trailingPE}</span>
            <span style="margin-left: 20px; color: ${forwardPeColor};"><strong>Forward PE:</strong> ${forwardPE}</span>
            <span style="margin-left: 20px;"><strong>EV/EBITDA:</strong> ${evEbitda}</span>
        </p>
        <div style="display: flex; align-items: center; margin: 10px 0; font-size: 14px;">
            <div style="margin-right: 10px;"><strong>52 Week Low: $${formattedLow}</strong></div>
            <div style="flex-grow: 1; position: relative;">
                <hr style="border: 1px solid #ccc;"/>
                <div style="position: absolute; left: ${position}%; transform: translate(-50%, -60%); color: blue; top: 50%;">
                    <strong style="font-size: 16px;">&#9670;</strong>
                </div>
            </div>
            <div style="margin-left: 10px;"><strong>52 Week High: $${formattedHigh}</strong></div>
        </div>
        <div style="text-align: center; margin-top: 5px;">
            <strong style="font-size: 14px;"><strong>Current Price:</strong> $${formattedCurrentPrice}</strong>
        </div>
    `;

    popup.innerHTML = content;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close popup when clicking outside
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

export { showInfoPopup };
