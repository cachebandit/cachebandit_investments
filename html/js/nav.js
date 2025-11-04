document.addEventListener('DOMContentLoaded', function() {
    const openNavBtn = document.getElementById('openNav');
    const closeNavBtn = document.querySelector('.sidenav .closebtn');
    const sidenav = document.getElementById('mySidenav');
    const overlay = document.getElementById('sidenav-overlay');

    function openNav() {
        sidenav.classList.add('open');
        overlay.classList.add('open');
    }

    function closeNav() {
        sidenav.classList.remove('open');
        overlay.classList.remove('open');
    }

    if (openNavBtn) openNavBtn.addEventListener('click', openNav);
    if (closeNavBtn) closeNavBtn.addEventListener('click', closeNav);
    if (overlay) overlay.addEventListener('click', closeNav);
});