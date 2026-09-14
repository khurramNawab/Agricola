const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');
const Feedback = require('../src/models/Feedback');
const Setting = require('../src/models/Setting');
const User = require('../src/models/User');

describe('Admin Support & Settings Module', () => {
  let adminToken;
  let createdFeedbackId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }
    // Create an admin user for testing
    let admin = await User.findOne({ role: 'admin', email: 'testadmin_support@example.com' });
    if (!admin) {
      admin = await User.create({
        userId: 'USR_TEST_SUPPORT_ADMIN',
        name: 'Test Support Admin',
        email: 'testadmin_support@example.com',
        phone: '+919998887771',
        password: 'Password123!',
        role: 'admin'
      });
    }
    adminToken = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET || 'agricola_super_secret_jwt_key_development_2026', { expiresIn: '1h' });

    // Create a sample feedback
    const fb = await Feedback.create({
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      rating: 5,
      message: 'Great quality organic pulses! Fast delivery.',
      page: '/products',
      status: 'open'
    });
    createdFeedbackId = fb._id.toString();
  });

  afterAll(async () => {
    await Feedback.deleteMany({ email: 'rohan@example.com' });
    await User.deleteMany({ email: 'testadmin_support@example.com' });
  });

  test('GET /api/v1/admin/support/feedbacks lists feedbacks with KPI stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/support/feedbacks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.feedbacks).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.total).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/v1/admin/support/feedbacks/:id/status updates status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/support/feedbacks/${createdFeedbackId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('resolved');
  });

  test('GET /api/v1/admin/settings fetches store configuration', async () => {
    const res = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.storeName).toBeDefined();
    expect(res.body.data.enableMultiWarehouse).toBeDefined();
  });

  test('PUT /api/v1/admin/settings updates settings values', async () => {
    const res = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        storeName: 'AgriCola Pure Living',
        freeShippingThreshold: 1200,
        supportPhone: '+91 9012659999'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.storeName).toBe('AgriCola Pure Living');
    expect(res.body.data.freeShippingThreshold).toBe(1200);
    expect(res.body.data.supportPhone).toBe('+91 9012659999');
  });
});
