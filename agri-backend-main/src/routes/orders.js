const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { buildSummary } = require('../utils/pricing');
const { initiateOrderPayment } = require('../utils/paymentIntent');
const mailer = require('../utils/email');
const shipping = require('../utils/shipping');
const { CouponUtils } = require('../utils/helpers');
const { streamInvoice } = require('../utils/invoice');

const ALLOWED_PAYMENT_METHODS = ['razorpay', 'cod'];

// Map a spec-shaped address object/Address doc to the Order's embedded shape
const toEmbeddedAddress = (a) => {
  const street = [a.house, a.address, a.locality].filter(Boolean).join(', ');
  return {
    name: a.name,
    phone: a.mobile || a.phone,
    street: street || a.address || a.street,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country || 'India'
  };
};

// Order response shape: { orderId, status, paymentStatus, paymentMethod,
// pricing, items, address, timeline, createdAt }
const toOrder = (order) => {
  const o = typeof order.toObject === 'function' ? order.toObject() : order;
  return {
    id: String(o._id),
    orderId: o.orderId,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    pricing: {
      subtotal: o.pricing?.subtotal || 0,
      discount: o.pricing?.discount || 0,
      charges: o.pricing?.shipping || 0,
      total: o.pricing?.total || 0
    },
    items: (o.items || []).map((i) => ({
      productId: i.product?.productId || (i.product ? String(i.product) : null),
      title: i.name,
      weight: i.weight || null,
      price: i.price,
      qty: i.quantity,
      image: i.image || '',
      subtotal: i.subtotal
    })),
    address: o.shippingAddress,
    shipping: {
      carrier: o.shipping?.carrier || null,
      trackingNumber: o.shipping?.trackingNumber || null,
      trackingUrl: o.shipping?.trackingUrl || null,
      estimatedDelivery: o.shipping?.estimatedDelivery || null
    },
    timeline: (o.timeline || []).map((t) => ({ status: t.status, message: t.message, at: t.timestamp })),
    createdAt: o.createdAt
  };
};

// Timeline statuses that are internal/diagnostic and must NOT be shown to
// customers on the public track page (e.g. shipment-booking failures with raw
// HTTP error text). Admins still see the full timeline elsewhere.
const INTERNAL_TIMELINE_STATUSES = new Set(['shipment_failed']);
const customerTimeline = (timeline) =>
  (timeline || []).filter((t) => !INTERNAL_TIMELINE_STATUSES.has(t.status));

// @desc    Place an order (creates order + returns payment intent)
// @route   POST /api/v1/orders
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const { items, shippingAddressId, billingAddress, paymentMethod, discountCode, notes, email } = req.body;

    if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: { code: 'UNSUPPORTED_PAYMENT_METHOD', message: `paymentMethod must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}` }
      });
    }

    // Email is mandatory at checkout — order confirmation + updates are sent here.
    const contactEmail = String(email || '').trim().toLowerCase();
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A valid email is required to send your order details' }
      });
    }

    // Resolve shipping address (must belong to the user)
    if (!shippingAddressId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'shippingAddressId is required' } });
    }
    const addressDoc = await Address.findOne({ _id: shippingAddressId, user: req.user._id });
    if (!addressDoc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shipping address not found' } });
    }
    const shippingAddress = toEmbeddedAddress(addressDoc);

    // Guard: refuse orders to pincodes NEITHER carrier can deliver to, and remember
    // which one covers it so the shipment is booked with that carrier. Fails open on
    // any provider error so an outage never blocks checkout. (Note: this uses the
    // serviceability APIs, which can't catch pincodes that report serviceable yet fail
    // at booking — those are handled post-payment.)
    let coveringProvider = null;
    if (shipping.anyConfigured()) {
      try {
        const serv = await shipping.getCoverage(addressDoc.pincode);
        if (serv && !serv.serviceable) {
          return res.status(400).json({
            success: false,
            error: { code: 'PINCODE_NOT_SERVICEABLE', message: 'Sorry, we can’t deliver to this pincode yet.' }
          });
        }
        coveringProvider = serv?.provider || null;
      } catch (servErr) {
        console.error('Serviceability guard skipped:', servErr.message);
      }
    }

    // billingAddress: "same" | { ...Address }
    let billing;
    if (!billingAddress || billingAddress === 'same') {
      billing = { ...shippingAddress, sameAsShipping: true };
    } else if (typeof billingAddress === 'object') {
      billing = { ...toEmbeddedAddress(billingAddress), sameAsShipping: false };
    } else {
      billing = { ...shippingAddress, sameAsShipping: true };
    }

    // Server-side pricing + stock validation (live carrier rate to the destination)
    const summary = await buildSummary({
      items,
      discountCode,
      userId: req.user._id,
      toPincode: addressDoc.pincode,
      serviceType: req.body.serviceType
    });

    // Reserve stock now ONLY for COD (placed immediately). Razorpay orders decrement
    // at payment success (fulfillPaidOrder in payments.js), so a cancelled/failed
    // payment never consumes stock. buildSummary already validated availability above.
    if (paymentMethod === 'cod') {
      const globalSetting = await Setting.findOne({ key: 'global_config' });
      if (globalSetting && globalSetting.enableCod === false) {
        return res.status(400).json({
          success: false,
          error: { code: 'COD_DISABLED', message: 'Cash on Delivery is currently disabled by store management.' }
        });
      }
      if (globalSetting && globalSetting.maxCodAmount && summary.total > globalSetting.maxCodAmount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COD_LIMIT_EXCEEDED',
            message: `Cash on Delivery is only available for orders up to ₹${globalSetting.maxCodAmount.toLocaleString('en-IN')}. Please pay online.`
          }
        });
      }

      const decremented = [];
      try {
        for (const line of summary.items) {
          const result = await Product.updateOne(
            { _id: line.product._id, stock: { $gte: line.qty }, status: 'active' },
            { $inc: { stock: -line.qty } }
          );
          if (line.weight) {
            await Product.updateOne(
              { _id: line.product._id, 'variantStocks.size': line.weight },
              { $inc: { 'variantStocks.$.stock': -line.qty } }
            );
          }
          if (result.modifiedCount !== 1) {
            throw Object.assign(new Error(`Insufficient stock for ${line.name}`), {
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK'
            });
          }
          decremented.push(line);
        }
      } catch (stockErr) {
        // Roll back any decrements already applied
        for (const line of decremented) {
          await Product.updateOne({ _id: line.product._id }, { $inc: { stock: line.qty } });
        }
        throw stockErr;
      }
    }

    // Build + save the order
    const order = new Order({
      user: req.user._id,
      email: contactEmail,
      items: summary.items.map((i) => ({
        product: i.product._id,
        name: i.name,
        weight: i.weight,
        price: i.price,
        quantity: i.qty,
        image: i.image,
        subtotal: i.subtotal
      })),
      shippingAddress,
      billingAddress: billing,
      pricing: {
        subtotal: summary.subtotal,
        shipping: summary.charges,
        tax: 0,
        discount: summary.discount,
        total: summary.total
      },
      paymentMethod,
      status: 'pending',
      paymentStatus: 'pending',
      // Carrier that covers this pincode; booking (auto or admin) uses it.
      shipping: coveringProvider ? { provider: coveringProvider } : undefined,
      coupon: summary.discountInfo
        ? { code: summary.discountInfo.code, discount: summary.discount, type: summary.discountInfo.type }
        : undefined,
      appliedCoupons: Array.isArray(summary.appliedCoupons) && summary.appliedCoupons.length > 0
        ? summary.appliedCoupons.map((c) => ({
            code: c.code,
            discount: c.discount,
            type: c.type,
            discountValue: c.discountValue
          }))
        : undefined,
      notes: { customer: notes?.customer || '' }
    });
    await order.save();

    // Always sync customer name and email to user profile so admin Customers section shows real customer name
    const customerName = (shippingAddress?.name || req.body?.name || '').trim();
    const updateFields = {};
    if (customerName && customerName !== '—' && customerName !== 'Customer') {
      updateFields.name = customerName;
    }
    if (!req.user.email && contactEmail) {
      updateFields.email = contactEmail.trim().toLowerCase();
    }
    if (Object.keys(updateFields).length > 0) {
      await User.findByIdAndUpdate(req.user._id, { $set: updateFields });
    }

    // Start payment. If the gateway isn't configured, keep the order but
    // surface that payment couldn't be initiated (dev-friendly).
    let payment = null;
    let warning;
    try {
      payment = await initiateOrderPayment(order);
    } catch (payErr) {
      if (payErr.code === 'PAYMENT_GATEWAY_UNCONFIGURED') {
        warning = payErr.message;
      } else {
        throw payErr;
      }
    }

    // For COD the order is placed immediately: clear the cart + email now. Razorpay
    // clears the cart + emails on payment success (fulfillPaidOrder), so a cancelled or
    // failed payment never empties the cart or places an order.
    if (paymentMethod === 'cod') {
      await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
      if (Array.isArray(order.appliedCoupons) && order.appliedCoupons.length > 0) {
        for (const ac of order.appliedCoupons) {
          if (ac.code) {
            await CouponUtils.recordRedemption(ac.code, req.user._id, order.orderId, ac.discount);
          }
        }
      } else if (order.coupon?.code) {
        await CouponUtils.recordRedemption(order.coupon.code, req.user._id, order.orderId, order.pricing?.discount);
      }
      await mailer.sendOrderConfirmation(order);
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { orderId: order.orderId, id: String(order._id), payment, order: toOrder(order) },
      ...(warning && { warning })
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    }
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } });
  }
});

// @desc    Get logged-in user's orders
// @route   GET /api/v1/orders (alias: /api/v1/orders/my-orders)
// @access  Private
router.get(['/', '/my-orders'], authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sort = '-createdAt' } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = String(status);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const orders = await Order.find(query)
      .populate('items.product', 'name images productId')
      .sort(String(sort))
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders.map(toOrder),
      pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } });
  }
});

// @desc    Track an order by orderId + mobile (guest-friendly)
// @route   POST /api/v1/orders/track
// @access  Public
router.post('/track', async (req, res) => {
  try {
    const { orderId, mobile } = req.body;
    if (!orderId || !mobile) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId and mobile are required' } });
    }

    const local = String(mobile).replace(/\D/g, '').slice(-10);
    const order = await Order.findOne({ orderId: String(orderId).trim() })
      .populate('items.product', 'name images productId');

    // Match the mobile against the shipping address phone (stored as 10-digit or +91)
    const orderPhone = order ? String(order.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10) : null;

    if (!order || orderPhone !== local) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No order found for those details' } });
    }

    const shaped = toOrder(order);
    res.status(200).json({
      success: true,
      data: {
        orderId: shaped.orderId,
        status: shaped.status,
        shipping: shaped.shipping,
        timeline: customerTimeline(shaped.timeline),
        items: shaped.items,
        address: shaped.address
      }
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to track order' } });
  }
});

// @desc    Get order by ID (own order, or any if admin)
// @route   GET /api/v1/orders/:id
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') query.user = req.user._id;

    const order = await Order.findOne(query)
      .populate('items.product', 'name images productId')
      .populate('user', 'name email phone userId');

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    res.status(200).json({ success: true, data: toOrder(order) });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch order' } });
  }
});

// @desc    Download official PDF invoice for order (accessible to customer who placed it, or admin)
// @route   GET /api/v1/orders/:id/invoice
// @access  Private
router.get('/:id/invoice', authenticate, async (req, res) => {
  try {
    const rawId = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(rawId);
    const query = isObjectId ? { $or: [{ _id: rawId }, { orderId: rawId }] } : { orderId: rawId };
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const order = await Order.findOne(query)
      .populate('user', 'name email phone userId')
      .populate('warehouse', 'code name address spocName spocPhone');

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.pdf"`);
    streamInvoice(order, res);
  } catch (error) {
    console.error('Customer invoice download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate invoice' } });
    }
  }
});

const { restoreOrderStock } = require('../utils/stock');

// @desc    Cancel an order (restores stock)
// @route   PUT /api/v1/orders/:id/cancel  (PATCH alias kept for compatibility)
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Order cannot be cancelled in its current status' } });
    }

    // Restore stock only if stock was actually decremented (COD orders or paid prepaid orders)
    const wasStockDecremented = order.paymentMethod === 'cod' || order.paymentStatus === 'paid';
    if (wasStockDecremented) {
      await restoreOrderStock(order);
    }

    order.status = 'cancelled';
    order.timeline.push({ status: 'cancelled', message: reason || 'Cancelled by customer', timestamp: new Date(), updatedBy: req.user._id });
    await order.save();

    res.status(200).json({ success: true, data: toOrder(order), message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel order' } });
  }
};
router.put('/:id/cancel', authenticate, cancelOrder);
router.patch('/:id/cancel', authenticate, cancelOrder);

// @desc    Discard an unpaid pending order (e.g. the customer cancelled Razorpay).
//          Only deletes an order that is still pending + unpaid — Razorpay orders
//          reserve no stock, so there's nothing to restore. Paid orders are never
//          deletable here (guarded by the query), which also blocks the race where a
//          payment lands right as the customer closes the modal.
// @route   DELETE /api/v1/orders/:id
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
      paymentStatus: 'pending'
    });
    if (!order) {
      return res.status(409).json({ success: false, error: { code: 'NOT_DISCARDABLE', message: 'Order can no longer be discarded' } });
    }

    // If stock was reserved at placement (COD), restore it upon discarding
    if (order.paymentMethod === 'cod') {
      await restoreOrderStock(order);
    }

    await Order.deleteOne({ _id: order._id });
    res.status(200).json({ success: true, message: 'Order discarded' });
  } catch (error) {
    console.error('Discard order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to discard order' } });
  }
});

// ============ ADMIN ROUTES ============

// @desc    Get all orders (Admin)
// @route   GET /api/v1/orders/admin/all
// @access  Admin
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus, paymentMethod, search, startDate, endDate, sort = '-createdAt' } = req.query;
    const query = {};
    if (status) query.status = String(status);
    if (paymentStatus) query.paymentStatus = String(paymentStatus);
    if (paymentMethod) query.paymentMethod = String(paymentMethod);
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { orderId: { $regex: safe, $options: 'i' } },
        { 'shippingAddress.name': { $regex: safe, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: safe, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const orders = await Order.find(query)
      .populate('user', 'name email userId')
      .populate('items.product', 'name productId')
      .sort(String(sort))
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders.map(toOrder),
      pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } });
  }
});

// @desc    Update order status (Admin)
// @route   PATCH /api/v1/orders/:id/status
// @access  Admin
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, message, trackingNumber, carrier } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const oldStatus = order.status;
    const wasStockDecremented = order.paymentMethod === 'cod' || order.paymentStatus === 'paid';
    if ((status === 'cancelled' || status === 'refunded') && oldStatus !== 'cancelled' && oldStatus !== 'refunded' && wasStockDecremented) {
      await restoreOrderStock(order);
    }
    order.status = status;
    if (message) order.notes.admin = message;
    if (trackingNumber) order.shipping.trackingNumber = trackingNumber;
    if (carrier) order.shipping.carrier = carrier;
    if (status === 'shipped') order.shipping.shippedAt = new Date();
    if (status === 'delivered') order.shipping.deliveredAt = new Date();

    order.timeline.push({ status, message: message || `Order status changed to ${status}`, timestamp: new Date(), updatedBy: req.user._id });
    await order.save();

    res.status(200).json({ success: true, data: toOrder(order), message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } });
  }
});

// @desc    Order analytics (Admin)
// @route   GET /api/v1/orders/analytics/summary
// @access  Admin
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const totalOrders = await Order.countDocuments(dateFilter);
    const ordersByStatus = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const revenueData = await Order.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$pricing.total' }, avgOrderValue: { $avg: '$pricing.total' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        ordersByStatus,
        revenue: revenueData[0] || { totalRevenue: 0, avgOrderValue: 0 }
      }
    });
  } catch (error) {
    console.error('Order analytics error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
  }
});

module.exports = router;
