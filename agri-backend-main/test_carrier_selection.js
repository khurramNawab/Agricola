require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function main() {
  await mongoose.connect(MONGO_URI);
  const User = require('./src/models/User');
  const Order = require('./src/models/Order');
  const Warehouse = require('./src/models/Warehouse');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) { console.log('NO_ADMIN_FOUND'); await mongoose.disconnect(); return; }

  const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
  const warehouses = await Warehouse.find({ status: 'active' }).limit(3).lean();
  const order = await Order.findOne({ status: { $in: ['pending','confirmed','processing'] } }).sort({ createdAt: -1 }).lean();

  console.log('=== Test Data ===');
  console.log('ADMIN:', admin.name || admin.phone);
  console.log('TOKEN:', token);
  console.log('');
  warehouses.forEach(w => console.log(`WAREHOUSE: ${w._id}  code=${w.code}  name=${w.name}  city=${w.address?.city}`));
  if (order) {
    console.log('');
    console.log(`ORDER: ${order._id}  num=${order.orderId}  status=${order.status}  items=${order.items?.length}`);
  } else {
    console.log('NO_ORDER_FOUND');
  }

  await mongoose.disconnect();
  console.log('\n=== Copy these curl commands ===');
  if (order && warehouses[0]) {
    const wid = warehouses[0]._id;
    const oid = order._id;
    console.log(`\n# 1. Assign + Shiprocket`);
    console.log(`curl -s -X PUT http://localhost:5000/api/v1/admin/orders/${oid}/assign-warehouse -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\"warehouseId\":\"${wid}\",\"shippingProvider\":\"shiprocket\"}" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).success"`);
    console.log(`\n# 2. Assign + Ekart`);
    console.log(`curl -s -X PUT http://localhost:5000/api/v1/admin/orders/${oid}/assign-warehouse -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\"warehouseId\":\"${wid}\",\"shippingProvider\":\"ekart\"}"`);
    console.log(`\n# 3. No provider (fallback)`);
    console.log(`curl -s -X PUT http://localhost:5000/api/v1/admin/orders/${oid}/assign-warehouse -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\"warehouseId\":\"${wid}\"}"`);
  }
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
