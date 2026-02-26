// checkout.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Cart Data
    let cart = JSON.parse(localStorage.getItem('dzerts_cart')) || [];
    const shippingCost = 0; // In-store pickup

    const checkoutItemsContainer = document.getElementById('checkout-items');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutTotal = document.getElementById('checkout-total');
    const checkoutForm = document.getElementById('checkout-form');

    // Redirect to home if cart is empty
    if (cart.length === 0) {
        alert("Your cart is empty. Please add items to checkout.");
        window.location.href = '../home/index.html';
        return;
    }

    // 2. Render Order Summary
    function renderCheckoutSummary() {
        checkoutItemsContainer.innerHTML = '';
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.price * item.quantity;
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

        const total = subtotal + shippingCost;

        checkoutSubtotal.textContent = `$${subtotal.toFixed(2)}`;
        checkoutTotal.textContent = `$${total.toFixed(2)}`;
    }

    renderCheckoutSummary();

    // 3. Handle Form Submission
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Basic validation
            if (!checkoutForm.checkValidity()) {
                checkoutForm.reportValidity();
                return;
            }

            // Gather Order Data
            const formData = new FormData(checkoutForm);
            const customerInfo = Object.fromEntries(formData.entries());

            // Calculate final totals for the order record
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            const pendingOrderData = {
                date: new Date().toISOString(),
                customer: {
                    name: customerInfo['name'],
                    phone: customerInfo['phone'] || 'N/A'
                },
                items: cart,
                subtotal: subtotal,
                shipping: shippingCost,
                total: total
            };

            // Save order data to localStorage to pass to payment page
            localStorage.setItem('dzerts_pending_order', JSON.stringify(pendingOrderData));

            // Redirect to Payment Page
            window.location.href = '../payment/index.html';
        });
    }
});
