/**
 * Migration Script: Seed Warehouses & Migrate Existing Products / Orders
 *
 * Idempotent: safe to run multiple times without duplicating data.
 * Seeds 2 verified Shiprocket warehouses, initializes ProductWarehouseStock for all products,
 * and stamps existing historical orders with the default warehouse.
 *
 * NOTE FOR DEVELOPERS & OPERATORS:
 * This app currently supports exactly the 2 pre-registered client warehouses.
 * Adding a third warehouse in the future requires:
 * (a) registering it in the Shiprocket dashboard first,
 * (b) manually inserting a matching Warehouse document in this app's database with the exact matching shiprocketPickupNickname.
 * This is intentionally not self-service from the admin UI to prevent shipment booking failures.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');

const SEED_WAREHOUSES = [
  {
    code: 'WH-PURNIA',
    name: 'WH-Purnia (Bihar)',
    shiprocketPickupNickname: 'Home-1',
    address: {
      street: 'House 00, Agricola, Naya tola line bazar, near Pani tanki, Behind veterinary hospital',
      city: 'Purnia',
      state: 'Bihar',
      pincode: '854301'
    },
    spocName: 'Amit Shrivastav',
    spocPhone: '9012659000',
    isDefault: true,
    status: 'active'
  },
  {
    code: 'WH-KAITHAL',
    name: 'WH-Kaithal (Haryana)',
    shiprocketPickupNickname: 'Home',
    address: {
      street: 'Flat 00, VPO Nauch, near PNB Bank',
      city: 'Kaithal',
      state: 'Haryana',
      pincode: '136027'
    },
    spocName: 'Sanjay Raj Rana',
    spocPhone: '9012659000',
    isDefault: false,
    status: 'active'
  }
];

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('--- Step 1: Seeding / Upserting Warehouses ---');
    const warehouseDocs = {};
    for (const wh of SEED_WAREHOUSES) {
      const doc = await Warehouse.findOneAndUpdate(
        { code: wh.code },
        { $set: wh },
        { upsert: true, new: true, runValidators: true }
      );
      warehouseDocs[wh.code] = doc;
      console.log(`✓ Warehouse ${wh.code} (${wh.name}) upserted. ID: ${doc._id}`);
    }

    const defaultWarehouse = warehouseDocs['WH-PURNIA'];
    if (!defaultWarehouse) {
      throw new Error('Default warehouse WH-PURNIA not found after upsert');
    }

    console.log('\n--- Step 2: Initializing ProductWarehouseStock for existing products ---');
    const products = await Product.find();
    let productStockCreated = 0;
    for (const p of products) {
      const existing = await ProductWarehouseStock.findOne({
        product: p._id,
        warehouse: defaultWarehouse._id
      });

      if (!existing) {
        await ProductWarehouseStock.create({
          product: p._id,
          warehouse: defaultWarehouse._id,
          stock: p.stock || 0
        });
        productStockCreated++;
      }
    }
    console.log(`✓ Processed ${products.length} products (${productStockCreated} new warehouse stock entries created for WH-PURNIA).`);

    console.log('\n--- Step 3: Stamping historical orders with Default Warehouse ---');
    const result = await Order.updateMany(
      { $or: [{ warehouse: null }, { warehouse: { $exists: false } }] },
      {
        $set: {
          warehouse: defaultWarehouse._id,
          awaitingWarehouseAssignment: false
        }
      }
    );
    console.log(`✓ Updated ${result.modifiedCount} historical orders to WH-PURNIA (awaitingWarehouseAssignment: false).`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  migrate();
}

module.exports = migrate;
