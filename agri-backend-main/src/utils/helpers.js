// Utility functions for the AgriCola backend
const crypto = require('crypto');

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate slug from text
 * @param {string} text - Text to convert to slug
 * @returns {string} Slug
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Format currency for Indian market
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Validate Indian phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
const validateIndianPhone = (phone) => {
  const phoneRegex = /^\+91[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate Indian PIN code
 * @param {string} pincode - PIN code to validate
 * @returns {boolean} Is valid
 */
const validatePincode = (pincode) => {
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Calculate order total with tax and shipping
 * @param {number} subtotal - Subtotal amount
 * @param {number} shippingCost - Shipping cost
 * @param {number} taxRate - Tax rate (decimal, e.g., 0.18 for 18%)
 * @param {number} discount - Discount amount
 * @returns {object} Pricing breakdown
 */
const calculateOrderTotal = (subtotal, shippingCost = 0, taxRate = 0.18, discount = 0) => {
  const discountedSubtotal = subtotal - discount;
  const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
  const total = discountedSubtotal + shippingCost + tax;

  return {
    subtotal,
    shipping: shippingCost,
    tax,
    discount,
    total: Math.round(total * 100) / 100
  };
};

/**
 * Generate order tracking number
 * @returns {string} Tracking number
 */
const generateTrackingNumber = () => {
  const prefix = 'AGR';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Paginate results
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object} Pagination info
 */
const paginate = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    skip: (page - 1) * limit
  };
};

/**
 * Send standardized API response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {object} pagination - Pagination info
 * @returns {object} API response
 */
const sendResponse = (res, statusCode, success, message, data = null, pagination = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
    ...(pagination && { pagination })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {any} details - Error details
 * @returns {object} Error response
 */
const sendError = (res, statusCode, code, message, details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    timestamp: new Date().toISOString()
  };

  return res.status(statusCode).json(response);
};

// Razorpay utilities
const RazorpayUtils = {
  verifyPaymentSignature(orderId, paymentId, signature, secret) {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');
    
    return expectedSignature === signature;
  },

  verifyWebhookSignature(body, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  },

  generateOrderOptions(amount, currency = 'INR', receipt) {
    return {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt,
      payment_capture: 1
    };
  }
};

// Shipping calculation utilities
const ShippingUtils = {
  calculateShippingCost(subtotal, weight, fromPincode, toPincode) {
    // Free shipping threshold
    if (subtotal >= 500) return 0;
    
    // Base shipping cost
    let shippingCost = 50;
    
    // Weight-based calculation
    if (weight > 1) {
      shippingCost += Math.ceil(weight - 1) * 20; // ₹20 per additional kg
    }
    
    // Distance-based calculation
    const distanceMultiplier = this.getDistanceMultiplier(fromPincode, toPincode);
    shippingCost *= distanceMultiplier;
    
    return Math.round(shippingCost);
  },

  getDistanceMultiplier(fromPincode, toPincode) {
    const fromCode = parseInt(fromPincode);
    const toCode = parseInt(toPincode);
    const difference = Math.abs(fromCode - toCode);
    
    // Same city
    if (difference < 100) return 1;
    
    // Same state (approximate)
    if (difference < 50000) return 1.2;
    
    // Different state
    return 1.5;
  },

  calculateEstimatedDelivery(shippingMethod, fromPincode, toPincode) {
    const deliveryDays = {
      'standard': 5,
      'express': 2,
      'overnight': 1,
      'same_day': 0
    };
    
    let days = deliveryDays[shippingMethod] || 5;
    
    // Add extra day for distant locations
    const distanceMultiplier = this.getDistanceMultiplier(fromPincode, toPincode);
    if (distanceMultiplier > 1.2) {
      days += 1;
    }
    
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    
    // Skip weekends for business days calculation
    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }
    
    return deliveryDate;
  }
};

// Tax calculation utilities
const TaxUtils = {
  calculateGST(amount, gstRate = 18) {
    return Math.round(amount * gstRate / 100);
  },

  getGSTRate(category) {
    const gstRates = {
      'vegetables': 0,
      'fruits': 0,
      'grains': 5,
      'pulses': 5,
      'dairy': 5,
      'processed-food': 12,
      'beverages': 18,
      'snacks': 18,
      'spices': 5
    };
    
    return gstRates[category.toLowerCase()] || 18;
  }
};

// Coupon utilities
const CouponUtils = {
  async validateCoupon(code, subtotal, userId) {
    if (!code || typeof code !== 'string') {
      return { valid: false, message: 'Invalid coupon code', code: 'INVALID_COUPON' };
    }

    const cleanCode = code.trim().toUpperCase();
    const Coupon = require('../models/Coupon');
    const User = require('../models/User');

    let coupon = await Coupon.findOne({ code: cleanCode });

    // Seed default starter coupons if none exist in DB yet
    if (!coupon && ['SAVE10', 'FLAT50', 'NEWUSER', 'WELCOME20'].includes(cleanCode)) {
      const defaults = {
        'SAVE10': { code: 'SAVE10', description: '10% off on orders above ₹200', discountType: 'percentage', discountValue: 10, minOrderValue: 200, maxDiscountCap: 100, validTo: new Date(Date.now() + 365*24*3600*1000) },
        'FLAT50': { code: 'FLAT50', description: '₹50 flat off on orders above ₹300', discountType: 'flat', discountValue: 50, minOrderValue: 300, maxDiscountCap: 50, validTo: new Date(Date.now() + 365*24*3600*1000) },
        'NEWUSER': { code: 'NEWUSER', description: '15% off on your first order', discountType: 'percentage', discountValue: 15, minOrderValue: 100, maxDiscountCap: 150, firstOrderOnly: true, validTo: new Date(Date.now() + 365*24*3600*1000) },
        'WELCOME20': { code: 'WELCOME20', description: '20% off on orders above ₹500', discountType: 'percentage', discountValue: 20, minOrderValue: 500, maxDiscountCap: 200, validTo: new Date(Date.now() + 365*24*3600*1000) }
      };
      try {
        coupon = await Coupon.create(defaults[cleanCode]);
      } catch (err) {
        coupon = await Coupon.findOne({ code: cleanCode });
      }
    }

    if (!coupon) {
      return { 
        valid: false, 
        message: 'Invalid coupon code',
        code: 'INVALID_COUPON'
      };
    }

    // Active switch check
    if (coupon.isActive === false) {
      return {
        valid: false,
        message: 'This coupon is currently inactive',
        code: 'COUPON_INACTIVE'
      };
    }

    const now = new Date();

    // Check valid from
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return {
        valid: false,
        message: 'This coupon is not active yet',
        code: 'COUPON_NOT_YET_ACTIVE'
      };
    }

    // Check validity date
    if (coupon.validTo && now > new Date(coupon.validTo)) {
      return { 
        valid: false, 
        message: 'Coupon has expired',
        code: 'EXPIRED_COUPON'
      };
    }

    // Check total usage limit
    if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) {
      return {
        valid: false,
        message: 'This coupon has reached its total usage limit',
        code: 'USAGE_LIMIT_REACHED'
      };
    }

    // Check user-specific rules
    if (userId) {
      // Per-user limit check
      const userRedemptions = (coupon.redemptions || []).filter(
        (r) => r.user && String(r.user) === String(userId)
      );
      const perUserLimit = coupon.perUserLimit || 1;
      if (userRedemptions.length >= perUserLimit) {
        return {
          valid: false,
          message: perUserLimit === 1 ? 'You have already used this coupon' : `You have reached the maximum limit of ${perUserLimit} uses for this coupon`,
          code: 'ALREADY_USED'
        };
      }

      // First order only check
      if (coupon.firstOrderOnly) {
        const userDoc = await User.findById(userId).select('orders');
        if (userDoc && (userDoc.orders || 0) > 0) {
          return {
            valid: false,
            message: 'This coupon is valid only for your first order',
            code: 'FIRST_ORDER_ONLY'
          };
        }
      }
    }

    // Check minimum order amount
    const minOrder = coupon.minOrderValue || 0;
    if (subtotal < minOrder) {
      return { 
        valid: false, 
        message: `Minimum order amount of ₹${minOrder} required`,
        code: 'MIN_ORDER_NOT_MET'
      };
    }

    // Calculate discount
    const isPercentage = coupon.discountType === 'percentage';
    let discount = isPercentage
      ? Math.round((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;

    // Apply maximum discount limit
    if (coupon.maxDiscountCap && isPercentage) {
      discount = Math.min(discount, coupon.maxDiscountCap);
    }

    // Never exceed the subtotal
    discount = Math.max(0, Math.min(discount, subtotal));

    return { 
      valid: true, 
      discount,
      type: coupon.discountType,
      discountValue: coupon.discountValue,
      percentage: isPercentage ? coupon.discountValue : null,
      code: cleanCode,
      couponId: coupon._id,
      description: coupon.description || `${isPercentage ? coupon.discountValue + '%' : '₹' + coupon.discountValue} off`
    };
  },

  async recordRedemption(code, userId, orderId, discountAmount) {
    if (!code || !userId) return;
    try {
      const cleanCode = code.trim().toUpperCase();
      const Coupon = require('../models/Coupon');
      await Coupon.updateOne(
        { code: cleanCode },
        {
          $inc: { usedCount: 1 },
          $push: {
            redemptions: {
              user: userId,
              orderId: orderId || null,
              discountAmount: Number(discountAmount) || 0,
              redeemedAt: new Date()
            }
          }
        }
      );
    } catch (err) {
      console.error('Failed to record coupon redemption:', err.message);
    }
  }
};

module.exports = {
  generateRandomString,
  generateSlug,
  formatCurrency,
  validateIndianPhone,
  validatePincode,
  calculateOrderTotal,
  generateTrackingNumber,
  paginate,
  sendResponse,
  sendError,
  RazorpayUtils,
  ShippingUtils,
  TaxUtils,
  CouponUtils
};