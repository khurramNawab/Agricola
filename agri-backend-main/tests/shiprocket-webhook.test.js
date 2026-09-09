// Shiprocket webhook receiver: verifies token auth and current_status -> Order.status
// mapping via the real POST /api/v1/shipping/webhook/shiprocket route against
// in-memory Mongo.
//
// Shiprocket does not sign webhook bodies — it replays a static custom header, so the
// token path is exercised here rather than an HMAC path.
process.env.SHIPROCKET_WEBHOOK_TOKEN = 'test-shiprocket-webhook-token';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/server');
const Order = require('../src/models/Order');

const TOKEN = process.env.SHIPROCKET_WEBHOOK_TOKEN;
let mongod;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/agricola_test');
  }
  await Order.deleteMany({});
});


afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// Minimal valid order with a known AWB.
const makeOrder = async (awb, status = 'processing', extra = {}) =>
  Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product: new mongoose.Types.ObjectId(), name: 'Basmati Rice', price: 299, quantity: 1, subtotal: 299 }],
    shippingAddress: { name: 'Asha', phone: '9876543210', street: '12 MG Rd', city: 'Pune', state: 'MH', pincode: '411001' },
    pricing: { subtotal: 299, total: 349 },
    paymentMethod: 'cod',
    status,
    shipping: { trackingNumber: awb, carrier: 'Xpressbees Surface', provider: 'shiprocket' },
    ...extra
  });

// Shape of a Shiprocket order-status webhook.
const statusEvent = (awb, current_status, extra = {}) => ({
  awb,
  current_status,
  shipment_status: current_status,
  current_timestamp: '2026-08-18 11:20:00',
  courier_name: 'Xpressbees Surface',
  scans: [{ location: 'Pune Hub', date: '2026-08-18 11:20:00', activity: `${current_status} scan` }],
  ...extra
});

const post = (payload, token = TOKEN) =>
  request(app).post('/api/v1/shipping/webhook/tracking').set('x-api-key', token).send(payload);

// Shiprocket's dashboard rejects webhook URLs containing "shiprocket"/"sr"/"kr", so
// /webhook/tracking is the canonical path — but the original path stays mounted.
describe('Shiprocket webhook: path aliases', () => {
  it('serves the same handler on /webhook/shiprocket', async () => {
    await makeOrder('SRALIAS1', 'shipped');
    const res = await request(app)
      .post('/api/v1/shipping/webhook/shiprocket')
      .set('x-api-key', TOKEN)
      .send(statusEvent('SRALIAS1', 'DELIVERED'));
    expect(res.status).toBe(200);
    expect((await Order.findOne({ 'shipping.trackingNumber': 'SRALIAS1' })).status).toBe('delivered');
  });
});

describe('Shiprocket webhook: token verification', () => {
  it('rejects a wrong token', async () => {
    await makeOrder('SRBAD001');
    const res = await post(statusEvent('SRBAD001', 'DELIVERED'), 'not-the-token');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');

    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRBAD001' });
    expect(order.status).toBe('processing'); // untouched
  });

  it('rejects a missing token', async () => {
    const res = await request(app).post('/api/v1/shipping/webhook/tracking').send(statusEvent('SRBAD001', 'DELIVERED'));
    expect(res.status).toBe(400);
  });

  it('fails closed (503) when no token is configured', async () => {
    delete process.env.SHIPROCKET_WEBHOOK_TOKEN;
    try {
      const res = await request(app)
        .post('/api/v1/shipping/webhook/tracking')
        .set('x-api-key', 'anything')
        .send(statusEvent('SRBAD001', 'DELIVERED'));
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('WEBHOOK_NOT_CONFIGURED');
    } finally {
      process.env.SHIPROCKET_WEBHOOK_TOKEN = TOKEN;
    }
  });

  it('accepts the token via Authorization: Bearer as well', async () => {
    await makeOrder('SRAUTH01');
    const res = await request(app)
      .post('/api/v1/shipping/webhook/tracking')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send(statusEvent('SRAUTH01', 'DELIVERED'));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRAUTH01' });
    expect(order.status).toBe('delivered');
  });
});

describe('Shiprocket webhook: current_status -> Order.status mapping', () => {
  it('maps "PICKED UP" to shipped and records shippedAt', async () => {
    await makeOrder('SRPKD001');
    const res = await post(statusEvent('SRPKD001', 'PICKED UP'));
    expect(res.status).toBe(200);

    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRPKD001' });
    expect(order.status).toBe('shipped');
    expect(order.shipping.shippedAt).toBeTruthy();
    expect(order.timeline.some((t) => t.status === 'PICKED UP' && t.message === 'PICKED UP scan')).toBe(true);
  });

  it('maps "OUT FOR DELIVERY" to shipped without overwriting an existing shippedAt', async () => {
    const shippedAt = new Date('2026-08-17T05:00:00Z');
    await makeOrder('SROFD001', 'shipped', { shipping: { trackingNumber: 'SROFD001', shippedAt } });
    const res = await post(statusEvent('SROFD001', 'OUT FOR DELIVERY'));
    expect(res.status).toBe(200);

    const order = await Order.findOne({ 'shipping.trackingNumber': 'SROFD001' });
    expect(order.status).toBe('shipped');
    expect(order.shipping.shippedAt.toISOString()).toBe(shippedAt.toISOString());
  });

  it('maps "DELIVERED" to delivered, records deliveredAt and stores the ETD', async () => {
    await makeOrder('SRDEL001', 'shipped');
    const res = await post(statusEvent('SRDEL001', 'DELIVERED', { etd: '2026-08-18 18:00:00' }));
    expect(res.status).toBe(200);

    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRDEL001' });
    expect(order.status).toBe('delivered');
    expect(order.shipping.deliveredAt).toBeTruthy();
    expect(order.shipping.estimatedDelivery).toBeTruthy();
  });

  it('maps "RTO DELIVERED" to cancelled', async () => {
    await makeOrder('SRRTO001', 'shipped');
    const res = await post(statusEvent('SRRTO001', 'RTO DELIVERED'));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRRTO001' });
    expect(order.status).toBe('cancelled');
  });

  it('is case-insensitive on the status value', async () => {
    await makeOrder('SRCASE01', 'shipped');
    const res = await post(statusEvent('SRCASE01', 'Delivered'));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRCASE01' });
    expect(order.status).toBe('delivered');
  });

  it('leaves status unchanged for an unmapped NDR status but still logs the timeline', async () => {
    await makeOrder('SRNDR001', 'shipped');
    const res = await post(statusEvent('SRNDR001', 'UNDELIVERED', { scans: [{ activity: 'Customer unavailable' }] }));
    expect(res.status).toBe(200);

    const order = await Order.findOne({ 'shipping.trackingNumber': 'SRNDR001' });
    expect(order.status).toBe('shipped'); // unchanged
    expect(order.timeline.some((t) => t.status === 'UNDELIVERED' && t.message === 'Customer unavailable')).toBe(true);
  });

  it('falls back to channel_order_id when the AWB is absent, and ignores unknown shipments', async () => {
    const order = await makeOrder('SRCHN001', 'processing');
    const res = await post({ channel_order_id: order.orderId, current_status: 'PICKED UP', current_timestamp: '2026-08-18 11:20:00' });
    expect(res.status).toBe(200);
    expect((await Order.findById(order._id)).status).toBe('shipped');

    // A webhook for a shipment we don't have should 200 without throwing.
    expect((await post(statusEvent('DOES-NOT-EXIST', 'DELIVERED'))).status).toBe(200);
    // A payload with no status at all is acknowledged and ignored.
    expect((await post({ awb: 'SRCHN001' })).status).toBe(200);
  });
});
