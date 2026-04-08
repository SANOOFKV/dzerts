require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

// Seed data fallback
const PRODUCTS_SEED = require('./data/products.json');

// Models
const Order = require('./models/Order');
const Counter = require('./models/Counter');
const Product = require('./models/Product');

// Multer — in-memory upload (never touches disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only'));
    }
});

// Compress uploaded image → WebP base64
async function processImage(buffer) {
    const webp = await sharp(buffer)
        .resize(800, 500, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toBuffer();
    return 'data:image/webp;base64,' + webp.toString('base64');
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: true,          // reflect the request origin (works for same-site and cross-site)
    credentials: true      // allow cookies to be sent cross-origin
}));

// Initialize Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Connect to MongoDB
let dbReady = false;
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(async () => {
            dbReady = true;
            console.log('Connected to MongoDB');
            await seedProducts();
            await syncTokenCounter();
        })
        .catch(err => console.error('MongoDB connection error:', err));

    mongoose.connection.on('disconnected', () => { dbReady = false; });
    mongoose.connection.on('reconnected', () => { dbReady = true; });
} else {
    console.error('WARNING: MONGODB_URI is not set. Database features will be unavailable.');
}

// Seed products from JSON on first run
async function seedProducts() {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            const docs = PRODUCTS_SEED.map(p => ({
                productId: p.id, name: p.name, description: p.description,
                price: p.price, category: p.category, tags: p.tags || [],
                badge: p.badge, rating: p.rating, meta: p.meta,
                image: p.image, inStock: true
            }));
            await Product.insertMany(docs);
            console.log(`Seeded ${docs.length} products into MongoDB`);
        }
    } catch (err) { console.error('Seed error:', err.message); }
}

// Sync token counter to the highest tokenNumber already in the DB.
// Runs once on startup — prevents counter from resetting to 1 after
// a DB migration, collection drop, or environment change.
async function syncTokenCounter() {
    try {
        // Find the highest tokenNumber ever assigned across all orders
        const highestOrder = await Order.findOne(
            { tokenNumber: { $exists: true, $ne: null } },
            { tokenNumber: 1 },
            { sort: { tokenNumber: -1 } }
        ).lean();

        const highestToken = highestOrder ? highestOrder.tokenNumber : 0;

        // Only update counter if it currently sits below the highest known token
        const current = await Counter.findById('tokenCounter').lean();
        const currentSeq = current ? current.seq : 0;

        if (highestToken > currentSeq) {
            await Counter.findOneAndUpdate(
                { _id: 'tokenCounter' },
                { $set: { seq: highestToken } },
                { upsert: true }
            );
            console.log(`Token counter synced: ${currentSeq} → ${highestToken}`);
        } else {
            console.log(`Token counter OK (seq: ${currentSeq}, highest order token: ${highestToken})`);
        }
    } catch (err) {
        console.error('Token counter sync error:', err.message);
    }
}

// Helper: Atomic Token Generation
async function generateToken() {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'tokenCounter' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

// Route: Health Check to wake up Render
app.get('/ping', (req, res) => {
    res.json({ status: 'awake', db: dbReady });
});

// Route: Public product catalog (reads from MongoDB, falls back to JSON)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({ inStock: true }).select('-__v').lean();
        const formatted = products.map(p => ({ ...p, id: p.productId || p._id.toString() }));
        res.set('Cache-Control', 'public, max-age=60');
        res.json(formatted);
    } catch {
        res.set('Cache-Control', 'public, max-age=60');
        res.json(PRODUCTS_SEED);
    }
});

// Route: Create Order
app.post('/api/create-order', async (req, res) => {
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database is not connected. Please try again in a moment.' });
        }

        const { amount, items, customerName, customerPhone, customerEmail } = req.body;

        if (!amount || !items || !customerName || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Sanitisation
        const cleanName = customerName.replace(/[<>'"/\\;]/g, '').trim();
        const cleanPhone = customerPhone.replace(/[^\d\+\-\s\(\)]/g, '').trim();

        if (cleanName.length < 2 || cleanPhone.length < 8) {
            return res.status(400).json({ error: 'Invalid name or phone' });
        }

        // Feature: Kitchen Capacity Control
        const activeOrdersCount = await Order.countDocuments({
            paymentStatus: 'SUCCESS',
            shopStatus: { $in: ['PREPARING'] } // Orders actively in the kitchen queue
        });

        if (activeOrdersCount >= 30) {
            return res.status(503).json({ error: 'High demand. Please wait a few minutes before placing an order.' });
        }

        // Create Razorpay Order
        const options = {
            amount: Math.round(amount * 100), // convert to paise
            currency: "INR",
            receipt: `rcpt_${Math.random().toString(36).substr(2, 9)}`,
        };

        const rzpOrder = await razorpay.orders.create(options);

        // Save order to MongoDB in CREATED state
        const newOrder = new Order({
            items,
            totalAmount: amount,
            customerName: cleanName,
            customerPhone: cleanPhone,
            customerEmail: customerEmail || '',
            paymentStatus: 'CREATED',
            shopStatus: 'CREATED',
            rzpOrderId: rzpOrder.id
        });

        await newOrder.save();

        res.json({
            orderId: rzpOrder.id,
            currency: rzpOrder.currency,
            amount: rzpOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID,
            dbOrderId: newOrder._id
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Route: Razorpay Webhook Endpoint
// Reliable payment confirmation
app.post('/webhook/razorpay', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const shasum = crypto.createHmac('sha256', webhookSecret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== req.headers['x-razorpay-signature']) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const paymentEntity = req.body.payload.payment.entity;
        const rzpOrderId = paymentEntity.order_id;
        const rzpPaymentId = paymentEntity.id;

        // Find the pending order in our database
        const order = await Order.findOne({ rzpOrderId });

        if (!order) {
            console.error('Webhook: Order not found for ID', rzpOrderId);
            return res.status(404).json({ error: 'Order not found' });
        }

        if (event === 'payment.captured' || event === 'payment.authorized') {
            // Prevent duplicate fulfillment if already success
            if (order.paymentStatus === 'SUCCESS') {
                return res.json({ status: 'ok', msg: 'Already processed' });
            }

            const tokenNumber = await generateToken();

            order.paymentStatus = 'SUCCESS';
            order.rzpPaymentId = rzpPaymentId;
            order.tokenNumber = tokenNumber;
            order.shopStatus = 'PREPARING'; // Send to kitchen queue
            await order.save();

            console.log(`Order fulfilled: DB_${order._id} - Token: ${tokenNumber}`);
        } else if (event === 'payment.failed') {
            order.paymentStatus = 'FAILED';
            await order.save();
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Route: Get Order Status (for polling on frontend / receipt view)
app.get('/api/orders/:id', async (req, res) => {
    try {
        // Can be queried by Mongo _id or Razorpay rzpOrderId
        const order = await Order.findOne({
            $or: [{ _id: req.params.id }, { rzpOrderId: req.params.id }]
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json(order);
    } catch (error) {
        // Handle invalid Object ID format gracefully
        res.status(400).json({ error: 'Invalid order reference' });
    }
});

// Route: Get order history by phone number (Option B - cross-device lookup)
app.get('/api/orders/by-phone/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.trim();
        if (!phone || phone.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const orders = await Order.find({
            customerPhone: phone,
            paymentStatus: 'SUCCESS'
        }).sort({ createdAt: -1 }); // Newest first

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});


// --- ADMIN & QUEUE DISPLAY ENDPOINTS ---

// Rate limiter: max 5 login attempts per 15 minutes per IP
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Route: Admin Login — issues a signed JWT, sets httpOnly cookie
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    const { password } = req.body;
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    // Set httpOnly cookie (inaccessible to JS — XSS-safe)
    res.cookie('dzerts_admin', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',   // required for cross-origin cookie (Render backend + GitHub Pages frontend)
        maxAge: 12 * 60 * 60 * 1000  // 12 hours in ms
    });
    // Also return token in body so existing frontend code keeps working during migration
    res.json({ token });
});

// Route: Admin Logout — clears the httpOnly cookie
app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('dzerts_admin', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'None' });
    res.json({ success: true });
});

// Middleware: Verify JWT — accepts httpOnly cookie (primary) or Bearer token (fallback)
const requireAdmin = (req, res, next) => {
    // 1. Try httpOnly cookie first (XSS-safe)
    let token = req.cookies && req.cookies.dzerts_admin;
    // 2. Fall back to Authorization: Bearer <token>
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
};

// Route: PUBLIC display endpoint — token numbers only, no PII, no auth required
// Safe for TV screens and public displays
app.get('/api/display/orders', async (req, res) => {
    try {
        const activeOrders = await Order.find({
            paymentStatus: 'SUCCESS',
            shopStatus: { $in: ['PREPARING', 'READY'] }
        })
        .select('tokenNumber shopStatus -_id')
        .sort({ createdAt: 1 })
        .lean();
        res.set('Cache-Control', 'no-store');
        res.json(activeOrders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch display orders' });
    }
});

// Route: Get all active orders for Dashboard
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        // Fetch SUCCESS orders that are not SERVED yet.
        const activeOrders = await Order.find({
            paymentStatus: 'SUCCESS',
            shopStatus: { $ne: 'SERVED' }
        }).sort({ createdAt: 1 }); // Oldest first

        res.json(activeOrders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch active orders' });
    }
});

// Route: Analytics dashboard data
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek  = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - 6); // last 7 days

        // Run all queries in parallel
        const [
            allTimeOrders,
            todayOrders,
            weekOrders,
            hourlyRaw
        ] = await Promise.all([
            // All-time successful orders
            Order.find({ paymentStatus: 'SUCCESS' }).select('totalAmount items createdAt').lean(),
            // Today's orders
            Order.find({ paymentStatus: 'SUCCESS', createdAt: { $gte: startOfToday } }).lean(),
            // Last 7 days
            Order.find({ paymentStatus: 'SUCCESS', createdAt: { $gte: startOfWeek } })
                 .select('totalAmount createdAt').lean(),
            // Orders by hour today (for chart)
            Order.find({ paymentStatus: 'SUCCESS', createdAt: { $gte: startOfToday } })
                 .select('createdAt totalAmount').lean()
        ]);

        // All-time revenue
        const totalRevenue = allTimeOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        // Today revenue
        const todayRevenue = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        // Week revenue
        const weekRevenue = weekOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        // Top 5 products by total quantity sold (from items arrays)
        const productTotals = {};
        allTimeOrders.forEach(order => {
            (order.items || []).forEach(item => {
                if (!productTotals[item.name]) productTotals[item.name] = 0;
                productTotals[item.name] += item.quantity || 1;
            });
        });
        const topProducts = Object.entries(productTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, qty]) => ({ name, qty }));

        // Hourly breakdown for today (0-23)
        const hourlyOrders  = Array(24).fill(0);
        const hourlyRevenue = Array(24).fill(0);
        hourlyRaw.forEach(o => {
            const h = new Date(o.createdAt).getHours();
            hourlyOrders[h]++;
            hourlyRevenue[h] += o.totalAmount || 0;
        });

        res.json({
            totalRevenue,
            totalOrders:  allTimeOrders.length,
            todayRevenue,
            todayOrders:  todayOrders.length,
            weekRevenue,
            weekOrders:   weekOrders.length,
            topProducts,
            hourlyOrders,
            hourlyRevenue
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Route: Update order shop status (PREPARING -> READY -> SERVED)
app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PREPARING', 'READY', 'SERVED'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { shopStatus: status },
            { new: true }
        );

        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// ── Admin Product CRUD ────────────────────────────────────────────

// GET all products (admin — includes out-of-stock)
app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 }).lean();
        res.json(products.map(p => ({ ...p, id: p.productId || p._id.toString() })));
    } catch { res.status(500).json({ error: 'Failed to fetch products' }); }
});

// POST create product
app.post('/api/admin/products', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category, tags, badge, rating, meta, inStock } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });
        const imageStr = req.file ? await processImage(req.file.buffer) : '';
        const product = await Product.create({
            productId: 'prd_' + Date.now().toString(36),
            name: name.trim(), description: description || '',
            price: parseFloat(price), category: category || 'cakes',
            tags: JSON.parse(tags || '[]'), badge: badge || null,
            rating: parseFloat(rating) || 5.0, meta: meta || null,
            image: imageStr, inStock: inStock !== 'false'
        });
        res.json({ success: true, product });
    } catch (err) { res.status(500).json({ error: err.message || 'Failed to create product' }); }
});

// PUT update product
app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category, tags, badge, rating, meta, inStock } = req.body;
        const update = {
            name: name.trim(), description: description || '',
            price: parseFloat(price), category: category || 'cakes',
            tags: JSON.parse(tags || '[]'), badge: badge || null,
            rating: parseFloat(rating) || 5.0, meta: meta || null,
            inStock: inStock !== 'false'
        };
        if (req.file) update.image = await processImage(req.file.buffer);
        const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, product });
    } catch (err) { res.status(500).json({ error: err.message || 'Failed to update product' }); }
});

// DELETE product
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const p = await Product.findByIdAndDelete(req.params.id);
        if (!p) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete product' }); }
});

// PATCH toggle inStock
app.patch('/api/admin/products/:id/stock', requireAdmin, async (req, res) => {
    try {
        const p = await Product.findById(req.params.id);
        if (!p) return res.status(404).json({ error: 'Product not found' });
        p.inStock = !p.inStock;
        await p.save();
        res.json({ success: true, inStock: p.inStock });
    } catch { res.status(500).json({ error: 'Failed to toggle stock' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
