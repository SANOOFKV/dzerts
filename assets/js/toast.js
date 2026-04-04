// assets/js/toast.js — Global toast notification utility

(function () {
    // Inject the toast container once
    function getOrCreateContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = [
                'position:fixed',
                'bottom:24px',
                'right:24px',
                'z-index:9999',
                'display:flex',
                'flex-direction:column',
                'gap:10px',
                'align-items:flex-end',
                'pointer-events:none'
            ].join(';');
            document.body.appendChild(container);
        }
        return container;
    }

    const ICONS = {
        success: 'check_circle',
        error:   'error',
        warning: 'warning',
        info:    'info'
    };

    const COLORS = {
        success: { bg: '#166534', border: '#15803d', icon: '#4ade80' },
        error:   { bg: '#7f1d1d', border: '#b91c1c', icon: '#f87171' },
        warning: { bg: '#78350f', border: '#d97706', icon: '#fbbf24' },
        info:    { bg: '#1e3a5f', border: '#2563eb', icon: '#60a5fa' }
    };

    /**
     * Show a toast notification.
     * @param {string} message   - The message to display
     * @param {'success'|'error'|'warning'|'info'} [type='info'] - Toast type
     * @param {number} [duration=4000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
     */
    window.showToast = function (message, type, duration) {
        type = type || 'info';
        duration = (duration === undefined) ? 4000 : duration;

        const container = getOrCreateContainer();
        const color = COLORS[type] || COLORS.info;
        const icon  = ICONS[type]  || 'info';

        const toast = document.createElement('div');
        toast.style.cssText = [
            'display:flex',
            'align-items:center',
            'gap:10px',
            'padding:12px 16px',
            'border-radius:10px',
            'border:1px solid ' + color.border,
            'background:' + color.bg,
            'color:#fff',
            'font-family:inherit',
            'font-size:14px',
            'font-weight:500',
            'line-height:1.4',
            'max-width:340px',
            'box-shadow:0 4px 20px rgba(0,0,0,0.35)',
            'pointer-events:auto',
            'cursor:default',
            'opacity:0',
            'transform:translateY(8px)',
            'transition:opacity 0.25s ease, transform 0.25s ease'
        ].join(';');

        toast.innerHTML =
            '<span style="font-family:\'Material Symbols Outlined\';font-size:20px;color:' + color.icon + ';flex-shrink:0;line-height:1">' + icon + '</span>' +
            '<span style="flex:1">' + message + '</span>' +
            '<span style="font-family:\'Material Symbols Outlined\';font-size:16px;opacity:0.6;cursor:pointer;flex-shrink:0;line-height:1" onclick="this.parentElement.remove()">close</span>';

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            });
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => dismiss(toast), duration);
        }

        return toast;
    };

    function dismiss(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 280);
    }
})();
