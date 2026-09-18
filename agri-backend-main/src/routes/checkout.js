const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { buildSummary, FREE_SHIPPING_THRESHOLD } = require('../utils/pricing');
const { CouponUtils } = require('../utils/helpers');
const Address = require('../models/Address');
const Setting = require('../models/Setting');

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
router.get('/payment-methods', optionalAuth, async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'global_config' });
    const isCodEnabled = setting?.enableCod ?? true;
    const maxCod = setting?.maxCodAmount || 49999;
    const methods = PAYMENT_METHODS.map((m) => {
      if (m.id === 'cod') {
        return {
          ...m,
          enabled: isCodEnabled,
          maxAmount: maxCod,
          description: isCodEnabled
            ? `Pay cash on doorstep delivery (up to ₹${maxCod.toLocaleString('en-IN')})`
            : 'Temporarily disabled'
        };
      }
      return m;
    });
    res.status(200).json({ success: true, data: methods });
  } catch (err) {
    res.status(200).json({ success: true, data: PAYMENT_METHODS });
  }
});

// @desc    Public storefront config (free-shipping threshold, coupon stacking, COD rules, etc.)
// @route   GET /api/v1/checkout/config
// @access  Public
router.get('/config', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'global_config' });
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: setting?.freeShippingThreshold || FREE_SHIPPING_THRESHOLD,
        standardDeliveryCharge: typeof setting?.standardDeliveryCharge === 'number' ? setting.standardDeliveryCharge : 50,
        allowCouponStacking: setting?.allowCouponStacking ?? false,
        maxStackedCoupons: setting?.maxStackedCoupons || 2,
        enableCod: setting?.enableCod ?? true,
        maxCodAmount: setting?.maxCodAmount || 49999
      }
    });
  } catch (err) {
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        standardDeliveryCharge: 50,
        allowCouponStacking: false,
        maxStackedCoupons: 2,
        enableCod: true,
        maxCodAmount: 49999
      }
    });
  }
});

// @desc    Validate a discount code → { valid, discount }
// @route   POST /api/v1/checkout/discount
// @access  Public (optionalAuth — guests can preview, full check at checkout)
router.post('/discount', optionalAuth, async (req, res) => {
  try {
    const { code, subtotal, existingCodes } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount code is required' } });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const appliedList = Array.isArray(existingCodes) ? existingCodes.map((c) => String(c).trim().toUpperCase()) : [];

    // Check store setting for stacking
    const setting = await Setting.findOne({ key: 'global_config' });
    const allowStacking = setting?.allowCouponStacking ?? false;
    const maxStacked = setting?.maxStackedCoupons || 2;

    if (appliedList.length > 0) {
      if (!allowStacking) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            discount: 0,
            message: 'Coupon stacking is currently disabled by store policy. Only one coupon can be applied per order.',
            code: 'STACKING_DISABLED'
          }
        });
      }

      if (appliedList.includes(cleanCode)) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            discount: 0,
            message: 'This coupon is already applied to your cart.',
            code: 'ALREADY_APPLIED'
          }
        });
      }

      if (appliedList.length >= maxStacked) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            discount: 0,
            message: `You can apply a maximum of ${maxStacked} coupons per order.`,
            code: 'MAX_COUPONS_REACHED'
          }
        });
      }
    }

    const amount = Number(subtotal) || 0;
    // req.user is null for guests — pass undefined so the coupon utility skips per-user limit check
    const result = await CouponUtils.validateCoupon(cleanCode, amount, req.user?._id);

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
        description: result.description,
        allowStacking
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
