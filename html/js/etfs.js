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

// --- Logo lookup from list_watchlist.json (cached in-memory) ---
let _logoMap = null;

const SYMBOL_ALIASES = new Map([
  // common dual-tickers / class-share variants
  ["GOOGL", "GOOG"],
  ["BRK.B", "BRK-B"],
  ["BF.B", "BF-B"],
  // add any others you run into here
]);

function normalizeCandidates(sym) {
  const s = (sym || "").toUpperCase();
  if (!s) return [];
  const cands = new Set([s]);

  // dot <-> dash swap attempts
  cands.add(s.replace(/\./g, "-"));
  cands.add(s.replace(/-/g, "."));

  // explicit alias mapping
  if (SYMBOL_ALIASES.has(s)) cands.add(SYMBOL_ALIASES.get(s));

  return Array.from(cands);
}

async function loadLogoMap() {
  if (_logoMap) return _logoMap;
  _logoMap = new Map();
  try {
    const res = await fetch("/list_watchlist.json", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      const cats = j?.Categories || {};
      for (const subs of Object.values(cats)) {
        for (const arr of Object.values(subs)) {
          if (Array.isArray(arr)) {
            for (const it of arr) {
              const sym = (it.symbol || it.Symbol || "").toUpperCase();
              const url = it.stockUrl || it.logoUrl || "";
              if (sym && url) _logoMap.set(sym, url);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Logo map load failed", e);
  }
  return _logoMap;
}

function getLogoForSymbol(sym) {
  if (!_logoMap) return "";
  for (const c of normalizeCandidates(sym)) {
    const hit = _logoMap.get(c);
    if (hit) return hit;
  }
  return "";
}

// Set the chart box's height to match the holdings panel (bounded)
function syncChartHeight(symbol) {
  const chartBox = document.getElementById(`tv-adv-${symbol}`);
  if (!chartBox) return 0;
  const target = 620;   // pick 600–660 if you prefer
  chartBox.style.height = `${target}px`;
  return target;
}

function ensureAdvChart(symbol) {
  const id = `tv-adv-${symbol}`;
  const mount = document.getElementById(id);
  if (!mount || mount.dataset.loaded) return;

  // ensure inner widget node exists (no shadowing)
  let inner = mount.querySelector('.tradingview-widget-container__widget');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    mount.appendChild(inner);
  }
  
  const mountWidget = () => {
    inner.innerHTML = "";

    const hTarget = syncChartHeight(symbol);
    const w = Math.max(320, mount.clientWidth);
    const h = Math.max(320, hTarget || mount.clientHeight || 620);

    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.src  = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.text = JSON.stringify({
      autosize: false,     // <-- important
      width:  w,
      height: h,
      symbol: symbol,
      timezone: "America/Chicago",
      theme: "light",
      style: "1",
      locale: "en",
      interval: "D",
      range: "12M",
      enable_drawing: true,
      withdateranges: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      calendar: false,
      studies: ["STD;RSI"],
      support_host: "https://www.tradingview.com"
    });
    inner.appendChild(s);
  };

  requestAnimationFrame(() => {
    mountWidget();

    // Remount if either the chart box width changes OR the holdings height changes
    if (!mount._ro) {
      let t;
      const holdings = mount.previousElementSibling;
      const onResize = () => { clearTimeout(t); t = setTimeout(mountWidget, 120); };
      mount._ro = new ResizeObserver(onResize);
      mount._ro.observe(mount);
      if (holdings) {
        mount._ro_holdings = new ResizeObserver(onResize);
        mount._ro_holdings.observe(holdings);
      }
    }
  });

  mount.dataset.loaded = "1";
}

function renderFundStats(stats = {}) {
  const n = (v) => (v == null || !isFinite(v)) ? null : Number(v);
  const money = (v) => (n(v) == null) ? '—' : '$' + n(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const price = (v) => (n(v) == null) ? '—' : '$' + n(v).toFixed(2);
  const pct   = (v) => (n(v) == null) ? '—' : n(v).toFixed(2) + '%';
  const range = (lo, hi) => (n(lo) == null || n(hi) == null) ? '—' : `$${n(lo).toFixed(2)} → $${n(hi).toFixed(2)}`;

  const {
    price: p,
    netAssets, nav, sharesOutstanding,
    expenseRatioAnnual, dividendYieldTTM, ytdReturnPct,
    fiftyTwoWeekLow, fiftyTwoWeekHigh
  } = stats || {};

  return `
    <div class="fund-stats-flat">
        <table class="fund-stats-table">
          <tbody>
            <tr><td>PRICE</td><td>${price(p)}</td></tr>
            <tr><td>Net Assets</td><td>${money(netAssets)}</td></tr>
            <tr><td>NAV</td><td>${price(nav)}</td></tr>
            <tr><td>Shares Outstanding</td><td>${n(sharesOutstanding)==null ? '—' : n(sharesOutstanding).toLocaleString('en-US')}</td></tr>
            <tr><td>Expense Ratio</td><td>${pct(expenseRatioAnnual)}</td></tr>
            <tr><td>Dividend Yield (TTM)</td><td>${pct(dividendYieldTTM)}</td></tr>
            <tr><td>YTD Return</td><td>${pct(ytdReturnPct)}</td></tr>
            <tr><td>52-Week Range</td><td>${range(fiftyTwoWeekLow, fiftyTwoWeekHigh)}</td></tr>
          </tbody>
        </table>
    </div>
  `;
}

function renderHoldingsTable(holdings = [], stats = {}, parentSymbol = "") {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return `
      <div class="holdings-wrap">
        <div class="holdings-title">Top Holdings</div>
        <div class="empty-note">No holdings available.</div>
        ${renderFundStats(stats)}
      </div>`;
  }

  const rows = holdings.map(h => {
    const sym = (h.symbol || '').toUpperCase();
    const wt = (h.weight != null && isFinite(h.weight)) ? h.weight.toFixed(2) + '%' : '—';
    const safeName = h.name || sym || '-';

    return `
      <tr>
        <td class="h-col-symbol"><span class="symbol-badge">${sym || '-'}</span></td>
        <td class="h-col-name" title="${safeName}">${safeName}</td>
        <td class="h-col-weight h-wt">${wt}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="holdings-wrap">
      <div class="holdings-title">Top Holdings</div>
      <table class="holdings-table">
        <thead>
          <tr>
            <th class="h-col-symbol">Symbol</th>
            <th class="h-col-name">Company</th>
            <th class="h-col-weight h-wt">Weight</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${renderFundStats(stats)}
    </div>
  `;
}

function changeBg(pctChange) {
  if (pctChange === null || pctChange === undefined || !isFinite(pctChange)) {
    return "var(--hover-bg)";
  }
  const abs = Math.abs(pctChange);
  const green = ["#d4edda", "#a5d6a7", "#81c784", "#388e3c"];
  const red   = ["#ffe3e0", "#ffb3ad", "#ff7961", "#d32f2f"];
  const idx = abs < 1 ? 0 : abs < 3 ? 1 : abs < 6 ? 2 : 3;
  return pctChange >= 0 ? green[idx] : red[idx];
}

document.addEventListener('DOMContentLoaded', async function() {
    const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);

    const refreshButton = document.getElementById('refresh-button');
    const buttonContainer = refreshButton ? refreshButton.closest('.button-container') : null;

    if (isLocal() && buttonContainer) {
        buttonContainer.style.display = 'flex';
        refreshButton.addEventListener('click', function() {
            this.setAttribute('data-refreshing', 'true');
            loadEtfData({ refresh: true });
        });
    }

    // NEW: prepare logos
    await loadLogoMap();

    // Initial load uses static only
    loadEtfData({ refresh: false, preferStatic: true });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.expand-toggle');
      if (!btn) return;
      e.stopPropagation();

      const row = btn.closest('tr');
      const expandRow = row && row.nextElementSibling;
      if (!expandRow || !expandRow.classList.contains('expand-row')) return;

      const icon = btn.querySelector('img');
      const isOpen = expandRow.style.display !== 'none';

      expandRow.style.display = isOpen ? 'none' : '';
      btn.classList.toggle('is-open', !isOpen);
      if (icon) icon.src = isOpen ? 'plus.png' : 'minus.png';

      if (!isOpen) {
        const sym = row?.dataset?.symbol || row.getAttribute('data-symbol');

        // Wait for layout to apply, then mount, then nudge autosize.
        requestAnimationFrame(() => {
          ensureAdvChart(sym);

          // If the table reflows after images/fonts, nudge again.
          setTimeout(() => window.dispatchEvent(new Event('resize')), 120);

          // Robust: re-nudge on any size change of the container.
          const container = document.getElementById(`tv-adv-${sym}`);
          if (container && !container._ro) {
            container._ro = new ResizeObserver(() => {
              window.dispatchEvent(new Event('resize'));
            });
            container._ro.observe(container);
          }
        });
      }
    });
});

function formatCT(ts) {
  // Accept ISO or plain strings; always show CT-like label
  try {
    const d = new Date(ts);
    if (!isNaN(d)) {
      return new Intl.DateTimeFormat("en-US", {
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
        hour12: false, timeZone: "America/Chicago"
      }).format(d) + " CT";
    }
  } catch {}
  return ts; // fallback to whatever string came back
}

async function loadEtfData(opts = {}) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    const refreshButton = document.getElementById('refresh-button');
    const isRefreshing = opts.refresh || false;

    try {
        const response = await getCategoryData('ETFs', { refresh: isRefreshing, scope: 'etf' });
        const lastUpdated = response.updated_at || response.last_updated;
        const ts = document.getElementById('last-updated');
        if (ts && lastUpdated) ts.textContent = `Last Updated: ${formatCT(lastUpdated)}`;

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

    const rsiColor = getRsiBackgroundStyle(etf.RSI);

    return `
  <tr data-symbol="${symbol}">
    <td class="company-name">
      <div class="company-cell">
        <button class="expand-toggle" aria-label="Expand/Collapse">
          <img src="plus.png" alt="+">
        </button>
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
    <td class="change">
      <div class="badge-change" style="background-color: ${isFinite(pctChangeNum) ? changeBg(pctChangeNum) : 'var(--hover-bg)'};">
        ${changeText}
      </div>
    </td>
    <td class="rsi"><div class="badge-metric" style="background-color: ${rsiColor};">${etf.RSI !== undefined ? formatRsi(etf.RSI) : '-'}</div></td>
  </tr>

  <!-- REPLACED CONTENT: the expander now ONLY shows holdings -->
  <tr class="expand-row" data-symbol="${symbol}" style="display:none;">
    <td colspan="8">
      <div class="expand-panel">
        ${renderHoldingsTable(etf.holdings, etf.fund_stats)}
        <div class="tv-adv tradingview-widget-container" id="tv-adv-${symbol}">
          <div class="tradingview-widget-container__widget"></div>
        </div>
      </div>
    </td>
  </tr>
`;
}