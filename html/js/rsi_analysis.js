import { showChartPopup } from './chart.js';
import { showInfoPopup } from './popup.js';
import {
    getTrailingPeColor,
    getForwardPeColor,
    formatMarketCap,
    getRsiBackgroundStyle
} from './utils.js';
import { getCategoryData } from './dataSource.js';

document.addEventListener('DOMContentLoaded', function () {
    loadRsiData();
});

async function loadRsiData() {
    try {
        const categoriesToFetch = [
            'Owned', 'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);

        let allStocks = [];
        const processedSymbols = new Set();
        let lastUpdated = '';

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

        // timestamp
        if (lastUpdated) {
            const ts = document.getElementById('last-updated');
            if (ts) ts.textContent = `Last Updated: ${lastUpdated}`;
        }

        // keep only stocks with valid RSI
        const stocksWithRsi = allStocks.filter(stock =>
            stock.RSI !== null &&
            stock.RSI !== 'N/A' &&
            !isNaN(parseFloat(stock.RSI))
        );

        // helper sort: big names first
        const sortByMarketCapDesc = (a, b) => {
            const capA = a['Market Cap'] === 'N/A' ? 0 : parseFloat(a['Market Cap']);
            const capB = b['Market Cap'] === 'N/A' ? 0 : parseFloat(b['Market Cap']);
            return capB - capA;
        };

        // build groupings
        const oversold = stocksWithRsi
            .filter(s => parseFloat(s.RSI) <= 30)
            .sort(sortByMarketCapDesc);

        const overbought = stocksWithRsi
            .filter(s => parseFloat(s.RSI) >= 70)
            .sort(sortByMarketCapDesc);

        // we need yRSI logic for transitions
        const withYRsi = stocksWithRsi.filter(
            s => s.yRSI !== null && s.yRSI !== 'N/A' && !isNaN(parseFloat(s.yRSI))
        );

        // Was NOT oversold yesterday, now in 30 < RSI ≤ 35 (early dip watch)
        const enteringOversold = withYRsi
            .filter(s => parseFloat(s.yRSI) > 30 &&
                         parseFloat(s.RSI)  > 30 &&
                         parseFloat(s.RSI)  <= 35)
            .sort(sortByMarketCapDesc);

        // WAS oversold yesterday (yRSI ≤ 30), now recovering >30 (bounce watch)
        const exitingOversold = withYRsi
            .filter(s => parseFloat(s.yRSI) <= 30 &&
                         parseFloat(s.RSI)  > 30)
            .sort(sortByMarketCapDesc);

        // WAS overbought yesterday (yRSI ≥ 70), cooling off <70 (top watch)
        const exitingOverbought = withYRsi
            .filter(s => parseFloat(s.yRSI) >= 70 &&
                         parseFloat(s.RSI)  < 70)
            .sort(sortByMarketCapDesc);

        // render into each section
        renderList('oversold-list', oversold);
        renderList('overbought-list', overbought);
        renderList('entering-oversold-list', enteringOversold);
        renderList('exiting-oversold-list', exitingOversold);
        renderList('exiting-overbought-list', exitingOverbought);

        // single event delegation for all RSI tables
        const gridContainer = document.querySelector('.rsi-grid-container');
        if (gridContainer) {
            gridContainer.addEventListener('click', function (event) {
                // info button click stops row click
                const infoBtn = event.target.closest('.company-info-btn');
                if (infoBtn) {
                    event.stopPropagation();
                    showInfoPopup(infoBtn);
                    return;
                }

                // otherwise, row click opens chart
                const row = event.target.closest('.rsi-row');
                if (row && row.dataset.symbol) {
                    showChartPopup(row.dataset.symbol);
                }
            });
        }
    } catch (err) {
        console.error('Error loading RSI data:', err);
    }
}

/**
 * Render a list of stocks into a given container.
 * Target containers (in HTML) will live inside each .rsi-table just like oversold-list etc.
 * We output rows matching the shared table style (company | price | chg | rsi).
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
 * Render one row (company cell + price/chg/RSI).
 * Mirrors the Volatility-style row:
 * - .rsi-row is a grid with fixed numeric column widths
 * - first column is company info block
 * - last column shows RSI as a colored badge
 */
function renderRowHtml(stock) {
    const symbol = stock.Symbol || stock.symbol || '';
    const name = stock.Name || stock.name || symbol;
    const industry = stock.industry || '—';
    const logoUrl = stock.stockUrl || '';

    // numeric data
    const closeNum = parseFloat(stock.Close);
    const changeNum = parseFloat(stock['Price Change']);
    const pctChangeNum = parseFloat(stock['Percent Change']);
    const rsiNum = parseFloat(stock.RSI);

    const priceText = isFinite(closeNum) ? `$${closeNum.toFixed(2)}` : 'N/A';

    const changeText = (isFinite(changeNum) && isFinite(pctChangeNum))
        ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${pctChangeNum >= 0 ? '+' : ''}${pctChangeNum.toFixed(2)}%)`
        : 'N/A';

    let changeClass = '';
    if (isFinite(pctChangeNum)) {
        if (pctChangeNum > 0) changeClass = 'metric-change-up';
        else if (pctChangeNum < 0) changeClass = 'metric-change-down';
    }

    const rsiText = isFinite(rsiNum) ? rsiNum.toFixed(1) : 'N/A';
    const rsiBg = getRsiBackgroundStyle(stock.RSI);

    // fundamentals popup data attrs
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
    <div class="rsi-row" data-symbol="${escapeHtml(symbol)}">
        <!-- COL 1: company block -->
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
                </div>
                <div class="company-subline">${escapeHtml(industry)}</div>
                <div class="company-price-line">
                    <span class="price-text">${escapeHtml(priceText)}</span>
                    <span class="change-text ${changeClass}">${escapeHtml(changeText)}</span>
                </div>
            </div>
        </div>

        <!-- COL 2: fixed ticker chip lane -->
        <div class="ticker-col">
            <span class="ticker-chip">${escapeHtml(symbol)}</span>
        </div>

        <!-- COL 3: RSI badge -->
        <div class="badge-metric" style="background-color:${escapeHtml(rsiBg)};">
            ${escapeHtml(rsiText)}
        </div>
    </div>`;
}


/* tiny util to safely escape text going into HTML */
function escapeHtml(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
