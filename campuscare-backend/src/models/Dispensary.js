const mongoose = require('mongoose');

const dispensarySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        building: {
            type: String,
            required: true
        },
        floor: {
            type: Number,
            required: true
        },
        room: {
            type: String
        },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    capacity: {
        type: Number,
        required: true
    },
    slots: [{
        slotId: {
            type: String,
            required: true
        },
        isOccupied: {
            type: Boolean,
            default: false
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            default: 0
        }
    }],
    status: {
        type: String,
        enum: ['active', 'maintenance', 'offline'],
        default: 'active'
    },
    lastMaintenance: {
        type: Date
    },
    nextMaintenance: {
        type: Date
    },
    temperature: {
        type: Number
    },
    humidity: {
        type: Number
    },
    powerStatus: {
        type: String,
        enum: ['on', 'off', 'battery'],
        default: 'on'
    },
    networkStatus: {
        type: String,
        enum: ['connected', 'disconnected', 'poor'],
        default: 'connected'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Dispensary', dispensarySchema);