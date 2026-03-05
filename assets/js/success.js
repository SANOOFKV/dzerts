// success.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Retrieve Order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');

    // Safety check - if no order ID, redirect home
    if (!orderId) {
        window.location.href = '../home/index.html';
        return;
    }

    try {
        // Fetch official order data from the backend
        const response = await fetch(`https://dzerts.onrender.com/api/orders/${orderId}`);
        if (!response.ok) throw new Error('Order not found');

        const orderData = await response.json();

        // 2. Populate Receipt DOM Elements
        const tokenDisplay = document.getElementById('token-display');
        const orderIdDisplay = document.getElementById('order-id');
        const orderDateDisplay = document.getElementById('order-date');
        const orderCustomerDisplay = document.getElementById('order-customer');
        const orderItemsContainer = document.getElementById('order-items');

        const orderSubtotalDisplay = document.getElementById('order-subtotal');
        const orderShippingDisplay = document.getElementById('order-shipping'); // We leave this 0 or hidden
        const orderTotalDisplay = document.getElementById('order-total');

        // Pad token to 3 digits (e.g., 001, 042, 105)
        const tokenString = String(orderData.tokenNumber || '---').padStart(3, '0');

        // Format date nicely
        const orderDate = new Date(orderData.createdAt);
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };

        // Set text content
        tokenDisplay.textContent = `#${tokenString}`;
        orderIdDisplay.textContent = orderData.rzpOrderId || orderData._id;
        orderDateDisplay.textContent = orderDate.toLocaleDateString('en-US', dateOptions);
        orderCustomerDisplay.textContent = orderData.customerName || 'Customer';

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
        if (orderTotalDisplay) orderTotalDisplay.textContent = `₹${orderData.totalAmount.toFixed(2)}`;

        // Calculate subtotal if shipping was stored (currently 0)
        if (orderSubtotalDisplay) orderSubtotalDisplay.textContent = `₹${orderData.totalAmount.toFixed(2)}`;
        if (orderShippingDisplay) orderShippingDisplay.textContent = `₹0.00`;

        // 3. Handle PDF Download
        const downloadBtn = document.getElementById('download-pdf');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const receiptElement = document.getElementById('receipt-card');

                // Generate filename based on order ID
                const filename = `dzerts_receipt_${orderData._id}.pdf`;

                // Options for html2pdf
                const opt = {
                    margin: 10,
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                // Temporarily add a class to ensure text is visible during capture
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

    } catch (error) {
        console.error("Error fetching order:", error);
        alert("Could not load your order details. Please contact the counter with your phone number.");
    }
});
