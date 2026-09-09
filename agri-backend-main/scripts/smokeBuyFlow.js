/**
 * End-to-end smoke test for the storefront buy-flow.
 *
 * Run with a MongoDB available:
 *   node scripts/smokeBuyFlow.js
 *
 * It mints a JWT directly (so no SMS/OTP or Razorpay keys are needed),
 * seeds a category + product, then walks the full flow:
 *   catalog -> address -> cart -> checkout summary -> place order (COD)
 *   -> fetch order -> guest track. Cleans up after itself.
 */
require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test'; // avoid binding the listen port
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Order = require('../src/models/Order');
const Address = require('../src/models/Address');
const Cart = require('../src/models/Cart');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log((pass ? 'PASS' : 'FAIL').padEnd(5), name, detail && !pass ? `→ ${detail}` : '');
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola');

  // --- seed ---
  const stamp = Date.now();
  const category = await Category.create({ name: `Smoke Grains ${stamp}`, status: 'active' });
  const product = await Product.create({
    productId: `SMK${stamp}`,
    name: 'Smoke Test Basmati Rice',
    description: 'For smoke testing',
    price: 699,
    compareAtPrice: 999,
    category: category._id,
    stock: 50,
    status: 'active',
    sizes: ['250g', '500g'],
    images: [{ url: 'https://example.com/rice.jpg' }],
    rating: { average: 4, count: 10 },
    tags: ['Organic'],
    featured: true
  });
  const user = await User.create({
    userId: `SMKU${stamp}`,
    phone: `+9190000${String(stamp).slice(-5)}`,
    name: 'Smoke User',
    role: 'customer',
    phoneVerified: true
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production', { expiresIn: '1h' });
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  try {
    // --- catalog ---
    const list = await request(app).get('/api/v1/products');
    check('GET /products returns storefront shape', list.status === 200 && list.body.data.some(p => p.title === 'Smoke Test Basmati Rice' && p.oldPrice === 999));

    const featured = await request(app).get('/api/v1/products/featured');
    check('GET /products/featured', featured.status === 200 && featured.body.data.length >= 1);

    const detail = await request(app).get(`/api/v1/products/${product.productId}`);
    check('GET /products/:id by productId', detail.status === 200 && detail.body.data.id === product.productId);

    const cats = await request(app).get('/api/v1/categories');
    check('GET /categories shape {id,name,productCount}', cats.status === 200 && cats.body.data.some(c => typeof c.productCount === 'number'));

    // --- address ---
    const addr = await auth(request(app).post('/api/v1/addresses')).send({
      name: 'Smoke User', mobile: '9876543210', pincode: '560001', state: 'Karnataka',
      house: '12', address: 'MG Road', locality: 'Central', city: 'Bangalore', type: 'Home'
    });
    check('POST /addresses', addr.status === 201 && !!addr.body.data.id);
    const addressId = addr.body.data.id;

    // --- cart ---
    const add = await auth(request(app).post('/api/v1/cart/items')).send({ productId: product.productId, weight: '250g', qty: 2 });
    check('POST /cart/items', add.status === 201 && add.body.data.subtotal === 1398 && add.body.data.items[0].qty === 2);

    const getCart = await auth(request(app).get('/api/v1/cart'));
    check('GET /cart', getCart.status === 200 && getCart.body.data.itemCount === 2);

    // --- checkout summary ---
    const summary = await auth(request(app).post('/api/v1/checkout/summary')).send({
      items: [{ productId: product.productId, weight: '250g', qty: 2 }]
    });
    // subtotal 1398 >= free-shipping threshold 500 → charges 0
    check('POST /checkout/summary money shape', summary.status === 200 &&
      summary.body.data.subtotal === 1398 && summary.body.data.charges === 0 && summary.body.data.total === 1398);

    // --- place order (COD, no gateway needed) ---
    const place = await auth(request(app).post('/api/v1/orders')).send({
      items: [{ productId: product.productId, weight: '250g', qty: 2 }],
      shippingAddressId: addressId,
      billingAddress: 'same',
      paymentMethod: 'cod',
      email: 'smoketest@gmail.com'
    });
    check('POST /orders (COD)', place.status === 201 && /^ORD-\d{8}-\d{4}$/.test(place.body.data.orderId) && place.body.data.payment.gateway === 'cod', JSON.stringify(place.body));
    const orderId = place.body.data.orderId;

    // stock decremented 50 -> 48
    const afterStock = await Product.findById(product._id).select('stock');
    check('stock decremented after order', afterStock.stock === 48, `stock=${afterStock.stock}`);

    // cart cleared
    const cartAfter = await auth(request(app).get('/api/v1/cart'));
    check('cart cleared after order', cartAfter.body.data.itemCount === 0);

    // --- fetch + track ---
    const mine = await auth(request(app).get('/api/v1/orders'));
    check('GET /orders lists the order', mine.status === 200 && mine.body.data.some(o => o.orderId === orderId));

    const track = await request(app).post('/api/v1/orders/track').send({ orderId, mobile: '9876543210' });
    check('POST /orders/track (guest)', track.status === 200 && track.body.data.orderId === orderId && Array.isArray(track.body.data.timeline));

    const trackBad = await request(app).post('/api/v1/orders/track').send({ orderId, mobile: '0000000000' });
    check('POST /orders/track rejects wrong mobile', trackBad.status === 404);
  } finally {
    // --- cleanup ---
    await Promise.all([
      Order.deleteMany({ user: user._id }),
      Cart.deleteMany({ user: user._id }),
      Address.deleteMany({ user: user._id }),
      Product.deleteOne({ _id: product._id }),
      Category.deleteOne({ _id: category._id }),
      User.deleteOne({ _id: user._id })
    ]);
    await mongoose.connection.close();
  }

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR:', e); process.exit(1); });
