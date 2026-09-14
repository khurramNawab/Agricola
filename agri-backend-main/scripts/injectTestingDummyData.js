/**
 * Injects comprehensive dummy test data into local MongoDB:
 * - Admin and multiple test customer users
 * - Multiple products across categories with per-warehouse stock
 * - Active Warehouses (Purnia, Guwahati, Kaithal)
 * - Diverse Orders in different lifecycle states (Awaiting Assignment, Confirmed, Processing, Shipped, Delivered, Refunded)
 * - Complete Payment transaction records (Razorpay Paid, COD Pending, Refunded)
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Warehouse = require('../src/models/Warehouse');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');

async function inject() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);

  console.log('\n--- 1. Admin & Test Customers ---');
  const adminPhone = '+917062201992';
  let admin = await User.findOne({ phone: adminPhone });
  if (!admin) {
    admin = await User.create({
      name: 'Admin User',
      phone: adminPhone,
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'changeme123',
      role: 'admin',
      status: 'active'
    });
  }

  const customersData = [
    { name: 'Rahul Sharma', phone: '+919876543210', email: 'rahul.sharma@gmail.com', city: 'Patna', state: 'Bihar', pincode: '800001' },
    { name: 'Priya Patel', phone: '+919812345678', email: 'priya.patel@outlook.com', city: 'Guwahati', state: 'Assam', pincode: '781005' },
    { name: 'Amit Verma', phone: '+919823456789', email: 'amit.verma@yahoo.com', city: 'Kaithal', state: 'Haryana', pincode: '136027' },
    { name: 'Sunita Roy', phone: '+919834567890', email: 'sunita.roy@gmail.com', city: 'Kolkata', state: 'West Bengal', pincode: '700001' }
  ];

  const customers = [];
  for (const c of customersData) {
    let u = await User.findOne({ phone: c.phone });
    if (!u) {
      u = await User.create({
        name: c.name,
        phone: c.phone,
        email: c.email,
        password: 'password123',
        role: 'customer',
        status: 'active'
      });
    }
    customers.push({ user: u, meta: c });
  }
  console.log(`✓ Seeded ${customers.length} test customers`);

  console.log('\n--- 2. Warehouses ---');
  const whPurnia = await Warehouse.findOneAndUpdate(
    { code: 'WH-PURNIA' },
    {
      $set: {
        name: 'WH-Purnia (Bihar)',
        shiprocketPickupNickname: 'Home-1',
        ekartPickupAlias: 'PURNIA, Bihar',
        address: { street: 'Naya Tola, Line Bazar', city: 'Purnia', state: 'Bihar', pincode: '854301', phone: '9012659000' },
        spocName: 'Amit Shrivastav',
        spocPhone: '9012659000',
        isDefault: true,
        status: 'active'
      }
    },
    { upsert: true, new: true }
  );

  const whGuwahati = await Warehouse.findOneAndUpdate(
    { code: 'WH-ASSAM' },
    {
      $set: {
        name: 'WH-Guwahati (Assam)',
        shiprocketPickupNickname: 'Guwahati-Hub',
        ekartPickupAlias: 'Flat 2c',
        address: { street: 'GS Road, Dispur', city: 'Guwahati', state: 'Assam', pincode: '781005', phone: '9012659001' },
        spocName: 'Pranab Bora',
        spocPhone: '9012659001',
        isDefault: false,
        status: 'active'
      }
    },
    { upsert: true, new: true }
  );

  const whKaithal = await Warehouse.findOneAndUpdate(
    { code: 'WH-KAITHAL' },
    {
      $set: {
        name: 'WH-Kaithal (Haryana)',
        shiprocketPickupNickname: 'Home',
        ekartPickupAlias: 'Prempura Street',
        address: { street: 'VPO Nauch, Near PNB', city: 'Kaithal', state: 'Haryana', pincode: '136027', phone: '9012659002' },
        spocName: 'Sanjay Raj Rana',
        spocPhone: '9012659002',
        isDefault: false,
        status: 'active'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Warehouses verified: ${whPurnia.code}, ${whGuwahati.code}, ${whKaithal.code}`);

  console.log('\n--- 3. Categories & Products ---');
  let catSnacks = await Category.findOneAndUpdate(
    { name: 'Snacks & Nuts' },
    { $set: { name: 'Snacks & Nuts', slug: 'snacks-nuts', status: 'active' } },
    { upsert: true, new: true }
  );

  let catSpices = await Category.findOneAndUpdate(
    { name: 'Organic Spices' },
    { $set: { name: 'Organic Spices', slug: 'organic-spices', status: 'active' } },
    { upsert: true, new: true }
  );

  let catOils = await Category.findOneAndUpdate(
    { name: 'Cold-Pressed Oils' },
    { $set: { name: 'Cold-Pressed Oils', slug: 'cold-pressed-oils', status: 'active' } },
    { upsert: true, new: true }
  );

  const productsConfig = [
    { productId: 'P001', name: 'Premium Organic Makhana 200g', price: 299, compareAtPrice: 350, category: catSnacks._id, stock: 120, sizes: ['200g', '500g'], tags: ['Makhana', 'Superfood', 'Healthy Snack'], whStock: { purnia: 80, guwahati: 20, kaithal: 20 } },
    { productId: 'P002', name: 'Raw Organic Chia Seeds 250g', price: 199, compareAtPrice: 249, category: catSnacks._id, stock: 95, sizes: ['250g', '500g'], tags: ['Chia Seeds', 'Omega-3', 'Fiber'], whStock: { purnia: 50, guwahati: 15, kaithal: 30 } },
    { productId: 'P003', name: 'Lakadong High-Curcumin Turmeric 100g', price: 149, compareAtPrice: 180, category: catSpices._id, stock: 150, sizes: ['100g', '250g'], tags: ['Turmeric', 'Curcumin', 'Spices'], whStock: { purnia: 60, guwahati: 50, kaithal: 40 } },
    { productId: 'P004', name: 'Cold-Pressed Yellow Mustard Oil 1L', price: 329, compareAtPrice: 380, category: catOils._id, stock: 75, sizes: ['1L', '2L', '5L'], tags: ['Mustard Oil', 'Cold Pressed', 'Kachi Ghani'], whStock: { purnia: 40, guwahati: 10, kaithal: 25 } },
    { productId: 'P005', name: 'Raw Forest Wildflower Honey 500g', price: 449, compareAtPrice: 499, category: catSnacks._id, stock: 60, sizes: ['500g', '1kg'], tags: ['Raw Honey', 'Organic Honey', 'Natural'], whStock: { purnia: 30, guwahati: 10, kaithal: 20 } }
  ];

  const seededProducts = [];
  for (const pc of productsConfig) {
    const p = await Product.findOneAndUpdate(
      { productId: pc.productId },
      {
        $set: {
          productId: pc.productId,
          name: pc.name,
          price: pc.price,
          compareAtPrice: pc.compareAtPrice,
          stock: pc.stock,
          category: pc.category,
          description: `Finest grade 100% certified organic ${pc.name}`,
          about: 'Farm directly sourced, zero adulteration, naturally processed.',
          usageInstructions: 'Consume daily as part of a wholesome, healthy diet.',
          whyChoose: 'Sustainable farming, third-party lab tested for purity.',
          sizes: pc.sizes,
          tags: pc.tags,
          status: 'active'
        }
      },
      { upsert: true, new: true }
    );
    seededProducts.push(p);

    // Seed per-warehouse stock
    await ProductWarehouseStock.findOneAndUpdate({ product: p._id, warehouse: whPurnia._id }, { stock: pc.whStock.purnia }, { upsert: true });
    await ProductWarehouseStock.findOneAndUpdate({ product: p._id, warehouse: whGuwahati._id }, { stock: pc.whStock.guwahati }, { upsert: true });
    await ProductWarehouseStock.findOneAndUpdate({ product: p._id, warehouse: whKaithal._id }, { stock: pc.whStock.kaithal }, { upsert: true });
  }
  console.log(`✓ Seeded ${seededProducts.length} products with live warehouse stock`);

  console.log('\n--- 4. Seeding Diverse Orders & Payment Transactions ---');

  const pMakhana = seededProducts[0];
  const pChia = seededProducts[1];
  const pTurmeric = seededProducts[2];
  const pOil = seededProducts[3];
  const pHoney = seededProducts[4];

  const dummyOrders = [
    {
      orderId: 'ORD-20260911-1001',
      customerIndex: 0,
      items: [{ product: pMakhana, qty: 2 }],
      warehouse: null,
      awaitingWarehouseAssignment: true,
      status: 'confirmed',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayPaymentId: 'pay_Qz1001_Makhana01',
      razorpayOrderId: 'order_Rz1001_Makhana01',
      shipping: {}
    },
    {
      orderId: 'ORD-20260911-1002',
      customerIndex: 1,
      items: [{ product: pChia, qty: 1 }, { product: pHoney, qty: 1 }],
      warehouse: whPurnia._id,
      awaitingWarehouseAssignment: false,
      status: 'confirmed',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayPaymentId: 'pay_Qz1002_HoneyChia02',
      razorpayOrderId: 'order_Rz1002_HoneyChia02',
      shipping: { provider: 'shiprocket', carrier: 'Blue Dart' }
    },
    {
      orderId: 'ORD-20260911-1003',
      customerIndex: 2,
      items: [{ product: pOil, qty: 2 }, { product: pTurmeric, qty: 2 }],
      warehouse: whPurnia._id,
      awaitingWarehouseAssignment: false,
      status: 'processing',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayPaymentId: 'pay_Qz1003_MustardOil03',
      razorpayOrderId: 'order_Rz1003_MustardOil03',
      shipping: { provider: 'shiprocket', carrier: 'Delhivery', trackingNumber: 'SR1092837482', courierName: 'Delhivery Surface' }
    },
    {
      orderId: 'ORD-20260911-1004',
      customerIndex: 3,
      items: [{ product: pHoney, qty: 1 }],
      warehouse: whKaithal._id,
      awaitingWarehouseAssignment: false,
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      razorpayPaymentId: null,
      shipping: { provider: 'ekart', carrier: 'Ekart Logistics', trackingNumber: 'EK9988776655IN', courierName: 'Ekart Ground' }
    },
    {
      orderId: 'ORD-20260911-1005',
      customerIndex: 0,
      items: [{ product: pMakhana, qty: 3 }, { product: pOil, qty: 1 }],
      warehouse: whPurnia._id,
      awaitingWarehouseAssignment: false,
      status: 'delivered',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayPaymentId: 'pay_Qz1005_Delivered05',
      razorpayOrderId: 'order_Rz1005_Delivered05',
      shipping: { provider: 'shiprocket', carrier: 'DTDC Express', trackingNumber: 'DTDC7766554433', deliveredAt: new Date(Date.now() - 86400000) }
    },
    {
      orderId: 'ORD-20260911-1006',
      customerIndex: 1,
      items: [{ product: pMakhana, qty: 2 }],
      warehouse: whPurnia._id,
      awaitingWarehouseAssignment: false,
      status: 'refunded',
      paymentMethod: 'razorpay',
      paymentStatus: 'refunded',
      razorpayPaymentId: 'pay_Qz1006_Cancelled06',
      razorpayOrderId: 'order_Rz1006_Cancelled06',
      refundId: 'rfnd_9988776611',
      refundAmount: 598,
      failureReason: 'Customer requested cancellation prior to dispatch',
      shipping: {}
    }
  ];

  for (const od of dummyOrders) {
    const cust = customers[od.customerIndex];
    let subtotal = 0;
    const orderItems = od.items.map((it) => {
      const itemSubtotal = it.product.price * it.qty;
      subtotal += itemSubtotal;
      return {
        product: it.product._id,
        name: it.product.name,
        price: it.product.price,
        quantity: it.qty,
        weight: it.product.sizes[0] || 'Standard',
        subtotal: itemSubtotal
      };
    });

    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const total = subtotal + shippingCharge;

    await Order.findOneAndUpdate(
      { orderId: od.orderId },
      {
        $set: {
          orderId: od.orderId,
          user: cust.user._id,
          items: orderItems,
          pricing: {
            subtotal,
            shipping: shippingCharge,
            discount: 0,
            tax: 0,
            total
          },
          warehouse: od.warehouse,
          awaitingWarehouseAssignment: od.awaitingWarehouseAssignment,
          paymentMethod: od.paymentMethod,
          paymentStatus: od.paymentStatus,
          status: od.status,
          paymentDetails: {
            razorpayPaymentId: od.razorpayPaymentId,
            razorpayOrderId: od.razorpayOrderId,
            refundId: od.refundId,
            refundAmount: od.refundAmount,
            failureReason: od.failureReason,
            paymentDate: new Date()
          },
          shipping: od.shipping,
          shippingAddress: {
            name: cust.meta.name,
            phone: cust.meta.phone,
            street: `${cust.meta.city} Main Road, Block A`,
            city: cust.meta.city,
            state: cust.meta.state,
            pincode: cust.meta.pincode,
            country: 'India'
          },
          billingAddress: {
            name: cust.meta.name,
            phone: cust.meta.phone,
            street: `${cust.meta.city} Main Road, Block A`,
            city: cust.meta.city,
            state: cust.meta.state,
            pincode: cust.meta.pincode,
            country: 'India'
          },
          timeline: [
            { status: 'confirmed', message: 'Order placed & payment verified', timestamp: new Date(Date.now() - 3600000 * 2) },
            ...(od.warehouse ? [{ status: 'warehouse_assigned', message: 'Assigned to WH-PURNIA hub', timestamp: new Date(Date.now() - 3600000) }] : [])
          ]
        }
      },
      { upsert: true, new: true }
    );
  }

  console.log(`✓ Seeded ${dummyOrders.length} complete dummy orders & reconciliation logs!`);

  console.log('\n--- 5. Abandoned Carts & Recovery Logs ---');
  const Cart = require('../src/models/Cart');
  const AbandonedCartLog = require('../src/models/AbandonedCartLog');

  const abandonedUsersData = [
    { name: 'Vikram Singhania', phone: '+919811223344', email: 'vikram.singhania@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    { name: 'Ananya Deshmukh', phone: '+919822334455', email: 'ananya.deshmukh@gmail.com', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    { name: 'Kavita Nair', phone: '+919833445566', email: 'kavita.nair@yahoo.com', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    { name: 'Manish Tiwari', phone: '+919844556677', email: 'manish.tiwari@outlook.com', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' }
  ];

  const activeProducts = await Product.find({ status: 'active' }).limit(4);

  if (activeProducts.length > 0) {
    for (let i = 0; i < abandonedUsersData.length; i++) {
      const uData = abandonedUsersData[i];
      let u = await User.findOne({ phone: uData.phone });
      if (!u) {
        u = await User.create({
          name: uData.name,
          phone: uData.phone,
          email: uData.email,
          password: 'password123',
          role: 'customer',
          status: 'active'
        });
      }

      await Order.deleteMany({ user: u._id });

      const cartItems = [
        { product: activeProducts[i % activeProducts.length]._id, qty: (i % 2) + 1, weight: '500g' }
      ];
      if (activeProducts.length > 1) {
        cartItems.push({
          product: activeProducts[(i + 1) % activeProducts.length]._id,
          qty: 1,
          weight: '250g'
        });
      }

      let cart = await Cart.findOne({ user: u._id });
      if (!cart) {
        cart = new Cart({ user: u._id, items: cartItems });
      } else {
        cart.items = cartItems;
      }
      await cart.save();
      const pastDate = new Date(Date.now() - (36 + i * 6) * 3600 * 1000);
      await Cart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: pastDate } });

      if (i % 2 === 0) {
        await AbandonedCartLog.findOneAndUpdate(
          { user: u._id },
          {
            $set: {
              cart: cart._id,
              user: u._id,
              recipientName: u.name,
              recipientPhone: u.phone,
              recipientEmail: u.email,
              channel: i === 0 ? 'whatsapp' : 'email',
              subject: 'Your organic harvest is waiting at AgriCola 🌾',
              messageContent: `Hello ${u.name}, your selected farm-fresh items are saved with special code SAVE10.`,
              couponCode: 'SAVE10',
              cartValue: 760 + i * 150,
              itemNames: [activeProducts[0].name],
              status: 'sent',
              sentAt: new Date(Date.now() - 12 * 3600 * 1000)
            }
          },
          { upsert: true, new: true }
        );
      }
    }
    console.log(`✓ Seeded ${abandonedUsersData.length} realistic abandoned carts & recovery logs!`);
  }

  console.log('\n🎉 ALL DUMMY TESTING DATA INJECTED SUCCESSFULLY!');
}

if (require.main === module) {
  inject().then(() => mongoose.disconnect()).catch(err => {
    console.error('Injection error:', err);
    process.exit(1);
  });
}

module.exports = inject;
