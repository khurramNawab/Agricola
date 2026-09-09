// Regression test for the tea -> generic-agriculture field rename
// (brewingInstructions -> usageInstructions, admin API aboutTea -> about).
//
// Drives the real admin product create/get/update routes and the public
// product-detail route via supertest against an in-memory MongoDB, asserting:
//   - the renamed fields round-trip through create -> read -> update,
//   - the storefront serializer exposes `usageInstructions`,
//   - the old tea-specific keys (aboutTea / brewingInstructions) are gone.

const jwt = require('jsonwebtoken');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/server');
const User = require('../src/models/User');
const Category = require('../src/models/Category');

let mongod;
let adminToken;
let categoryId;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/agricola_test');
  }
  await User.deleteMany({});
  await Category.deleteMany({});

  const admin = await User.create({ name: 'Ops Admin', phone: '+919800000000', role: 'admin' });

  adminToken = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const category = await Category.create({ name: 'Grains & Pulses', status: 'active' });
  categoryId = category._id.toString();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Product content fields: about + usageInstructions round-trip', () => {
  let productMongoId;
  let productId;

  it('creates a product with `about` and `usageInstructions` (no tea-named keys)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set(auth(adminToken))
      .send({
        name: 'Organic Basmati Rice',
        category: categoryId,
        sellingPrice: 299,
        stock: 50,
        about: 'Premium long-grain basmati rice grown on organic farms.',
        usageInstructions: 'Rinse well, then cook 1 cup rice to 2 cups water for ~15 minutes.',
        whyChoose: 'Aromatic, fluffy, and responsibly sourced.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.about).toMatch(/organic farms/i);
    expect(res.body.data.usageInstructions).toMatch(/Rinse well/i);
    // The old tea-specific contract keys must not exist anymore.
    expect(res.body.data).not.toHaveProperty('aboutTea');
    expect(res.body.data).not.toHaveProperty('brewingInstructions');

    productMongoId = res.body.data.id;
    productId = res.body.data.productId;
  });

  it('returns the renamed fields from the admin detail route', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/products/${productMongoId}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.about).toMatch(/organic farms/i);
    expect(res.body.data.usageInstructions).toMatch(/Rinse well/i);
    expect(res.body.data).not.toHaveProperty('aboutTea');
    expect(res.body.data).not.toHaveProperty('brewingInstructions');
  });

  it('updates `usageInstructions` via the admin update route', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/products/${productMongoId}`)
      .set(auth(adminToken))
      .send({ usageInstructions: 'Store in a cool, dry place. Best used within 6 months.' });

    expect(res.status).toBe(200);
    expect(res.body.data.usageInstructions).toMatch(/cool, dry place/i);
  });

  it('exposes `usageInstructions` (not brewingInstructions) on the public product-detail route', async () => {
    const res = await request(app).get(`/api/v1/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.usageInstructions).toMatch(/cool, dry place/i);
    expect(res.body.data.about).toMatch(/organic farms/i);
    expect(res.body.data).not.toHaveProperty('brewingInstructions');
  });
});

describe('Best seller selection: admin featured flag drives /products/featured', () => {
  let mongoId;

  const isInFeatured = async () => {
    const res = await request(app).get('/api/v1/products/featured');
    expect(res.status).toBe(200);
    return (res.body.data || []).some((p) => p._id === mongoId);
  };

  it('creates a product flagged as a best seller (featured: true)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set(auth(adminToken))
      .send({
        name: 'Best Seller Toor Dal',
        category: categoryId,
        sellingPrice: 159,
        stock: 25,
        featured: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.featured).toBe(true);
    mongoId = res.body.data.id;
  });

  it('includes a featured product in the public best-sellers feed', async () => {
    expect(await isInFeatured()).toBe(true);
  });

  it('removes it from best sellers when the admin un-flags it (partial update)', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/products/${mongoId}`)
      .set(auth(adminToken))
      .send({ featured: false });

    expect(res.status).toBe(200);
    expect(res.body.data.featured).toBe(false);
    expect(await isInFeatured()).toBe(false);
  });

  it('re-adds it when the admin flags it again', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/products/${mongoId}`)
      .set(auth(adminToken))
      .send({ featured: true });

    expect(res.status).toBe(200);
    expect(res.body.data.featured).toBe(true);
    expect(await isInFeatured()).toBe(true);
  });
});
