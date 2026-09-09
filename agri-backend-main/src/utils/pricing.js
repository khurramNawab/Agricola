// Centralised money math so cart, checkout summary, and order creation all
// agree. Produces the { subtotal, discount, charges, total } shape the UI uses.
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { CouponUtils } = require('./helpers');
const shipping = require('./shipping');
const { unitWeightKg } = require('./parcel');

const FREE_SHIPPING_THRESHOLD = parseInt(process.env.FREE_SHIPPING_THRESHOLD) || 500;
const DEFAULT_SHIPPING_COST = parseInt(process.env.DEFAULT_SHIPPING_COST) || 50;

const findProduct = async (productId) => {
  if (mongoose.Types.ObjectId.isValid(productId)) {
    const byId = await Product.findById(productId);
    if (byId) return byId;
  }
  return Product.findOne({ productId });
};

/**
 * Shipping/handling charges. Free-shipping promo applies above the threshold.
 * Otherwise quote a live rate from the configured provider when a destination
 * pincode is known; fall back to the flat fee when it's unconfigured or unavailable.
 *
 * `rate` lets a caller that already has a live quote (e.g. the delivery-quote route,
 * which gets one from getCoverage) reuse it instead of paying for a second lookup —
 * so the threshold rules stay owned by this function only.
 * @returns {Promise<number>}
 */
const computeCharges = async (subtotal, { toPincode, weight, declaredValue, serviceType, rate } = {}) => {
  if (subtotal <= 0) return 0;
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0; // free-shipping promo

  if (rate !== null && rate !== undefined) return rate;

  if (shipping.isConfigured() && toPincode) {
    const quoted = await shipping.getShippingCharge({ toPincode, weight, declaredValue: declaredValue ?? subtotal, serviceType });
    if (quoted !== null && quoted !== undefined) return quoted;
  }
  return DEFAULT_SHIPPING_COST;
};

/**
 * Resolve a list of { productId, weight, qty } against the catalog and compute
 * the full money summary. Throws an Error with `.statusCode`/`.code` on bad input.
 * @returns {Promise<{ items, subtotal, discount, charges, total, discountInfo }>}
 */
const buildSummary = async ({ items, discountCode, userId, toPincode, serviceType } = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Order items are required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const resolved = [];
  let subtotal = 0;
  let totalWeight = 0;

  for (const item of items) {
    const qty = parseInt(item.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      const err = new Error('Each item needs a positive qty');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const product = await findProduct(String(item.productId));
    if (!product) {
      const err = new Error(`Product ${item.productId} not found`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (product.status !== 'active') {
      const err = new Error(`${product.name} is not available`);
      err.statusCode = 400;
      err.code = 'PRODUCT_UNAVAILABLE';
      throw err;
    }
    if (product.stock < qty) {
      const err = new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      err.statusCode = 400;
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }

    const lineTotal = product.price * qty;
    subtotal += lineTotal;
    // kg, from the selected pack size first — reading product.weight.value raw ignored
    // its unit and quoted a 250g product as a 250kg parcel.
    totalWeight += unitWeightKg({ sizeLabel: item.weight, product }) * qty;

    resolved.push({
      product,
      productId: product.productId || String(product._id),
      name: product.name,
      price: product.price,
      weight: item.weight || null,
      qty,
      image: (product.images || []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean)[0] || '',
      subtotal: lineTotal
    });
  }

  // Discount (server-validated; never trust a client-supplied amount)
  let discount = 0;
  let discountInfo = null;
  if (discountCode) {
    const result = await CouponUtils.validateCoupon(String(discountCode), subtotal, userId);
    if (!result.valid) {
      const err = new Error(result.message || 'Invalid discount code');
      err.statusCode = 400;
      err.code = result.code || 'INVALID_DISCOUNT';
      throw err;
    }
    discount = result.discount;
    discountInfo = result;
  }

  const charges = await computeCharges(subtotal, { toPincode, weight: totalWeight, declaredValue: subtotal, serviceType });
  const total = Math.max(0, subtotal - discount + charges);

  return { items: resolved, subtotal, discount, charges, total, discountInfo, weight: totalWeight };
};

module.exports = {
  buildSummary,
  computeCharges,
  findProduct,
  FREE_SHIPPING_THRESHOLD,
  DEFAULT_SHIPPING_COST
};
