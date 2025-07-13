const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const upload = require('../config/multer');
const { validationResult } = require('express-validator');

const getAllProducts = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
        
        const query = { isActive: true };
        
        if (category) {
            query.category = category;
        }
        
        if (search) {
            query.$text = { $search: search };
        }
        
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const products = await Product.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Product.countDocuments(query);
        
        res.json({
            status: 'success',
            data: {
                products,
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

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }
        
        // Get inventory information
        const inventory = await Inventory.find({ product: product._id })
            .populate('dispensary', 'name location')
            .select('quantity slot dispensary status');
        
        res.json({
            status: 'success',
            data: {
                product,
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

const createProduct = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const productData = { ...req.body };
        
        // Handle image uploads
        if (req.files && req.files.length > 0) {
            productData.images = req.files.map(file => file.path);
        }
        
        const product = new Product(productData);
        await product.save();
        
        res.status(201).json({
            status: 'success',
            message: 'Product created successfully',
            data: { product }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Product with this barcode already exists'
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const updateProduct = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const updateData = { ...req.body };
        
        // Handle image uploads
        if (req.files && req.files.length > 0) {
            updateData.images = req.files.map(file => file.path);
        }
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Product updated successfully',
            data: { product }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Product deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Server error',
            error: error.message
        });
    }
};

const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const products = await Product.find({ category, isActive: true })
            .sort({ name: 1 });
        
        res.json({
            status: 'success',
            data: { products }
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
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByCategory
};