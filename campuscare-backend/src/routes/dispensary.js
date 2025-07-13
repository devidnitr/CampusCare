const express = require('express');
const { body } = require('express-validator');
const {
    getAllDispensaries,
    getDispensaryById,
    createDispensary,
    updateDispensary,
    updateDispensaryStatus,
    dispenseProduct,
    getDispensaryOrders
} = require('../controllers/dispensaryController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all dispensaries
router.get('/', getAllDispensaries);

// Get dispensary by ID
router.get('/:id', getDispensaryById);

// Get dispensary orders
router.get('/:id/orders', auth, authorize('admin'), getDispensaryOrders);

// Create dispensary (admin only)
router.post('/', [
    auth,
    authorize('admin'),
    body('name').notEmpty().withMessage('Dispensary name is required'),
    body('location.building').notEmpty().withMessage('Building is required'),
    body('location.floor').isInt({ min: 0 }).withMessage('Floor must be a valid number'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1')
], createDispensary);

// Update dispensary (admin only)
router.put('/:id', [
    auth,
    authorize('admin'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1')
], updateDispensary);

// Update dispensary status
router.put('/:id/status', [
    auth,
    authorize('admin'),
    body('status').optional().isIn(['active', 'maintenance', 'offline'])
        .withMessage('Invalid status')
], updateDispensaryStatus);

// Dispense product
router.post('/:id/dispense', [
    auth,
    authorize('admin'),
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('slotId').notEmpty().withMessage('Slot ID is required')
], dispenseProduct);

module.exports = router;