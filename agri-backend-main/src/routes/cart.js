const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/auth');
const { primaryImage } = require('../utils/serializers');

// Resolve a productId that may be a Mongo _id or a "P001" productId
const findProduct = async (productId) => {
  if (mongoose.Types.ObjectId.isValid(productId)) {
    const byId = await Product.findById(productId);
    if (byId) return byId;
  }
  return Product.findOne({ productId });
};

// Build the cart response shape the frontend expects.
// items: { id, productId, title, weight, price, qty, image, lineTotal }
const buildCartResponse = async (cart) => {
  if (!cart || cart.items.length === 0) {
    return { items: [], subtotal: 0, itemCount: 0 };
  }

  await cart.populate('items.product');

  const items = [];
  let subtotal = 0;
  let mutated = false;

  for (const item of cart.items) {
    const product = item.product;
    // Drop items whose product no longer exists
    if (!product) {
      mutated = true;
      continue;
    }
    const price = product.price;
    const lineTotal = price * item.qty;
    subtotal += lineTotal;

    items.push({
      id: String(item._id),
      productId: product.productId || String(product._id),
      title: product.name,
      weight: item.weight,
      price,
      qty: item.qty,
      image: primaryImage(product.images),
      inStock: (product.stock || 0) >= item.qty && product.status === 'active',
      lineTotal
    });
  }

  // Persist removal of dead product references
  if (mutated) {
    cart.items = cart.items.filter((i) => i.product);
    await cart.save();
  }

  return { items, subtotal, itemCount: items.reduce((n, i) => n + i.qty, 0) };
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// @desc    Get current cart
// @route   GET /api/v1/cart
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const data = await buildCartResponse(cart);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cart' } });
  }
});

// @desc    Add item to cart
// @route   POST /api/v1/cart/items
// @access  Private
router.post('/items', authenticate, async (req, res) => {
  try {
    const { productId, weight = null, qty = 1 } = req.body;
    const quantity = parseInt(qty);

    if (!productId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'productId is required' } });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'qty must be a positive integer' } });
    }

    const product = await findProduct(String(productId));
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }
    if (product.status !== 'active') {
      return res.status(400).json({ success: false, error: { code: 'PRODUCT_UNAVAILABLE', message: `${product.name} is not available` } });
    }

    const cart = await getOrCreateCart(req.user._id);

    // Merge with an existing line of the same product + weight
    const existing = cart.items.find(
      (i) => i.product.toString() === product._id.toString() && (i.weight || null) === (weight || null)
    );
    const newQty = (existing ? existing.qty : 0) + quantity;

    if (product.stock < newQty) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_STOCK', message: `Only ${product.stock} in stock for ${product.name}` }
      });
    }

    if (existing) {
      existing.qty = newQty;
    } else {
      cart.items.push({ product: product._id, weight: weight || null, qty: quantity });
    }
    await cart.save();

    const data = await buildCartResponse(cart);
    res.status(201).json({ success: true, data, message: 'Item added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add item to cart' } });
  }
});

// @desc    Update item quantity
// @route   PATCH /api/v1/cart/items/:id
// @access  Private
router.patch('/items/:id', authenticate, async (req, res) => {
  try {
    const { qty } = req.body;
    const quantity = parseInt(qty);

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'qty must be a non-negative integer' } });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart && cart.items.id(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart item not found' } });
    }

    // qty 0 removes the line
    if (quantity === 0) {
      cart.items.pull(req.params.id);
    } else {
      const product = await Product.findById(item.product);
      if (product && product.stock < quantity) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_STOCK', message: `Only ${product.stock} in stock` }
        });
      }
      item.qty = quantity;
    }
    await cart.save();

    const data = await buildCartResponse(cart);
    res.status(200).json({ success: true, data, message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update cart item' } });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:id
// @access  Private
router.delete('/items/:id', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || !cart.items.id(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart item not found' } });
    }
    cart.items.pull(req.params.id);
    await cart.save();

    const data = await buildCartResponse(cart);
    res.status(200).json({ success: true, data, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove cart item' } });
  }
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
router.delete('/', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.status(200).json({ success: true, data: { items: [], subtotal: 0, itemCount: 0 }, message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clear cart' } });
  }
});

module.exports = router;
