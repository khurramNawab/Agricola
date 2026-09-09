const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Warehouse = require('../src/models/Warehouse');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');

const seedDummyData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('--- Step 1: Seeding Admin Account ---');
    const adminPhone = '+917062201992';
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'changeme123';
    let adminUser = await User.findOne({ phone: adminPhone });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Admin User',
        phone: adminPhone,
        password: adminPassword,
        role: 'admin',
        status: 'active'
      });
      console.log(`✓ Admin user created: ${adminPhone}`);
    } else {
      adminUser.role = 'admin';
      adminUser.password = adminPassword;
      await adminUser.save();
      console.log(`✓ Admin user updated: ${adminPhone}`);
    }

    console.log('\n--- Step 2: Seeding Warehouses ---');
    const whPurnia = await Warehouse.findOneAndUpdate(
      { code: 'WH-PURNIA' },
      {
        $set: {
          code: 'WH-PURNIA',
          name: 'WH-Purnia (Bihar)',
          shiprocketPickupNickname: 'Home-1',
          address: {
            street: 'Naya tola line bazar',
            city: 'Purnia',
            state: 'Bihar',
            pincode: '854301'
          },
          spocName: 'Amit Shrivastav',
          spocPhone: '9012659000',
          isDefault: true,
          status: 'active'
        }
      },
      { upsert: true, new: true }
    );

    const whKaithal = await Warehouse.findOneAndUpdate(
      { code: 'WH-KAITHAL' },
      {
        $set: {
          code: 'WH-KAITHAL',
          name: 'WH-Kaithal (Haryana)',
          shiprocketPickupNickname: 'Home',
          address: {
            street: 'VPO Nauch, near PNB',
            city: 'Kaithal',
            state: 'Haryana',
            pincode: '136027'
          },
          spocName: 'Sanjay Raj Rana',
          spocPhone: '9012659000',
          isDefault: false,
          status: 'active'
        }
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Warehouses seeded: ${whPurnia.code}, ${whKaithal.code}`);

    console.log('\n--- Step 3: Seeding Category & Products ---');
    let category = await Category.findOne({ name: 'Snacks & Nuts' });
    if (!category) {
      category = await Category.create({
        name: 'Snacks & Nuts',
        description: 'Healthy farm fresh snacks and dry fruits',
        status: 'active'
      });
    }

    let product = await Product.findOne({ name: 'Premium Organic Makhana 200g' });
    if (!product) {
      product = await Product.create({
        name: 'Premium Organic Makhana 200g',
        price: 299,
        compareAtPrice: 350,
        stock: 50,
        category: category._id,
        description: 'Crispy high-quality organic makhana (foxnuts)',
        about: 'Rich in protein and anti-oxidants',
        usageInstructions: 'Roast with ghee and spices for healthy snacking',
        whyChoose: '100% natural, farm directly sourced',
        sizes: ['200g'],
        status: 'active'
      });
      console.log(`✓ Created test product: ${product.name}`);
    }

    // Set ProductWarehouseStock: WH-PURNIA = 50, WH-KAITHAL = 0 (for testing shortage check!)
    await ProductWarehouseStock.findOneAndUpdate(
      { product: product._id, warehouse: whPurnia._id },
      { stock: 50 },
      { upsert: true }
    );

    await ProductWarehouseStock.findOneAndUpdate(
      { product: product._id, warehouse: whKaithal._id },
      { stock: 0 },
      { upsert: true }
    );
    console.log(`✓ Product warehouse stock set (Purnia: 50, Kaithal: 0)`);

    console.log('\n--- Step 4: Seeding Dummy Order Awaiting Assignment ---');
    const existingOrder = await Order.findOne({ orderId: 'ORD-TEST-001' });
    if (!existingOrder) {
      await Order.create({
        orderId: 'ORD-TEST-001',
        user: adminUser._id,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 2,
            subtotal: product.price * 2
          }
        ],
        pricing: {
          subtotal: product.price * 2,
          shipping: 0,
          discount: 0,
          tax: 0,
          total: product.price * 2
        },
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'confirmed',
        awaitingWarehouseAssignment: true,
        shippingAddress: {
          name: 'Rajesh Kumar',
          phone: '+919876543210',
          street: '123 Main Market Road',
          city: 'Patna',
          state: 'Bihar',
          pincode: '800001',
          country: 'India'
        },
        timeline: [
          { status: 'confirmed', message: 'Order placed successfully', timestamp: new Date() }
        ]
      });
      console.log(`✓ Created test order ORD-TEST-001 (awaiting warehouse assignment)`);
    } else {
      console.log(`✓ Test order ORD-TEST-001 already exists`);
    }

    console.log('\n✅ Dummy testing data successfully injected into local MongoDB!');
  } catch (error) {
    console.error('❌ Error seeding dummy data:', error);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  seedDummyData();
}

module.exports = seedDummyData;
