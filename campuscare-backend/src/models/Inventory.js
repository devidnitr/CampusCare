const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    dispensary: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dispensary',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    slot: {
        type: String,
        required: true // e.g., 'A1', 'B2', etc.
    },
    batchNumber: {
        type: String
    },
    expiryDate: {
        type: Date
    },
    costPrice: {
        type: Number,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    },
    restockLevel: {
        type: Number,
        default: 5
    },
    lastRestocked: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'low_stock', 'out_of_stock', 'expired'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Compound index for product and dispensary
inventorySchema.index({ product: 1, dispensary: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);