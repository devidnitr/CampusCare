const Order = require('../models/Order');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const QRCode = require('qrcode');
const { validationResult } = require('express-validator');

const createOrder = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { items, dispensary, paymentMethod } = req.body;
        const userId = req.user.id;

        // Validate items and calculate total
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const inventory = await Inventory.findOne({
                product: item.product,
                dispensary: dispensary,
                quantity: { $gte: item.quantity }
            }).populate('product');

            if (!inventory) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient stock for product: ${item.product}`
                });
            }

            const itemTotal = inventory.sellingPrice * item.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                product: item.product,
                quantity: item.quantity,
                price: inventory.sellingPrice,
                slot: inventory.slot
            });
        }

        // Check user wallet balance if payment method is wallet
        if (paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (user.wallet.balance < totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Insufficient wallet balance'
                });
            }
        }

        // Create order
        const order = new Order({
            user: userId,
            dispensary,
            items: orderItems,
            totalAmount,
            paymentMethod
        });

        await order.save();

        // Generate QR code
        const qrCodeData = {
            orderId: order._id,
            transactionId: order.transactionId,
            amount: totalAmount,
            timestamp: new Date()
        };

        const qrCode = await QRCode.toDataURL(JSON.stringify(qrCodeData));
        order.qrCode = qrCode;
        await order.save();

        // Process payment
        if (paymentMethod === 'wallet') {
            await processWalletPayment(userId, order._id, totalAmount);
        }

        // Update inventory
        for (const item of orderItems) {
            await Inventory.findOneAndUpdate(
                { product: item.product, dispensary: dispensary },
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Emit real-time update
        req.app.get('io').emit('newOrder', {
            orderId: order._id,
            dispensary: dispensary,
            status: 'placed'
        });

        const populatedOrder = await Order.findById(order._id)
            .populate('user', 'firstName lastName email')
            .populate('dispensary', 'name location')
            .populate('items.product', 'name images');

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: { order: populatedOrder }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const processWalletPayment = async (userId, orderId, amount) => {
    try {
        // Update user wallet
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { 'wallet.balance': -amount } },
            { new: true }
        );

        // Create transaction record
        const transaction = new Transaction({
            user: userId,
            order: orderId,
            type: 'debit',
            amount: amount,
            description: 'Order payment',
            paymentMethod: 'wallet',
            status: 'completed',
            balanceAfter: user.wallet.balance
        });

        await transaction.save();

        // Update order payment status
        await Order.findByIdAndUpdate(orderId, {
            paymentStatus: 'completed',
            orderStatus: 'processing'
        });

        // Add transaction to user's wallet
        user.wallet.transactions.push(transaction._id);
        await user.save();

        return transaction;
    } catch (error) {
        throw error;
    }
};

const getUserOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const userId = req.user.id;

        const query = { user: userId };
        if (status) {
            query.orderStatus = status;
        }

        const orders = await Order.find(query)
            .populate('dispensary', 'name location')
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

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName email phone')
            .populate('dispensary', 'name location')
            .populate('items.product', 'name images brand');

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Check if user owns this order or is admin
        if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        res.json({
            status: 'success',
            data: { order }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        const order = await Order.findByIdAndUpdate(
            id,
            { orderStatus: status },
            { new: true }
        ).populate('user', 'firstName lastName email');

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // If order is collected, update collectedAt
        if (status === 'completed') {
            order.collectedAt = new Date();
            await order.save();
        }

        // Emit real-time update
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: order._id,
            status: status,
            userId: order.user._id
        });

        res.json({
            status: 'success',
            message: 'Order status updated successfully',
            data: { order }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Check if user owns this order
        if (order.user.toString() !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Can only cancel if order is not dispensed
        if (['dispensed', 'completed'].includes(order.orderStatus)) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot cancel order that has been dispensed'
            });
        }

        // Update order status
        order.orderStatus = 'cancelled';
        await order.save();

        // Refund if payment was completed
        if (order.paymentStatus === 'completed') {
            await processRefund(order);
        }

        // Restore inventory
        for (const item of order.items) {
            await Inventory.findOneAndUpdate(
                { product: item.product, dispensary: order.dispensary },
                { $inc: { quantity: item.quantity } }
            );
        }

        res.json({
            status: 'success',
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const processRefund = async (order) => {
    try {
        // Update user wallet
        const user = await User.findByIdAndUpdate(
            order.user,
            { $inc: { 'wallet.balance': order.totalAmount } },
            { new: true }
        );

        // Create refund transaction
        const transaction = new Transaction({
            user: order.user,
            order: order._id,
            type: 'credit',
            amount: order.totalAmount,
            description: 'Order refund',
            paymentMethod: 'wallet',
            status: 'completed',
            balanceAfter: user.wallet.balance
        });

        await transaction.save();

        // Update order payment status
        order.paymentStatus = 'refunded';
        await order.save();

        return transaction;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
};