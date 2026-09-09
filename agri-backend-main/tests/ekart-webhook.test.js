// Ekart webhook receiver: verifies swift_status -> Order.status mapping (spec
// v3.8.9) via the real POST /api/v1/shipping/webhook route against in-memory Mongo.
//
// EKART_WEBHOOK_SECRET is unset here so signature verification is skipped (the
// signed path is covered by e2e-order-flow.test.js). Deleted explicitly so this
// file is deterministic even if another suite set it in the same worker.
delete process.env.EKART_WEBHOOK_SECRET;

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/server');
const Order = require('../src/models/Order');

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

// Minimal valid order with a known Ekart tracking id.
const makeOrder = async (trackingNumber, status = 'processing') => {
  return Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product: new mongoose.Types.ObjectId(), name: 'Basmati Rice', price: 299, quantity: 1, subtotal: 299 }],
    shippingAddress: { name: 'Asha', phone: '9876543210', street: '12 MG Rd', city: 'Pune', state: 'MH', pincode: '411001' },
    pricing: { subtotal: 299, total: 349 },
    paymentMethod: 'cod',
    status,
    shipping: { trackingNumber, carrier: 'Ekart' },
  });
};

// Shape per spec: track_updated payload.
const trackEvent = (id, status, extra = {}) => ({
  id,
  wbn: `WBN${id}`,
  status,
  desc: `${status} update`,
  ctime: 1657523187604,
  ...extra,
});

const post = (payload) => request(app).post('/api/v1/shipping/webhook').send(payload);

describe('Ekart webhook: swift_status -> Order.status mapping', () => {
  it('maps "Out for Delivery" to shipped and records shippedAt', async () => {
    await makeOrder('EKOFD001');
    const res = await post(trackEvent('EKOFD001', 'Out for Delivery', { pickupTime: 1655980197000 }));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'EKOFD001' });
    expect(order.status).toBe('shipped');
    expect(order.shipping.shippedAt).toBeTruthy();
    expect(order.timeline.some((t) => t.status === 'Out for Delivery')).toBe(true);
  });

  it('maps "Delivered" to delivered and records deliveredAt', async () => {
    await makeOrder('EKDEL001', 'shipped');
    const res = await post(trackEvent('EKDEL001', 'Delivered'));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'EKDEL001' });
    expect(order.status).toBe('delivered');
    expect(order.shipping.deliveredAt).toBeTruthy();
  });

  it('maps "RTO Delivered" to cancelled', async () => {
    await makeOrder('EKRTO001', 'shipped');
    const res = await post(trackEvent('EKRTO001', 'RTO Delivered'));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'EKRTO001' });
    expect(order.status).toBe('cancelled');
  });

  it('leaves status unchanged for an unmapped NDR status ("Undelivered") but still logs the timeline', async () => {
    await makeOrder('EKNDR001', 'shipped');
    const res = await post(trackEvent('EKNDR001', 'Undelivered', { desc: 'Customer unavailable' }));
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'EKNDR001' });
    expect(order.status).toBe('shipped'); // unchanged
    expect(order.timeline.some((t) => t.status === 'Undelivered')).toBe(true);
  });

  it('matches the order by wbn when id does not match, and ignores unknown shipments', async () => {
    await makeOrder('EKWBN001', 'processing');
    // No order has trackingNumber 'EKWBN001' under `id`; match should fall to wbn.
    const res = await post({ id: 'UNKNOWN', wbn: 'EKWBN001', status: 'Picked Up', desc: 'picked', ctime: 1657523187604 });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ 'shipping.trackingNumber': 'EKWBN001' });
    expect(order.status).toBe('shipped');

    // A webhook for a shipment we don't have should 200 without throwing.
    const res2 = await post(trackEvent('DOES-NOT-EXIST', 'Delivered'));
    expect(res2.status).toBe(200);
  });
});
