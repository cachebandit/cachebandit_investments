/**
 * Favorites management using localStorage
 * Stores favorite stocks per device
 */

const FAVORITES_STORAGE_KEY = 'watchlist_favorites';

export function getFavorites() {
    try {
        const favorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
        return favorites ? JSON.parse(favorites) : [];
    } catch (error) {
        console.error('Error reading favorites:', error);
        return [];
    }
}

export function isFavorite(symbol) {
    const favorites = getFavorites();
    return favorites.includes(symbol.toUpperCase());
}

export function addFavorite(symbol) {
    try {
        const favorites = getFavorites();
        const symbolUpper = symbol.toUpperCase();
        if (!favorites.includes(symbolUpper)) {
            favorites.push(symbolUpper);
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error adding favorite:', error);
        return false;
    }
}

export function removeFavorite(symbol) {
    try {
        const favorites = getFavorites();
        const symbolUpper = symbol.toUpperCase();
        const index = favorites.indexOf(symbolUpper);
        if (index > -1) {
            favorites.splice(index, 1);
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error removing favorite:', error);
        return false;
    }
}

export function toggleFavorite(symbol) {
    if (isFavorite(symbol)) {
        return !removeFavorite(symbol);
    } else {
        return addFavorite(symbol);
    }
}
