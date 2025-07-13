const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dispensary: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dispensary',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        slot: {
            type: String,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'card', 'upi', 'cash'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    orderStatus: {
        type: String,
        enum: ['placed', 'processing', 'dispensed', 'completed', 'cancelled'],
        default: 'placed'
    },
    qrCode: {
        type: String
    },
    collectByTime: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
    },
    collectedAt: {
        type: Date
    },
    transactionId: {
        type: String,
        unique: true
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Generate transaction ID before saving
orderSchema.pre('save', function(next) {
    if (!this.transactionId) {
        this.transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);