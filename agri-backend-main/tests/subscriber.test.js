const mongoose = require('mongoose');
const LaunchSubscriber = require('../src/models/LaunchSubscriber');
const request = require('supertest');
const app = require('../src/server');

describe('Launch Notification System (Utensils & Gardening)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }
    await LaunchSubscriber.deleteMany({ email: /test_launch/ });
  });

  afterAll(async () => {
    await LaunchSubscriber.deleteMany({ email: /test_launch/ });
  });

  test('Rejects submission with neither email nor phone', async () => {
    const res = await request(app)
      .post('/api/v1/subscribers/notify-launch')
      .send({
        name: 'Test Customer',
        category: 'utensils'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Registers subscriber with email and interest tags', async () => {
    const res = await request(app)
      .post('/api/v1/subscribers/notify-launch')
      .send({
        name: 'Priya Sharma',
        email: 'test_launch_priya@example.com',
        phone: '9876543210',
        category: 'utensils',
        preferredChannel: 'whatsapp',
        interestTags: ['kansa_thali', 'pure_brass_handi']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test_launch_priya@example.com');
    expect(res.body.data.category).toBe('utensils');
    expect(res.body.data.interestTags).toContain('kansa_thali');
  });

  test('Idempotent update when same subscriber registers with more interests', async () => {
    const res = await request(app)
      .post('/api/v1/subscribers/notify-launch')
      .send({
        email: 'test_launch_priya@example.com',
        category: 'gardening',
        interestTags: ['terracotta_planters', 'heirloom_seeds']
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('both'); // category upgraded to both
    expect(res.body.data.interestTags).toContain('heirloom_seeds');
    expect(res.body.data.interestTags).toContain('kansa_thali');
  });
});
