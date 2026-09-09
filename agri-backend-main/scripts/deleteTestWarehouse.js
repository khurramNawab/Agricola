const mongoose = require('mongoose');
require('dotenv').config();

const Warehouse = require('../src/models/Warehouse');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');

const cleanup = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const testWh = await Warehouse.findOne({ code: 'WH-PATNA' });
    if (testWh) {
      console.log(`Found test warehouse WH-PATNA (ID: ${testWh._id}). Deleting...`);
      await ProductWarehouseStock.deleteMany({ warehouse: testWh._id });
      await Order.updateMany({ warehouse: testWh._id }, { $unset: { warehouse: 1 }, awaitingWarehouseAssignment: true });
      await Warehouse.deleteOne({ _id: testWh._id });
      console.log('✓ WH-PATNA deleted from database.');
    } else {
      console.log('✓ WH-PATNA not found in database (already clean).');
    }

    const allWhs = await Warehouse.find();
    console.log(`\nRemaining Warehouses in Database (${allWhs.length}):`);
    allWhs.forEach((w) => console.log(`- ${w.code} (${w.name}): ${w.address.city}, ${w.address.state}`));

  } catch (err) {
    console.error('Error deleting test warehouse:', err);
  } finally {
    await mongoose.disconnect();
  }
};

cleanup();
