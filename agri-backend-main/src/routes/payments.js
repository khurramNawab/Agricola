const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { initiateOrderPayment } = require('../utils/paymentIntent');
const { verifyWebhookSignature } = require('../utils/razorpayClient');
const shipping = require('../utils/shipping');
const email = require('../utils/email');
const mongoose = require('mongoose');

// Best-effort shipment booking after a payment succeeds. Never throws: a fulfilment
// failure must not break payment confirmation (it can be retried by an admin via
// POST /shipping/create-shipment).
const autoCreateShipment = async (order) => {
  try {
    if (process.env.AUTO_CREATE_SHIPMENT !== 'true') return;
    if (process.env.ENABLE_MULTI_WAREHOUSE === 'true' && order.awaitingWarehouseAssignment) return;
    if (!shipping.isConfigured()) return;
    if (order.shipping?.trackingNumber) return; // already shipped

    await order.populate('items.product', 'name productId weight dimensions');
    // Book with the carrier that covers this pincode (stamped at order creation).
    const shipment = await shipping.createShipment(order, { provider: shipping.providerOfOrder(order) });

    shipping.applyShipment(order, shipment);
    order.status = 'processing';
    order.timeline.push({
      status: 'shipment_created',
      message: `Shipment auto-created with ${shipment.carrier}. AWB: ${shipment.awbNumber}`,
      timestamp: new Date()
    });
    await order.save();
  } catch (error) {
    console.error(`Auto shipment creation failed for order ${order.orderId}:`, error.message);
    // Record the failure on the order so an admin can see it needs manual booking,
    // instead of it silently sitting at 'confirmed'. order.status is left unchanged
    // (timeline.status is free-form and doesn't touch the status enum). Best-effort.
    try {
      order.timeline.push({
        status: 'shipment_failed',
        message: `Auto shipment creation failed: ${error.message}`.slice(0, 500),
        timestamp: new Date()
      });
      await order.save();
    } catch (saveError) {
      console.error(`Could not record shipment failure for order ${order.orderId}:`, saveError.message);
    }
  }
};

/**
 * Idempotently fulfil an order after a successful payment. Atomically claims the
 * pending→paid transition (so the client verify and the webhook can't both run the
 * work), then decrements stock, clears the cart, and updates user stats — EXACTLY
 * ONCE. Returns the fulfilled order if THIS call did the work, else null.
 *
 * Stock is deliberately NOT reserved at order creation for Razorpay orders, so a
 * cancelled/failed payment never consumes stock or "places" an order.
 */
const fulfillPaidOrder = async (orderId, { razorpayPaymentId, razorpaySignature } = {}) => {
  const set = { paymentStatus: 'paid', status: 'confirmed' };
  if (razorpayPaymentId) set['paymentDetails.razorpayPaymentId'] = razorpayPaymentId;
  if (razorpaySignature) set['paymentDetails.razorpaySignature'] = razorpaySignature;

  // Atomic claim — only the first caller flips paymentStatus away from unpaid.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: 'paid' } },
    { $set: set },
    { new: true }
  ).populate('items.product', 'name weight dimensions stock');
  if (!order) return null; // already fulfilled by the other path

  // Decrement stock now. If a line is short (rare concurrent oversell), log it — the
  // payment already succeeded, so an admin reconciles rather than failing the customer.
  for (const item of order.items) {
    const pid = item.product?._id || item.product;
    const r = await Product.updateOne({ _id: pid, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });
    if (r.modifiedCount !== 1) {
      console.error(`[fulfill] ${order.orderId}: stock short for "${item.name}" — needs manual review`);
    }
  }

  await Cart.updateOne({ user: order.user }, { $set: { items: [] } });
  await User.findByIdAndUpdate(order.user, { $inc: { orders: 1, totalSpent: order.pricing.total } });

  order.timeline.push({ status: 'confirmed', message: 'Payment received — order confirmed', timestamp: new Date() });
  await order.save();
  return order;
};

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay order
// @route   POST /api/v1/payments/create-order
// @access  Private
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      coupon,
      notes
    } = req.body;

    const userId = req.user._id;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Order items are required'
        }
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Shipping address is required'
        }
      });
    }

    // Validate and calculate order total
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Product ${item.product} not found`
          }
        });
      }

      if (product.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Product ${product.name} is not available`
          }
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
          }
        });
      }

      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;

      processedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0]?.url || '',
        subtotal: itemSubtotal
      });
    }

    // Calculate shipping, tax, and discount
    const shipping = calculateShipping(subtotal, shippingAddress);
    const tax = calculateTax(subtotal);
    let discount = 0;

    // Apply coupon if provided
    if (coupon) {
      const couponValidation = await validateCoupon(coupon.code, subtotal);
      if (couponValidation.valid) {
        discount = couponValidation.discount;
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: couponValidation.message
          }
        });
      }
    }

    const total = subtotal + shipping + tax - discount;

    // Create order in database first
    const order = new Order({
      user: userId,
      items: processedItems,
      shippingAddress,
      billingAddress: billingAddress || { ...shippingAddress, sameAsShipping: true },
      pricing: {
        subtotal,
        shipping,
        tax,
        discount,
        total
      },
      paymentMethod: 'razorpay',
      status: 'pending',
      paymentStatus: 'pending',
      coupon,
      notes: {
        customer: notes?.customer || ''
      }
    });

    await order.save();

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // Amount in paise
      currency: 'INR',
      receipt: order.orderId,
      notes: {
        order_id: order._id.toString(),
        user_id: userId.toString()
      }
    });

    // Update order with Razorpay order ID
    order.paymentDetails.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(201).json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderId: order.orderId,
          total: order.pricing.total,
          items: order.items.length
        },
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        },
        user: {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone
        }
      },
      message: 'Payment order created successfully'
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create payment order'
      }
    });
  }
});

// @desc    Verify Razorpay payment
// @route   POST /api/v1/payments/verify
// @access  Private
router.post('/verify', authenticate, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Payment verification details are required'
        }
      });
    }

    // Find order by Razorpay order ID
    const order = await Order.findOne({
      'paymentDetails.razorpayOrderId': razorpay_order_id,
      user: req.user._id
    }).populate('items.product', 'name stock');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Payment verification failed
      order.paymentStatus = 'failed';
      order.timeline.push({
        status: 'payment_failed',
        message: 'Payment verification failed',
        timestamp: new Date()
      });
      await order.save();

      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_VERIFICATION_FAILED',
          message: 'Payment verification failed'
        }
      });
    }

    // Signature is valid — fulfil idempotently. Stock decrement + cart clear + confirm
    // happen HERE (not at order creation), so a cancelled/failed payment never consumes
    // stock or places an order. Race-safe against the webhook: only the first path wins.
    const fulfilled = await fulfillPaidOrder(order._id, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });
    if (fulfilled) {
      await autoCreateShipment(fulfilled);
      await email.sendOrderConfirmation(fulfilled);
      try {
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        fulfilled.paymentDetails.transactionId = paymentDetails.id;
        await fulfilled.save();
      } catch (paymentFetchError) {
        console.error('Error fetching payment details:', paymentFetchError.message);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderId: order.orderId,
          status: 'confirmed',
          paymentStatus: 'paid',
          total: order.pricing.total
        },
        payment: {
          razorpayPaymentId: razorpay_payment_id,
          amount: order.pricing.total
        }
      },
      message: 'Payment verified successfully'
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Payment verification failed'
      }
    });
  }
});

// @desc    Initiate (or restart) gateway payment for an existing order
// @route   POST /api/v1/payments/initiate
// @access  Private
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId is required' } });
    }

    // Accept either Mongo _id or human orderId, scoped to the user
    const query = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId, user: req.user._id }
      : { orderId: String(orderId), user: req.user._id };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_PAID', message: 'Order is already paid' } });
    }

    const payment = await initiateOrderPayment(order);
    res.status(200).json({ success: true, data: { orderId: order.orderId, payment } });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    }
    console.error('Initiate payment error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate payment' } });
  }
});

// @desc    Poll payment status for an order
// @route   GET /api/v1/payments/:id/status
// @access  Private
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, user: req.user._id }
      : { orderId: String(id), user: req.user._id };
    const order = await Order.findOne(query).select('orderId status paymentStatus pricing.total paymentDetails.razorpayPaymentId');

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        amount: order.pricing.total,
        razorpayPaymentId: order.paymentDetails?.razorpayPaymentId || null
      }
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment status' } });
  }
});

// @desc    Get payment details
// @route   GET /api/v1/payments/:paymentId
// @access  Private
router.get('/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Find order by payment ID
    const order = await Order.findOne({
      $or: [
        { 'paymentDetails.razorpayPaymentId': paymentId },
        { 'paymentDetails.transactionId': paymentId }
      ],
      user: req.user._id
    }).populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found'
        }
      });
    }

    // Get detailed payment info from Razorpay if available
    let razorpayPaymentDetails = null;
    if (order.paymentDetails.razorpayPaymentId) {
      try {
        razorpayPaymentDetails = await razorpay.payments.fetch(order.paymentDetails.razorpayPaymentId);
      } catch (error) {
        console.error('Error fetching Razorpay payment details:', error);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          pricing: order.pricing,
          createdAt: order.createdAt
        },
        payment: {
          method: order.paymentMethod,
          details: order.paymentDetails,
          razorpayDetails: razorpayPaymentDetails
        }
      }
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payment details'
      }
    });
  }
});

// @desc    Razorpay webhook
// @route   POST /api/v1/payments/webhook
// @access  Public
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    // Verify against the raw request body (captured by express.json's verify
    // hook in server.js) using a constant-time comparison.
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        }
      });
    }

    const event = req.body;
    console.log('Razorpay webhook event:', event.event);

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      
      case 'order.paid':
        await handleOrderPaid(event.payload.order.entity);
        break;
      
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Webhook processing failed'
      }
    });
  }
});

// @desc    Refund payment (Admin only)
// @route   POST /api/v1/payments/:paymentId/refund
// @access  Admin
router.post('/:paymentId/refund', authenticate, requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    // Find order
    const order = await Order.findOne({
      'paymentDetails.razorpayPaymentId': paymentId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found'
        }
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Payment is not in paid status'
        }
      });
    }

    // Create refund in Razorpay
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount ? Math.round(amount * 100) : undefined, // Full refund if amount not specified
      notes: {
        reason: reason || 'Refund requested by admin',
        order_id: order.orderId
      }
    });

const { restoreOrderStock } = require('../utils/stock');

    // Restore stock on refund
    if (order.status !== 'refunded' && order.status !== 'cancelled') {
      await restoreOrderStock(order);
    }

    // Update order status
    order.paymentStatus = amount ? 'partially_refunded' : 'refunded';
    if (!amount || amount >= order.pricing.total) {
      order.status = 'refunded';
    }
    
    order.timeline.push({
      status: 'refund_processed',
      message: `Refund of ₹${amount || order.pricing.total} processed. Reason: ${reason || 'Admin refund'}`,
      timestamp: new Date(),
      updatedBy: req.user._id
    });

    await order.save();

    res.status(200).json({
      success: true,
      data: {
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status
        },
        order: {
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      },
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFUND_FAILED',
        message: error.message || 'Failed to process refund'
      }
    });
  }
});

// @desc    Get payment analytics (Admin only)
// @route   GET /api/v1/payments/analytics/summary
// @access  Admin
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Payment status summary
    const paymentStats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.total' }
        }
      }
    ]);

    // Payment method summary
    const paymentMethods = await Order.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.total' }
        }
      }
    ]);

    // Daily revenue
    const dailyRevenue = await Order.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        paymentStats,
        paymentMethods,
        dailyRevenue
      }
    });
  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payment analytics'
      }
    });
  }
});

// Helper functions
async function handlePaymentCaptured(payment) {
  try {
    const existing = await Order.findOne({ 'paymentDetails.razorpayOrderId': payment.order_id }).select('_id');
    if (!existing) return;
    const order = await fulfillPaidOrder(existing._id, { razorpayPaymentId: payment.id });
    if (order) {
      await autoCreateShipment(order);
      await email.sendOrderConfirmation(order);
    }
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(payment) {
  try {
    const order = await Order.findOne({
      'paymentDetails.razorpayOrderId': payment.order_id
    });

    if (order) {
      order.paymentStatus = 'failed';
      
      order.timeline.push({
        status: 'payment_failed',
        message: 'Payment failed via webhook',
        timestamp: new Date()
      });

      await order.save();
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleOrderPaid(orderEntity) {
  try {
    const existing = await Order.findOne({ 'paymentDetails.razorpayOrderId': orderEntity.id }).select('_id');
    if (!existing) return;
    const order = await fulfillPaidOrder(existing._id);
    if (order) {
      await autoCreateShipment(order);
      await email.sendOrderConfirmation(order);
    }
  } catch (error) {
    console.error('Error handling order paid:', error);
  }
}

function calculateShipping(subtotal, address) {
  // Basic shipping calculation logic
  if (subtotal >= 500) return 0; // Free shipping over ₹500
  
  // Different rates based on location
  const metropolitanCities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'pune', 'chennai', 'kolkata'];
  const city = address.city.toLowerCase();
  
  if (metropolitanCities.includes(city)) {
    return 50; // ₹50 for metro cities
  } else {
    return 100; // ₹100 for other cities
  }
}

function calculateTax(subtotal) {
  // GST calculation - 18% for most food items
  return Math.round(subtotal * 0.18);
}

async function validateCoupon(code, subtotal) {
  // Placeholder coupon validation
  // In real implementation, you would check against a coupons collection
  const validCoupons = {
    'SAVE10': { type: 'percentage', discount: 10, minOrder: 200 },
    'FLAT50': { type: 'fixed', discount: 50, minOrder: 300 },
    'NEWUSER': { type: 'percentage', discount: 15, minOrder: 100 }
  };

  const coupon = validCoupons[code.toUpperCase()];
  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  if (subtotal < coupon.minOrder) {
    return { 
      valid: false, 
      message: `Minimum order amount of ₹${coupon.minOrder} required for this coupon` 
    };
  }

  const discount = coupon.type === 'percentage' 
    ? Math.round(subtotal * coupon.discount / 100)
    : coupon.discount;

  return { valid: true, discount };
}

module.exports = router;