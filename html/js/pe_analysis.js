import { showChartPopup } from './chart.js';
import { getCategoryData } from './dataSource.js';

let myChart;
let chartData = {}; // { category: { industry: [ {name, value:[cap, fpe], symbol} ] } }
let currentView = 'categories'; // 'categories' | 'industries'
let selectedCategory = null;
let highlightedSeries = null;

document.addEventListener('DOMContentLoaded', function() {
    const chartDom = document.getElementById('peScatterChart');
    if (chartDom) {
        // assumes echarts is globally available
        myChart = echarts.init(chartDom);
        setupEventListeners();
    }
    loadChartData();
});

async function loadChartData() {
    try {
        // Include "Owned" so we can merge its stocks into their true categories/industries.
        const categoriesToFetch = [
            'Owned',
            'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);

        const combinedData = {};
        let lastUpdated = '';

        results.forEach((responseData, idx) => {
            if (!responseData) return;

            // Grab timestamp once
            if (!lastUpdated && (responseData.updated_at || responseData.last_updated)) {
                lastUpdated = responseData.updated_at || responseData.last_updated;
            }

            const requestedCat = categoriesToFetch[idx];
            const items = (responseData.items || responseData.data || []).filter(Boolean);

            // IMPORTANT: If we requested "Owned", force the bucket to be named "Owned"
            // so we can merge it later. Do not infer from the items.
            let categoryName = responseData.category;
            if (requestedCat === 'Owned') {
                categoryName = 'Owned';
            } else if (!categoryName) {
                // For non-Owned, try to infer from the first item, else fall back to requested name.
                const inferred = items.length > 0 ? items[0].category : null;
                categoryName = inferred || requestedCat;
            }

            if (!combinedData[categoryName]) combinedData[categoryName] = [];
            combinedData[categoryName].push(...items);
        });

        // ---- Merge "Owned" into real categories/industries, then remove it ----
        if (combinedData['Owned']) {
            const ownedItems = combinedData['Owned'];
            for (const stk of ownedItems) {
                const cat = stk.category || 'Uncategorized';
                if (!combinedData[cat]) combinedData[cat] = [];
                combinedData[cat].push(stk);
            }
            delete combinedData['Owned'];
        }

        // Update the "Last Updated" UI
        const el = document.getElementById('last-updated');
        if (el && lastUpdated) el.innerText = `Last Updated: ${lastUpdated}`;

        prepareChartData(combinedData);
    } catch (error) {
        console.error('Error loading P/E chart data:', error);
    }
}

function prepareChartData(categoryData) {
    const negativePeStocks = [];
    const processedSymbols = new Set();

    // Single source of truth for charted categories (Owned intentionally excluded)
    const activeCategories = [
        'Information Technology',
        'Financial Services',
        'Industrials',
        'Energy & Utilities',
        'Healthcare',
        'Communication Services',
        'Real Estate',
        'Consumer Staples',
        'Consumer Discretionary'
    ];

    // Reset and initialize nested structure
    chartData = {};
    activeCategories.forEach(cat => { chartData[cat] = {}; });

    // Flatten all stocks while deduping by symbol (case-insensitive)
    const allStocks = Object.entries(categoryData)
        .filter(([cat]) => activeCategories.includes(cat)) // ignore Uncategorized or others
        .map(([, arr]) => arr)
        .flat()
        .filter(stock => {
            const sym = (stock.Symbol || stock.symbol || '').toUpperCase().trim();
            if (!sym) return false;
            if (processedSymbols.has(sym)) return false;
            processedSymbols.add(sym);
            return true;
        });

    allStocks.forEach(stock => {
        const category = stock.category || 'Uncategorized';
        const industry = stock.industry || 'Uncategorized';

        // Parse market cap
        const mcRaw = stock['Market Cap'];
        const marketCap = (mcRaw !== undefined && mcRaw !== null && mcRaw !== 'N/A')
            ? Number(mcRaw)
            : null;

        // Parse Forward PE (could be number or string)
        const fpeRaw = stock['Forward PE'];
        const forwardPE = (fpeRaw !== undefined && fpeRaw !== null && fpeRaw !== 'N/A' && fpeRaw !== '-')
            ? Number(fpeRaw)
            : null;

        const validCategory = activeCategories.includes(category);
        const validCap = marketCap && isFinite(marketCap) && marketCap > 0;
        const validFPE = forwardPE && isFinite(forwardPE) && forwardPE > 0;

        if (validCategory && validCap && validFPE) {
            if (!chartData[category][industry]) chartData[category][industry] = [];
            chartData[category][industry].push({
                name: stock.Name || stock.name || (stock.Symbol || stock.symbol),
                value: [marketCap, forwardPE], // market cap expected in millions in your data
                symbol: stock.Symbol || stock.symbol
            });
        } else {
            negativePeStocks.push(stock);
        }
    });

    renderChart();
    renderNegativePeList(negativePeStocks);
}

function renderChart() {
    if (!myChart) return;

    let series = [];
    let legendData = [];
    let chartTitle = 'Market Cap vs. Forward P/E Ratio';

    if (currentView === 'categories') {
        legendData = Object.keys(chartData);
        series = legendData.map(category => {
            const categoryStocks = Object.values(chartData[category]).flat();
            return {
                name: category,
                type: 'scatter',
                data: categoryStocks,
                symbolSize: 8,
                label: {
                    show: false,
                    formatter: (params) => params.data.symbol,
                    position: 'top',
                    fontSize: 10
                },
                emphasis: {
                    focus: 'series',
                    label: {
                        show: true,
                        formatter: (params) => params.data.symbol,
                        position: 'top'
                    }
                }
            };
        });
    } else if (currentView === 'industries' && selectedCategory) {
        chartTitle = `${selectedCategory} - Market Cap vs. Forward P/E`;
        legendData = Object.keys(chartData[selectedCategory]);
        series = legendData.map(industry => ({
            name: industry,
            type: 'scatter',
            data: chartData[selectedCategory][industry],
            symbolSize: 8,
            label: { show: true, formatter: (p) => p.data.symbol, position: 'top', fontSize: 10 },
            emphasis: { focus: 'series', label: { show: true, formatter: (p) => p.data.symbol, position: 'top' } }
        }));
    }

    const option = {
        title: { text: chartTitle, left: 'center', top: 20 },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                const marketCapInMillions = params.data.value[0];
                const asB = marketCapInMillions >= 1000
                    ? `$${(marketCapInMillions / 1000).toFixed(2)}B`
                    : `$${marketCapInMillions.toFixed(2)}M`;
                return `${params.data.name} (${params.data.symbol})<br/>` +
                       `Market Cap: ${asB}<br/>` +
                       `Forward P/E: ${params.data.value[1].toFixed(2)}`;
            }
        },
        grid: { bottom: '20%' },
        legend: {
            data: legendData,
            orient: 'horizontal',
            bottom: 10,
            type: 'scroll'
        },
        xAxis: {
            type: 'log',
            name: 'Market Cap',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: function (value) {
                    return value >= 1000 ? (value / 1000) + 'B' : value + 'M';
                }
            }
        },
        yAxis: {
            type: 'log',
            name: 'Forward P/E',
            nameLocation: 'middle',
            nameGap: 40
        },
        series
    };

    myChart.setOption(option, true);
}

function setupEventListeners() {
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            currentView = 'categories';
            selectedCategory = null;
            highlightedSeries = null;
            renderChart();
            backButton.style.display = 'none';
        });
    }

    myChart.on('click', function (params) {
        if (params.componentType === 'series' && params.data && params.data.symbol) {
            showChartPopup(params.data.symbol);
        } else if (params.seriesName === undefined && highlightedSeries) {
            highlightedSeries = null;
            const seriesOption = myChart.getOption().series;
            const resetSeries = seriesOption.map(s => ({
                name: s.name,
                itemStyle: { opacity: 1 },
                label: { show: false }
            }));
            myChart.setOption({ series: resetSeries });
        }
    });

    myChart.on('legendselectchanged', function (params) {
        const clickedSeriesName = params.name;
        const allSeriesNames = myChart.getOption().legend[0].data;

        // keep all series selected (legend acts as drill/highlight control)
        allSeriesNames.forEach(name => {
            myChart.dispatchAction({ type: 'legendSelect', name: name });
        });

        if (currentView === 'categories') {
            selectedCategory = clickedSeriesName;
            currentView = 'industries';
            highlightedSeries = null;
            renderChart();
            const backBtn = document.getElementById('back-button');
            if (backBtn) backBtn.style.display = 'inline-block';
        } else {
            setTimeout(() => {
                if (highlightedSeries === clickedSeriesName) {
                    highlightedSeries = null;
                    const resetSeries = myChart.getOption().series.map(s => ({
                        name: s.name,
                        itemStyle: { opacity: 1 },
                        label: { show: true }
                    }));
                    myChart.setOption({ series: resetSeries });
                } else {
                    highlightedSeries = clickedSeriesName;
                    const updatedSeries = myChart.getOption().series.map(s => ({
                        name: s.name,
                        itemStyle: { opacity: s.name === highlightedSeries ? 1 : 0.2 },
                        label: { show: s.name === highlightedSeries }
                    }));
                    myChart.setOption({ series: updatedSeries });
                }
            }, 0);
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

function renderNegativePeList(stocks) {
    const listContainer = document.getElementById('negative-pe-list');
    if (!listContainer) return;

    if (stocks.length === 0) {
        listContainer.innerHTML = '<li>All stocks have a positive Forward P/E.</li>';
        return;
    }

    // Sort by market cap desc (treating N/A as 0)
    stocks.sort((a, b) => {
        const capA = (a['Market Cap'] === 'N/A' || a['Market Cap'] == null) ? 0 : Number(a['Market Cap']);
        const capB = (b['Market Cap'] === 'N/A' || b['Market Cap'] == null) ? 0 : Number(b['Market Cap']);
        return capB - capA;
    });

    const itemsHtml = stocks.map(stock => 
        `<li>${stock.Name || stock.name || (stock.Symbol || stock.symbol)} (${stock.Symbol || stock.symbol})</li>`
    ).join('');

    listContainer.innerHTML = itemsHtml;
}
