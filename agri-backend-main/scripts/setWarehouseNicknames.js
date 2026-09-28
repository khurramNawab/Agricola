/**
 * One-time migration: set shiprocketPickupNickname on both warehouses.
 *
 * Shiprocket pickup addresses (from Settings → Company Setup → Pick Up Address):
 *   "Home"   → Kaithal, Haryana,  136027  (PRIMARY)
 *   "Home-1" → Purnia,  Bihar,    854301
 *
 * Run: node scripts/setWarehouseNicknames.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MAPPINGS = [
  { pincode: '136027', nickname: 'Home',   city: 'Kaithal', state: 'Haryana' },
  { pincode: '854301', nickname: 'Home-1', city: 'Purnia',  state: 'Bihar'   }
];

const warehouseSchema = new mongoose.Schema({}, { strict: false });
const Warehouse = mongoose.model('Warehouse', warehouseSchema, 'warehouses');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  for (const { pincode, nickname, city, state } of MAPPINGS) {
    const wh = await Warehouse.findOne({ 'address.pincode': pincode });

    if (!wh) {
      console.warn(`No warehouse found with pincode ${pincode} (${city}, ${state}) — skipping.`);
      continue;
    }

    const old = wh.shiprocketPickupNickname || '(empty)';
    wh.shiprocketPickupNickname = nickname;
    await wh.save();

    console.log(`Warehouse "${wh.name || wh.code}" [${pincode}]`);
    console.log(`  shiprocketPickupNickname: "${old}" -> "${nickname}"\n`);
  }

  await mongoose.disconnect();
  console.log('Done. Server restart karo.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
