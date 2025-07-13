const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    type: {
        type: String,
        enum: ['credit', 'debit', 'refund'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'card', 'upi', 'cash', 'admin'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        unique: true
    },
    balanceAfter: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Generate transaction ID before saving
transactionSchema.pre('save', function(next) {
    if (!this.transactionId) {
        this.transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);