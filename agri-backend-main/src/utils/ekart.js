// Ekart (GoSwift/Elite) logistics client.
//
// Implements the real Ekart partner API documented at
// https://app.elite.ekartlogistics.in/api/docs (spec v3.8.9):
//   - auth   : POST   /integrations/v2/auth/token/{client_id}  -> bearer token (cached ~24h)
//   - create : PUT    /api/v1/package/create
//   - cancel : DELETE /api/v1/package/cancel?tracking_id=...
//   - track  : GET    /api/v1/track/{id}            (open, no auth)
//   - rate   : POST   /data/pricing/estimate
//   - serv.  : GET    /api/v2/serviceability/{pincode}
//
// Ekart has no sandbox. Set EKART_MOCK=true to return spec-shaped mock responses
// (see ekartMock.js) without any network call, so the full flow can be exercised
// in dev/staging. With real credentials and EKART_MOCK!=true it hits production.
const axios = require('axios');
const mock = require('./ekartMock');
const { totalWeightKg, parcelDimsCm } = require('./parcel');

const BASE_URL = process.env.EKART_API_BASE_URL || 'https://app.elite.ekartlogistics.in';

// EKART_MOCK is the canonical flag; MOCK_SHIPPING_API is kept for back-compat.
const isMock = () =>
  process.env.EKART_MOCK === 'true' || process.env.MOCK_SHIPPING_API === 'true';

const hasCreds = () => {
  const { EKART_CLIENT_ID, EKART_USERNAME, EKART_PASSWORD } = process.env;
  return !!(
    EKART_CLIENT_ID && EKART_USERNAME && EKART_PASSWORD &&
    !EKART_CLIENT_ID.startsWith('your-') &&
    !EKART_USERNAME.startsWith('your-') &&
    !EKART_PASSWORD.startsWith('your-')
  );
};

// The integration is "on" when we can reach Ekart (real creds) OR mock mode is
// enabled. Callers (pricing, payments) use this to decide whether to attempt
// live shipping vs. fall back to flat-rate / manual flows.
const isConfigured = () => isMock() || hasCreds();

// --- auth token cache -------------------------------------------------------
let tokenCache = { value: null, expiresAt: 0 };

const getToken = async () => {
  if (isMock()) return mock.token().access_token;

  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expiresAt) return tokenCache.value;

  const clientId = process.env.EKART_CLIENT_ID;
  const { data } = await axios.post(
    `${BASE_URL}/integrations/v2/auth/token/${encodeURIComponent(clientId)}`,
    { username: process.env.EKART_USERNAME, password: process.env.EKART_PASSWORD },
    { timeout: 20000 }
  );
  if (!data || !data.access_token) throw new Error('Ekart auth failed: no access_token in response');

  // Refresh 5 minutes before the token actually expires.
  const ttl = Math.max(0, (Number(data.expires_in) || 3600) - 300);
  tokenCache = { value: data.access_token, expiresAt: now + ttl * 1000 };
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
    return await axios({ baseURL: BASE_URL, timeout: 30000, ...config, headers: buildHeaders(await getToken()) });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      tokenCache = { value: null, expiresAt: 0 };
      return axios({ baseURL: BASE_URL, timeout: 30000, ...config, headers: buildHeaders(await getToken()) });
    }
    throw err;
  }
};

// --- helpers ----------------------------------------------------------------
// Parcel weight/dimensions live in utils/parcel (shared with the Shiprocket client and
// checkout pricing); this one stays because the rate estimate takes kilograms.
const toGrams = (value, unit) => {
  const v = Number(value) || 0;
  if (unit === 'g') return v;
  if (unit === 'lb') return v * 453.592;
  return v * 1000; // kg (default)
};
const digits10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

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

// pickup/return locations: if the warehouse is pre-registered with Ekart, just
// send the alias (Ekart autofills the rest); otherwise send the full address.
const pickupLocation = (warehouseObj = null) => {
  if (warehouseObj) {
    if (warehouseObj.ekartPickupAlias) {
      return { name: warehouseObj.ekartPickupAlias };
    }
    return {
      name: warehouseObj.name || 'AgriCola Warehouse',
      phone: Number(digits10(warehouseObj.spocPhone || warehouseObj.phone || '9876543210')),
      address: warehouseObj.address?.street || warehouseObj.address || 'Warehouse Address',
      city: warehouseObj.address?.city || 'Kaithal',
      state: warehouseObj.address?.state || 'Haryana',
      pin: parseInt(warehouseObj.address?.pincode || '136027', 10),
      country: warehouseObj.address?.country || 'India'
    };
  }
  const alias = process.env.EKART_PICKUP_ALIAS;
  if (alias) return { name: alias };
  const w = warehouse();
  return {
    name: w.name,
    phone: Number(digits10(w.phone)),
    address: w.address,
    city: w.city,
    state: w.state,
    pin: parseInt(w.pincode, 10),
    country: w.country
  };
};

const returnLocation = (warehouseObj = null) => {
  if (warehouseObj) return pickupLocation(warehouseObj);
  const alias = process.env.EKART_RETURN_ALIAS || process.env.EKART_PICKUP_ALIAS;
  if (alias) return { name: alias };
  return pickupLocation();
};

/**
 * Map an Order (with populated items.product) to the Ekart `shipment` schema.
 * Exported for testing.
 */
const buildShipmentPayload = (order, warehouseObj = null) => {
  let quantity = 0;
  const descParts = [];
  const assignedWh = warehouseObj || (order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null);

  for (const item of order.items) {
    quantity += item.quantity;
    descParts.push(`${item.name} x${item.quantity}`);
  }

  // Pack size on the line ("200g") wins over the product's physical weight, and only
  // real per-item dimensions stack — see utils/parcel. Ekart wants grams and cm.
  const grams = totalWeightKg(order.items) * 1000;
  const dims = parcelDimsCm(order.items);

  const isCOD = order.paymentMethod === 'cod';
  const consigneePhone = digits10(order.shippingAddress.phone);

  // Invoice math. The product subtotal is treated as the goods (invoice) value;
  // tax_value is the GST component; taxable_amount = total_amount - tax_value so
  // the API's `total_amount === taxable_amount + tax_value` invariant holds.
  const totalAmount = Math.max(1, Math.round(order.pricing.subtotal));
  const taxValue = Math.max(0, Math.round(order.pricing.tax || 0));
  const taxableAmount = Math.max(1, totalAmount - taxValue);

  return {
    order_number: order.orderId,
    invoice_number: order.orderId,
    invoice_date: new Date(order.createdAt || Date.now()).toISOString().split('T')[0],

    seller_name: process.env.EKART_SELLER_NAME || assignedWh?.name || warehouse().name,
    seller_address: process.env.EKART_SELLER_ADDRESS || warehouse().address,
    seller_gst_tin: assignedWh?.ekartGstin || process.env.EKART_SELLER_GST_TIN || '',
    consignee_gst_amount: 0,

    consignee_name: order.shippingAddress.name,
    // Ekart rejects a shipment when the consignee's primary phone (drop_location.phone)
    // and this alternate phone are identical ("Phone and Alternate Phone cannot be
    // same"). We only collect one number, so leave the alternate blank.
    consignee_alternate_phone: '',

    payment_mode: isCOD ? 'COD' : 'Prepaid',
    return_reason: '', // forward shipment: field required by schema, value not needed
    category_of_goods: process.env.EKART_CATEGORY_OF_GOODS || 'Grocery',
    products_desc: (descParts.join(', ') || 'Agriculture products').slice(0, 250),

    total_amount: totalAmount,
    tax_value: taxValue,
    taxable_amount: taxableAmount,
    commodity_value: String(taxableAmount),
    cod_amount: isCOD ? Math.min(49999, Math.round(order.pricing.total)) : 0,
    quantity: Math.max(1, quantity),

    weight: Math.max(1, Math.round(grams || 500)),        // grams
    length: dims.length,                                  // cm
    width: dims.width,                                    // cm
    height: Math.min(dims.height, 150),                   // cm (Ekart caps height)

    drop_location: {
      name: order.shippingAddress.name,
      phone: Number(consigneePhone),
      address: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pin: parseInt(order.shippingAddress.pincode, 10),
      country: order.shippingAddress.country || 'India'
    },
    pickup_location: pickupLocation(assignedWh),
    return_location: returnLocation(assignedWh)
  };
};

/**
 * Create a forward shipment for a (paid/confirmed) order.
 * Throws on failure so the caller decides whether to swallow it.
 * @returns normalized shipment details
 */
const createShipment = async (order, { serviceType, warehouse } = {}) => {
  if (!isConfigured()) {
    const e = new Error('Ekart is not configured');
    e.code = 'EKART_UNCONFIGURED';
    throw e;
  }

  const payload = buildShipmentPayload(order, warehouse);
  const data = isMock()
    ? mock.createShipment(payload)
    : (await authed({ method: 'put', url: '/api/v1/package/create', data: payload })).data;

  if (!data || data.status !== true || !data.tracking_id) {
    throw new Error(data?.remark || 'Failed to create Ekart shipment');
  }

  return {
    shipmentId: data.tracking_id,        // Ekart tracking id
    awbNumber: data.tracking_id,         // what we track + show the customer
    vendorWaybill: data.barcodes?.wbn,   // courier waybill (FedEx etc.)
    carrier: 'Ekart',
    provider: 'ekart',
    vendor: data.vendor,
    trackingUrl: `${BASE_URL}/track/${data.tracking_id}`,
    shippingCharge: undefined,           // not returned by create; caller falls back
    estimatedDelivery: null,
    serviceType: serviceType || process.env.EKART_DEFAULT_SERVICE || 'standard',
    raw: data
  };
};

/**
 * Cancel a shipment by its Ekart tracking id. Throws on failure.
 * Accepts either the tracking id or the provider-agnostic `{ trackingNumber }`
 * identifier object utils/shipping.js passes.
 */
const cancelShipment = async (idOrIds, reason) => {
  const trackingId = typeof idOrIds === 'object' && idOrIds !== null ? idOrIds.trackingNumber : idOrIds;
  if (!isConfigured()) {
    const e = new Error('Ekart is not configured');
    e.code = 'EKART_UNCONFIGURED';
    throw e;
  }
  // `reason` is not part of the cancel API contract; kept for caller logging.
  void reason;

  const data = isMock()
    ? mock.cancelShipment(trackingId)
    : (await authed({ method: 'delete', url: '/api/v1/package/cancel', params: { tracking_id: trackingId } })).data;

  const ack = Array.isArray(data?.data) ? data.data[0] : null;
  if (!ack || ack.status !== true) {
    throw new Error(ack?.remark || 'Failed to cancel Ekart shipment');
  }
  return { trackingId: ack.tracking_id || trackingId, remark: ack.remark };
};

/**
 * Track a shipment by its Ekart tracking id. This is an open API (no auth).
 * @returns normalized tracking details
 */
const trackShipment = async (trackingId) => {
  const data = isMock()
    ? mock.track(trackingId)
    : (await axios.get(`${BASE_URL}/api/v1/track/${encodeURIComponent(trackingId)}`, { timeout: 20000 })).data;

  const t = data?.track || {};
  return {
    trackingId: data?._id || trackingId,
    orderNumber: data?.order_number,
    status: t.status,
    description: t.desc,
    location: t.location,
    updatedAt: t.ctime ? new Date(t.ctime) : null,
    estimatedDelivery: data?.edd ? new Date(data.edd) : null,
    events: Array.isArray(t.details)
      ? t.details.map((d) => ({
          status: d.status,
          description: d.desc,
          location: d.location,
          timestamp: d.ctime ? new Date(d.ctime) : null
        }))
      : [],
    raw: data
  };
};

/**
 * Raw shipping-rate estimate. `weight` is in kilograms (matches our catalog).
 * NOTE: the spec marks `billingClientType` required but never defines its
 * allowed values; it is omitted here. If production rejects the request,
 * getShippingCharge() swallows the error and pricing falls back to flat-rate.
 */
const getEstimate = async ({ toPincode, fromPincode, weight = 0.5, declaredValue = 0, serviceType, codAmount = 0, dimensions } = {}) => {
  const body = {
    shippingDirection: 'FORWARD',
    serviceType: String(serviceType || '').toUpperCase() === 'EXPRESS' ? 'EXPRESS' : 'SURFACE',
    pickupPincode: parseInt(fromPincode || warehousePincode(), 10),
    dropPincode: parseInt(toPincode, 10),
    invoiceAmount: Number(declaredValue) || 0,
    weight: Math.max(1, Math.round(toGrams(weight, 'kg'))),
    length: Math.max(1, Math.round(dimensions?.length || 20)),
    height: Math.max(1, Math.round(dimensions?.height || 10)),
    width: Math.max(1, Math.round(dimensions?.width || 20)),
    codAmount: Number(codAmount) || 0
  };
  const data = isMock()
    ? mock.estimate(body)
    : (await authed({ method: 'post', url: '/data/pricing/estimate', data: body })).data;
  return data;
};

/**
 * Shipping charge in rupees for a destination, or null when unavailable so the
 * caller can fall back to a flat rate.
 * @returns {Promise<number|null>}
 */
const getShippingCharge = async (args) => {
  if (!isConfigured() || !args || !args.toPincode) return null;
  try {
    const est = await getEstimate(args);
    const total = parseFloat(est?.total ?? est?.shippingCharge);
    return Number.isFinite(total) ? Math.round(total) : null;
  } catch (error) {
    console.error('Ekart rate lookup failed, falling back:', error.message);
    return null;
  }
};

/**
 * Check pincode serviceability. Returns the raw AcknowledgementServiceability.
 */
const checkServiceability = async (pincode) => {
  const data = isMock()
    ? mock.serviceability(pincode)
    : (await authed({ method: 'get', url: `/api/v2/serviceability/${encodeURIComponent(pincode)}` })).data;
  return data;
};

/**
 * Serviceability in the provider-agnostic shape utils/shipping.js exposes.
 *
 * Unlike Shiprocket, Ekart's serviceability response carries no rate or ETA, so
 * `charge` costs a second (estimate) call and is only fetched when cart context is
 * passed; `eta` is never available.
 * @returns {Promise<{pincode,serviceable,cod,city,state,charge,eta,courierName}>}
 */
const getServiceability = async (pincode, { weight, declaredValue, codAmount } = {}) => {
  const data = await checkServiceability(pincode);
  const d = data?.details || {};
  const serviceable = data?.status === true && d.forward_drop !== false;

  const charge = serviceable && weight
    ? await getShippingCharge({ toPincode: pincode, weight, declaredValue, codAmount })
    : null;

  return {
    pincode: String(pincode),
    serviceable,
    cod: !!d.cod,
    city: d.city || null,
    state: d.state || null,
    charge,
    eta: null,
    courierName: null
  };
};

// Webhook topics Ekart can push (spec v3.8.9, Webhook V2).
const WEBHOOK_TOPICS = ['track_updated', 'shipment_created', 'shipment_recreated'];

/**
 * Register a webhook with Ekart (POST /api/v2/webhook) so it pushes
 * track_updated / shipment_created / shipment_recreated events to our URL.
 * Ekart signs each delivery with an HMAC of the body using `secret`.
 * @returns the created webhookResponse ({ id, url, secret, topics, active }).
 */
const registerWebhook = async ({ url, secret, topics = WEBHOOK_TOPICS, active = true }) => {
  if (!url) throw new Error('registerWebhook: url is required');
  if (!secret || secret.length < 6 || secret.length > 30) {
    throw new Error('registerWebhook: secret must be 6-30 characters');
  }
  const body = { url, secret, topics, active };
  const data = isMock()
    ? mock.registerWebhook(body)
    : (await authed({ method: 'post', url: '/api/v2/webhook', data: body })).data;
  return data;
};

/**
 * List webhooks currently registered with Ekart (GET /api/v2/webhook).
 * @returns {Promise<Array>}
 */
const listWebhooks = async () => {
  const data = isMock()
    ? mock.listWebhooks()
    : (await authed({ method: 'get', url: '/api/v2/webhook' })).data;
  return Array.isArray(data) ? data : [];
};

module.exports = {
  isMock,
  isConfigured,
  getToken,
  buildShipmentPayload,
  createShipment,
  cancelShipment,
  trackShipment,
  getEstimate,
  getShippingCharge,
  checkServiceability,
  getServiceability,
  registerWebhook,
  listWebhooks,
  WEBHOOK_TOPICS,
  warehouse,
  warehousePincode,
  providerName: () => 'ekart'
};
