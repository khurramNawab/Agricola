const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const shipping = require('../utils/shipping');
const { findProduct, computeCharges, FREE_SHIPPING_THRESHOLD } = require('../utils/pricing');
const { unitWeightKg } = require('../utils/parcel');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

// Shared by the serviceability + quote routes.
const cleanPincode = (value) => String(value || '').replace(/\D/g, '');
const isValidPincode = (pincode) => /^[1-9][0-9]{5}$/.test(pincode);

// @desc    Calculate shipping cost (live carrier estimate, flat-rate fallback)
// @route   POST /api/v1/shipping/calculate
// @access  Private
router.post('/calculate', authenticate, async (req, res) => {
  try {
    const { items, fromPincode, toPincode, weight, dimensions, declaredValue } = req.body;

    if (!toPincode) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Destination pincode (toPincode) is required' }
      });
    }

    let totalWeight = Number(weight) || 0;
    let totalValue = Number(declaredValue) || 0;
    if (Array.isArray(items)) {
      for (const item of items) {
        totalWeight += (item.weight?.value || 0.5) * (item.quantity || 1);
        totalValue += (item.price || 0) * (item.quantity || 1);
      }
    }
    if (!totalWeight) totalWeight = 0.5;

    const standardCharge = shipping.isConfigured()
      ? await shipping.getShippingCharge({
          fromPincode,
          toPincode,
          weight: totalWeight,
          declaredValue: totalValue,
          dimensions,
          serviceType: 'SURFACE'
        })
      : null;

    if (standardCharge !== null && standardCharge !== undefined) {
      return res.status(200).json({
        success: true,
        data: {
          rates: [
            {
              serviceType: 'standard',
              serviceName: 'Standard Delivery',
              cost: standardCharge,
              transitTime: '3-5 business days'
            }
          ],
          calculation: { weight: totalWeight, declaredValue: totalValue, fromPincode, toPincode }
        }
      });
    }

    // Fallback when the provider is unconfigured or the estimate call failed.
    return res.status(200).json({
      success: true,
      data: {
        rates: calculateFallbackShipping({ fromPincode, toPincode, weight: totalWeight, declaredValue: totalValue }),
        fallback: true,
        message: 'Using estimated shipping rates'
      }
    });
  } catch (error) {
    console.error('Shipping calculation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CALCULATION_FAILED', message: 'Failed to calculate shipping' }
    });
  }
});

// @desc    Check if a pincode is serviceable by EITHER carrier (address entry / checkout)
// @route   GET /api/v1/shipping/serviceability/:pincode
// @access  Public
// NOTE: this reflects the carriers' serviceability APIs, which can differ from what
// booking accepts (some pincodes report serviceable yet fail at booking). It catches
// genuinely un-serviceable pincodes; it is not a guarantee of booking.
router.get('/serviceability/:pincode', async (req, res) => {
  const pincode = cleanPincode(req.params.pincode);
  try {
    if (!isValidPincode(pincode)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid 6-digit pincode' } });
    }
    // Fail open: if we can't verify (no carrier configured), don't block the user.
    if (!shipping.anyConfigured()) {
      return res.status(200).json({ success: true, data: { pincode, serviceable: true, unverified: true } });
    }
    const serv = await shipping.getCoverage(pincode);
    return res.status(200).json({
      success: true,
      data: {
        pincode,
        serviceable: serv.serviceable,
        city: serv.city,
        state: serv.state,
        cod: serv.cod,
        provider: serv.provider,
        eta: serv.eta,
        ...(serv.unverified ? { unverified: true } : {})
      }
    });
  } catch (error) {
    console.error('Serviceability check error:', error.message);
    // Provider error must not block checkout — treat as serviceable-but-unverified.
    return res.status(200).json({ success: true, data: { pincode, serviceable: true, unverified: true } });
  }
});

// @desc    Pre-checkout delivery quote: can we deliver here, by when, for how much
// @route   POST /api/v1/shipping/quote
// @access  Public (guests must be able to check before signing in)
// Body: { pincode, items?: [{ productId, qty }] }
// `items` are resolved against the catalog server-side (prices are never trusted from
// the client, same contract as POST /checkout/summary); without them the answer is
// coverage-only and `delivery` is omitted.
router.post('/quote', optionalAuth, async (req, res) => {
  const pincode = cleanPincode(req.body?.pincode);
  try {
    if (!isValidPincode(pincode)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid 6-digit pincode' } });
    }

    // Resolve the cart, ignoring anything that no longer exists rather than failing the
    // quote — this is a delivery question, not an order validation.
    let subtotal = 0;
    let weight = 0;
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    for (const item of items) {
      const qty = parseInt(item?.qty, 10);
      if (!Number.isInteger(qty) || qty < 1) continue;
      const product = await findProduct(String(item.productId));
      if (!product) continue;
      subtotal += product.price * qty;
      // Same weight rule as checkout/booking: selected pack size first (utils/parcel).
      weight += unitWeightKg({ sizeLabel: item.weight, product }) * qty;
    }
    const hasCart = subtotal > 0;

    if (!shipping.anyConfigured()) {
      return res.status(200).json({ success: true, data: { pincode, serviceable: true, unverified: true, delivery: null } });
    }

    const coverage = await shipping.getCoverage(pincode, hasCart ? { weight, declaredValue: subtotal } : {});

    let delivery = null;
    if (hasCart && coverage.serviceable) {
      // computeCharges owns the free-shipping/flat-fee rules; feed it the rate we just
      // quoted so the number shown here is the number checkout will charge.
      const charge = await computeCharges(subtotal, {
        toPincode: pincode,
        weight,
        declaredValue: subtotal,
        rate: coverage.charge
      });
      delivery = { charge, free: charge === 0, freeShippingThreshold: FREE_SHIPPING_THRESHOLD };
    }

    return res.status(200).json({
      success: true,
      data: {
        pincode,
        serviceable: coverage.serviceable,
        city: coverage.city,
        state: coverage.state,
        cod: coverage.cod,
        provider: coverage.provider,
        eta: coverage.eta,
        courierName: coverage.courierName,
        delivery,
        ...(coverage.unverified ? { unverified: true } : {})
      }
    });
  } catch (error) {
    console.error('Delivery quote error:', error.message);
    // Never block the funnel on our own outage.
    return res.status(200).json({ success: true, data: { pincode, serviceable: true, unverified: true, delivery: null } });
  }
});

// @desc    Create shipment with the configured logistics provider
// @route   POST /api/v1/shipping/create-shipment
// @access  Admin
router.post('/create-shipment', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderId, serviceType = 'standard' } = req.body;

    const order = await Order.findById(orderId).populate('items.product', 'name productId weight dimensions');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (order.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Order must be confirmed to create shipment' }
      });
    }
    if (order.shipping?.trackingNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_SHIPPED', message: 'A shipment already exists for this order' }
      });
    }

    // Book with the carrier that covers this pincode (stamped at order creation),
    // falling back to the active provider.
    const shipment = await shipping.createShipment(order, {
      serviceType,
      provider: shipping.providerOfOrder(order)
    });

    shipping.applyShipment(order, shipment, { serviceType });
    order.status = 'processing';
    order.timeline.push({
      status: 'shipment_created',
      message: `Shipment created with ${shipment.carrier}. Tracking: ${shipment.awbNumber}`,
      timestamp: new Date(),
      updatedBy: req.user._id
    });
    await order.save();

    res.status(201).json({
      success: true,
      data: {
        shipment: {
          id: shipment.shipmentId,
          trackingNumber: shipment.awbNumber,
          vendorWaybill: shipment.vendorWaybill,
          carrier: shipment.carrier,
          courierName: shipment.courierName,
          labelUrl: shipment.labelUrl,
          trackingUrl: shipment.trackingUrl
        },
        order: { orderId: order.orderId, status: order.status }
      },
      message: 'Shipment created successfully'
    });
  } catch (error) {
    console.error('Create shipment error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SHIPMENT_CREATION_FAILED',
        message: error.response?.data?.message || error.message || 'Failed to create shipment'
      }
    });
  }
});

// @desc    Track shipment
// @route   GET /api/v1/shipping/track/:trackingNumber
// @access  Private
router.get('/track/:trackingNumber', authenticate, async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const order = await Order.findOne({
      'shipping.trackingNumber': trackingNumber,
      user: req.user._id
    });
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shipment not found' } });
    }

    try {
      // An AWB must be tracked with the carrier that issued it.
      const tracking = await shipping.trackShipment(trackingNumber, { provider: shipping.providerOfOrder(order) });
      res.status(200).json({
        success: true,
        data: {
          order: { orderId: order.orderId, status: order.status },
          tracking: {
            trackingNumber: tracking.trackingId,
            currentStatus: tracking.status,
            currentLocation: tracking.location,
            estimatedDelivery: tracking.estimatedDelivery,
            events: tracking.events
          }
        }
      });
    } catch (apiError) {
      // Fall back to the order timeline if the carrier API is unavailable.
      res.status(200).json({
        success: true,
        data: {
          order: { orderId: order.orderId, status: order.status },
          tracking: {
            trackingNumber,
            currentStatus: order.status,
            estimatedDelivery: order.shipping.estimatedDelivery,
            events: order.timeline.map((e) => ({
              status: e.status,
              description: e.message,
              timestamp: e.timestamp,
              location: 'Processing Center'
            }))
          },
          fallback: true
        }
      });
    }
  } catch (error) {
    console.error('Track shipment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'TRACKING_FAILED', message: 'Failed to fetch tracking information' }
    });
  }
});

// @desc    Update shipment status manually (Admin only)
// @route   PATCH /api/v1/shipping/:orderId/status
// @access  Admin
router.patch('/:orderId/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, message } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const validShippingStatuses = ['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];
    if (!validShippingStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid shipping status' }
      });
    }

    if (status === 'shipped') {
      order.status = 'shipped';
      order.shipping.shippedAt = new Date();
    } else if (status === 'delivered') {
      order.status = 'delivered';
      order.shipping.deliveredAt = new Date();
    }

    order.timeline.push({
      status,
      message: message || `Shipment status updated to ${status}`,
      timestamp: new Date(),
      updatedBy: req.user._id
    });
    await order.save();

    res.status(200).json({
      success: true,
      data: { order: { orderId: order.orderId, status: order.status, shipping: order.shipping } },
      message: 'Shipping status updated successfully'
    });
  } catch (error) {
    console.error('Update shipping status error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update shipping status' }
    });
  }
});

// @desc    Cancel shipment (Admin only)
// @route   POST /api/v1/shipping/:orderId/cancel
// @access  Admin
router.post('/:orderId/cancel', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (!order.shipping?.trackingNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'No shipment found to cancel' }
      });
    }

    try {
      await shipping.cancelShipment(
        {
          trackingNumber: order.shipping.trackingNumber,
          providerOrderId: order.shipping.providerOrderId,
          providerShipmentId: order.shipping.providerShipmentId,
          provider: shipping.providerOfOrder(order)
        },
        reason || 'Order cancelled by admin'
      );
      order.status = 'cancelled';
      order.timeline.push({
        status: 'shipment_cancelled',
        message: `Shipment cancelled. Reason: ${reason || 'Admin cancellation'}`,
        timestamp: new Date(),
        updatedBy: req.user._id
      });
      await order.save();

      res.status(200).json({
        success: true,
        data: { order: { orderId: order.orderId, status: order.status } },
        message: 'Shipment cancelled successfully'
      });
    } catch (apiError) {
      // Carrier cancellation failed — record a manual cancellation and warn.
      order.status = 'cancelled';
      order.timeline.push({
        status: 'shipment_cancelled',
        message: `Shipment manually cancelled. Reason: ${reason || 'Admin cancellation'}`,
        timestamp: new Date(),
        updatedBy: req.user._id
      });
      await order.save();

      res.status(200).json({
        success: true,
        data: { order: { orderId: order.orderId, status: order.status } },
        message: 'Shipment cancelled successfully (manual)',
        warning: 'Could not cancel with carrier - manual intervention may be required'
      });
    }
  } catch (error) {
    console.error('Cancel shipment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CANCELLATION_FAILED', message: 'Failed to cancel shipment' }
    });
  }
});

// @desc    Get shipping analytics (Admin only)
// @route   GET /api/v1/shipping/analytics/summary
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

    const shippingStats = await Order.aggregate([
      { $match: { ...dateFilter, 'shipping.trackingNumber': { $exists: true } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalShippingCost: { $sum: '$pricing.shipping' } } }
    ]);

    const deliveryTimes = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          status: 'delivered',
          'shipping.shippedAt': { $exists: true },
          'shipping.deliveredAt': { $exists: true }
        }
      },
      {
        $project: {
          deliveryTime: {
            $divide: [{ $subtract: ['$shipping.deliveredAt', '$shipping.shippedAt'] }, 1000 * 60 * 60 * 24]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDeliveryTime: { $avg: '$deliveryTime' },
          minDeliveryTime: { $min: '$deliveryTime' },
          maxDeliveryTime: { $max: '$deliveryTime' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        shippingStats,
        deliveryTimes: deliveryTimes[0] || { avgDeliveryTime: 0, minDeliveryTime: 0, maxDeliveryTime: 0 }
      }
    });
  } catch (error) {
    console.error('Shipping analytics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shipping analytics' }
    });
  }
});

// Map Ekart `swift_status` values (spec v3.8.9) onto our Order.status enum
// ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'].
// Our enum has no 'returned'/'out_for_delivery' state, so RTO-terminal and
// out-for-delivery collapse onto the nearest coarse bucket; the exact swift_status
// is always preserved verbatim in order.timeline below. Statuses not listed here
// (e.g. 'Order Placed', 'In Transit' pre-ship nuances, NDR 'Undelivered',
// 'Shipment Delayed', 'Damaged', RTO-in-progress) intentionally leave order.status
// unchanged and only add a timeline entry.
const STATUS_TO_ORDER = {
  'Picked Up': 'shipped',
  'In Transit': 'shipped',
  'Out for Delivery': 'shipped',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  'Seller Cancelled': 'cancelled',
  'Pickup Cancelled': 'cancelled',
  Lost: 'cancelled',
  // RTO terminal: the parcel came back to us — no 'returned' state exists, so the
  // order is treated as cancelled (refunds remain a separate manual/payment action).
  'RTO Delivered': 'cancelled'
};

// @desc    Ekart webhook handler (track_updated / shipment_created topics)
// @route   POST /api/v1/shipping/webhook
// @access  Public (HMAC verified)
router.post('/webhook', async (req, res) => {
  try {
    // Ekart signs the webhook body with the configured secret (HMAC-SHA256).
    const secret = process.env.EKART_WEBHOOK_SECRET;
    if (secret && !secret.startsWith('your-')) {
      const signature = String(
        req.headers['x-ekart-signature'] || req.headers['x-webhook-signature'] || req.headers['x-hmac-signature'] || ''
      ).trim().toLowerCase();
      const rawBody = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();
      let valid = false;
      try {
        valid = expected.length > 0 && expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        valid = false;
      }
      if (!valid) {

        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' }
        });
      }
    }

    const payload = req.body || {};
    // track_updated payloads carry a `status`; shipment_created/recreated don't.
    if (!payload.status) {
      return res.status(200).json({ success: true });
    }

    // `id` is the Ekart tracking id (matches our stored trackingNumber); `wbn`
    // is the courier waybill — match on either.
    console.log('EKART WEBHOOK LOOKUP ID:', payload.id, 'WBN:', payload.wbn);
    const order = await Order.findOne({
      'shipping.trackingNumber': { $in: [payload.id, payload.wbn].filter(Boolean) }
    });
    console.log('EKART WEBHOOK FOUND ORDER:', order ? { id: order._id, orderId: order.orderId, trackingNumber: order.shipping?.trackingNumber } : null);

    if (!order) {
      return res.status(200).json({ success: true });
    }


    const when = payload.ctime ? new Date(Number(payload.ctime)) : new Date();
    const mapped = STATUS_TO_ORDER[payload.status];
    if (mapped) {
      order.status = mapped;
      if (mapped === 'shipped') order.shipping.shippedAt = payload.pickupTime ? new Date(Number(payload.pickupTime)) : when;
      if (mapped === 'delivered') order.shipping.deliveredAt = when;
    }
    if (payload.edd) order.shipping.estimatedDelivery = new Date(Number(payload.edd));

    order.timeline.push({
      status: String(payload.status),
      message: payload.desc || `Shipment status: ${payload.status}`,
      timestamp: when
    });
    await order.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Ekart webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// Map Shiprocket `current_status` values onto our Order.status enum
// ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'].
// Same shape and caveats as STATUS_TO_ORDER above: we have no 'returned' or
// 'out_for_delivery' state, so those collapse onto the nearest coarse bucket while the
// exact Shiprocket status is preserved verbatim in order.timeline. Statuses not listed
// (NEW, PICKUP SCHEDULED/GENERATED, UNDELIVERED/NDR, SHIPMENT DELAYED, DAMAGED,
// RTO IN TRANSIT) intentionally leave order.status unchanged and only add a timeline entry.
const SHIPROCKET_STATUS_TO_ORDER = {
  'PICKED UP': 'shipped',
  SHIPPED: 'shipped',
  'IN TRANSIT': 'shipped',
  'OUT FOR DELIVERY': 'shipped',
  'REACHED AT DESTINATION HUB': 'shipped',
  DELIVERED: 'delivered',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
  'PICKUP CANCELLED': 'cancelled',
  LOST: 'cancelled',
  // RTO terminal: the parcel came back to us — no 'returned' state exists, so the
  // order is treated as cancelled (refunds remain a separate manual/payment action).
  'RTO DELIVERED': 'cancelled'
};

// @desc    Shiprocket order-status webhook
// @route   POST /api/v1/shipping/webhook/tracking  (alias: /webhook/shiprocket)
// @access  Public (static token verified)
//
// The canonical path is /webhook/tracking: Shiprocket's dashboard refuses to register
// or test a webhook URL containing "shiprocket", "kartrocket", "sr" or "kr", so the
// obvious path is unusable. /webhook/shiprocket stays mounted as an alias.
// Shiprocket does not sign webhook bodies; it replays whatever custom header you
// configure under Settings → API → Webhooks. We compare that header's value against
// SHIPROCKET_WEBHOOK_TOKEN, accepting the header under any of the names Shiprocket
// has been observed to use.
//
// This endpoint mutates order status, so it fails CLOSED: with no token configured it
// refuses every request rather than trusting the caller. (The older Ekart receiver
// above skips verification when its secret is unset — deliberately not copied here.)
router.post(['/webhook/tracking', '/webhook/shiprocket'], async (req, res) => {
  try {
    const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    if (!expected || expected.startsWith('your-')) {
      console.error('Shiprocket webhook rejected: SHIPROCKET_WEBHOOK_TOKEN is not configured');
      return res.status(503).json({
        success: false,
        error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook verification is not configured' }
      });
    }
    const provided = String(
      req.headers['x-api-key'] ||
        req.headers['x-shiprocket-token'] ||
        String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
        ''
    );
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      valid = false; // length mismatch
    }
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook token' }
      });
    }

    const payload = req.body || {};
    const status = payload.current_status || payload.shipment_status;
    if (!status) {
      return res.status(200).json({ success: true });
    }

    // `awb` matches our stored trackingNumber; `channel_order_id` is our own orderId,
    // which still identifies the order if the AWB was reassigned.
    const order = await Order.findOne(
      payload.awb
        ? { 'shipping.trackingNumber': String(payload.awb) }
        : { orderId: String(payload.channel_order_id || '') }
    );
    if (!order) {
      console.log('Shiprocket webhook: no order for', payload.awb || payload.channel_order_id);
      return res.status(200).json({ success: true });
    }

    const when = payload.current_timestamp ? new Date(payload.current_timestamp) : new Date();
    const mapped = SHIPROCKET_STATUS_TO_ORDER[String(status).toUpperCase()];
    if (mapped) {
      order.status = mapped;
      if (mapped === 'shipped' && !order.shipping.shippedAt) order.shipping.shippedAt = when;
      if (mapped === 'delivered') order.shipping.deliveredAt = when;
    }
    if (payload.etd) order.shipping.estimatedDelivery = new Date(payload.etd);
    if (payload.courier_name && !order.shipping.courierName) {
      order.shipping.courierName = payload.courier_name;
    }

    const latestScan = Array.isArray(payload.scans) ? payload.scans[payload.scans.length - 1] : null;
    order.timeline.push({
      status: String(status),
      message: latestScan?.activity || `Shipment status: ${status}`,
      timestamp: when
    });
    await order.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Shiprocket webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// Flat-rate fallback used when the provider is unconfigured or the estimate call fails.
function calculateFallbackShipping({ fromPincode, toPincode, weight = 1 }) {
  const baseRate = 50;
  const weightRate = Math.ceil(weight) * 10;
  const distanceMultiplier = calculateDistanceMultiplier(fromPincode, toPincode);

  const standardCost = Math.round((baseRate + weightRate) * distanceMultiplier);
  const expressCost = Math.round(standardCost * 1.5);

  return [
    {
      serviceType: 'standard',
      serviceName: 'Standard Delivery',
      cost: standardCost,
      transitTime: '3-5 business days',
      description: 'Regular delivery service'
    },
    {
      serviceType: 'express',
      serviceName: 'Express Delivery',
      cost: expressCost,
      transitTime: '1-2 business days',
      description: 'Fast delivery service'
    }
  ];
}

function calculateDistanceMultiplier(fromPincode, toPincode) {
  const from = parseInt(fromPincode);
  const to = parseInt(toPincode);
  if (!from || !to) return 1.2;
  const diff = Math.abs(from - to);
  if (diff < 10000) return 1; // same city
  if (diff < 50000) return 1.2; // same state
  return 1.5; // different state
}

module.exports = router;
