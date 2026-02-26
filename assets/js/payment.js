// payment.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Pending Order Data
    const pendingOrderStr = localStorage.getItem('dzerts_pending_order');

    if (!pendingOrderStr) {
        alert("No order details found. Please start from checkout.");
        window.location.href = '../checkout/index.html';
        return;
    }

    const pendingOrder = JSON.parse(pendingOrderStr);
    const cart = pendingOrder.items;

    const checkoutItemsContainer = document.getElementById('checkout-items');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutTotal = document.getElementById('checkout-total');
    const paymentForm = document.getElementById('payment-form');

    // 2. Render Order Summary
    function renderPaymentSummary() {
        checkoutItemsContainer.innerHTML = '';

        cart.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex py-4 items-center justify-between gap-4';
            li.innerHTML = `
                <div class="flex items-center gap-4 flex-1">
                    <img src="${item.image}" alt="${item.name}" class="h-16 w-16 rounded-md object-cover">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-espresso dark:text-white">${item.name}</span>
                        <span class="text-xs text-muted-espresso dark:text-gray-400">Qty: ${item.quantity}</span>
                    </div>
                </div>
                <div class="text-sm font-medium text-espresso dark:text-gray-300">
                    $${(item.price * item.quantity).toFixed(2)}
                </div>
            `;
            checkoutItemsContainer.appendChild(li);
        });

        checkoutSubtotal.textContent = `$${pendingOrder.subtotal.toFixed(2)}`;
        checkoutTotal.textContent = `$${pendingOrder.total.toFixed(2)}`;

        // Update UPI Amount display
        const upiAmount = document.getElementById('upi-amount');
        if (upiAmount) {
            upiAmount.textContent = `$${pendingOrder.total.toFixed(2)}`;
        }
    }

    renderPaymentSummary();

    // 3. Handle Form Submission
    if (paymentForm) {
        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Basic validation
            if (!paymentForm.checkValidity()) {
                paymentForm.reportValidity();
                return;
            }

            // Generate Final Order Data
            const finalOrderData = {
                ...pendingOrder,
                orderId: 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                paymentTime: new Date().toISOString()
            };

            // Save order data for success page
            localStorage.setItem('dzerts_latest_order', JSON.stringify(finalOrderData));

            // Clean up: clear the cart and pending order
            localStorage.removeItem('dzerts_cart');
            localStorage.removeItem('dzerts_pending_order');

            // Redirect to Success Page
            window.location.href = '../success/index.html';
        });
    }
});
