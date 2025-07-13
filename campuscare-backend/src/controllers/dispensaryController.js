const Dispensary = require('../models/Dispensary');
const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const { validationResult } = require('express-validator');

const getAllDispensaries = async (req, res) => {
    try {
        const dispensaries = await Dispensary.find({ isActive: true })
            .sort({ name: 1 });

        res.json({
            status: 'success',
            data: { dispensaries }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const getDispensaryById = async (req, res) => {
    try {
        const dispensary = await Dispensary.findById(req.params.id);

        if (!dispensary) {
            return res.status(404).json({
                status: 'error',
                message: 'Dispensary not found'
            });
        }

        // Get inventory for this dispensary
        const inventory = await Inventory.find({ dispensary: dispensary._id })
            .populate('product', 'name images price category')
            .sort({ slot: 1 });

        res.json({
            status: 'success',
            data: {
                dispensary,
                inventory
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const createDispensary = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const dispensaryData = { ...req.body };
        
        // Initialize slots
        const slots = [];
        for (let i = 1; i <= dispensaryData.capacity; i++) {
            const row = String.fromCharCode(65 + Math.floor((i - 1) / 10)); // A, B, C, etc.
            const col = ((i - 1) % 10) + 1;
            slots.push({
                slotId: `${row}${col}`,
                isOccupied: false,
                quantity: 0
            });
        }
        
        dispensaryData.slots = slots;

        const dispensary = new Dispensary(dispensaryData);
        await dispensary.save();

        res.status(201).json({
            status: 'success',
            message: 'Dispensary created successfully',
            data: { dispensary }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const updateDispensary = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const dispensary = await Dispensary.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!dispensary) {
            return res.status(404).json({
                status: 'error',
                message: 'Dispensary not found'
            });
        }

        res.json({
            status: 'success',
            message: 'Dispensary updated successfully',
            data: { dispensary }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const updateDispensaryStatus = async (req, res) => {
    try {
        const { status, temperature, humidity, powerStatus, networkStatus } = req.body;
        const { id } = req.params;

        const updateData = {};
        if (status) updateData.status = status;
        if (temperature !== undefined) updateData.temperature = temperature;
        if (humidity !== undefined) updateData.humidity = humidity;
        if (powerStatus) updateData.powerStatus = powerStatus;
        if (networkStatus) updateData.networkStatus = networkStatus;

        const dispensary = await Dispensary.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!dispensary) {
            return res.status(404).json({
                status: 'error',
                message: 'Dispensary not found'
            });
        }

        // Emit real-time update
        req.app.get('io').emit('dispensaryStatusUpdate', {
            dispensaryId: dispensary._id,
            status: dispensary.status,
            temperature: dispensary.temperature,
            humidity: dispensary.humidity,
            powerStatus: dispensary.powerStatus,
            networkStatus: dispensary.networkStatus
        });

        res.json({
            status: 'success',
            message: 'Dispensary status updated successfully',
            data: { dispensary }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const dispenseProduct = async (req, res) => {
    try {
        const { orderId, slotId } = req.body;
        const { id: dispensaryId } = req.params;

        // Find the order
        const order = await Order.findById(orderId)
            .populate('items.product');

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Check if order is ready for dispensing
        if (order.orderStatus !== 'processing') {
            return res.status(400).json({
                status: 'error',
                message: 'Order is not ready for dispensing'
            });
        }

        // Find the dispensary
        const dispensary = await Dispensary.findById(dispensaryId);
        if (!dispensary) {
            return res.status(404).json({
                status: 'error',
                message: 'Dispensary not found'
            });
        }

        // Check if dispensary is active
        if (dispensary.status !== 'active') {
            return res.status(400).json({
                status: 'error',
                message: 'Dispensary is not active'
            });
        }

        // Update order status
        order.orderStatus = 'dispensed';
        await order.save();

        // Update slot status
        const slot = dispensary.slots.find(s => s.slotId === slotId);
        if (slot) {
            slot.quantity -= 1;
            if (slot.quantity === 0) {
                slot.isOccupied = false;
                slot.product = null;
            }
            await dispensary.save();
        }

        // Emit real-time update
        req.app.get('io').emit('productDispensed', {
            orderId: order._id,
            dispensaryId: dispensary._id,
            slotId: slotId,
            userId: order.user
        });

        res.json({
            status: 'success',
            message: 'Product dispensed successfully',
            data: {
                order,
                dispensary: {
                    id: dispensary._id,
                    name: dispensary.name,
                    slot: slotId
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const getDispensaryOrders = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { dispensary: id };
        if (status) {
            query.orderStatus = status;
        }

        const orders = await Order.find(query)
            .populate('user', 'firstName lastName email')
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    getAllDispensaries,
    getDispensaryById,
    createDispensary,
    updateDispensary,
    updateDispensaryStatus,
    dispenseProduct,
    getDispensaryOrders
};