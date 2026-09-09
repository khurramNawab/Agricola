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
  async validateCoupon(code, subtotal, _userId) {
    const coupons = {
      'SAVE10': {
        type: 'percentage',
        discount: 10,
        minOrder: 200,
        maxDiscount: 100,
        validUntil: '2025-12-31'
      },
      'FLAT50': {
        type: 'fixed',
        discount: 50,
        minOrder: 300,
        maxDiscount: 50,
        validUntil: '2025-12-31'
      },
      'NEWUSER': {
        type: 'percentage',
        discount: 15,
        minOrder: 100,
        maxDiscount: 150,
        validUntil: '2025-12-31',
        firstOrderOnly: true
      },
      'WELCOME20': {
        type: 'percentage',
        discount: 20,
        minOrder: 500,
        maxDiscount: 200,
        validUntil: '2025-12-31'
      }
    };

    const coupon = coupons[code.toUpperCase()];
    
    if (!coupon) {
      return { 
        valid: false, 
        message: 'Invalid coupon code',
        code: 'INVALID_COUPON'
      };
    }

    // Check validity date
    if (new Date() > new Date(coupon.validUntil)) {
      return { 
        valid: false, 
        message: 'Coupon has expired',
        code: 'EXPIRED_COUPON'
      };
    }

    // Check minimum order amount
    if (subtotal < coupon.minOrder) {
      return { 
        valid: false, 
        message: `Minimum order amount of ₹${coupon.minOrder} required`,
        code: 'MIN_ORDER_NOT_MET'
      };
    }

    // Calculate discount
    let discount = coupon.type === 'percentage' 
      ? Math.round(subtotal * coupon.discount / 100)
      : coupon.discount;

    // Apply maximum discount limit
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }

    return { 
      valid: true, 
      discount,
      type: coupon.type,
      percentage: coupon.type === 'percentage' ? coupon.discount : null,
      code: code.toUpperCase(),
      description: `${coupon.type === 'percentage' ? coupon.discount + '%' : '₹' + coupon.discount} off`
    };
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