// assets/js/products.js
// Fetches the product catalog from the backend API.
// Edit backend/data/products.json to update the menu without a frontend deploy.

const PRODUCTS_API = 'https://dzerts.onrender.com/api/products';

// Fallback catalog — shown if the backend is unreachable
const PRODUCTS_FALLBACK = [
    {
        id: 'prd_01',
        name: 'Dark Chocolate Truffle',
        description: 'Velvety dark chocolate ganache with a hint of sea salt, served on a gluten-free cocoa base.',
        price: 9.50,
        tags: ['gluten-free', 'best-sellers'],
        badge: 'GF',
        rating: 4.9,
        meta: '380 kcal',
        category: 'cakes',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUBsvfj05Y72qZFdz8soTwor5L5uHIz62wgaHUOpxG7sYdQx_FtYcj8UFZo7w1CgJJLRbvslNnUHHposvK6Q03K0VoFBIoTJB__PGV8GORZB-aSpTu5s6DE6xnZAVQOObhuSb6_x5hdso1QDLOZE3nsUXnWkMfdpREMH1u3tTXu0-v61WmOeDQNHJueN3RCW9alwpMA2slv6i6UaOSkv1sFq6jtPTydwb9Rlx8mjfC8WB_sNG-eLR0LoD9F0_gVcgwYI0JdwuUdg'
    },
    {
        id: 'prd_02',
        name: 'Raspberry Rose Macarons',
        description: 'Delicate almond shells filled with rose-infused raspberry cream. A box of six jewels.',
        price: 12.00,
        tags: ['gluten-free'],
        badge: 'GF',
        rating: 4.8,
        meta: '6 pc',
        category: 'macarons',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyUMY_5VuXkFZbvDsxlF9C_lscc2IyVeqz7oFGnoJKOY1GJ6DSfhbKq3IjaIPcLPOLuo7v7Q_khZcaM2UnOoLjlW2sZ8IsqUyUsrvj4sVcZvsvlJAmG5kd8IQietXoNjHpbhF_It6xX-KJYcJXQSul3Duz-V8p7wmg7H7T2-ZxXD1YQnu0_4Evsr7km9_AIOoU2igm5wVMn1WJqg5BwikWstpW_HJ1gV_-H-DoYV17tnDdPGhIhz6OxHDJ_A4CL2PHVinj8GYoyA'
    },
    {
        id: 'prd_03',
        name: 'Sicilian Pistachio Cannoli',
        description: 'Crisp pastry shells filled with sweet ricotta and crushed emerald pistachios from Bronte.',
        price: 7.00,
        tags: ['best-sellers'],
        badge: null,
        rating: 4.7,
        meta: '2 pc',
        category: 'pastries',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCevbLR9_L7_FgcbSBpq0PHJx9-GMyj2aNF6I0-9cL1zq93kyfUjMhyQsI-xLJC2bS1sptUKbHrcMRauD9j2lLdFHgV4E9KFPZyDqFmpzRE6ft1V_uApVgzhhR4ldn6yig1v_VjgrJ9wTAhXnaWCtXZzYSO3g4_SJolPptbAl0g-Tj6YJaBwtySfryT0O4GYNzneygNKNbkDBClcgpt5CKNLfl5_aI1tkaYiibIuPchUmEX7LWPmQ4P6RiBdtpooSDRFiJVuzVShw'
    },
    {
        id: 'prd_04',
        name: 'Lemon Basil Tart',
        description: 'Zesty lemon curd nestled in a buttery shortbread crust, finished with fresh basil and meringue.',
        price: 8.50,
        tags: ['nut-free', 'vegan'],
        badge: 'Nut-Free',
        rating: 5.0,
        meta: null,
        category: 'pastries',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6kUI9eLXiSzkHY5Ofu_gZLbmSsosa-mhUgnwdJQFtZbsVIHB6Os1EDs_TeBJhRZ76W1FjZ_hK3rHJU3WceIUnmJbUmt7X6-0m_3EP96DJ3slPTDQRjft_89dKHpVqAFgjYBnFWRvmMq_Bmzc_2swlcsm3ucKc2vse2ZyVh9dCS1X-tpjw6i5Zi5AISpyKKebdQxmLhNM93FFUKtYmafhNoqvqHIFybKQjhmzC17nXBv1hZGVofzR3nU8Vze7kLYkDXQa23v8fBw'
    },
    {
        id: 'prd_05',
        name: 'Cold Brew Tiramisu',
        description: 'Layers of espresso-soaked ladyfingers and mascarpone cream dusted with dutch cocoa.',
        price: 10.00,
        tags: ['best-sellers'],
        badge: null,
        rating: 4.8,
        meta: 'Coffee',
        category: 'cakes',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqsPhvYITqrh85uhQLH8fYhaGjxVLRixjjasITxBLEAjVGdsbNULJkyRG4Ay1l4AfB_XJUvYRSqptPPsxGxgB-4dzxdtQlQfMJNMG7l3mkOs3U4YazdmkPHH6UOR8CJbLy7IIufJTHAu51pC6AtwbUQwfSoMQMGzR5UHNUWI4cpftITrtMG0yMlT4kvjvIDgnyn05IygVcP2KpnKIk1kdi7we4nNKDZWDgv7qK9_1BDDp8r7NZ0UgtCKsZByoM2ZolfJFuszItPw'
    },
    {
        id: 'prd_06',
        name: 'Lavender Honey Cheesecake',
        description: 'Creamy cheesecake infused with floral lavender buds and drizzled with wild mountain honey.',
        price: 11.00,
        tags: ['nut-free'],
        badge: 'New',
        rating: 4.6,
        meta: null,
        category: 'cakes',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIr1rIR7vq-3WPBE3fBpOeqhxw9pNiGOYntSvV7iD5uZieIjC-sYbAd5l67b5SPweBCOZecSm79PcwWizjcKn-vShUdu4dLCfomWIvID9G-YMWRaYaSGRn4vzvwOJ9RC1aE5EcBGEaZpB_YGccMuYrRFH0Q3NhJoiS3ZIr760ZEHl8i8wWer8VGH3DJtv81U7cQ1hck-RS9mgQzE3sM1nRb3EM8YPSZcVgM_8ql0JOOEMveSGjX4IIzKi4_gM8po0Wno1KqVn3Og'
    }
];

/**
 * Fetches the product catalog from the backend API.
 * Falls back to PRODUCTS_FALLBACK if the request fails.
 * @returns {Promise<Array>}
 */
async function fetchProducts() {
    try {
        const res = await fetch(PRODUCTS_API);
        if (!res.ok) throw new Error('Non-OK response: ' + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
        throw new Error('Empty product list from API');
    } catch (err) {
        console.warn('[products.js] Could not fetch products from API, using fallback.', err.message);
        return PRODUCTS_FALLBACK;
    }
}
