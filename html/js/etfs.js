import {
    formatMarketCap,
    formatValue,
    formatChange,
    formatPercentChange,
    formatRsi,
    getRsiBackgroundStyle
} from './utils.js';
import { getCategoryData } from './dataSource.js';
import { showInfoPopup } from './popup.js';
import { showChartPopup } from './chart.js';

document.addEventListener('DOMContentLoaded', function() {
    const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);

    const refreshButton = document.getElementById('refresh-button');
    const buttonContainer = refreshButton ? refreshButton.closest('.button-container') : null;

    if (isLocal() && buttonContainer) {
        buttonContainer.style.display = 'flex'; // Show button on localhost
        refreshButton.addEventListener('click', function() {
            this.setAttribute('data-refreshing', 'true');
            loadEtfData();
        });
    }

    loadEtfData(); // Initial load
});

async function loadEtfData() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    const refreshButton = document.getElementById('refresh-button');
    const isRefreshing = refreshButton ? refreshButton.getAttribute('data-refreshing') === 'true' : false;

    try {
        const response = await getCategoryData('ETFs', { refresh: isRefreshing });
        const lastUpdated = response.updated_at || response.last_updated;
        const ts = document.getElementById('last-updated');
        if (ts && lastUpdated) ts.textContent = `Last Updated: ${lastUpdated}`;

        const etfs = response.items || response.data || [];
        renderEtfTable(etfs);

    } catch (error) {
        console.error('Error loading ETF data:', error);
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (refreshButton) refreshButton.setAttribute('data-refreshing', 'false');
    }
}

function renderEtfTable(etfs) {
    const container = document.getElementById('etf-content-container');
    if (!container) return;

    if (etfs.length === 0) {
        container.innerHTML = '<p>No ETF data available.</p>';
        return;
    }

    // --- Group ETFs by their sub-category (which is stored in the 'industry' field) ---
    const subCategories = {};
    etfs.forEach(etf => {
        const subCategory = etf.industry || 'Uncategorized';
        if (!subCategories[subCategory]) {
            subCategories[subCategory] = [];
        }
        subCategories[subCategory].push(etf);
    });

    // --- Create a main section wrapper to hold all the tables ---
    const section = document.createElement('div');
    section.className = 'section';

    const categoryHeading = document.createElement('h2');
    categoryHeading.textContent = 'ETFs';
    section.appendChild(categoryHeading);
    
    // --- Render a separate table for each sub-category ---
    for (const [subCategory, etfList] of Object.entries(subCategories)) {
        if (etfList.length === 0) continue;

        const industrySection = document.createElement('div');
        industrySection.className = 'industry-section';

        const industryHeading = document.createElement('h3');
        industryHeading.textContent = subCategory;
        industrySection.appendChild(industryHeading);

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="company-name">Name</th>
                    <th class="market-cap">Market Cap</th>
                    <th class="open">Open</th>
                    <th class="high">High</th>
                    <th class="low">Low</th>
                    <th class="close">Close</th>
                    <th class="change">Change</th>
                    <th class="rsi">RSI</th>
                </tr>
            </thead>
            <tbody>
                ${etfList.map(renderEtfRow).join('')}
            </tbody>
        `;

        industrySection.appendChild(table);
        section.appendChild(industrySection);

        // Add event listeners for this specific table
        table.querySelectorAll('.chart-clickable').forEach(el => {
            el.addEventListener('click', (e) => { e.stopPropagation(); showChartPopup(el.dataset.symbol); });
        });
        table.querySelectorAll('.company-info-btn').forEach(el => {
            el.addEventListener('click', (e) => { e.stopPropagation(); showInfoPopup(el); });
        });
    }

    container.innerHTML = ''; // Clear placeholder
    container.appendChild(section);
}

function renderEtfRow(etf) {
    const symbol = etf.Symbol || etf.symbol;
    const name = etf.Name || etf.name;
    const logoUrl = etf.stockUrl || '';

    const changeNum = parseFloat(etf['Price Change']);
    const pctChangeNum = parseFloat(etf['Percent Change']);
    const changeText = (isFinite(changeNum) && isFinite(pctChangeNum))
        ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)} (${pctChangeNum >= 0 ? '+' : ''}${pctChangeNum.toFixed(2)}%)`
        : 'N/A';
    const changeClass = pctChangeNum > 0 ? 'metric-change-up' : (pctChangeNum < 0 ? 'metric-change-down' : '');

    const rsiColor = getRsiBackgroundStyle(etf.RSI);

    return `
        <tr data-symbol="${symbol}">
            <td class="company-name">
                <div class="company-cell">
                    <img class="company-logo chart-clickable" src="${logoUrl}" alt="${name} logo" onerror="this.style.display='none'" data-symbol="${symbol}">
                    <div class="company-text-block">
                        <div class="company-name-line">
                            <span class="company-name-text chart-clickable" data-symbol="${symbol}">${name}</span>
                            <span class="ticker-chip">${symbol}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td class="market-cap">${formatMarketCap(etf['Market Cap'] || etf.marketCap)}</td>
            <td class="open">${etf.Open != null ? formatValue(etf.Open) : '-'}</td>
            <td class="high">${etf.High != null ? formatValue(etf.High) : '-'}</td>
            <td class="low">${etf.Low != null ? formatValue(etf.Low) : '-'}</td>
            <td class="close">${etf.Close != null ? formatValue(etf.Close) : '-'}</td>
            <td class="change"><div class="metric-main ${changeClass}">${changeText}</div></td>
            <td class="rsi"><div class="badge-metric" style="background-color: ${rsiColor};">${etf.RSI !== undefined ? formatRsi(etf.RSI) : '-'}</div></td>
        </tr>
    `;
}