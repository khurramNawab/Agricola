// Route-level Shiprocket flow: admin books a shipment -> customer tracks it ->
// the status webhook marks it delivered. Drives the real Express routes via supertest
// against an in-memory MongoDB with Shiprocket in mock mode (no sandbox exists).
//
// The equivalent flow for the rollback provider lives in e2e-order-flow.test.js.
process.env.SHIPPING_PROVIDER = 'shiprocket';
process.env.SHIPROCKET_MOCK = 'true';
process.env.SHIPROCKET_PICKUP_LOCATION = 'Home';
process.env.SHIPROCKET_WEBHOOK_TOKEN = 'test-shiprocket-webhook-token';
process.env.AUTO_CREATE_SHIPMENT = 'false'; // booked explicitly via the admin route

const jwt = require('jsonwebtoken');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');

let mongod;
let customer;
let admin;
let product;
let customerToken;
let adminToken;

const tokenFor = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/agricola_test');
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
  if (mongod) await mongod.stop();
});

const makeConfirmedOrder = (overrides = {}) =>
  Order.create({
    user: customer._id,
    email: 'asha@example.com',
    items: [{ product: product._id, name: product.name, weight: '250g', price: 300, quantity: 2, subtotal: 600 }],
    shippingAddress: {
      name: 'Asha Customer',
      phone: '9876543210',
      street: '12 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001'
    },
    pricing: { subtotal: 600, shipping: 55, total: 655 },
    paymentMethod: 'cod',
    status: 'confirmed',
    ...overrides
  });

describe('Shiprocket route flow: book -> track -> webhook', () => {
  it('books a shipment, persists provider fields, tracks it and marks it delivered', async () => {
    const order = await makeConfirmedOrder();

    // 1) BOOK (admin) — hits the Shiprocket client in mock mode
    const shipRes = await request(app)
      .post('/api/v1/shipping/create-shipment')
      .set(auth(adminToken))
      .send({ orderId: String(order._id), serviceType: 'standard' })
      .expect(201);

    const awb = shipRes.body.data.shipment.trackingNumber;
    expect(awb).toMatch(/^MOCK\d{9}SR$/);
    expect(shipRes.body.data.shipment.courierName).toBe('Mock Surface'); // cheapest courier
    expect(shipRes.body.data.shipment.labelUrl).toContain('.pdf');
    expect(shipRes.body.data.order.status).toBe('processing');

    const booked = await Order.findById(order._id);
    expect(booked.shipping.provider).toBe('shiprocket');
    expect(booked.shipping.trackingNumber).toBe(awb);
    expect(booked.shipping.carrier).toBe('Mock Surface');
    expect(booked.shipping.providerShipmentId).toMatch(/^\d+$/);
    expect(booked.shipping.providerOrderId).toMatch(/^\d+$/);
    expect(booked.shipping.labelUrl).toBeTruthy();
    expect(booked.shipping.method).toBe('standard'); // enum-safe
    expect(booked.shipping.ekartShipmentId).toBeUndefined(); // legacy field untouched
    expect(booked.timeline.some((t) => t.status === 'shipment_created')).toBe(true);

    // 2) DOUBLE-BOOK is refused
    await request(app)
      .post('/api/v1/shipping/create-shipment')
      .set(auth(adminToken))
      .send({ orderId: String(order._id) })
      .expect(400);

    // 3) TRACK (customer) — normalized through the provider facade
    const trackRes = await request(app)
      .get(`/api/v1/shipping/track/${awb}`)
      .set(auth(customerToken))
      .expect(200);

    expect(trackRes.body.data.tracking.currentStatus).toBe('In Transit');
    expect(trackRes.body.data.tracking.events.length).toBeGreaterThan(0);
    expect(trackRes.body.data.fallback).toBeUndefined(); // came from the (mock) carrier

    // 4) WEBHOOK — Shiprocket posts a delivered status with its custom header token
    await request(app)
      .post('/api/v1/shipping/webhook/tracking')
      .set('x-api-key', process.env.SHIPROCKET_WEBHOOK_TOKEN)
      .send({
        awb,
        current_status: 'DELIVERED',
        current_timestamp: '2026-08-18 16:45:00',
        courier_name: 'Mock Surface',
        scans: [{ location: 'Pune', date: '2026-08-18 16:45:00', activity: 'Delivered to consignee' }]
      })
      .expect(200);

    const delivered = await Order.findById(order._id);
    expect(delivered.status).toBe('delivered');
    expect(delivered.shipping.deliveredAt).toBeTruthy();
    expect(delivered.timeline.some((t) => t.status === 'DELIVERED')).toBe(true);
  });

  it('cancels a booked shipment through the provider facade', async () => {
    const order = await makeConfirmedOrder();
    await request(app)
      .post('/api/v1/shipping/create-shipment')
      .set(auth(adminToken))
      .send({ orderId: String(order._id) })
      .expect(201);

    const res = await request(app)
      .post(`/api/v1/shipping/${order._id}/cancel`)
      .set(auth(adminToken))
      .send({ reason: 'Customer changed their mind' })
      .expect(200);

    // A real carrier cancellation (not the manual fallback path).
    expect(res.body.warning).toBeUndefined();
    const cancelled = await Order.findById(order._id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.timeline.some((t) => t.status === 'shipment_cancelled')).toBe(true);
  });

  // A pincode only Ekart covers is stamped shipping.provider='ekart' at order creation;
  // that order must book and track with Ekart even while Shiprocket is the default.
  it('books and tracks an ekart-stamped order with Ekart, not the active provider', async () => {
    process.env.EKART_MOCK = 'true';
    const order = await makeConfirmedOrder({ shipping: { provider: 'ekart' } });

    const shipRes = await request(app)
      .post('/api/v1/shipping/create-shipment')
      .set(auth(adminToken))
      .send({ orderId: String(order._id) })
      .expect(201);

    const awb = shipRes.body.data.shipment.trackingNumber;
    expect(awb).toMatch(/^MOCK\d+EK$/);              // Ekart's id format, not Shiprocket's
    expect(shipRes.body.data.shipment.carrier).toBe('Ekart');

    const booked = await Order.findById(order._id);
    expect(booked.shipping.provider).toBe('ekart');
    expect(booked.shipping.ekartShipmentId).toBe(awb); // legacy field kept on the ekart path

    // Tracking must go back to the carrier that issued the AWB.
    const trackRes = await request(app)
      .get(`/api/v1/shipping/track/${awb}`)
      .set(auth(customerToken))
      .expect(200);
    expect(trackRes.body.data.tracking.currentStatus).toBe('In Transit');
    expect(trackRes.body.data.fallback).toBeUndefined();
  });

  it('serves live serviceability + rates for the storefront', async () => {
    const serv = await request(app).get('/api/v1/shipping/serviceability/411001').expect(200);
    expect(serv.body.data).toMatchObject({ pincode: '411001', serviceable: true, cod: true, state: 'Maharashtra' });

    const rate = await request(app)
      .post('/api/v1/shipping/calculate')
      .set(auth(customerToken))
      .send({ toPincode: '411001', weight: 0.7, declaredValue: 600 })
      .expect(200);

    expect(rate.body.data.fallback).toBeUndefined(); // quoted by the provider, not flat-rate
    expect(rate.body.data.rates[0].cost).toBeGreaterThan(0);
  });
});
