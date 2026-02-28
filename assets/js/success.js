// success.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Retrieve Order Data
    const orderDataString = localStorage.getItem('dzerts_latest_order');

    // Safety check - if no order data, redirect home
    if (!orderDataString) {
        window.location.href = '../home/index.html';
        return;
    }

    const orderData = JSON.parse(orderDataString);

    // 2. Populate Receipt DOM Elements
    const tokenDisplay = document.getElementById('token-display');
    const orderIdDisplay = document.getElementById('order-id');
    const orderDateDisplay = document.getElementById('order-date');
    const orderCustomerDisplay = document.getElementById('order-customer');
    const orderItemsContainer = document.getElementById('order-items');

    const orderSubtotalDisplay = document.getElementById('order-subtotal');
    const orderShippingDisplay = document.getElementById('order-shipping');
    const orderTotalDisplay = document.getElementById('order-total');

    // Generate a simple 4-character alphanumeric token
    const token = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Format date nicely
    const orderDate = new Date(orderData.date);
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };

    // Set text content
    tokenDisplay.textContent = `#${token}`;
    orderIdDisplay.textContent = orderData.orderId;
    orderDateDisplay.textContent = orderDate.toLocaleDateString('en-US', dateOptions);
    orderCustomerDisplay.textContent = orderData.customer.name;

    // Render items line by line
    if (orderItemsContainer && orderData.items) {
        orderItemsContainer.innerHTML = ''; // clear existing

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

    // Render totals
    if (orderSubtotalDisplay) orderSubtotalDisplay.textContent = `₹${orderData.subtotal.toFixed(2)}`;
    if (orderShippingDisplay) orderShippingDisplay.textContent = `₹${orderData.shipping.toFixed(2)}`;
    if (orderTotalDisplay) orderTotalDisplay.textContent = `₹${orderData.total.toFixed(2)}`;

    // 3. Handle PDF Download
    const downloadBtn = document.getElementById('download-pdf');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const receiptElement = document.getElementById('receipt-card');

            // Generate filename based on order ID
            const filename = `dzerts_receipt_${orderData.orderId}.pdf`;

            // Options for html2pdf
            const opt = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Temporarily add a class to ensure text is visible during capture
            // (especially helpful if in dark mode, forcing a standard print look)
            receiptElement.classList.add('pdf-render-mode');

            // Change button state to indicate processing
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> Generating...';
            downloadBtn.disabled = true;

            // Generate PDF
            html2pdf().set(opt).from(receiptElement).save().then(() => {
                // Restore button state
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
                receiptElement.classList.remove('pdf-render-mode');
            });
        });
    }
});
