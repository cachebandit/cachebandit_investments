// Warning icon tooltip handler
function initWarningTooltip() {
    document.addEventListener('mouseover', function(e) {
        if (e.target.hasAttribute('data-tooltip')) {
            // Remove any existing tooltips
            const existing = document.getElementById('custom-tooltip');
            if (existing) existing.remove();
            
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.id = 'custom-tooltip';
            tooltip.textContent = e.target.getAttribute('data-tooltip');
            tooltip.style.cssText = `
                position: fixed;
                background-color: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                white-space: nowrap;
                pointer-events: none;
            `;
            document.body.appendChild(tooltip);
            
            // Position tooltip, checking if it would go off-screen
            const rect = e.target.getBoundingClientRect();
            let left = rect.left - tooltip.offsetWidth / 2;
            let top = rect.top - 30;
            
            // If tooltip would go off left side, position to the right of icon instead
            if (left < 10) {
                left = rect.right + 8;
                top = rect.top - tooltip.offsetHeight / 2;
            }
            // If tooltip would go off right side, position to the left
            else if (left + tooltip.offsetWidth > window.innerWidth - 10) {
                left = rect.left - tooltip.offsetWidth - 8;
                top = rect.top - tooltip.offsetHeight / 2;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        if (e.target.hasAttribute('data-tooltip')) {
            const tooltip = document.getElementById('custom-tooltip');
            if (tooltip) tooltip.remove();
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWarningTooltip);
} else {
    initWarningTooltip();
}
