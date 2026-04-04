const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, unique: true, sparse: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price:       { type: Number, required: true, min: 0 },
    category:    { type: String, default: 'cakes' },
    tags:        { type: [String], default: [] },
    badge:       { type: String, default: null },
    rating:      { type: Number, default: 5.0, min: 0, max: 5 },
    meta:        { type: String, default: null },
    image:       { type: String, default: '' },  // base64 data URL or http URL
    inStock:     { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
