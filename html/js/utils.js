// Utility functions for formatting and styling

function formatMarketCap(marketCap) {
    // Convert marketCap to a number to ensure it's numeric
    marketCap = Number(marketCap);
    
    // Check if marketCap is a valid number
    if (isNaN(marketCap)) {
        return 'N/A'; // Return 'N/A' if marketCap is not a number
    }

    // Market cap is assumed to be in millions
    if (marketCap >= 1_000_000) {
        // If the market cap is 1 trillion or more (1,000,000M), convert to trillions
        return (marketCap / 1_000_000).toFixed(2) + 'T';
    } else if (marketCap >= 1_000) {
        // If the market cap is 1 billion or more (1,000M), convert to billions
        return (marketCap / 1_000).toFixed(2) + 'B';
    } else if (marketCap > 0) {
        // Otherwise, display in millions
        return marketCap.toFixed(2) + 'M';
    } else {
        return 'N/A'; // Return 'N/A' for market cap of 0
    }
}

function formatValue(value) {
    return value !== null ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
}

function formatChange(value) {
    return value !== null ? value.toFixed(2) : 'N/A';
}

function formatPercentChange(value) {
    return value !== null ? `${value.toFixed(2)}%` : 'N/A';
}

function formatRsi(rsi) {
    return rsi !== null ? parseFloat(rsi).toFixed(2) : 'N/A';
}

function getColorForChange(percentChange) {
    if (percentChange <= -4) {
        return '#B30000';  // Dark Red
    } else if (percentChange <= -2) {
        return '#FF6347';  // Lighter Red
    } else if (percentChange < 0) {
        return '#FFA07A';  // Lightest Red
    } else if (percentChange === 0) {
        return '#808080';  // Grey
    } else if (percentChange <= 2) {
        return '#98FB98';  // Light Green
    } else if (percentChange <= 4) {
        return '#32CD32';  // Green
    } else {
        return '#008000';  // Dark Green
    }
}

function getTrailingPeColor(pe) {
    if (pe === null) {
        return '#FF6347';  // Lighter Red
    } else {
        return ''; 
    }
}

function getForwardPeColor(pe, trailingPe) {
    if (pe === null || pe < 0 || trailingPe === null) {
        return '#FF6347';  // Lighter Red
    } 
    else if (pe < trailingPe) {
        return '#32CD32';  // Lighter Green
    }
    else if (pe > trailingPe) {
        return '#ffd600';  // Yellow
    }
    else {
        return ''; 
    }
}

function getRsiBackgroundStyle(rsi) {
    const rsiValue = parseFloat(rsi);
    if (rsiValue < 30) {
        return '#FF6347';  // Light Red (RSI below 30)
    } else if (rsiValue < 35) {
        return '#FFA500';  // Orange (RSI below 35)
    } else if (rsiValue > 70) {
        return '#98FB98';  // Light Green (RSI above 70)
    } else if (rsiValue > 65) {
        return '#ffd600';  // Yellow (RSI above 65)
    } else {
        return '';  // No background color for RSI between 35 and 65
    }
} 

export { 
    formatMarketCap, 
    formatValue, 
    formatChange, 
    formatPercentChange, 
    formatRsi, 
    getColorForChange, 
    getTrailingPeColor, 
    getForwardPeColor, 
    getRsiBackgroundStyle
};