// Mocked Ekart (GoSwift/Elite) API responses.
//
// Ekart has no sandbox, so this module returns payloads shaped exactly like the
// real API (see https://app.elite.ekartlogistics.in/api/docs) without making any
// network call. The ekart client routes here whenever EKART_MOCK=true, letting
// dev/staging exercise the full create -> track -> cancel flow safely.
//
// All mock ids are prefixed with "MOCK" so a mocked shipment can never be
// mistaken for a real one in the database.

let trackingSeq = 1;
let wbnSeq = 1;

const nextTrackingId = () => `MOCK${String(trackingSeq++).padStart(8, '0')}EK`;
const nextWbn = () => String(7000000000 + wbnSeq++);

// POST /integrations/v2/auth/token/{client_id}
const token = () => ({
  access_token: 'mock-access-token',
  scope: 'core:all',
  expires_in: 86400,
  token_type: 'Bearer'
});

// PUT /api/v1/package/create  ->  acknowledgement_create
const createShipment = (payload = {}) => {
  const res = {
    status: true,
    remark: 'Successfully created shipment',
    tracking_id: nextTrackingId(),
    vendor: 'EKART',
    barcodes: {
      wbn: nextWbn(),
      order: String(payload.order_number || '')
    }
  };
  if (payload.payment_mode === 'COD') res.barcodes.cod = `C${res.barcodes.wbn}`;
  return res;
};

// DELETE /api/v1/package/cancel  ->  dispatch_date_response
const cancelShipment = (trackingId) => ({
  data: [
    {
      status: true,
      remark: 'Shipment cancelled successfully',
      tracking_id: trackingId
    }
  ]
});

// GET /api/v1/track/{id}  ->  track_obj
const track = (trackingId) => {
  const now = Date.now();
  const hours = (h) => now - h * 60 * 60 * 1000;
  return {
    _id: trackingId,
    order_number: 'MOCK-ORDER',
    edd: now + 2 * 24 * 60 * 60 * 1000,
    track: {
      status: 'In Transit',
      ctime: hours(2),
      desc: 'Shipment in transit at sortation hub',
      location: 'Bengaluru Hub',
      attempts: 0,
      details: [
        { status: 'Order Placed', ctime: hours(26), desc: 'Shipment manifested', location: 'Bengaluru' },
        { status: 'Picked Up', ctime: hours(20), desc: 'Picked up from seller', location: 'Bengaluru' },
        { status: 'In Transit', ctime: hours(2), desc: 'Shipment in transit at sortation hub', location: 'Bengaluru Hub' }
      ]
    }
  };
};

// POST /data/pricing/estimate  ->  estimateResponse (all fields are strings)
const estimate = (req = {}) => {
  const grams = Number(req.weight) || 500;
  const ship = 40 + Math.ceil(grams / 1000) * 25;
  const cod = Number(req.codAmount) > 0 ? 30 : 0;
  const taxes = Math.round((ship + cod) * 0.18);
  const total = ship + cod + taxes;
  return {
    type: 'WEIGHT_BASED',
    zone: 'MOCK-ZONE',
    volumetricWeight: '0',
    billingWeight: String(grams),
    shippingCharge: String(ship),
    rtoCharge: String(ship),
    fuelSurcharge: '0',
    codCharge: String(cod),
    qcCharge: '0',
    taxes: String(taxes),
    total: String(total),
    rid: 'mock-rid',
    rSnapshotId: 'mock-snapshot'
  };
};

// --- Webhook V2 (in-memory registry) ---------------------------------------
let webhooks = [];
let webhookSeq = 1;

// POST /api/v2/webhook  ->  webhookResponse
const registerWebhook = (body = {}) => {
  const hook = { id: `MOCKWH${String(webhookSeq++).padStart(4, '0')}`, active: true, ...body };
  webhooks.push(hook);
  return hook;
};

// GET /api/v2/webhook  ->  webhookResponse[]
const listWebhooks = () => webhooks;

// GET /api/v2/serviceability/{pincode}  ->  AcknowledgementServiceability
const serviceability = (pincode) => ({
  status: true,
  pincode: Number(pincode) || 0,
  remark: 'Serviceable',
  details: {
    cod: true,
    max_cod_amount: 49999,
    forward_pickup: true,
    forward_drop: true,
    reverse_pickup: true,
    reverse_drop: true,
    city: 'Mock City',
    state: 'KA'
  }
});

module.exports = {
  token,
  createShipment,
  cancelShipment,
  track,
  estimate,
  serviceability,
  registerWebhook,
  listWebhooks
};
