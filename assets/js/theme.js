// assets/js/theme.js — Shared theme toggle logic for all dzerts pages

(function () {
    const htmlElement = document.documentElement;

    // Smooth transition class (added briefly during toggle)
    function enableThemeTransition() {
        htmlElement.classList.add('theme-transition');
        setTimeout(() => htmlElement.classList.remove('theme-transition'), 500);
    }

    function updateTheme(isDark) {
        if (isDark) {
            htmlElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else {
            htmlElement.classList.remove('dark');
            localStorage.theme = 'light';
        }
    }

    // Initialize: default to dark if not previously set
    function initTheme() {
        if (localStorage.theme === 'light') {
            htmlElement.classList.remove('dark');
        } else {
            htmlElement.classList.add('dark');
            if (!('theme' in localStorage)) localStorage.theme = 'dark';
        }
    }

    function toggleHandler() {
        enableThemeTransition();
        updateTheme(!htmlElement.classList.contains('dark'));
    }

    // Wire up any theme-toggle button(s) on the current page
    function initToggles() {
        document.querySelectorAll('[id^="theme-toggle"]').forEach(btn => {
            btn.addEventListener('click', toggleHandler);
        });
    }

    // Sync theme when another tab changes it
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            enableThemeTransition();
            updateTheme(e.newValue === 'dark');
        }
    });

    // Run immediately so there's no flash of wrong theme
    initTheme();

    // Wire toggles after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggles);
    } else {
        initToggles();
    }
})();
