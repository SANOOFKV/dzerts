// assets/js/cart.js

// Initialize cart from localStorage or empty array
let cart = JSON.parse(localStorage.getItem('dzerts_cart')) || [];

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('dzerts_cart', JSON.stringify(cart));
    updateCartIcon();
    renderCart();
}

// Sync cart from localStorage across pages/tabs
function syncCart() {
    cart = JSON.parse(localStorage.getItem('dzerts_cart')) || [];
    updateCartIcon();
    renderCart();
}

// Listen for storage events (when other tabs/windows update the cart)
window.addEventListener('storage', (e) => {
    if (e.key === 'dzerts_cart') {
        syncCart();
    }
});

// Add item to cart
function addToCart(item) {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    saveCart();
    updateCartIcon();
}

// Remove item from cart completely
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
}

// Update item quantity
function updateQuantity(itemId, newQuantity) {
    const item = cart.find(cartItem => cartItem.id === itemId);
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(itemId);
        } else {
            item.quantity = newQuantity;
            saveCart();
        }
    }
}

// Calculate total price
function getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Calculate total items
function getCartItemCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
}

// Update the cart icon badge
function updateCartIcon() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = getCartItemCount();
    badges.forEach(badge => {
        badge.textContent = count;
        if (count > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

// Render the cart sidebar contents
function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');

    if (!cartItemsContainer || !cartTotalElement) return;

    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-charcoal/50 dark:text-gray-400 py-10 bg-white dark:bg-[#1a0d0f] rounded-lg border border-border-cream dark:border-white/10 shadow-sm">
                <span class="material-symbols-outlined text-4xl mb-4 opacity-50">shopping_bag</span>
                <p>Your cart is empty</p>
                <button onclick="closeCartSidebar()" class="mt-6 text-primary hover:underline">Continue Shopping</button>
            </div>
        `;
        cartTotalElement.textContent = '₹0.00';
        return;
    }

    cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'flex gap-4 items-center bg-white dark:bg-[#1a0d0f] p-3 rounded-lg border border-border-cream dark:border-white/10 shadow-sm';
        itemElement.innerHTML = `
            <div class="w-16 h-16 rounded-md bg-gray-100 dark:bg-black overflow-hidden flex-shrink-0">
                <div class="w-full h-full bg-cover bg-center" style="background-image: url('${item.image}')"></div>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-espresso dark:text-white truncate">${item.name}</h4>
                <div class="text-primary font-bold text-sm mt-1">₹${item.price.toFixed(2)}</div>
            </div>
            <div class="flex items-center gap-2 border border-border-cream dark:border-white/10 rounded-lg p-1 bg-cream-bg dark:bg-black">
                <button onclick="updateQuantity('${item.id}', ${item.quantity - 1})" class="w-6 h-6 flex items-center justify-center text-charcoal dark:text-gray-300 hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span class="text-xs font-bold w-4 text-center dark:text-white">${item.quantity}</span>
                <button onclick="updateQuantity('${item.id}', ${item.quantity + 1})" class="w-6 h-6 flex items-center justify-center text-charcoal dark:text-gray-300 hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-[16px]">add</span>
                </button>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);
    });

    cartTotalElement.textContent = '₹' + getCartTotal().toFixed(2);
}

// Sidebar toggle logic
function openCartSidebar() {
    syncCart(); // Always sync state when opening
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

function closeCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar && overlay) {
        sidebar.classList.add('translate-x-full');
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300); // match transition duration
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Format the checkout data and navigate
function proceedToCheckout() {
    if (cart.length === 0) return;
    window.location.href = '../checkout/index.html';
}

// Generate the Cart UI HTML
function injectCartUI() {
    // Check if it already exists
    if (document.getElementById('cart-sidebar')) return;

    const cartHTML = `
        <!-- Cart Overlay -->
        <div id="cart-overlay" onclick="closeCartSidebar()" class="fixed inset-0 bg-black/50 z-[60] hidden opacity-0 transition-opacity duration-300 backdrop-blur-sm"></div>
        
        <!-- Cart Sidebar -->
        <div id="cart-sidebar" class="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-cream-bg dark:bg-bg-main z-[70] transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col shadow-2xl border-l border-border-cream dark:border-white/10">
            <!-- Header -->
            <div class="p-6 border-b border-border-cream dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#1a0d0f]">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-primary text-2xl">shopping_bag</span>
                    <h2 class="text-xl font-bold text-espresso dark:text-white">Your Cart</h2>
                </div>
                <button onclick="closeCartSidebar()" class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-charcoal dark:text-gray-400 transition-colors">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- Items Container -->
            <div id="cart-items-container" class="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <!-- Items rendered here by JS -->
            </div>

            <!-- Footer -->
            <div class="p-6 border-t border-border-cream dark:border-white/10 bg-white dark:bg-[#1a0d0f] flex flex-col gap-4">
                <div class="flex items-center justify-between text-espresso dark:text-white">
                    <span class="font-medium text-charcoal/70 dark:text-gray-400">Subtotal</span>
                    <span id="cart-total" class="text-2xl font-black">₹0.00</span>
                </div>
                <button onclick="proceedToCheckout()" class="w-full h-14 rounded-lg bg-primary text-white font-bold text-lg shadow-[0_4px_15px_rgba(212,17,50,0.2)] hover:shadow-[0_6px_20px_rgba(212,17,50,0.3)] transition-all hover:bg-primary/95 flex items-center justify-center gap-2">
                    Checkout <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
            </div>
        </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', cartHTML);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    injectCartUI();
    updateCartIcon();
    renderCart();

    // Silent ping to wake up Render Free Tier backend
    fetch('https://dzerts.onrender.com/ping')
        .then(() => console.log('Backend pre-warmed'))
        .catch(() => console.log('Backend pre-warm failed or waking up'));
});
