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

document.addEventListener('DOMContentLoaded', function() {
    fetchMarketMoversData();

    document.addEventListener('click', function(event) {
        if (event.target.closest('.popup')) return;
        document.querySelectorAll('.popup').forEach(p => p.style.display = 'none');
    });
});

async function fetchMarketMoversData() {
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

        if (lastUpdated) {
            const ts = document.getElementById('last-updated');
            if (ts) ts.innerText = `Last Updated: ${lastUpdated}`;
        }

        // find movers
        const movers = allStocks.filter(s => 
            s['Percent Change'] !== null &&
            s['Percent Change'] !== undefined &&
            !isNaN(s['Percent Change'])
        );

        const ROW_LIMIT = 20;

        const topGainers = movers
            .filter(s => s['Percent Change'] > 0)
            .sort((a, b) => b['Percent Change'] - a['Percent Change'])

        const topDecliners = movers
            .filter(s => s['Percent Change'] < 0)
            .sort((a, b) => a['Percent Change'] - b['Percent Change'])

        renderMoversTable('top-gainers-container', topGainers.slice(0, ROW_LIMIT));
        renderMoversTable('top-decliners-container', topDecliners.slice(0, ROW_LIMIT));

        // click delegation for chart/info
        const gridContainer = document.querySelector('.movers-grid-container');
        if (gridContainer) {
            gridContainer.addEventListener('click', function(event) {
                // info button
                const infoBtn = event.target.closest('.company-info-btn');
                if (infoBtn) {
                    event.stopPropagation();
                    showInfoPopup(infoBtn);
                    return;
                }

                // row click
                const row = event.target.closest('.mover-row');
                if (row && row.dataset.symbol) {
                    showChartPopup(row.dataset.symbol);
                }
            });
        }

    } catch (error) {
        console.error('Error fetching market movers data:', error);
    }
}

/**
 * Returns a CSS class name based on the RSI value for color-coding.
 */
function getRsiBadgeClass(rsi) {
    const rsiValue = Number(rsi);
    if (isNaN(rsiValue)) return 'rsi-neutral';
    if (rsiValue <= 30) return 'rsi-low';
    if (rsiValue <= 35) return 'rsi-weak';
    if (rsiValue < 65) return 'rsi-neutral';
    if (rsiValue < 70) return 'rsi-strength';
    return 'rsi-high';
}

function renderMoversTable(containerId, data) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;

    if (!data || data.length === 0) {
        listEl.innerHTML = `
            <div style="padding:12px 16px; color:#6c757d; font-size:13px;">
                No stocks in this category.
            </div>`;
        return;
    }

    listEl.innerHTML = data.map(renderMoverRow).join('');
}

function renderMoverRow(stock) {
    const symbol = stock.Symbol || stock.symbol || '';
    const name = stock.Name || stock.name || symbol;
    const industry = stock.industry || '—';
    const logoUrl = stock.stockUrl || '';

    // price / change
    const priceNum = stock.Close;
    const priceText = (priceNum !== null && priceNum !== undefined && !isNaN(priceNum))
        ? formatValue(priceNum)
        : '—';

    const rawChange = stock['Price Change'];
    const rawPct = stock['Percent Change'];
    const changeText = (rawChange !== undefined && rawChange !== null && !isNaN(rawChange))
        ? `${formatChange(rawChange)} (${formatPercentChange(rawPct)})`
        : '—';

    let changeClass = '';
    if (isFinite(rawPct)) {
        if (rawPct > 0) changeClass = 'metric-change-up';
        else if (rawPct < 0) changeClass = 'metric-change-down';
    }

    // RSI lives under the name now
    const rsiVal = (stock.RSI !== undefined && stock.RSI !== null)
        ? formatRsi(stock.RSI)
        : 'N/A';
    const rsiBadgeClass = getRsiBadgeClass(stock.RSI);

    // fundamentals for popup
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
    const trailingPeColor = getTrailingPeColor(stock["Trailing PE"] || stock.trailingPE);
    const forwardPeColor  = getForwardPeColor(stock["Forward PE"] || stock.forwardPE, stock["Trailing PE"] || stock.trailingPE);

    return `
        <div class="mover-row" data-symbol="${escapeHtml(symbol)}">
            <!-- COL 1: company block -->
            <div class="mover-company-cell">
                <button class="company-info-btn"
                        data-stock-name="${escapeHtml(name)}"
                        data-fifty-two-week-high="${escapeHtml(high52)}"
                        data-current-price="${priceNum != null && !isNaN(priceNum) ? escapeHtml(priceNum.toFixed(2)) : 'N/A'}"
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
                        data-trailing-pe-color="${escapeHtml(trailingPeColor)}"
                        data-forward-pe-color="${escapeHtml(forwardPeColor)}"
                        data-url="${escapeHtml(logoUrl)}">
                    <img src="info.png" alt="Info">
                </button>

                <img class="company-logo"
                        src="${escapeHtml(logoUrl)}"
                        alt="${escapeHtml(name)} logo"
                        onerror="this.style.display='none'"/>

                <div class="mover-text-block">
                    <div class="mover-name-line">
                        <span class="mover-name-text">${escapeHtml(name)}</span><span class="ticker-chip">${escapeHtml(symbol)}</span>
                    </div>
                    <div class="mover-industry-line">
                        ${escapeHtml(industry)}
                    </div>
                </div>
            </div>

            <!-- COL 2: RSI badge -->
            <div class="mover-rsi-col">
                <span class="rsi-badge ${rsiBadgeClass}">RSI: ${escapeHtml(rsiVal)}</span>
            </div>

            <!-- COL 3: price/change block -->
            <div class="mover-change-block">
                <div class="mover-change-delta ${changeClass}">
                    ${escapeHtml(changeText)}
                </div>
                <div class="mover-change-price">
                    ${escapeHtml(priceText)}
                </div>
            </div>
        </div>
    `;
}

// util to not break HTML
function escapeHtml(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// we keep importDependencies in case inline popup/chart ever need globals
function importDependencies() {
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
        import { showInfoPopup } from './popup.js';
        import { showChartPopup } from './chart.js';
        window.showInfoPopup = showInfoPopup;
        window.showChartPopup = showChartPopup;
    `;
    document.head.appendChild(script);
}
importDependencies();
