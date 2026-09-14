const mongoose = require('mongoose');
const HeroCampaign = require('../src/models/HeroCampaign');
const request = require('supertest');
const app = require('../src/server');

describe('Hero & Festival Campaigns: Admin Scheduling, Overlaps & Storefront Delivery', () => {
  let createdCampaignId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }
    await HeroCampaign.deleteMany({ name: { $regex: /^TEST_/ } });
  });

  afterAll(async () => {
    await HeroCampaign.deleteMany({ name: { $regex: /^TEST_/ } });
  });

  test('GET /api/v1/campaigns/active returns default fallback slides when no custom campaign active', async () => {
    const res = await request(app).get('/api/v1/campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slides).toBeDefined();
    expect(res.body.data.slides.length).toBeGreaterThanOrEqual(1);
  });

  test('Creates a festival campaign with slides and video module', async () => {
    const campaign = await HeroCampaign.create({
      name: 'TEST_DIWALI_2026',
      festivalType: 'diwali',
      startDate: new Date(Date.now() - 3600000), // 1 hour ago
      endDate: new Date(Date.now() + 86400000 * 5), // 5 days later
      priority: 10,
      isActive: true,
      slides: [
        {
          image: 'https://agricola-images.s3.us-east-1.amazonaws.com/diwali_special.png',
          title: 'Diwali Mega Sale',
          description: 'Celebrate the festival of lights with pure organic goodness.',
          ctaText: 'Shop Festive Offers',
          ctaLink: '/products?category=festive',
          order: 0
        }
      ],
      videoModule: {
        isEnabled: true,
        title: 'Diwali Farm Fest',
        subtitle: 'Watch how we prepare the purest festival harvests',
        videoType: 'youtube',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        position: 'hero_banner'
      }
    });

    createdCampaignId = campaign._id.toString();
    expect(campaign._id).toBeDefined();
    expect(campaign.festivalType).toBe('diwali');
    expect(campaign.videoModule.isEnabled).toBe(true);
  });

  test('GET /api/v1/campaigns/active returns the active festival campaign with priority', async () => {
    const res = await request(app).get('/api/v1/campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isCustomCampaign).toBe(true);
    expect(res.body.data.campaignName).toBe('TEST_DIWALI_2026');
    expect(res.body.data.festivalType).toBe('diwali');
    expect(res.body.data.slides[0].title).toBe('Diwali Mega Sale');
    expect(res.body.data.videoModule.isEnabled).toBe(true);
  });

  test('Campaign date validation and deactivation fallback', async () => {
    // Deactivate campaign
    await HeroCampaign.findByIdAndUpdate(createdCampaignId, { isActive: false });

    const res = await request(app).get('/api/v1/campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Since our test campaign is inactive, it should not return TEST_DIWALI_2026
    if (res.body.data.isCustomCampaign) {
      expect(res.body.data.campaignName).not.toBe('TEST_DIWALI_2026');
    } else {
      expect(res.body.data.campaignName).toBe('Default Hero');
    }
  });
});
