/**
 * Diagnose why shipment creation fails: attempt a real create against Ekart and
 * capture the ACTUAL error. If it unexpectedly SUCCEEDS, immediately cancel it so
 * no courier is dispatched for this test order (and nothing is persisted).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./src/models/Order');
require('./src/models/User');
require('./src/models/Product');
const ekart = require('./src/utils/ekart');

const ORDER_ID = process.argv[2] || 'ORD-20260802-4706';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const order = await Order.findOne({ orderId: ORDER_ID }).populate('items.product', 'name weight dimensions');
  if (!order) { console.log('no order'); return mongoose.connection.close(); }

  const payload = ekart.buildShipmentPayload(order);
  console.log('mock mode            :', ekart.isMock());
  console.log('EKART_PICKUP_ALIAS   :', JSON.stringify(process.env.EKART_PICKUP_ALIAS || '(unset)'));
  console.log('pickup_location sent :', JSON.stringify(payload.pickup_location));
  console.log('existing tracking#   :', order.shipping?.trackingNumber || '-');
  console.log('\nAttempting ekart.createShipment …\n');

  try {
    const s = await ekart.createShipment(order);
    console.log('✅ CREATE SUCCEEDED — Ekart accepted it. tracking_id =', s.awbNumber);
    console.log('   (NOT persisted to the order.) Cancelling immediately so no courier is dispatched…');
    try {
      const c = await ekart.cancelShipment(s.awbNumber, 'diagnostic test — auto-cancel');
      console.log('   ↩︎ cancelled:', JSON.stringify(c));
    } catch (ce) {
      console.log('   ⚠︎ could not auto-cancel:', ce.response?.data?.remark || ce.message, '— you may need to cancel', s.awbNumber, 'in the Ekart portal.');
    }
    console.log('\n➡ CONCLUSION: shipment creation WORKS with the current config.');
  } catch (e) {
    console.log('❌ CREATE FAILED (HTTP ' + (e.response?.status || '?') + '):');
    console.log(JSON.stringify(e.response?.data || e.message, null, 2));
  }

  await mongoose.connection.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
