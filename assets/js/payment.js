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

    // 3. Handle Payment Submission
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Disable button during processing
            const submitBtn = paymentForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Processing... <span class="material-symbols-outlined animate-spin">sync</span>';
            submitBtn.disabled = true;

            try {
                // Step 1: Create Order on Backend
                const response = await fetch('http://localhost:3000/create-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ amount: pendingOrder.total })
                });

                if (!response.ok) throw new Error('Failed to create order on server.');

                const orderData = await response.json();

                // Step 2: Configure Razorpay Checkout
                const options = {
                    key: orderData.keyId,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: "dzerts.",
                    description: "In-store Pick up Order",
                    order_id: orderData.orderId,
                    handler: async function (response) {
                        try {
                            // Step 3: Verify Signature on Backend
                            const verifyRes = await fetch('http://localhost:3000/verify-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature
                                })
                            });

                            const verifyData = await verifyRes.json();

                            if (verifyData.verified) {
                                // Generate Final Order Data
                                const finalOrderData = {
                                    ...pendingOrder,
                                    orderId: response.razorpay_payment_id, // Use actual payment ID as order ID
                                    paymentTime: new Date().toISOString()
                                };

                                // Save order data for success page
                                localStorage.setItem('dzerts_latest_order', JSON.stringify(finalOrderData));

                                // Clean up
                                localStorage.removeItem('dzerts_cart');
                                localStorage.removeItem('dzerts_pending_order');

                                // Redirect to Success Page
                                window.location.href = '../success/index.html';
                            } else {
                                alert("Payment verification failed. Please try again or contact the counter.");
                                submitBtn.innerHTML = originalBtnText;
                                submitBtn.disabled = false;
                            }
                        } catch (err) {
                            console.error("Verification Error:", err);
                            alert("Something went wrong verifying the payment.");
                            submitBtn.innerHTML = originalBtnText;
                            submitBtn.disabled = false;
                        }
                    },
                    prefill: {
                        name: pendingOrder.customer.name,
                        contact: pendingOrder.customer.phone === 'N/A' || !pendingOrder.customer.phone ? '9999999999' : pendingOrder.customer.phone
                    },
                    theme: {
                        color: "#d41132" // Primary brand color
                    },
                    config: {
                        display: {
                            blocks: {
                                upi: {
                                    name: "Pay via UPI",
                                    instruments: [
                                        {
                                            method: "upi"
                                        }
                                    ]
                                },
                                other: {
                                    name: "Other Payment Methods",
                                    instruments: [
                                        { method: "card" },
                                        { method: "netbanking" },
                                        { method: "wallet" }
                                    ]
                                }
                            },
                            sequence: ["block.upi", "block.other"],
                            preferences: {
                                show_default_blocks: true
                            }
                        }
                    }
                };

                // Open Modal
                const rzp1 = new Razorpay(options);
                rzp1.on('payment.failed', function (response) {
                    alert("Payment Failed. Reason: " + response.error.description);
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                });
                rzp1.open();

            } catch (error) {
                console.error("Checkout Error:", error);
                alert("Could not initialize payment wrapper. Ensure the backend server is running on localhost:3000.");
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});
