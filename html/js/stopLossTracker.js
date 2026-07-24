/**
 * stopLossTracker.js
 * Manages RSI-anchored trailing stops in localStorage.
 */

const STORAGE_KEY = 'rsi_stop_loss_tracking_v1';
const ATR_MULTIPLIER = 1.5;

/**
 * Updates the tracking list based on fresh stock data.
 * Stock entries are added/updated when RSI is in extreme zones.
 * Entries are removed if the stop price is hit.
 */
export function updateStopLossTracking(stocks) {
    let tracking = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    let modified = false;

    stocks.forEach(s => {
        const sym = (s.Symbol || s.symbol || '').toUpperCase();
        if (!sym) return;

        const rsi = parseFloat(s.RSI);
        const close = parseFloat(s.Close);
        const high = parseFloat(s.High);
        const low = parseFloat(s.Low);
        const atr = parseFloat(s.ATR);

        if (isNaN(close) || isNaN(atr)) return;

        // Use daily extremes for anchoring
        const currentPeak = !isNaN(high) ? high : close;
        const currentFloor = !isNaN(low) ? low : close;

        // --- 1. HANDLE EXISTING ENTRIES ---
        if (tracking[sym]) {
            const record = tracking[sym];
            
            if (record.type === 'overbought') {
                // Trailing Peak Stop for Overbought
                if (currentPeak > record.anchorPrice) {
                    record.anchorPrice = currentPeak;
                    record.stopPrice = currentPeak - (atr * ATR_MULTIPLIER);
                    modified = true;
                }
                if (currentFloor < record.stopPrice) {
                    delete tracking[sym];
                    modified = true;
                    return;
                }
            }
        }

        else {
            // --- 2. ADD NEW ENTRIES ---
            // Only check for new entries if we aren't already tracking (or haven't just deleted) the symbol
            if (!isNaN(rsi) && rsi >= 70) {
                // Standard Overbought Stop
                tracking[sym] = { type: 'overbought', anchorPrice: currentPeak, stopPrice: currentPeak - (atr * ATR_MULTIPLIER), rsiAtAnchor: rsi, timestamp: new Date().toISOString() };
                modified = true;
            }
        }
    });

    if (modified) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
    }

    return { modified };
}

export function getTrackingData(symbol) {
    const tracking = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return tracking[symbol.toUpperCase()] || null;
}