const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { buildSummary, FREE_SHIPPING_THRESHOLD } = require('../utils/pricing');
const { CouponUtils } = require('../utils/helpers');
const Address = require('../models/Address');

// Only Razorpay + COD are active for this phase (per build decision).
const PAYMENT_METHODS = [
  { id: 'razorpay', label: 'Razorpay', description: 'UPI, Cards, Netbanking & Wallets', enabled: true },
  { id: 'cod', label: 'Cash on Delivery', description: 'Pay when your order arrives', enabled: true },
  { id: 'cashfree', label: 'Cashfree', description: 'Coming soon', enabled: false },
  { id: 'cred', label: 'CRED', description: 'Coming soon', enabled: false }
];

// @desc    Available payment methods
// @route   GET /api/v1/checkout/payment-methods
// @access  Public
router.get('/payment-methods', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, data: PAYMENT_METHODS });
});

// @desc    Public storefront config (free-shipping threshold, etc.)
// @route   GET /api/v1/checkout/config
// @access  Public
router.get('/config', (req, res) => {
  res.status(200).json({ success: true, data: { freeShippingThreshold: FREE_SHIPPING_THRESHOLD } });
});

// @desc    Validate a discount code → { valid, discount }
// @route   POST /api/v1/checkout/discount
// @access  Private
router.post('/discount', authenticate, async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount code is required' } });
    }

    const amount = Number(subtotal) || 0;
    const result = await CouponUtils.validateCoupon(String(code), amount, req.user._id);

    if (!result.valid) {
      return res.status(200).json({
        success: true,
        data: { valid: false, discount: 0, message: result.message, code: result.code }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        discount: result.discount,
        type: result.type,
        code: result.code,
        description: result.description
      }
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to validate discount' } });
  }
});

// @desc    Recompute money summary { subtotal, discount, charges, total }
// @route   POST /api/v1/checkout/summary
// @access  Private
router.post('/summary', authenticate, async (req, res) => {
  try {
    const { items, discountCode, shippingAddressId, serviceType } = req.body;
    let { toPincode } = req.body;

    // Resolve a destination pincode (for live Ekart rates) from an address id if given
    if (!toPincode && shippingAddressId) {
      const addr = await Address.findOne({ _id: shippingAddressId, user: req.user._id }).select('pincode');
      if (addr) toPincode = addr.pincode;
    }

    const summary = await buildSummary({ items, discountCode, userId: req.user._id, toPincode, serviceType });

    res.status(200).json({
      success: true,
      data: {
        subtotal: summary.subtotal,
        discount: summary.discount,
        charges: summary.charges,
        total: summary.total,
        items: summary.items.map((i) => ({
          productId: i.productId,
          title: i.name,
          weight: i.weight,
          price: i.price,
          qty: i.qty,
          image: i.image,
          subtotal: i.subtotal
        }))
      }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    }
    console.error('Checkout summary error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to compute summary' } });
  }
});

module.exports = router;
