// End-to-end flow test: order -> address -> checkout -> delivery.
//
// Drives the real Express routes via supertest against an in-memory MongoDB,
// with Ekart in mock mode (no sandbox exists). Exercises the full lifecycle:
//   register users -> save address -> checkout summary -> place COD order ->
//   admin confirm -> admin create Ekart shipment -> customer track ->
//   signed delivery webhook -> order marked delivered.

// This suite is the Ekart-path regression: it pins SHIPPING_PROVIDER=ekart so the
// rollback provider stays covered after the switch to Shiprocket (whose equivalent
// route-level flow lives in shipping-routes-shiprocket.test.js).
process.env.SHIPPING_PROVIDER = 'ekart';
process.env.EKART_MOCK = 'true';
process.env.AUTO_CREATE_SHIPMENT = 'false'; // shipment is created explicitly via the admin route
process.env.EKART_WEBHOOK_SECRET = 'test_ekart_webhook_secret';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/agricola_test';
delete process.env.ENABLE_MULTI_WAREHOUSE;

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/server');

const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');

let customer;
let admin;
let product;
let customerToken;
let adminToken;

const tokenFor = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  await User.deleteMany({});
  await Product.deleteMany({});
  await Order.deleteMany({});

  customer = await User.create({ name: 'Asha Customer', phone: '+919876543210', role: 'customer' });
  admin = await User.create({ name: 'Ops Admin', phone: '+919800000000', role: 'admin' });
  product = await Product.create({
    productId: 'P001',
    name: 'Assam CTC Tea',
    description: 'Strong malty Assam CTC tea',
    price: 300,
    category: new mongoose.Types.ObjectId(),
    stock: 100,
    status: 'active',
    images: [{ url: 'https://example.com/tea.jpg', alt: 'Tea' }],
    weight: { value: 250, unit: 'g' },
    dimensions: { length: 15, width: 10, height: 6, unit: 'cm' }
  });

  customerToken = tokenFor(customer);
  adminToken = tokenFor(admin);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
});


describe('E2E: order -> address -> checkout -> delivery', () => {
  it('runs the full lifecycle from address to delivered', async () => {
    // 1) ADDRESS — customer saves a delivery address
    const addrRes = await request(app)
      .post('/api/v1/addresses')
      .set(auth(customerToken))
      .send({
        name: 'Asha Customer',
        mobile: '9876543210',
        pincode: '411001',
        state: 'Maharashtra',
        address: '12 MG Road',
        locality: 'Camp',
        city: 'Pune',
        type: 'Home'
      })
      .expect(201);
    const addressId = addrRes.body.data.id;
    expect(addressId).toBeTruthy();

    // 2) CHECKOUT SUMMARY — server-side pricing (live Ekart mock rate)
    const items = [{ productId: String(product._id), qty: 2 }];
    const summaryRes = await request(app)
      .post('/api/v1/checkout/summary')
      .set(auth(customerToken))
      .send({ items, shippingAddressId: addressId })
      .expect(200);

    const summary = summaryRes.body.data;
    expect(summary.subtotal).toBe(600); // 300 * 2
    expect(typeof summary.charges).toBe('number');
    expect(summary.total).toBe(summary.subtotal - summary.discount + summary.charges);

    // 3) PLACE ORDER — Cash on Delivery
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set(auth(customerToken))
      .send({ items, shippingAddressId: addressId, paymentMethod: 'cod', email: 'e2e@gmail.com' })
      .expect(201);

    const orderObjId = orderRes.body.data.id;
    const orderId = orderRes.body.data.orderId;
    expect(orderId).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(orderRes.body.data.payment.gateway).toBe('cod');
    expect(orderRes.body.data.order.status).toBe('pending');

    // stock decremented by 2
    expect((await Product.findById(product._id)).stock).toBe(98);

    // 4) CONFIRM ORDER (admin) — required before a shipment can be created
    const confirmRes = await request(app)
      .patch(`/api/v1/orders/${orderObjId}/status`)
      .set(auth(adminToken))
      .send({ status: 'confirmed', message: 'Payment confirmed (COD)' })
      .expect(200);
    expect(confirmRes.body.data.status).toBe('confirmed');

    // 5) CREATE SHIPMENT (admin) — hits the Ekart client in mock mode
    const shipRes = await request(app)
      .post('/api/v1/shipping/create-shipment')
      .set(auth(adminToken))
      .send({ orderId: orderObjId, serviceType: 'standard' })
      .expect(201);

    const trackingNumber = shipRes.body.data.shipment.trackingNumber;
    expect(trackingNumber).toMatch(/^MOCK\d+EK$/);
    expect(shipRes.body.data.shipment.carrier).toBe('Ekart');
    expect(shipRes.body.data.shipment.vendorWaybill).toEqual(expect.any(String));
    expect(shipRes.body.data.order.status).toBe('processing');

    // order persisted with the tracking id, under both the provider-agnostic field
    // and the legacy Ekart one (kept populated on the ekart path)
    const afterShip = await Order.findById(orderObjId);
    console.log('DEBUG AFTER SHIP SHIPPING:', afterShip.shipping);
    expect(afterShip.shipping.trackingNumber).toBe(trackingNumber);

    expect(afterShip.shipping.provider).toBe('ekart');
    expect(afterShip.shipping.providerShipmentId).toBe(trackingNumber);
    expect(afterShip.shipping.ekartShipmentId).toBe(trackingNumber);

    // 6) TRACK (customer) — open tracking via the mock Ekart track API
    const trackRes = await request(app)
      .get(`/api/v1/shipping/track/${trackingNumber}`)
      .set(auth(customerToken))
      .expect(200);

    expect(trackRes.body.data.tracking.currentStatus).toBe('In Transit');
    expect(trackRes.body.data.tracking.events.length).toBeGreaterThan(0);
    expect(trackRes.body.data.fallback).toBeUndefined(); // came from the (mock) carrier, not the timeline

    // 7) DELIVERY WEBHOOK — Ekart posts a signed track_updated event
    const webhookBody = {
      id: trackingNumber,
      wbn: afterShip.shipping.trackingNumber,
      status: 'Delivered',
      desc: 'Delivered to customer',
      location: 'Pune',
      ctime: Date.now()
    };
    const raw = JSON.stringify(webhookBody);
    const signature = crypto
      .createHmac('sha256', process.env.EKART_WEBHOOK_SECRET)
      .update(raw)
      .digest('hex');

    await request(app)
      .post('/api/v1/shipping/webhook')
      .set('x-ekart-signature', signature)
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200);

    // 8) DELIVERED — order reflects the delivery
    const delivered = await Order.findById(orderObjId);
    expect(delivered.status).toBe('delivered');
    expect(delivered.shipping.deliveredAt).toBeTruthy();
    expect(delivered.timeline.some((t) => t.status === 'Delivered')).toBe(true);


  }, 60000);

  it('rejects a delivery webhook with a bad signature', async () => {
    const body = JSON.stringify({ id: 'MOCK00000001EK', status: 'Delivered' });
    await request(app)
      .post('/api/v1/shipping/webhook')
      .set('x-ekart-signature', 'deadbeef')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
  });
});
