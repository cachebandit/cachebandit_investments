// Chart functionality

function showChartPopup(symbol) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'chart-overlay';
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
    popup.className = 'chart-popup';
    popup.style.backgroundColor = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '5px';
    popup.style.width = '80%';
    popup.style.height = '80%';
    popup.style.maxWidth = '1200px';
    popup.style.maxHeight = '800px';
    popup.style.position = 'relative';
    
    // Create loading indicator
    const loading = document.createElement('div');
    loading.textContent = 'Loading chart...';
    loading.style.textAlign = 'center';
    loading.style.padding = '20px';
    
    popup.appendChild(loading);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Create canvas for chart
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'none'; // Hide until loaded
    
    popup.appendChild(canvas);
    
    // Load chart data
    fetch(`http://localhost:8000/get_chart_data?symbol=${symbol}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(chartData => {
            if (!chartData || !chartData.labels) {
                throw new Error('Invalid data received from server');
            }
            
            // Hide loading indicator and show canvas
            loading.style.display = 'none';
            canvas.style.display = 'block';
            
            // Function to format numbers to two decimal places
            const formatNumber = num => num.toFixed(2);
            
            const formatDataForCandlestick = (data) => {
                return data.labels.map((date, index) => ({
                    x: new Date(date).getTime(), // Keep this as a timestamp
                    o: formatNumber(data.open[index]),
                    h: formatNumber(data.high[index]),
                    l: formatNumber(data.low[index]),
                    c: formatNumber(data.close[index])
                }));
            };
            
            const candlestickData = formatDataForCandlestick(chartData);
            
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: chartData.companyName,
                        data: candlestickData,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                tooltipFormat: 'MM/dd/yyyy',
                                displayFormats: {
                                    day: 'MM/dd/yyyy'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Price'
                            },
                            ticks: {
                                callback: (value) => {
                                    return value.toFixed(2);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    return new Date(tooltipItems[0].label).toLocaleDateString('en-US', { 
                                        month: 'short', // Short month name (e.g., "Oct")
                                        day: 'numeric', // Day of the month
                                        year: 'numeric'  // Full year
                                    })
                                },
                                label: function(tooltipItem) {
                                    return `O: ${tooltipItem.raw.o}, H: ${tooltipItem.raw.h}, L: ${tooltipItem.raw.l}, C: ${tooltipItem.raw.c}`;
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error fetching chart data:', error);
            loading.textContent = 'Failed to load chart data.';
        });
    
    // Close popup when clicking outside
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
} 