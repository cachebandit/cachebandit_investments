import { showChartPopup } from './chart.js';

document.addEventListener('DOMContentLoaded', function() {
    loadChartData();
});

async function loadChartData() {
    try {
        const response = await fetch('/api/all_stock_data');
        if (!response.ok) {
            throw new Error('Failed to load cached stock data.');
        }
        const cachedData = await response.json();
        prepareChartData(cachedData.data);
    } catch (error) {
        console.error('Error loading P/E chart data:', error);
    }
}

function prepareChartData(categoryData) {
    const categorizedSeries = {};
    const negativePeStocks = [];
    // Get clean category names without the "category_" prefix and filter out "Owned"
    const categories = Object.keys(categoryData)
        .map(key => key.replace('category_', ''))
        .filter(cat => cat !== "Owned");
    const processedSymbols = new Set();

    // Initialize an array for each clean category name
    categories.forEach(cat => {
        categorizedSeries[cat] = [];
    });

    // Flatten all stocks into a single list, avoiding duplicates from the "Owned" category
    let allStocks = [];
    Object.values(categoryData).forEach(stocks => {
        stocks.forEach(stock => {
            if (!processedSymbols.has(stock.Symbol)) {
                allStocks.push(stock);
                processedSymbols.add(stock.Symbol);
            }
        });
    });

    allStocks.forEach(stock => {
        const marketCap = stock['Market Cap'];
        const forwardPE = stock['Forward PE'];
        const category = stock.category; // This is the clean name, e.g., "Information Technology"

        // If stock has a valid, positive Forward P/E, add it to the chart data
        if (marketCap !== 'N/A' && forwardPE !== null && forwardPE !== 'N/A' && forwardPE > 0) {
            // Ensure the category exists before pushing data
            if (categorizedSeries[category]) {
                categorizedSeries[category].push({
                    name: stock.Name,
                    value: [marketCap / 1000, forwardPE], // Market Cap in Billions
                    symbol: stock.Symbol
                });
            }
        } else {
            // Otherwise, add it to the list of stocks with negative or N/A P/E
            negativePeStocks.push(stock);
        }
    });

    renderChart(categorizedSeries, categories); // Pass clean category names
    renderNegativePeList(negativePeStocks);
}

function renderChart(categorizedSeries, categories) {
    const chartDom = document.getElementById('peScatterChart');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom);
    let highlightedSeries = null;

    // Create a series for each category
    const series = categories.map(category => ({
        name: category,
        type: 'scatter',
        data: categorizedSeries[category],
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
    }));

    const option = {
        title: {
            text: 'Market Cap vs. Forward P/E Ratio',
            left: 'center',
            top: 20 // Adds 20px of padding from the top of the chart container
        },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                const marketCapInBillions = params.data.value[0];
                let marketCapFormatted;
                if (marketCapInBillions >= 1000) {
                    marketCapFormatted = `$${(marketCapInBillions / 1000).toFixed(2)}T`;
                } else {
                    marketCapFormatted = `$${marketCapInBillions.toFixed(2)}B`;
                }

                return `${params.data.name} (${params.data.symbol})<br/>` +
                       `Market Cap: ${marketCapFormatted}<br/>` +
                       `Forward P/E: ${params.data.value[1].toFixed(2)}`;
            }
        },
        grid: {
            bottom: '15%' // Adjust bottom padding for legend
        },
        legend: {
            data: categories,
            orient: 'horizontal', // Lay out the legend horizontally
            bottom: 10,         // Position it at the bottom of the chart
            type: 'scroll'
        },
        xAxis: {
            type: 'log',
            name: 'Market Cap (Billions)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: function (value) {
                    if (value >= 1000) { // 1000B = 1T
                        return (value / 1000) + 'T';
                    }
                    return value + 'B';
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

    myChart.setOption(option);

    // Add event listener to handle legend clicks for persistent highlighting
    myChart.on('legendselectchanged', function (params) {
        const clickedSeriesName = params.name;
        const allSeriesNames = categories;

        // Immediately re-select all legend items to prevent them from being toggled off
        allSeriesNames.forEach(name => {
            myChart.dispatchAction({ type: 'legendSelect', name: name });
        });

        // Use a zero-delay timeout to ensure this runs after the event queue is cleared
        setTimeout(() => {
            // If the user clicks the already highlighted series, reset everything
            if (highlightedSeries === clickedSeriesName) {
                highlightedSeries = null;
                // Create a configuration to reset the opacity of all series
                const resetSeries = series.map(s => ({
                    name: s.name,
                    itemStyle: { opacity: 1 },
                    label: { show: false }
                }));
                myChart.setOption({ series: resetSeries });
            } else {
                // Otherwise, highlight the new series and downplay others
                highlightedSeries = clickedSeriesName;
                // Create a configuration that sets the opacity for each series
                const updatedSeries = series.map(s => ({
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
    });

    // Add a click listener to the chart
    myChart.on('click', function (params) {
        // If a data point (a stock) is clicked, show the chart popup
        if (params.seriesName && params.data && params.data.symbol) {
            showChartPopup(params.data.symbol);
        } 
        // If a blank area is clicked and a series is highlighted, reset the view
        else if (params.seriesName === undefined && highlightedSeries) {
            highlightedSeries = null;
            const resetSeries = series.map(s => ({
                name: s.name,
                itemStyle: { opacity: 1 },
                label: { show: false }
            }));
            myChart.setOption({ series: resetSeries });
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