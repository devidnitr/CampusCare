const express = require('express');
const { body } = require('express-validator');
const {
    createOrder,
    getUserOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
} = require('../controllers/orderController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Create new order
router.post('/', [
    auth,
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('dispensary').notEmpty().withMessage('Dispensary is required'),
    body('paymentMethod').isIn(['wallet', 'card', 'upi']).withMessage('Invalid payment method')
], createOrder);

// Get user's orders
router.get('/my-orders', auth, getUserOrders);

// Get order by ID
router.get('/:id', auth, getOrderById);

// Update order status (admin only)
router.put('/:id/status', [
    auth,
    authorize('admin'),
    body('status').isIn(['placed', 'processing', 'dispensed', 'completed', 'cancelled'])
        .withMessage('Invalid status')
], updateOrderStatus);

// Cancel order
router.put('/:id/cancel', auth, cancelOrder);

module.exports = router;