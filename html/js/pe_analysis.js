import { showChartPopup } from './chart.js';
import { getCategoryData } from './dataSource.js';

let myChart;
let chartData = {}; // Will hold the nested data: { category: { industry: [stocks] } }
let currentView = 'categories'; // Can be 'categories' or 'industries'
let selectedCategory = null;
let highlightedSeries = null;

document.addEventListener('DOMContentLoaded', function() {
    const chartDom = document.getElementById('peScatterChart');
    if (chartDom) {
        myChart = echarts.init(chartDom);
        setupEventListeners();
    }
    loadChartData();
});

async function loadChartData() {
    try {
        // Categories to display on the chart
        const categoriesToFetch = [
            'Information Technology', 'Industrials', 'Energy & Utilities',
            'Financial Services', 'Healthcare', 'Communication Services',
            'Real Estate', 'Consumer Staples', 'Consumer Discretionary'
        ];

        // Fetch all categories in parallel
        const promises = categoriesToFetch.map(cat => getCategoryData(cat));
        const results = await Promise.all(promises);

        // Combine the data into the format prepareChartData expects
        const combinedData = {};
        let lastUpdated = '';

        results.forEach(responseData => {
            // Grab the timestamp from the first valid response
            if (!lastUpdated && (responseData.updated_at || responseData.last_updated)) {
                lastUpdated = responseData.updated_at || responseData.last_updated;
            }

            // The local server doesn't return the category name, so we derive it
            const categoryName = responseData.category || categoriesToFetch.find(c => {
                const items = responseData.items || responseData.data || [];
                return items.length > 0 && items[0].category === c;
            });


            if (categoryName) {
                combinedData[categoryName] = responseData.items || responseData.data || [];
            }
        });
        prepareChartData(combinedData);
    } catch (error) {
        // Update the last updated timestamp in the UI
        if (lastUpdated) {
            document.getElementById('last-updated').innerText = `Last Updated: ${lastUpdated}`;
        }

        console.error('Error loading P/E chart data:', error);
    }
}

function prepareChartData(categoryData) {
    const negativePeStocks = [];
    const processedSymbols = new Set();

    // Define the single source of truth for active categories
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

    // Initialize the nested data structure
    activeCategories.forEach(cat => {
        chartData[cat] = {};
    });

    // Flatten all stocks into a single list, avoiding duplicates from the "Owned" category
    const allStocks = Object.values(categoryData).flat().filter(stock => {
        if (processedSymbols.has(stock.symbol || stock.Symbol)) {
            return false;
        }
        processedSymbols.add(stock.symbol || stock.Symbol);
        return true;
    });

    allStocks.forEach(stock => {
        const marketCap = stock['Market Cap'] ? parseFloat(stock['Market Cap']) : null;
        const forwardPE = stock['Forward PE'];
        const category = stock.category || 'Uncategorized';
        const industry = stock.industry || 'Uncategorized';

        // Process the stock only if its category is in our active list
        if (activeCategories.includes(category) && marketCap && forwardPE !== null && forwardPE !== 'N/A' && forwardPE > 0) {
            if (chartData[category]) {
                if (!chartData[category][industry]) {
                    chartData[category][industry] = [];
                }
                chartData[category][industry].push({
                    name: stock.Name || stock.name,
                    value: [marketCap, forwardPE], // Market Cap in Millions
                    symbol: stock.Symbol || stock.symbol
                });
            }
        } else {
            negativePeStocks.push(stock);
        }
    });

    renderChart(); // Render the initial category view
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
            // Combine all stocks from all industries within this category
            const categoryStocks = Object.values(chartData[category]).flat();
            return {
                name: category,
                type: 'scatter',
                data: categoryStocks,
                symbolSize: 8,
                label: {
                    show: false, // Initially hidden
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
        title: {
            text: chartTitle,
            left: 'center',
            top: 20
        },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                const marketCapInMillions = params.data.value[0];
                let marketCapFormatted;
                if (marketCapInMillions >= 1000) {
                    marketCapFormatted = `$${(marketCapInMillions / 1000).toFixed(2)}B`;
                } else {
                    marketCapFormatted = `$${marketCapInMillions.toFixed(2)}M`;
                }
                return `${params.data.name} (${params.data.symbol})<br/>` +
                       `Market Cap: ${marketCapFormatted}<br/>` +
                       `Forward P/E: ${params.data.value[1].toFixed(2)}`;
            }
        },
        grid: {
            bottom: '20%'
        },
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
                    if (value >= 1000) { // Now in millions, so 1000M = 1B
                        return (value / 1000) + 'B';
                    }
                    return value + 'M';
                }
            }
        },
        yAxis: {
            type: 'log',
            name: 'Forward P/E',
            nameLocation: 'middle',
            nameGap: 40
        },
        series: series
    };

    myChart.setOption(option, true); // `true` clears the previous chart state
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

    // This handles clicks on data points to open the TradingView chart
    myChart.on('click', function (params) {
        // If a data point (a stock) is clicked, always show the chart popup
        if (params.componentType === 'series' && params.data && params.data.symbol) {
            showChartPopup(params.data.symbol);
        }
        // If a blank area is clicked and a series is highlighted, reset the highlighting
        else if (params.seriesName === undefined && highlightedSeries) {
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

    // This handles clicks on the legend for drilling down and highlighting
    myChart.on('legendselectchanged', function (params) {
        const clickedSeriesName = params.name;
        const allSeriesNames = myChart.getOption().legend[0].data;

        // Immediately re-select all legend items to prevent them from being toggled off
        allSeriesNames.forEach(name => {
            myChart.dispatchAction({ type: 'legendSelect', name: name });
        });

        // If in category view, a legend click drills down
        if (currentView === 'categories') {
            selectedCategory = clickedSeriesName;
            currentView = 'industries';
            highlightedSeries = null; // Reset highlight on drilldown
            renderChart();
            document.getElementById('back-button').style.display = 'inline-block';
        } 
        // If in industry view, a legend click highlights the industry
        else {
            // Use a zero-delay timeout to ensure this runs after the event queue is cleared
            setTimeout(() => {
                // If the user clicks the already highlighted series, reset everything
                if (highlightedSeries === clickedSeriesName) {
                    highlightedSeries = null;
                    // Create a configuration to reset the opacity and hide labels for all series
                    const resetSeries = myChart.getOption().series.map(s => ({
                        name: s.name,
                        itemStyle: { opacity: 1 },
                    label: { show: true }
                    }));
                    myChart.setOption({ series: resetSeries });
                } else {
                    // Otherwise, highlight the new series and downplay others
                    highlightedSeries = clickedSeriesName;
                    // Create a configuration that sets the opacity and label visibility for each series
                    const updatedSeries = myChart.getOption().series.map(s => ({
                        name: s.name,
                        itemStyle: {
                            opacity: s.name === highlightedSeries ? 1 : 0.2
                        },
                        label: {
                            show: s.name === highlightedSeries
                        }
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

    // Sort stocks by market cap in descending order
    stocks.sort((a, b) => {
        const capA = a['Market Cap'] === 'N/A' ? 0 : parseFloat(a['Market Cap']);
        const capB = b['Market Cap'] === 'N/A' ? 0 : parseFloat(b['Market Cap']);
        return capB - capA;
    });

    const itemsHtml = stocks.map(stock => 
        `<li>${stock.Name} (${stock.Symbol})</li>`
    ).join('');

    listContainer.innerHTML = itemsHtml;
}