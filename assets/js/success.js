// success.js

// Prevent back-swipe from returning to checkout
history.pushState(null, '', window.location.href);
window.addEventListener('popstate', () => {
    window.location.href = '../home/index.html';
});

const API = 'https://dzerts.onrender.com';

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Retrieve Order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId   = urlParams.get('orderId');

    // Safety check - if no order ID, redirect home
    if (!orderId) {
        window.location.href = '../home/index.html';
        return;
    }

    // ── Polling Configuration ──────────────────────────────────────
    // Poll every 2.5s for up to 2 minutes (48 attempts)
    const POLL_INTERVAL_MS = 2500;
    const MAX_ATTEMPTS     = 48;   // 48 × 2.5s = 120s = 2 minutes
    let   attempts         = 0;

    // Show a loading state while we wait for webhook confirmation
    showLoadingState();

    // ── Start polling loop ─────────────────────────────────────────
    const pollInterval = setInterval(async () => {
        attempts++;

        try {
            const response = await fetch(`${API}/api/orders/${orderId}`);
            if (!response.ok) throw new Error('Order not found');

            const orderData = await response.json();

            if (orderData.paymentStatus === 'SUCCESS' && orderData.tokenNumber) {
                // ✅ Webhook has fired — token assigned — show receipt
                clearInterval(pollInterval);
                hideLoadingState();
                renderReceipt(orderData);

            } else if (orderData.paymentStatus === 'FAILED') {
                // ❌ Payment failed
                clearInterval(pollInterval);
                showFailedState();

            } else if (attempts >= MAX_ATTEMPTS) {
                // ⏰ Timed out after 2 minutes — show manual fallback
                clearInterval(pollInterval);
                showTimeoutState(orderData);
            }
            // Otherwise: still CREATED/PENDING — keep polling silently

        } catch (err) {
            console.error('Poll error:', err);
            // Network error — keep trying until max attempts
            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(pollInterval);
                showTimeoutState(null);
            }
        }
    }, POLL_INTERVAL_MS);

    // ── UI State Functions ─────────────────────────────────────────

    function showLoadingState() {
        const tokenDisplay = document.getElementById('token-display');
        const loadingMsg   = document.getElementById('loading-message');
        if (tokenDisplay) tokenDisplay.textContent = '...';
        if (loadingMsg)   loadingMsg.classList.remove('hidden');
    }

    function hideLoadingState() {
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg)  loadingMsg.classList.add('hidden');
    }

    function showFailedState() {
        hideLoadingState();
        const failMsg = document.getElementById('failed-message');
        if (failMsg) failMsg.classList.remove('hidden');
        const tokenDisplay = document.getElementById('token-display');
        if (tokenDisplay) tokenDisplay.textContent = '---';
    }

    function showTimeoutState(orderData) {
        hideLoadingState();
        const timeoutMsg = document.getElementById('timeout-message');
        if (timeoutMsg) {
            timeoutMsg.classList.remove('hidden');
            // If we have the order reference, show it so they can show staff
            if (orderData && orderData.rzpOrderId) {
                const ref = document.getElementById('timeout-ref');
                if (ref) ref.textContent = orderData.rzpOrderId;
            }
        }
        // Still try to render whatever we have
        if (orderData) renderReceipt(orderData);
    }

    // ── Receipt Renderer ───────────────────────────────────────────

    function renderReceipt(orderData) {

        const tokenDisplay        = document.getElementById('token-display');
        const orderIdDisplay      = document.getElementById('order-id');
        const orderDateDisplay    = document.getElementById('order-date');
        const orderItemsContainer = document.getElementById('order-items');
        const orderSubtotalDisplay= document.getElementById('order-subtotal');
        const orderShippingDisplay= document.getElementById('order-shipping');
        const orderTotalDisplay   = document.getElementById('order-total');

        // Token number
        const tokenString = orderData.tokenNumber
            ? String(orderData.tokenNumber).padStart(3, '0')
            : '---';

        // Format date
        const orderDate   = new Date(orderData.createdAt);
        const dateOptions = { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' };

        if (tokenDisplay)     tokenDisplay.textContent = `#${tokenString}`;
        if (orderIdDisplay)   orderIdDisplay.textContent = orderData.rzpOrderId || orderData._id;
        if (orderDateDisplay) orderDateDisplay.textContent = orderDate.toLocaleDateString('en-US', dateOptions);

        // Render line items
        if (orderItemsContainer && orderData.items) {
            orderItemsContainer.innerHTML = '';
            orderData.items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-start text-sm';
                const itemTotal = (item.price * item.quantity).toFixed(2);
                li.innerHTML = `
                    <div class="flex-1 pr-4">
                        <span class="font-medium text-espresso dark:text-gray-300">${item.quantity}x ${item.name}</span>
                    </div>
                    <div class="text-muted-espresso dark:text-gray-400">
                        ₹${itemTotal}
                    </div>
                `;
                orderItemsContainer.appendChild(li);
            });
        }

        // Totals
        const total = orderData.totalAmount || 0;
        if (orderTotalDisplay)    orderTotalDisplay.textContent    = `₹${total.toFixed(2)}`;
        if (orderSubtotalDisplay) orderSubtotalDisplay.textContent = `₹${total.toFixed(2)}`;
        if (orderShippingDisplay) orderShippingDisplay.textContent = `₹0.00`;

        // Wire download button
        const downloadBtn = document.getElementById('download-pdf');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => generatePDF(orderData, false));
        }
    }

    // ── PDF Generator ──────────────────────────────────────────────

    function generatePDF(orderData, isAuto = false) {
        const receiptElement = document.getElementById('receipt-card');
        const filename = `dzerts_receipt_${orderData._id}.pdf`;

        const opt = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        receiptElement.classList.add('pdf-render-mode');

        const downloadBtn = document.getElementById('download-pdf');

        if (!isAuto && downloadBtn) {
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> Generating...';
            downloadBtn.disabled = true;
            html2pdf().set(opt).from(receiptElement).save().then(() => {
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled  = false;
                receiptElement.classList.remove('pdf-render-mode');
            });
        } else {
            html2pdf().set(opt).from(receiptElement).save().then(() => {
                receiptElement.classList.remove('pdf-render-mode');
            });
        }
    }
});
