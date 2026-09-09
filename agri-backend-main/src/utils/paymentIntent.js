// Starts (or restarts) the gateway payment for an order and returns the
// payment intent the frontend needs. Shared by POST /orders and /payments/initiate.
const { isConfigured, createOrder } = require('./razorpayClient');

/**
 * @param {object} order - a saved Order document
 * @returns {Promise<object>} payment intent: { gateway, redirectUrl, ... }
 * @throws Error with .statusCode/.code on unsupported method or unconfigured gateway
 */
const initiateOrderPayment = async (order) => {
  if (order.paymentMethod === 'cod') {
    return { gateway: 'cod', redirectUrl: null, status: 'pending' };
  }

  if (order.paymentMethod !== 'razorpay') {
    const e = new Error(`Payment method '${order.paymentMethod}' is not supported`);
    e.statusCode = 400;
    e.code = 'UNSUPPORTED_PAYMENT_METHOD';
    throw e;
  }

  if (!isConfigured()) {
    const e = new Error('Razorpay is not configured on the server');
    e.statusCode = 503;
    e.code = 'PAYMENT_GATEWAY_UNCONFIGURED';
    throw e;
  }

  const rzpOrder = await createOrder({
    amountRupees: order.pricing.total,
    receipt: order.orderId,
    notes: { order_id: order._id.toString(), user_id: order.user.toString() }
  });

  order.paymentDetails = order.paymentDetails || {};
  order.paymentDetails.razorpayOrderId = rzpOrder.id;
  await order.save();

  return {
    gateway: 'razorpay',
    redirectUrl: null, // Razorpay uses a client-side checkout handshake, not a redirect
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    key: process.env.RAZORPAY_KEY_ID
  };
};

module.exports = { initiateOrderPayment };
