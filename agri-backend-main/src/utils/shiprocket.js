// Shiprocket logistics client.
//
// Implements the Shiprocket v1 external API (https://apidocs.shiprocket.in):
//   - auth    : POST /v1/external/auth/login                 -> bearer token (valid 240h)
//   - rates   : GET  /v1/external/courier/serviceability/     (also gives dest city/state)
//   - create  : POST /v1/external/orders/create/adhoc         -> order_id + shipment_id
//   - awb     : POST /v1/external/courier/assign/awb          -> awb_code + courier
//   - pickup  : POST /v1/external/courier/generate/pickup
//   - label   : POST /v1/external/courier/generate/label      -> label_url (courier AWB label)
//   - track   : GET  /v1/external/courier/track/awb/{awb}
//   - cancel  : POST /v1/external/orders/cancel/shipment/awbs (or /orders/cancel by order id)
//   - pickups : GET  /v1/external/settings/company/pickup
//
// Shiprocket has no sandbox. Set SHIPROCKET_MOCK=true to return spec-shaped mock
// responses (see shiprocketMock.js) without any network call, so the full flow can
// be exercised in dev/test. With real credentials and SHIPROCKET_MOCK!=true it hits
// production. The exported surface mirrors ekart.js so utils/shipping.js can treat
// the two providers interchangeably.
const axios = require('axios');
const mock = require('./shiprocketMock');
const { totalWeightKg, parcelDimsCm, MIN_PARCEL_KG } = require('./parcel');

const BASE_URL = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in';

const isMock = () => process.env.SHIPROCKET_MOCK === 'true';

const hasCreds = () => {
  const { SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD } = process.env;
  return !!(
    SHIPROCKET_EMAIL && SHIPROCKET_PASSWORD &&
    !SHIPROCKET_EMAIL.startsWith('your-') &&
    !SHIPROCKET_PASSWORD.startsWith('your-')
  );
};

// "On" when we can reach Shiprocket (real creds) OR mock mode is enabled. Callers
// (pricing, payments) use this to decide whether to attempt live shipping vs. fall
// back to flat-rate / manual flows.
const isConfigured = () => isMock() || hasCreds();

// --- auth token cache -------------------------------------------------------
// Shiprocket tokens are valid 240h; refresh a day early.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
let tokenCache = { value: null, expiresAt: 0 };

const getToken = async () => {
  if (isMock()) return mock.login().token;

  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expiresAt) return tokenCache.value;

  const { data } = await axios.post(
    `${BASE_URL}/v1/external/auth/login`,
    { email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD },
    { timeout: 30000 }
  );
  if (!data || !data.token) throw new Error('Shiprocket auth failed: no token in response');

  tokenCache = { value: data.token, expiresAt: now + TOKEN_TTL_MS };
  return tokenCache.value;
};

// Authenticated request, retrying once on a 401 with a fresh token.
const authed = async (config) => {
  const buildHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(config.headers || {})
  });
  try {
    return await axios({ baseURL: BASE_URL, timeout: 40000, ...config, headers: buildHeaders(await getToken()) });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      tokenCache = { value: null, expiresAt: 0 };
      return axios({ baseURL: BASE_URL, timeout: 40000, ...config, headers: buildHeaders(await getToken()) });
    }
    throw err;
  }
};

// --- helpers ----------------------------------------------------------------
// Weight and dimensions come from utils/parcel (shared with the Ekart client and
// checkout pricing, so a line measures the same wherever it's measured).
const digits10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const warehouse = () => ({
  name: process.env.WAREHOUSE_NAME || 'AgriCola Warehouse',
  phone: process.env.WAREHOUSE_PHONE || '9876543210',
  address: [process.env.WAREHOUSE_ADDRESS_LINE_1, process.env.WAREHOUSE_ADDRESS_LINE_2]
    .filter(Boolean).join(', ') || 'Warehouse Address',
  city: process.env.WAREHOUSE_CITY || 'Mumbai',
  state: process.env.WAREHOUSE_STATE || 'Maharashtra',
  pincode: process.env.WAREHOUSE_PINCODE || '400001',
  country: process.env.WAREHOUSE_COUNTRY || 'India'
});

const warehousePincode = () => process.env.WAREHOUSE_PINCODE || '400001';

// Shiprocket bills a 0.5kg minimum and rejects zero dimensions.
const MIN_WEIGHT_KG = MIN_PARCEL_KG;

/**
 * Sum an order's items into the single parcel Shiprocket books: total weight (kg),
 * footprint (max L/W) and stacked height (cm). Mirrors ekart.buildShipmentPayload's
 * dimension logic.
 *
 * Per-unit weight comes from the pack size on the line ("200g") before the product's
 * physical weight — see utils/parcel.
 */
const measureParcel = (items = []) => {
  const dims = parcelDimsCm(items);
  return {
    weight: Math.max(MIN_WEIGHT_KG, round2(totalWeightKg(items) || MIN_WEIGHT_KG)),
    length: dims.length,
    breadth: dims.width,
    height: dims.height
  };
};

/**
 * Map an Order (with populated items.product) onto the Shiprocket adhoc-order
 * schema. Exported for testing.
 */
const buildOrderPayload = (order, warehouse = null) => {
  const isCOD = order.paymentMethod === 'cod';
  const addr = order.shippingAddress;
  const parcel = measureParcel(order.items);
  const assignedWh = warehouse || (order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null);
  const pickupLoc = assignedWh?.shiprocketPickupNickname || process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  // Shiprocket splits the consignee name into first/last; our addresses hold one
  // field, so the first token is the first name and the remainder the last name.
  const nameParts = String(addr.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ');

  const payload = {
    order_id: order.orderId,
    order_date: new Date(order.createdAt || Date.now()).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickupLoc,

    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: addr.street,
    billing_city: addr.city,
    billing_pincode: String(addr.pincode),
    billing_state: addr.state,
    billing_country: addr.country || 'India',
    billing_email: order.email || process.env.STORE_ORDER_EMAIL || '',
    billing_phone: digits10(addr.phone),
    shipping_is_billing: true,

    order_items: (order.items || []).map((item) => {
      const product = item.product && typeof item.product === 'object' ? item.product : null;
      return {
        name: [item.name, item.weight].filter(Boolean).join(' ').slice(0, 250) || 'Product',
        sku: product?.productId || String(product?._id || item.product || item.name),
        units: item.quantity,
        selling_price: Math.round(item.price ?? (item.subtotal / Math.max(1, item.quantity)))
      };
    }),

    payment_method: isCOD ? 'COD' : 'Prepaid',
    sub_total: Math.max(1, Math.round(order.pricing.subtotal - (order.pricing.discount || 0))),
    ...parcel
  };

  if (process.env.SHIPROCKET_CHANNEL_ID) payload.channel_id = process.env.SHIPROCKET_CHANNEL_ID;
  return payload;
};

// --- rates / serviceability -------------------------------------------------

/**
 * Courier options for a lane, cheapest first. `weight` is in kilograms.
 * Shiprocket answers an unserviceable lane with HTTP 200 + { status: 404 }, so an
 * empty list is a normal (non-error) outcome.
 * @returns {Promise<{ couriers: Array, recommendedId: number|null, destination: {city,state}|null }>}
 */
const getRates = async ({ toPincode, fromPincode, weight = 0.5, declaredValue = 0, codAmount = 0 } = {}) => {
  const params = {
    pickup_postcode: String(fromPincode || warehousePincode()),
    delivery_postcode: String(toPincode),
    weight: Math.max(MIN_WEIGHT_KG, round2(weight)),
    cod: Number(codAmount) > 0 ? 1 : 0,
    declared_value: Math.round(Number(declaredValue) || 0)
  };

  const data = isMock()
    ? mock.serviceability(params)
    : (await authed({ method: 'get', url: '/v1/external/courier/serviceability/', params })).data;

  const list = data?.data?.available_courier_companies || [];
  const couriers = list
    .map((c) => ({
      courierId: c.courier_company_id,
      courierName: c.courier_name,
      rate: Number(c.rate),                     // total incl. COD/fuel — what Shiprocket bills
      freightCharge: Number(c.freight_charge),
      codCharge: Number(c.cod_charges) || 0,
      cod: c.cod === 1,
      etd: c.etd || null,
      estimatedDeliveryDays: c.estimated_delivery_days || null
    }))
    .filter((c) => Number.isFinite(c.rate))
    .sort((a, b) => a.rate - b.rate);

  // Every courier row echoes the destination's city/state — used for address autofill.
  const first = list[0];
  return {
    couriers,
    recommendedId: data?.data?.recommended_courier_company_id ?? null,
    destination: first ? { city: first.city || null, state: first.state || null } : null
  };
};

/**
 * Shipping charge in rupees for a destination (cheapest serviceable courier), or
 * null when unavailable so the caller can fall back to a flat rate.
 * @returns {Promise<number|null>}
 */
const getShippingCharge = async (args) => {
  if (!isConfigured() || !args || !args.toPincode) return null;
  try {
    const { couriers } = await getRates(args);
    return couriers.length ? Math.round(couriers[0].rate) : null;
  } catch (error) {
    console.error('Shiprocket rate lookup failed, falling back:', error.message);
    return null;
  }
};

/**
 * Normalized pincode serviceability for checkout/address entry.
 *
 * Shiprocket's serviceability endpoint IS its rate endpoint, so the cheapest
 * courier's charge and ETA come back from the same call at no extra cost. Pass the
 * cart's weight/value to have them reflect the real parcel instead of a 0.5kg probe.
 * @returns {Promise<{ pincode, serviceable, cod, city, state, charge, eta, courierName }>}
 */
const getServiceability = async (pincode, { weight, declaredValue, codAmount } = {}) => {
  const { couriers, destination } = await getRates({
    toPincode: pincode,
    weight: weight || MIN_WEIGHT_KG,
    declaredValue: declaredValue ?? 500,
    codAmount
  });
  const cheapest = couriers[0];
  return {
    pincode: String(pincode),
    serviceable: couriers.length > 0,
    cod: couriers.some((c) => c.cod),
    city: destination?.city || null,
    state: destination?.state || null,
    charge: cheapest ? Math.round(cheapest.rate) : null,
    eta: cheapest && (cheapest.etd || cheapest.estimatedDeliveryDays)
      ? { date: cheapest.etd || null, days: Number(cheapest.estimatedDeliveryDays) || null }
      : null,
    courierName: cheapest?.courierName || null
  };
};

// --- booking ----------------------------------------------------------------

/**
 * Book a shipment: create the order, assign an AWB with the cheapest serviceable
 * courier (or SHIPROCKET_COURIER_ID), then request pickup and fetch the courier
 * label. Pickup and label are best-effort — a failure there leaves a booked,
 * trackable shipment rather than losing it. Throws if create or AWB fails.
 * @returns normalized shipment details
 */
const createShipment = async (order, { serviceType, courierId, warehouse } = {}) => {
  if (!isConfigured()) {
    const e = new Error('Shiprocket is not configured');
    e.code = 'SHIPROCKET_UNCONFIGURED';
    throw e;
  }

  const payload = buildOrderPayload(order, warehouse);
  const created = isMock()
    ? mock.createOrder(payload)
    : (await authed({ method: 'post', url: '/v1/external/orders/create/adhoc', data: payload })).data;

  const shipmentId = created?.shipment_id;
  if (!shipmentId) {
    throw new Error(created?.message || 'Failed to create Shiprocket order');
  }

  // Pick the courier we quoted at checkout so the charged and billed rates agree.
  let chosenCourierId = courierId || Number(process.env.SHIPROCKET_COURIER_ID) || null;
  if (!chosenCourierId) {
    try {
      const { couriers } = await getRates({
        toPincode: order.shippingAddress.pincode,
        weight: payload.weight,
        declaredValue: payload.sub_total,
        codAmount: order.paymentMethod === 'cod' ? order.pricing.total : 0
      });
      if (couriers.length) chosenCourierId = couriers[0].courierId;
    } catch (error) {
      // Fall through: Shiprocket auto-selects per the account's courier priority.
      console.error(`Courier pre-selection failed for ${order.orderId}, letting Shiprocket choose:`, error.message);
    }
  }

  const awbBody = { shipment_id: shipmentId };
  if (chosenCourierId) awbBody.courier_id = chosenCourierId;
  const awbRes = isMock()
    ? mock.assignAwb(awbBody)
    : (await authed({ method: 'post', url: '/v1/external/courier/assign/awb', data: awbBody })).data;

  const awb = awbRes?.response?.data || {};
  if (!awb.awb_code) {
    throw new Error(awbRes?.message || 'Failed to assign a Shiprocket AWB');
  }

  let pickupScheduled = false;
  if (process.env.SHIPROCKET_REQUEST_PICKUP !== 'false') {
    try {
      const res = isMock()
        ? mock.requestPickup(shipmentId)
        : (await authed({ method: 'post', url: '/v1/external/courier/generate/pickup', data: { shipment_id: [shipmentId] } })).data;
      pickupScheduled = !!res;
    } catch (error) {
      console.error(`Shiprocket pickup request failed for ${order.orderId}:`, error.response?.data?.message || error.message);
    }
  }

  let labelUrl = null;
  if (process.env.SHIPROCKET_GENERATE_LABEL !== 'false') {
    try {
      const res = isMock()
        ? mock.generateLabel(shipmentId)
        : (await authed({ method: 'post', url: '/v1/external/courier/generate/label', data: { shipment_id: [shipmentId] } })).data;
      labelUrl = res?.label_url || null;
    } catch (error) {
      console.error(`Shiprocket label generation failed for ${order.orderId}:`, error.response?.data?.message || error.message);
    }
  }

  return {
    shipmentId: String(shipmentId),
    awbNumber: awb.awb_code,
    carrier: awb.courier_name || 'Shiprocket',
    courierName: awb.courier_name || null,
    provider: 'shiprocket',
    providerOrderId: created.order_id ? String(created.order_id) : null,
    trackingUrl: `https://shiprocket.co/tracking/${awb.awb_code}`,
    labelUrl,
    pickupScheduled,
    shippingCharge: Number.isFinite(Number(awb.freight_charge)) ? Math.round(Number(awb.freight_charge)) : undefined,
    estimatedDelivery: null,
    // Kept enum-safe for order.shipping.method; the courier itself is in `carrier`.
    serviceType: serviceType || 'standard',
    raw: { created, awb: awbRes }
  };
};

/**
 * Cancel a booked shipment. Prefers cancelling by AWB (which also unbooks the
 * courier); falls back to cancelling the Shiprocket order when no AWB exists.
 */
const cancelShipment = async ({ trackingNumber, providerOrderId } = {}, reason) => {
  if (!isConfigured()) {
    const e = new Error('Shiprocket is not configured');
    e.code = 'SHIPROCKET_UNCONFIGURED';
    throw e;
  }
  // `reason` is not part of the cancel API contract; kept for caller logging.
  void reason;

  if (!trackingNumber && !providerOrderId) throw new Error('cancelShipment: awb or order id is required');

  const request = trackingNumber
    ? { url: '/v1/external/orders/cancel/shipment/awbs', data: { awbs: [trackingNumber] } }
    : { url: '/v1/external/orders/cancel', data: { ids: [Number(providerOrderId) || providerOrderId] } };

  const data = isMock()
    ? mock.cancel(request.data)
    : (await authed({ method: 'post', ...request })).data;

  // Shiprocket answers 200 + { status: 400/404, message } for a shipment it won't cancel.
  if (data && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to cancel Shiprocket shipment');
  }
  return { trackingNumber, remark: data?.message || 'Cancelled' };
};

// Shiprocket's own status vocabulary, normalized to the same shape ekart.trackShipment
// returns so routes/shipping.js and the customer tracking UI need no changes.
const trackShipment = async (awb) => {
  const data = isMock()
    ? mock.track(awb)
    : (await authed({ method: 'get', url: `/v1/external/courier/track/awb/${encodeURIComponent(awb)}` })).data;

  // The API returns either an object or a single-element array of them.
  const payload = Array.isArray(data) ? data[0] : data;
  const t = payload?.tracking_data || {};
  const track = Array.isArray(t.shipment_track) ? t.shipment_track[0] || {} : {};
  const activities = Array.isArray(t.shipment_track_activities) ? t.shipment_track_activities : [];
  const latest = activities[0] || {};

  return {
    trackingId: track.awb_code || awb,
    orderNumber: track.order_id ? String(track.order_id) : undefined,
    status: track.current_status || t.shipment_status || null,
    description: latest.activity || null,
    location: latest.location || track.destination || null,
    updatedAt: latest.date ? new Date(latest.date) : null,
    estimatedDelivery: track.edd ? new Date(track.edd) : null,
    trackingUrl: t.track_url || null,
    events: activities.map((a) => ({
      status: a['sr-status-label'] || a.status || null,
      description: a.activity || null,
      location: a.location || null,
      timestamp: a.date ? new Date(a.date) : null
    })),
    raw: payload
  };
};

/**
 * Registered pickup addresses. Used by the pre-flight check to prove
 * SHIPROCKET_PICKUP_LOCATION matches a real nickname — a mismatch is the most
 * common cause of booking failures.
 * @returns {Promise<Array>}
 */
const listPickupLocations = async () => {
  const data = isMock()
    ? mock.pickupLocations()
    : (await authed({ method: 'get', url: '/v1/external/settings/company/pickup' })).data;
  const list = data?.data?.shipping_address || data?.data || [];
  return Array.isArray(list) ? list : [];
};

module.exports = {
  isMock,
  isConfigured,
  getToken,
  measureParcel,
  buildOrderPayload,
  getRates,
  getShippingCharge,
  getServiceability,
  createShipment,
  cancelShipment,
  trackShipment,
  listPickupLocations,
  warehouse,
  warehousePincode,
  providerName: () => 'shiprocket'
};
