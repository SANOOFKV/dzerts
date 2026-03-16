const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Store cart items cleanly
    items: [{
        id: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    customerName: {
        type: String,
        default: 'Guest'
    },
    customerPhone: {
        type: String,
        default: 'N/A'
    },
    customerEmail: {
        type: String
    },
    // Razorpay Details
    rzpOrderId: {
        type: String,
        required: true,
        unique: true
    },
    rzpPaymentId: {
        type: String
    },
    // Order State: CREATED -> SUCCESS -> PENDING -> FAILED
    paymentStatus: {
        type: String,
        enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'],
        default: 'CREATED'
    },
    // Queue State for Kitchen Staff
    shopStatus: {
        type: String,
        enum: ['CREATED', 'PREPARING', 'READY', 'SERVED'],
        default: 'CREATED'
    },
    // The Queue Token Number generated upon SUCCESS
    tokenNumber: {
        type: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
