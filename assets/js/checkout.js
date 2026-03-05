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
                    ₹${(item.price * item.quantity).toFixed(2)}
                </div>
            `;
            checkoutItemsContainer.appendChild(li);
        });

        const total = subtotal + shippingCost;

        checkoutSubtotal.textContent = `₹${subtotal.toFixed(2)}`;
        checkoutTotal.textContent = `₹${total.toFixed(2)}`;
    }

    renderCheckoutSummary();

    // 3. Handle Proceed to Payment Click
    const payNowBtn = document.getElementById('pay-now-btn');
    const customerNameInput = document.getElementById('customerName');
    const customerPhoneInput = document.getElementById('customerPhone');

    if (payNowBtn) {
        payNowBtn.addEventListener('click', () => {
            const customerName = customerNameInput.value.trim();
            const customerPhone = customerPhoneInput.value.trim();

            if (!customerName || !customerPhone) {
                alert("Please fill in your Name and Phone Number to continue.");
                return;
            }

            // Calculate final totals for the order record
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            const pendingOrderData = {
                date: new Date().toISOString(),
                customer: {
                    name: customerName,
                    phone: customerPhone,
                    email: ''
                },
                items: cart,
                subtotal: subtotal,
                shipping: shippingCost,
                total: total
            };


            // Disable button during processing
            const originalBtnText = payNowBtn.innerHTML;
            payNowBtn.innerHTML = 'Processing... <span class="material-symbols-outlined animate-spin">sync</span>';
            payNowBtn.disabled = true;

            // Inform user if Render Free Tier is waking up
            const wakeUpTimeout = setTimeout(() => {
                if (payNowBtn.disabled) {
                    payNowBtn.innerHTML = 'Waking up secure server (can take 30s)... <span class="material-symbols-outlined animate-spin">sync</span>';
                }
            }, 4000);

            // Trigger Razorpay Payment
            initiatePayment(pendingOrderData, originalBtnText, payNowBtn, wakeUpTimeout);
        });
    }

    async function initiatePayment(pendingOrder, originalBtnText, submitBtn, wakeUpTimeout) {
        try {
            // Step 1: Create Order on Backend
            const response = await fetch('https://dzerts.onrender.com/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: pendingOrder.total,
                    items: pendingOrder.items,
                    customerName: pendingOrder.customer.name,
                    customerPhone: pendingOrder.customer.phone,
                    customerEmail: ''
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create order on server.');
            }

            const orderData = await response.json();
            clearTimeout(wakeUpTimeout); // Server responded, no need to show the delay text

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
                        submitBtn.innerHTML = 'Verifying... <span class="material-symbols-outlined animate-spin">sync</span>';

                        // Step 3: Poll backend for Webhook fulfillment
                        let attempts = 0;
                        const maxAttempts = 15; // Poll for approx 30 seconds

                        const verifyInterval = setInterval(async () => {
                            attempts++;
                            try {
                                const pollRes = await fetch(`https://dzerts.onrender.com/api/orders/${orderData.dbOrderId}`);
                                const orderStatusData = await pollRes.json();

                                if (orderStatusData.paymentStatus === 'SUCCESS') {
                                    clearInterval(verifyInterval);

                                    // Clean up cart
                                    localStorage.removeItem('dzerts_cart');


                                    // Redirect to Success Page with DB Order ID
                                    window.location.href = `../success/index.html?orderId=${orderData.dbOrderId}`;
                                } else if (orderStatusData.paymentStatus === 'FAILED' || attempts >= maxAttempts) {
                                    clearInterval(verifyInterval);
                                    alert("Payment verification failed or timed out. Please try again or contact the counter.");
                                    submitBtn.innerHTML = originalBtnText;
                                    submitBtn.disabled = false;
                                }
                            } catch (e) {
                                console.error("Poll Error:", e);
                            }
                        }, 2000); // 2 second intervals
                    } catch (err) {
                        console.error("Verification Error:", err);
                        alert("Something went wrong verifying the payment.");
                        submitBtn.innerHTML = originalBtnText;
                        submitBtn.disabled = false;
                    }
                },
                prefill: {
                    name: pendingOrder.customer.name,
                    contact: pendingOrder.customer.phone === 'N/A' || !pendingOrder.customer.phone ? '9999999999' : pendingOrder.customer.phone,
                    email: pendingOrder.customer.email || ''
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
                },
                modal: {
                    ondismiss: function () {
                        // Reset button state when user closes the modal
                        submitBtn.innerHTML = originalBtnText;
                        submitBtn.disabled = false;
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
            clearTimeout(wakeUpTimeout);
            alert("Could not connect to payment server. Please try again.");
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }
});
