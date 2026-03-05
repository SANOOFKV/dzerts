require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const mongoose = require('mongoose');

// Models
const Order = require('./models/Order');
const Counter = require('./models/Counter');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

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
    res.json({ status: 'awake' });
});

// Route: Create Order
app.post('/create-order', async (req, res) => {
    try {
        const { amount, items, customerName, customerPhone, customerEmail } = req.body;

        if (!amount || !items || !customerName || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
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
            customerName,
            customerPhone,
            customerEmail,
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


// --- ADMIN & QUEUE DISPLAY ENDPOINTS ---

// Check Admin Password Middleware
const requireAdmin = (req, res, next) => {
    const pass = req.headers['x-admin-password'];
    if (pass !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Route: Get all active orders for Dashboard
app.get('/api/admin/orders', async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
