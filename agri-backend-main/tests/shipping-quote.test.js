// POST /api/v1/shipping/quote — the pre-checkout delivery answer the product page and
// cart gate rely on. Drives the real Express route against in-memory MongoDB with both
// carriers in mock mode.
//
// The contract that matters most: the charge quoted here must equal what
// POST /checkout/summary will charge for the same items and pincode.
process.env.SHIPPING_PROVIDER = 'shiprocket';
process.env.SHIPROCKET_MOCK = 'true';
process.env.EKART_MOCK = 'true';
process.env.FREE_SHIPPING_THRESHOLD = '500';
process.env.DEFAULT_SHIPPING_COST = '50';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const shipping = require('../src/utils/shipping');
const shiprocket = require('../src/utils/shiprocket');
const ekart = require('../src/utils/ekart');

let mongod;
let product;
let cheapProduct;
let customerToken;

const quote = (body) => request(app).post('/api/v1/shipping/quote').send(body);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/agricola_test');
  }
  await User.deleteMany({});
  await Product.deleteMany({});

  const customer = await User.create({ name: 'Asha Customer', phone: '+919876543210', role: 'customer' });

  customerToken = jwt.sign({ id: customer._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const base = {
    description: 'Tea',
    category: new mongoose.Types.ObjectId(),
    stock: 100,
    status: 'active',
    images: [{ url: 'https://example.com/tea.jpg', alt: 'Tea' }],
    weight: { value: 250, unit: 'g' },
    dimensions: { length: 15, width: 10, height: 6, unit: 'cm' }
  };
  product = await Product.create({ ...base, productId: 'P001', name: 'Assam CTC Tea', price: 300 });
  cheapProduct = await Product.create({ ...base, productId: 'P002', name: 'Sample Sachet', price: 99 });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(() => shipping._clearCoverageCache());

describe('POST /shipping/quote: validation', () => {
  it('rejects a malformed pincode', async () => {
    const res = await quote({ pincode: '41100' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    await quote({ pincode: '011001' }).expect(400); // must not start with 0
    await quote({}).expect(400);
  });
});

describe('POST /shipping/quote: coverage', () => {
  it('answers a bare pincode without pricing anything', async () => {
    const res = await quote({ pincode: '411001' }).expect(200);

    expect(res.body.data).toMatchObject({
      pincode: '411001',
      serviceable: true,
      provider: 'shiprocket',
      city: 'Mock City',
      state: 'Maharashtra',
      cod: true
    });
    expect(res.body.data.eta).toMatchObject({ date: expect.any(String) });
    expect(res.body.data.delivery).toBeNull(); // no items -> no charge
  });

  it('works for guests (no auth header)', async () => {
    const res = await quote({ pincode: '411001' }).expect(200);
    expect(res.body.success).toBe(true);
  });

  it('reports an unserviceable pincode when neither carrier covers it', async () => {
    const no = { pincode: '799999', serviceable: false, cod: false, city: null, state: null, charge: null, eta: null };
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue(no);
    jest.spyOn(ekart, 'getServiceability').mockResolvedValue(no);

    const res = await quote({ pincode: '799999', items: [{ productId: String(product._id), qty: 1 }] }).expect(200);

    expect(res.body.data.serviceable).toBe(false);
    expect(res.body.data.provider).toBeNull();
    expect(res.body.data.delivery).toBeNull(); // nothing to price for a lane we can't ship
  });

  it('is serviceable when only the fallback carrier covers the pincode', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue({
      pincode: '201301', serviceable: false, cod: false, city: null, state: null, charge: null, eta: null
    });

    const res = await quote({ pincode: '201301' }).expect(200);
    expect(res.body.data).toMatchObject({ serviceable: true, provider: 'ekart' });
  });

  it('fails open when every carrier is unreachable', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockRejectedValue(new Error('timeout'));
    jest.spyOn(ekart, 'getServiceability').mockRejectedValue(new Error('timeout'));

    const res = await quote({ pincode: '411001' }).expect(200);
    expect(res.body.data).toMatchObject({ serviceable: true, unverified: true });
  });
});

describe('POST /shipping/quote: delivery charge', () => {
  it('quotes the live carrier rate below the free-delivery threshold', async () => {
    const items = [{ productId: String(cheapProduct._id), qty: 1 }]; // ₹99 subtotal

    const res = await quote({ pincode: '411001', items }).expect(200);

    expect(res.body.data.delivery.free).toBe(false);
    expect(res.body.data.delivery.charge).toBeGreaterThan(0);
    expect(res.body.data.delivery.freeShippingThreshold).toBe(500);
  });

  it('is free above the threshold', async () => {
    const items = [{ productId: String(product._id), qty: 2 }]; // ₹600 subtotal

    const res = await quote({ pincode: '411001', items }).expect(200);

    expect(res.body.data.delivery).toMatchObject({ charge: 0, free: true });
  });

  it('matches what /checkout/summary charges for the same items and pincode', async () => {
    const items = [{ productId: String(cheapProduct._id), qty: 1 }];

    const quoted = await quote({ pincode: '411001', items }).expect(200);

    shipping._clearCoverageCache();
    const summary = await request(app)
      .post('/api/v1/checkout/summary')
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({ items: items.map((i) => ({ productId: i.productId, qty: i.qty })), toPincode: '411001' })
      .expect(200);

    expect(quoted.body.data.delivery.charge).toBe(summary.body.data.charges);
  });

  it('ignores unknown or malformed lines rather than failing the quote', async () => {
    const res = await quote({
      pincode: '411001',
      items: [
        { productId: String(cheapProduct._id), qty: 1 },
        { productId: 'does-not-exist', qty: 2 },
        { productId: String(product._id), qty: 0 }
      ]
    }).expect(200);

    expect(res.body.data.serviceable).toBe(true);
    // Priced from the one valid ₹99 line only, so still below the free threshold.
    expect(res.body.data.delivery.free).toBe(false);
  });
});
