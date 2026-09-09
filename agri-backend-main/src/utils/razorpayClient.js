// Thin wrapper around the Razorpay SDK shared by orders.js and payments.js.
// Treats placeholder keys as "not configured" so local dev degrades gracefully.
const Razorpay = require('razorpay');
const crypto = require('crypto');

let instance = null;

const isConfigured = () => {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return !!(id && secret && !id.startsWith('your-') && !secret.startsWith('your-'));
};

const getClient = () => {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return instance;
};

/**
 * Create a Razorpay order. `amountRupees` is in rupees and converted to paise.
 */
const createOrder = async ({ amountRupees, receipt, notes }) =>
  getClient().orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
    notes: notes || {},
    payment_capture: 1
  });

/**
 * Verify the checkout handshake signature (order_id|payment_id).
 * Uses a constant-time comparison.
 */
const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
};

/**
 * Verify a webhook payload signature against the raw body Buffer/string.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
  } catch {
    return false;
  }
};

module.exports = {
  isConfigured,
  getClient,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature
};
