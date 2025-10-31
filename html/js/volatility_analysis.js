import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';
import { getCategoryData } from './dataSource.js';
import { formatMarketCap } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    loadVolatilityData();
});

async function loadVolatilityData() {
    try {
        const categoriesToFetch = [
            'Owned', 'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        // fetch all categories in parallel
        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);
        
        let allStocks = [];
        const processedSymbols = new Set();
        let lastUpdated = '';

        // unify and dedupe
        results.forEach(responseData => {
            const items = responseData.items || responseData.data || [];
            if (!lastUpdated && (responseData.updated_at || responseData.last_updated)) {
                lastUpdated = responseData.updated_at || responseData.last_updated;
            }

            items.forEach(stock => {
                const symbol = stock.Symbol || stock.symbol;
                if (!processedSymbols.has(symbol)) {
                    allStocks.push(stock);
                    processedSymbols.add(symbol);
                }
            });
        });

        // timestamp in header
        if (lastUpdated) {
            const ts = document.getElementById('last-updated');
            if (ts) ts.textContent = `Last Updated: ${lastUpdated}`;
        }

        // Filter by ATR% >= 2
        const highAtrStocks = allStocks
            .filter(stock => stock.ATR_Percent && !isNaN(parseFloat(stock.ATR_Percent)) && parseFloat(stock.ATR_Percent) >= 2)
            .sort((a, b) => parseFloat(b.ATR_Percent) - parseFloat(a.ATR_Percent));

        // Oversold (RSI-1h <= 30)
        const oversold = highAtrStocks.filter(s => s.RSI1H && !isNaN(parseFloat(s.RSI1H)) && parseFloat(s.RSI1H) <= 30);

        // Overbought (RSI-1h >= 70)
        const overbought = highAtrStocks.filter(s => s.RSI1H && !isNaN(parseFloat(s.RSI1H)) && parseFloat(s.RSI1H) >= 70);

        // Render both panels
        renderList('oversold-list', oversold);
        renderList('overbought-list', overbought);

        // Click handling for info popup / chart popup
        const gridContainer = document.querySelector('.volatility-grid-container');
        if (gridContainer) {
            gridContainer.addEventListener('click', function(e) {
                // info button click
                const infoBtn = e.target.closest('.company-info-btn');
                if (infoBtn) {
                    e.stopPropagation();
                    showInfoPopup(infoBtn);
                    return;
                }

                // row click -> chart popup
                const row = e.target.closest('.volatility-row');
                if (row && row.dataset.symbol) {
                    showChartPopup(row.dataset.symbol);
                }
            });
        }

    } catch (error) {
        console.error('Error loading Volatility data:', error);
    }
}

/**
 * Render a list of stocks into the given container.
 */
function renderList(containerId, stocks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!stocks || stocks.length === 0) {
        container.innerHTML = `
            <p style="padding:12px 16px; color:#6c757d; font-size:13px;">
                No stocks in this category.
            </p>
        `;
        return;
    }

    container.innerHTML = stocks.map(renderRowHtml).join('');
}

/**
 * Render a single stock row to HTML.
 */
function renderRowHtml(stock) {
    const symbol = stock.Symbol || stock.symbol || '';
    const name = stock.Name || stock.name || symbol;
    const industry = stock.industry || '—';
    const logoUrl = stock.stockUrl || '';

    // --- Numeric data ---
    const closeNum = parseFloat(stock.Close);
    const changeNum = parseFloat(stock['Price Change']);
    const pctChangeNum = parseFloat(stock['Percent Change']);
    const atrPctNum = parseFloat(stock.ATR_Percent);
    const rsi1hNum = parseFloat(stock.RSI1H);

    // Price text
    const price = isFinite(closeNum) ? `$${closeNum.toFixed(2)}` : 'N/A';

    // Change text (single line, no "1d" sub-row)
    const changeText = (
        isFinite(changeNum) && isFinite(pctChangeNum)
            ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${pctChangeNum >= 0 ? '+' : ''}${pctChangeNum.toFixed(2)}%)`
            : 'N/A'
    );

    // ATR%
    const atrPct = isFinite(atrPctNum) ? `${atrPctNum.toFixed(2)}%` : 'N/A';

    // RSI-1h
    const rsiText = isFinite(rsi1hNum) ? rsi1hNum.toFixed(1) : 'N/A';

    // color class for change
    let changeClass = '';
    if (isFinite(pctChangeNum)) {
        if (pctChangeNum > 0) changeClass = 'metric-change-up';
        else if (pctChangeNum < 0) changeClass = 'metric-change-down';
    }

    // RSI badge class (heat coloring)
    let rsiBadgeClass = 'badge-metric';
    if (isFinite(rsi1hNum)) {
        if (rsi1hNum <= 30) {
            rsiBadgeClass += ' badge-rsi-cold';
        } else if (rsi1hNum >= 70) {
            rsiBadgeClass += ' badge-rsi-hot';
        }
    }

    // Popup / fundamentals data
    const trailingPE = stock['Trailing PE'] || stock.trailingPE || 'N/A';
    const forwardPE  = stock['Forward PE'] || stock.forwardPE  || 'N/A';
    const evEbitda   = stock['EV/EBITDA'] || 'N/A';
    const earningsDate = stock.earningsDate || 'N/A';
    const high52 = stock.fiftyTwoWeekHigh || 'N/A';
    const low52  = stock.fiftyTwoWeekLow  || 'N/A';
    const dividend = stock.dividendYield || 'N/A';
    const totalRev = stock.totalRevenue || 'N/A';
    const netInc   = stock.netIncomeToCommon || 'N/A';
    const margin   = stock.profitMargins || 'N/A';
    const desc     = stock.stock_description || 'No description available';
    const marketCap = formatMarketCap(stock['Market Cap'] || stock.marketCap);

    return `
    <div class="volatility-row" data-symbol="${escapeHtml(symbol)}">
        <!-- COMPANY (col 1) -->
        <div class="company-cell">
            <button class="company-info-btn"
                    data-stock-name="${escapeHtml(name)}"
                    data-fifty-two-week-high="${escapeHtml(high52)}"
                    data-current-price="${isFinite(closeNum) ? closeNum.toFixed(2) : 'N/A'}"
                    data-fifty-two-week-low="${escapeHtml(low52)}"
                    data-earnings-date="${escapeHtml(earningsDate)}"
                    title="${escapeHtml(desc)}"
                    data-trailing-pe="${escapeHtml(trailingPE)}"
                    data-forward-pe="${escapeHtml(forwardPE)}"
                    data-ev-ebitda="${escapeHtml(evEbitda)}"
                    data-market-cap="${escapeHtml(marketCap)}"
                    data-dividend-yield="${escapeHtml(dividend)}"
                    data-total-revenue="${escapeHtml(totalRev)}"
                    data-net-income="${escapeHtml(netInc)}"
                    data-profit-margins="${escapeHtml(margin)}"
                    data-url="${escapeHtml(logoUrl)}">
                <img src="info.png" alt="Info">
            </button>

            <img class="company-logo"
                 src="${escapeHtml(logoUrl)}"
                 alt="${escapeHtml(name)} logo"
                 onerror="this.style.display='none'"/>

            <div class="company-text-block">
                <div class="company-name-line">
                    <span class="company-name-text">${escapeHtml(name)}</span>
                    <span class="ticker-chip">${escapeHtml(symbol)}</span>
                </div>
                <div class="company-subline">${escapeHtml(industry)}</div>
            </div>
        </div>

        <!-- PRICE (col 2) -->
        <div class="metric-col price-col">
            <div class="metric-main">${price}</div>
        </div>

        <!-- CHANGE (col 3) -->
        <div class="metric-col">
            <div class="metric-main ${changeClass}">${changeText}</div>
        </div>

        <!-- ATR% (col 4) -->
        <div class="badge-metric">${atrPct}</div>

        <!-- RSI-1h (col 5) -->
        <div class="${rsiBadgeClass}">${rsiText}</div>
    </div>`;
}

/**
 * basic HTML escaping to avoid breaking attributes / layout
 */
function escapeHtml(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
