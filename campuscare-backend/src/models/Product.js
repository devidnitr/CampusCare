const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['beverages', 'snacks', 'stationery', 'hygiene', 'electronics', 'medicines', 'other']
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    images: [{
        type: String
    }],
    barcode: {
        type: String,
        unique: true,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    weight: {
        type: Number // in grams
    },
    dimensions: {
        length: Number,
        width: Number,
        height: Number
    },
    expiryDate: {
        type: Date
    },
    nutritionalInfo: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        sugar: Number
    },
    tags: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    minStockLevel: {
        type: Number,
        default: 10
    },
    maxStockLevel: {
        type: Number,
        default: 100
    }
}, {
    timestamps: true
});

// Create index for search
productSchema.index({ name: 'text', description: 'text', brand: 'text' });

module.exports = mongoose.model('Product', productSchema);