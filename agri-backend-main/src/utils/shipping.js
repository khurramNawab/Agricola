// Logistics provider facade.
//
// The app books, rates, tracks and cancels through this module instead of talking to
// a carrier client directly. SHIPPING_PROVIDER selects the default implementation:
//
//   shiprocket (default) -> utils/shiprocket.js
//   ekart                -> utils/ekart.js       (previous provider, kept for rollback)
//
// Both clients expose the same normalized surface, so switching providers is an env
// change plus a restart — no code change. The env var is read per call so tests can
// flip providers without reloading modules.
//
// Serviceability is the one place we deliberately consult BOTH carriers (getCoverage):
// a pincode either can deliver to is orderable, and the covering provider is recorded
// on the order so the shipment is booked with the carrier that actually covers it.
const ekart = require('./ekart');
const shiprocket = require('./shiprocket');
const { canonicalState, titleCasePlace } = require('./indiaPlaces');

const CLIENTS = { shiprocket, ekart };

const activeName = () =>
  String(process.env.SHIPPING_PROVIDER || 'shiprocket').toLowerCase() === 'ekart' ? 'ekart' : 'shiprocket';

const provider = () => CLIENTS[activeName()];

/**
 * Resolve which client to use for an existing shipment. A parcel booked with one
 * carrier must be tracked and cancelled with that same carrier, whatever
 * SHIPPING_PROVIDER currently says.
 */
const clientFor = (name) => {
  const client = name ? CLIENTS[String(name).toLowerCase()] : null;
  return client && client.isConfigured() ? client : provider();
};

/**
 * The provider that booked an order's shipment. Orders booked before the provider
 * field existed only carry `ekartShipmentId`/`carrier`, so infer Ekart from those.
 */
const providerOfOrder = (order) => {
  const s = order?.shipping || {};
  if (s.provider) return s.provider;
  if (s.ekartShipmentId || s.carrier === 'Ekart') return 'ekart';
  return null;
};

// --- serviceability cache ---------------------------------------------------
// Product page, cart and the checkout address form all hit serviceability, and every
// Shiprocket lookup is a live rate call against their quota. Pincode coverage changes
// rarely, so cache both positive AND negative answers briefly. Process-local is
// enough (single PM2 instance); FIFO-capped so it can't grow unbounded.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

const cacheKey = (name, pincode, { weight, codAmount } = {}) =>
  // Bucket the weight to the 0.5kg step carriers bill in, so similar carts share an entry.
  `${name}:${pincode}:${Math.ceil((Number(weight) || 0.5) / 0.5)}:${Number(codAmount) > 0 ? 1 : 0}`;

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * Serviceability across BOTH carriers, active provider first.
 *
 * Short-circuits on the first provider that covers the pincode, so the fallback
 * carrier is only contacted when the primary says no or errors — a misconfigured or
 * unauthenticated secondary costs nothing on the happy path.
 *
 * Fails OPEN: if no provider could answer at all, the pincode is reported serviceable
 * but `unverified`, so a carrier outage never blocks the funnel.
 *
 * @param {string|number} pincode
 * @param {{weight?:number, declaredValue?:number, codAmount?:number}} [opts] cart
 *        context; when given, `charge`/`eta` reflect the real parcel.
 * @returns {Promise<{pincode,serviceable,provider,city,state,cod,charge,eta,courierName,unverified,attempts}>}
 */
const getCoverage = async (pincode, opts = {}) => {
  const pin = String(pincode);
  // Carriers disagree on casing ("Maharashtra" vs "UTTAR PRADESH") and Ekart sends
  // state codes; the storefront address form matches a fixed title-case list.
  const normalize = (result) => ({
    ...result,
    city: titleCasePlace(result.city),
    state: canonicalState(result.state)
  });
  const names = [activeName(), activeName() === 'ekart' ? 'shiprocket' : 'ekart'];
  const attempts = [];
  let firstAnswer = null;

  for (const name of names) {
    const client = CLIENTS[name];
    if (!client.isConfigured()) {
      attempts.push({ provider: name, skipped: 'unconfigured' });
      continue;
    }

    const key = cacheKey(name, pin, opts);
    let result = cacheGet(key);
    const cached = !!result;

    if (!result) {
      try {
        result = await client.getServiceability(pin, opts);
        cacheSet(key, result);
      } catch (error) {
        console.error(`Serviceability lookup failed on ${name} for ${pin}:`, error.message);
        attempts.push({ provider: name, error: error.message });
        continue;
      }
    }

    attempts.push({ provider: name, serviceable: result.serviceable, cached });
    if (result.serviceable) return { ...normalize(result), pincode: pin, provider: name, attempts };
    firstAnswer = firstAnswer || result;
  }

  // Every provider that answered said no.
  if (firstAnswer) {
    return { ...normalize(firstAnswer), pincode: pin, serviceable: false, provider: null, attempts };
  }

  // Nobody could answer — don't block the customer over our own outage.
  return {
    pincode: pin,
    serviceable: true,
    unverified: true,
    provider: null,
    city: null,
    state: null,
    cod: false,
    charge: null,
    eta: null,
    courierName: null,
    attempts
  };
};

module.exports = {
  /** Default provider slug from the env ('shiprocket' | 'ekart'). */
  providerName: activeName,
  providerOfOrder,
  isMock: () => provider().isMock(),
  isConfigured: () => provider().isConfigured(),
  /** True when at least one carrier client could answer. */
  anyConfigured: () => Object.values(CLIENTS).some((c) => c.isConfigured()),
  /** @returns {Promise<number|null>} charge in rupees, null to fall back to a flat rate */
  getShippingCharge: (args) => provider().getShippingCharge(args),
  /** Single-provider serviceability. Prefer getCoverage() for customer-facing checks. */
  getServiceability: (pincode, opts) => provider().getServiceability(pincode, opts),
  getCoverage,
  /** @param {{provider?:string}} [opts] book with a specific carrier (see providerOfOrder) */
  createShipment: (order, opts = {}) => clientFor(opts.provider).createShipment(order, opts),
  /** @param {{trackingNumber?:string, providerOrderId?:string, provider?:string}} ids */
  cancelShipment: (ids = {}, reason) => clientFor(ids.provider).cancelShipment(ids, reason),
  trackShipment: (trackingNumber, opts = {}) => clientFor(opts.provider).trackShipment(trackingNumber),
  warehousePincode: () => provider().warehousePincode(),

  /**
   * Auto-create a shipment for a confirmed or paid order.
   * Best-effort: catches errors, updates order timeline, and never crashes order flow.
   */
  autoCreateShipment: async (order) => {
    try {
      if (process.env.AUTO_CREATE_SHIPMENT !== 'true') return null;
      if (process.env.ENABLE_MULTI_WAREHOUSE === 'true' && order.awaitingWarehouseAssignment) return null;
      const client = clientFor(providerOfOrder(order));
      if (!client.isConfigured()) return null;
      if (order.shipping?.trackingNumber) return null; // already shipped

      if (typeof order.populate === 'function') {
        await order.populate('items.product', 'name productId weight dimensions');
        if (order.warehouse) {
          await order.populate('warehouse', 'code name address shiprocketPickupNickname');
        }
      }
      const shipment = await client.createShipment(order, { provider: providerOfOrder(order), warehouse: order.warehouse });
      module.exports.applyShipment(order, shipment);
      order.status = 'processing';
      order.timeline.push({
        status: 'shipment_created',
        message: `Shipment auto-created with ${shipment.carrier}. AWB: ${shipment.awbNumber}`,
        timestamp: new Date()
      });
      await order.save();
      return shipment;
    } catch (error) {
      console.error(`Auto shipment creation failed for order ${order.orderId}:`, error.message);
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
      return null;
    }
  },

  /**
   * Persist a normalized shipment onto an order's `shipping` subdocument. Fields are
   * set individually — spreading the Mongoose subdocument would expand its unset
   * nested paths to undefined and fail re-casting. Does not save, and leaves
   * order.status/timeline to the caller.
   */
  applyShipment: (order, shipment, { serviceType } = {}) => {
    const s = order.shipping;
    s.method = serviceType || (shipment.serviceType === 'express' ? 'express' : 'standard');
    s.carrier = shipment.carrier;
    s.trackingNumber = shipment.awbNumber;
    // The carrier that actually booked it, not whatever the env currently defaults to.
    s.provider = shipment.provider || activeName();
    if (shipment.courierName) s.courierName = shipment.courierName;
    if (shipment.providerOrderId) s.providerOrderId = shipment.providerOrderId;
    if (shipment.shipmentId) {
      s.providerShipmentId = String(shipment.shipmentId);
      // Keep the legacy field populated on the Ekart path so a rollback stays
      // byte-compatible with orders booked before the provider switch.
      if (s.provider === 'ekart') s.ekartShipmentId = String(shipment.shipmentId);
    }
    if (shipment.labelUrl) s.labelUrl = shipment.labelUrl;
    if (shipment.trackingUrl) s.trackingUrl = shipment.trackingUrl;
    if (shipment.estimatedDelivery) s.estimatedDelivery = shipment.estimatedDelivery;
    s.cost = shipment.shippingCharge || order.pricing.shipping;
    return order;
  },

  /** Test seam: drop the serviceability cache. */
  _clearCoverageCache: () => cache.clear()
};
