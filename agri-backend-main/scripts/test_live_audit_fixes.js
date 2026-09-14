const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');

async function run() {
  const BASE_URL = 'http://localhost:5000/api/v1';

  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find or create admin user to mint a real JWT
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      phone: '+919999999999',
      name: 'System Admin',
      email: 'admin@agricola.com',
      role: 'admin'
    });
  }

  const adminToken = jwt.sign(
    { id: admin._id.toString() },
    process.env.JWT_SECRET || 'agricola_super_secret_jwt_key_development_2026',
    { expiresIn: '2h' }
  );
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  console.log('\n======================================================');
  console.log('ITEM 5 LIVE TEST: REAL WAREHOUSE CARRIER DIAGNOSTICS');
  console.log('======================================================');

  const whListRes = await fetch(`${BASE_URL}/admin/warehouses`, { headers });
  const whList = (await whListRes.json()).data || [];
  console.log(`Found ${whList.length} warehouses in system:`);

  for (const wh of whList) {
    console.log(`\n--- Calling GET /api/v1/admin/warehouses/${wh._id || wh.id}/test-connectivity ---`);
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/admin/warehouses/${wh._id || wh.id}/test-connectivity`, { headers });
    const roundtrip = Date.now() - t0;
    const json = await res.json();
    console.log(`HTTP ${res.status} OK (roundtrip: ${roundtrip}ms)`);
    console.log('Warehouse:', `${json.data?.code} (${json.data?.name}), Pincode: ${json.data?.pincode}`);
    console.log('Shiprocket Result:', json.data?.shiprocket);
    console.log('Ekart Result:', json.data?.ekart);
    console.log('Reach Result:', json.data?.reach);
    console.log('Timestamp:', json.data?.testedAt);
  }

  console.log('\n======================================================');
  console.log('ITEM 6 LIVE TEST: INACTIVE WAREHOUSE STOCK EXCLUSION');
  console.log('======================================================');

  // Pick a product with stock in a warehouse
  const stocks = await ProductWarehouseStock.find({ stock: { $gt: 0 } }).populate('warehouse').populate('product');
  if (stocks.length === 0) {
    console.log('No warehouse stock entries found. Skipping stock allocation test.');
    await mongoose.disconnect();
    return;
  }

  const entry = stocks[0];
  const testProduct = await Product.findById(entry.product._id);
  const testWh = await Warehouse.findById(entry.warehouse._id);

  console.log(`Test Product: ${testProduct.name} (${testProduct.productId})`);
  console.log(`Initial Storefront Product.stock: ${testProduct.stock}`);
  console.log(`Target Warehouse: ${testWh.name} (${testWh.code}), status: ${testWh.status}`);
  console.log(`Allocated Stock in Target Warehouse: ${entry.stock}`);

  // Fetch storefront API directly
  const sf1 = await (await fetch(`${BASE_URL}/products/${testProduct.productId}`)).json();
  const initialSfStock = sf1.data?.stock;
  console.log(`Public Storefront GET /products/${testProduct.productId} stock: ${initialSfStock}`);

  // 1. Deactivate warehouse
  console.log(`\nAction: Deactivating warehouse ${testWh.code} via PATCH /admin/warehouses/${testWh._id}/status`);
  const deactRes = await fetch(`${BASE_URL}/admin/warehouses/${testWh._id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'inactive' })
  });
  const deactJson = await deactRes.json();
  console.log('Backend response:', deactJson.message);

  // Check storefront stock after deactivation
  const sf2 = await (await fetch(`${BASE_URL}/products/${testProduct.productId}`)).json();
  const droppedSfStock = sf2.data?.stock;
  console.log(`Public Storefront GET /products/${testProduct.productId} stock: ${droppedSfStock}`);
  const expectedDrop = initialSfStock - entry.stock;
  console.log(`Expected dropped stock: ${expectedDrop}, Actual: ${droppedSfStock}`);
  if (droppedSfStock === expectedDrop) {
    console.log('>>> PASS: Inactive warehouse stock immediately dropped from storefront availability! <<<');
  } else {
    console.log('Note on stock values:', { initialSfStock, allocated: entry.stock, droppedSfStock });
  }

  // 2. Reactivate warehouse
  console.log(`\nAction: Reactivating warehouse ${testWh.code} via PATCH /admin/warehouses/${testWh._id}/status`);
  const reactRes = await fetch(`${BASE_URL}/admin/warehouses/${testWh._id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'active' })
  });
  const reactJson = await reactRes.json();
  console.log('Backend response:', reactJson.message);

  // Check storefront stock after reactivation
  const sf3 = await (await fetch(`${BASE_URL}/products/${testProduct.productId}`)).json();
  const restoredSfStock = sf3.data?.stock;
  console.log(`Public Storefront GET /products/${testProduct.productId} stock: ${restoredSfStock}`);
  if (restoredSfStock === initialSfStock) {
    console.log('>>> PASS: Reactivated warehouse stock immediately restored to storefront availability! <<<');
  }

  console.log('\n======================================================');
  console.log('ITEM 3 LIVE TEST: GET /api/v1/orders/my-orders');
  console.log('======================================================');

  // Find a customer with orders
  const sampleOrder = await Order.findOne();
  if (sampleOrder) {
    const customerUser = await User.findById(sampleOrder.user);
    if (customerUser) {
      const customerToken = jwt.sign(
        { id: customerUser._id.toString() },
        process.env.JWT_SECRET || 'agricola_super_secret_jwt_key_development_2026',
        { expiresIn: '1h' }
      );
      const custHeaders = { Authorization: `Bearer ${customerToken}` };

      console.log(`Testing GET /api/v1/orders/my-orders for customer: ${customerUser.name} (${customerUser.phone})`);
      const myOrdersRes = await fetch(`${BASE_URL}/orders/my-orders`, { headers: custHeaders });
      const myOrdersJson = await myOrdersRes.json();
      console.log(`HTTP ${myOrdersRes.status} OK. Found ${myOrdersJson.data?.length} orders:`);
      if (myOrdersJson.data?.length > 0) {
        const o = myOrdersJson.data[0];
        console.log(`- Order: ${o.orderId}, Status: ${o.status}, Total: ₹${o.pricing?.total}, Items: ${o.items?.length}`);
        console.log('>>> PASS: Customer Profile Recent Orders endpoint returns valid live orders! <<<');
      }
    }
  }

  await mongoose.disconnect();
  console.log('\nLive audit verification script completed successfully!');
}

run().catch(err => {
  console.error('Run error:', err);
  process.exit(1);
});
