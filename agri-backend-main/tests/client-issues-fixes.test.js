const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Coupon = require('../src/models/Coupon');
const Feedback = require('../src/models/Feedback');
const shipping = require('../src/utils/shipping');

describe('Client Issues 1-7 Verification Suite', () => {
  let adminToken;
  let customerToken;
  let adminUser;
  let customerUser;
  let testProduct;
  let sampleOrder;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }

    const secret = process.env.JWT_SECRET || 'agricola_super_secret_jwt_key_development_2026';

    adminUser = await User.create({
      userId: 'USR_TEST_ADMIN_ISSUES',
      name: 'Admin Tester',
      email: 'admin_issues_test@agricola.com',
      phone: '+919876543210',
      password: 'Password123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id.toString() }, secret, { expiresIn: '1h' });

    customerUser = await User.create({
      userId: 'USR_TEST_CUST_ISSUES',
      name: 'Customer Tester',
      email: 'customer_issues_test@agricola.com',
      phone: '+919876543211',
      password: 'Password123!',
      role: 'customer',
    });
    customerToken = jwt.sign({ id: customerUser._id.toString() }, secret, { expiresIn: '1h' });

    testProduct = await Product.create({
      productId: 'P_TST_001',
      name: 'Organic Roasted Makhana Batch A',
      description: 'Crispy single-origin roasted makhana from Mithila.',
      category: new mongoose.Types.ObjectId(),
      slug: 'organic-makhana-batch-a',
      sku: 'MKH-TST-001',
      price: 350,
      stock: 50,
      status: 'active',
      video: {
        url: 'https://cdn.example.com/videos/makhana-roast.mp4',
        publicId: 'makhana-vid-001',
      },
      videoUrl: 'https://cdn.example.com/videos/makhana-roast.mp4',
    });

    sampleOrder = await Order.create({
      orderId: 'ORD_TST_ORIGINAL_01',
      user: customerUser._id,
      items: [
        {
          product: testProduct._id,
          name: testProduct.name,
          quantity: 2,
          price: 350,
          subtotal: 700,
        },
      ],
      pricing: {
        subtotal: 700,
        shipping: 0,
        tax: 0,
        discount: 0,
        total: 700,
      },
      shippingAddress: {
        name: 'Customer Tester',
        phone: '+919876543211',
        street: 'Flat 101, Farm Road',
        city: 'Patna',
        state: 'Bihar',
        pincode: '800001',
      },
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'confirmed',
    });
  });

  afterAll(async () => {
    await Order.deleteMany({
      $or: [
        { user: customerUser?._id },
        { orderId: { $regex: '^ORD_TST_' } },
        { orderId: { $regex: '^ORD-CLONE-' } },
      ],
    });
    await Product.deleteMany({ sku: 'MKH-TST-001' });
    await Coupon.deleteMany({ code: { $regex: '^CPN_TEST_' } });
    await Feedback.deleteMany({ email: 'contact_tester@agricola.com' });
    await User.deleteMany({
      email: { $in: ['admin_issues_test@agricola.com', 'customer_issues_test@agricola.com', 'other_cust@agricola.com'] },
    });
  });

  // Issue 1: Clone Order from Admin
  describe('Issue 1: Clone Order API', () => {
    test('POST /api/v1/admin/orders/:id/clone duplicates the order with fresh ID and resets statuses', async () => {
      const initialStock = (await Product.findById(testProduct._id)).stock;

      const res = await request(app)
        .post(`/api/v1/admin/orders/${sampleOrder._id}/clone`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const cloned = res.body.data;
      expect(cloned.orderId).not.toBe(sampleOrder.orderId);
      expect(cloned.orderId).toMatch(/^ORD-/);
      expect(['pending', 'Pending', 'processing', 'Processing']).toContain(cloned.status);
      expect(['pending', 'Pending']).toContain(cloned.paymentStatus);
      expect(cloned.amount).toBe(700);
      expect(cloned.items).toBe(1);

      // Verify stock was deducted for the new order
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stock).toBe(initialStock - 2);
    });

    test('POST /api/v1/admin/orders/:id/clone rejects clone if product stock is insufficient', async () => {
      // Temporarily set stock to 0
      await Product.findByIdAndUpdate(testProduct._id, { stock: 0 });

      const res = await request(app)
        .post(`/api/v1/admin/orders/${sampleOrder._id}/clone`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Restore stock
      await Product.findByIdAndUpdate(testProduct._id, { stock: 48 });
    });

    test('POST /api/v1/admin/orders/:id/clone supports reason, custom address, and prepaid retention with source link', async () => {
      const prepaidOrder = await Order.create({
        orderId: 'ORD_PREPAID_SOURCE',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        status: 'shipped',
        shippingAddress: sampleOrder.shippingAddress
      });

      const initialStock = (await Product.findById(testProduct._id)).stock;

      const res = await request(app)
        .post(`/api/v1/admin/orders/${prepaidOrder._id}/clone`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Transit Damage Replacement',
          shippingAddress: {
            name: 'Updated Recipient',
            phone: '9988776655',
            street: 'New Dispatch Street 42',
            city: 'Kaithal',
            state: 'Haryana',
            pincode: '136027'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const cloned = res.body.data;
      expect(['paid', 'Paid', 'Success']).toContain(cloned.paymentStatus);
      expect(cloned.shippingAddress.name).toBe('Updated Recipient');
      expect(cloned.shippingAddress.phone).toBe('9988776655');

      // Stock deducted for replacement item
      const stockAfter = (await Product.findById(testProduct._id)).stock;
      expect(stockAfter).toBe(initialStock - 1);

      // Verify two-way link in source order timeline
      const updatedSource = await Order.findById(prepaidOrder._id);
      const hasTimelineLink = updatedSource.timeline.some(t => t.message.includes(cloned.orderId));
      expect(hasTimelineLink).toBe(true);

      await Order.findByIdAndDelete(prepaidOrder._id);
      await Order.findOneAndDelete({ orderId: cloned.orderId });
    });
  });

  // Issue 2: Customer and Admin Invoice stream consistency
  describe('Issue 2: Unified Invoice Streaming', () => {
    test('GET /api/v1/orders/:id/invoice streams PDF invoice for the customer', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${sampleOrder._id}/invoice`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('invoice-ORD_TST_ORIGINAL_01.pdf');
      expect(res.body).toBeDefined();
    });

    test('GET /api/v1/orders/:id/invoice forbids customer from accessing another user order', async () => {
      const otherUser = await User.create({
        userId: 'USR_TEST_OTHER_CUST',
        name: 'Other',
        email: 'other_cust@agricola.com',
        phone: '+919876543299',
        password: 'Password123!',
      });
      const otherToken = jwt.sign(
        { id: otherUser._id.toString() },
        process.env.JWT_SECRET || 'agricola_super_secret_jwt_key_development_2026',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get(`/api/v1/orders/${sampleOrder._id}/invoice`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
      await User.findByIdAndDelete(otherUser._id);
    });
  });

  // Issue 3: Admin Order Cancellation with Carrier and Stock
  describe('Issue 3: Admin Order Cancellation Carrier & Stock Logic', () => {
    test('Disallows cancelling an already delivered order', async () => {
      const deliveredOrder = await Order.create({
        orderId: 'ORD_TST_DELIVERED',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'delivered',
        shippingAddress: sampleOrder.shippingAddress,
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${deliveredOrder._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS');
      expect(res.body.error.message).toContain('Delivered orders cannot be cancelled');

      await Order.findByIdAndDelete(deliveredOrder._id);
    });

    test('Cancelling an active order invokes carrier cancelShipment and restores stock', async () => {
      const cancelShipmentSpy = jest.spyOn(shipping, 'cancelShipment').mockResolvedValueOnce({
        cancelled: true,
        message: 'Shipment cancelled with carrier',
      });

      const activeOrder = await Order.create({
        orderId: 'ORD_TST_CANCELLATION',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 3, price: 350, subtotal: 1050 }],
        pricing: { subtotal: 1050, total: 1050, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'shipped',
        shipping: {
          trackingNumber: 'AWB_MOCK_123456',
          provider: 'shiprocket',
        },
        shippingAddress: sampleOrder.shippingAddress,
      });

      const stockBefore = (await Product.findById(testProduct._id)).stock;

      const res = await request(app)
        .put(`/api/v1/admin/orders/${activeOrder._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled', note: 'Customer called to cancel' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(cancelShipmentSpy).toHaveBeenCalled();

      // Verify stock restored
      const stockAfter = (await Product.findById(testProduct._id)).stock;
      expect(stockAfter).toBe(stockBefore + 3);

      cancelShipmentSpy.mockRestore();
      await Order.findByIdAndDelete(activeOrder._id);
    });

    test('Customer can cancel un-shipped order, cancels carrier shipment and restores stock', async () => {
      const cancelSpy = jest.spyOn(shipping, 'cancelShipment').mockResolvedValueOnce({
        cancelled: true,
        message: 'Shipment cancelled with carrier'
      });

      const customerOrder = await Order.create({
        orderId: 'ORD_CUST_CANCEL_OK',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 2, price: 350, subtotal: 700 }],
        pricing: { subtotal: 700, total: 700, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'processing',
        shipping: {
          trackingNumber: 'AWB_CUST_999',
          provider: 'shiprocket'
        },
        shippingAddress: sampleOrder.shippingAddress
      });

      const stockBefore = (await Product.findById(testProduct._id)).stock;

      const res = await request(app)
        .put(`/api/v1/orders/${customerOrder._id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Ordered by mistake' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
      expect(cancelSpy).toHaveBeenCalled();

      const stockAfter = (await Product.findById(testProduct._id)).stock;
      expect(stockAfter).toBe(stockBefore + 2);

      cancelSpy.mockRestore();
      await Order.findByIdAndDelete(customerOrder._id);
    });

    test('Customer cannot cancel already shipped order', async () => {
      const shippedOrder = await Order.create({
        orderId: 'ORD_CUST_CANCEL_BLOCK',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'shipped',
        shipping: {
          shippedAt: new Date(),
          trackingNumber: 'AWB_SHIPPED_111'
        },
        shippingAddress: sampleOrder.shippingAddress
      });

      const res = await request(app)
        .put(`/api/v1/orders/${shippedOrder._id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Too late' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ORDER_ALREADY_SHIPPED');

      await Order.findByIdAndDelete(shippedOrder._id);
    });
  });

  // Delivery Details Update API (Before Carrier Acceptance)
  describe('Delivery Details Update API (Before Carrier Acceptance)', () => {
    test('Customer can update delivery address before carrier booking', async () => {
      const pendingOrder = await Order.create({
        orderId: 'ORD_ADDR_EDIT_OK',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'pending',
        shippingAddress: sampleOrder.shippingAddress
      });

      const res = await request(app)
        .put(`/api/v1/orders/${pendingOrder._id}/shipping-address`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Updated Name',
          phone: '9876543210',
          street: 'Flat 101, New Residency Road',
          city: 'Kaithal',
          state: 'Haryana',
          pincode: '136027'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address.name).toBe('Updated Name');
      expect(res.body.data.address.phone).toBe('9876543210');
      expect(res.body.data.address.city).toBe('Kaithal');
      expect(res.body.data.address.pincode).toBe('136027');

      await Order.findByIdAndDelete(pendingOrder._id);
    });

    test('Customer cannot update delivery address after carrier booking (Shiprocket/Ekart tracking present)', async () => {
      const bookedOrder = await Order.create({
        orderId: 'ORD_ADDR_EDIT_LOCKED',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'processing',
        shipping: {
          trackingNumber: 'AWB_LOCKED_888',
          provider: 'shiprocket'
        },
        shippingAddress: sampleOrder.shippingAddress
      });

      const res = await request(app)
        .put(`/api/v1/orders/${bookedOrder._id}/shipping-address`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Hacker Attempt',
          phone: '9876543210',
          street: 'Different Street',
          city: 'Kaithal',
          state: 'Haryana',
          pincode: '136027'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SHIPMENT_ALREADY_BOOKED');

      await Order.findByIdAndDelete(bookedOrder._id);
    });

    test('Rejects invalid phone or pincode when editing delivery details', async () => {
      const testOrder = await Order.create({
        orderId: 'ORD_ADDR_VALIDATION',
        user: customerUser._id,
        items: [{ product: testProduct._id, name: testProduct.name, quantity: 1, price: 350, subtotal: 350 }],
        pricing: { subtotal: 350, total: 350, shipping: 0, tax: 0, discount: 0 },
        paymentMethod: 'cod',
        status: 'pending',
        shippingAddress: sampleOrder.shippingAddress
      });

      // Invalid phone
      const phoneRes = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/shipping-address`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Test Name',
          phone: '123', // not 10 digits
          street: 'Test Street',
          city: 'City',
          state: 'State',
          pincode: '136027'
        });
      expect(phoneRes.status).toBe(400);
      expect(phoneRes.body.error.code).toBe('VALIDATION_ERROR');

      // Invalid pincode
      const pinRes = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/shipping-address`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Test Name',
          phone: '9876543210',
          street: 'Test Street',
          city: 'City',
          state: 'State',
          pincode: '123' // not 6 digits
        });
      expect(pinRes.status).toBe(400);
      expect(pinRes.body.error.code).toBe('VALIDATION_ERROR');

      await Order.findByIdAndDelete(testOrder._id);
    });
  });

  // Issue 5: Coupon Delete API
  describe('Issue 5: Admin Coupon Delete (Smart Delete)', () => {
    test('Hard deletes coupon if it has never been used in orders', async () => {
      const unusedCoupon = await Coupon.create({
        code: 'CPN_TEST_UNUSED',
        discountType: 'fixed',
        discountValue: 50,
        validTo: new Date(Date.now() + 86400000),
        status: 'active',
        redemptions: [],
      });

      const res = await request(app)
        .delete(`/api/v1/admin/coupons/${unusedCoupon._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(true);

      const check = await Coupon.findById(unusedCoupon._id);
      expect(check).toBeNull();
    });

    test('Permanently deletes coupon even if historical orders redeemed it', async () => {
      const usedCoupon = await Coupon.create({
        code: 'CPN_TEST_USED',
        discountType: 'fixed',
        discountValue: 100,
        validTo: new Date(Date.now() + 86400000),
        status: 'active',
        redemptions: [{ user: customerUser._id, order: sampleOrder._id, discountAmount: 100, redeemedAt: new Date() }],
      });

      const res = await request(app)
        .delete(`/api/v1/admin/coupons/${usedCoupon._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(true);

      const check = await Coupon.findById(usedCoupon._id);
      expect(check).toBeNull();
    });
  });

  // Issue 6: Contact inquiry submission
  describe('Issue 6: Contact Form Inquiry Submission to Support', () => {
    test('POST /api/v1/support/feedback records customer inquiry and makes it visible in admin support', async () => {
      const res = await request(app).post('/api/v1/support/feedback').send({
        name: 'Contact Inquiry Tester',
        email: 'contact_tester@agricola.com',
        message: 'Interested in bulk single-origin Mithila makhana for export.',
        page: '/contact',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify admin sees it
      const adminListRes = await request(app)
        .get('/api/v1/admin/support/feedbacks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminListRes.status).toBe(200);
      const found = adminListRes.body.data.feedbacks.find(
        (f) => f.email === 'contact_tester@agricola.com'
      );
      expect(found).toBeDefined();
      expect(found.name).toBe('Contact Inquiry Tester');
    });
  });

  // Issue 7: Product Video serialization
  describe('Issue 7: Product Video Support', () => {
    test('GET /api/v1/products/:identifier includes video and videoUrl in response', async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct.productId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.video).toBeDefined();
      expect(res.body.data.video.url).toBe('https://cdn.example.com/videos/makhana-roast.mp4');
      expect(res.body.data.videoUrl).toBe('https://cdn.example.com/videos/makhana-roast.mp4');
    });
  });
});
