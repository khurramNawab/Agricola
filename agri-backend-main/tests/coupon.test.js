const mongoose = require('mongoose');
const Coupon = require('../src/models/Coupon');
const User = require('../src/models/User');
const { CouponUtils } = require('../src/utils/helpers');

describe('Coupon System: Validation, Limits & Redemptions', () => {
  let testUser1;
  let testUser2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }
    await Coupon.deleteMany({ code: { $in: ['TEST10', 'TESTFLAT', 'TESTFIRST', 'TESTLIMIT', 'TESTEXPIRED'] } });

    testUser1 = new mongoose.Types.ObjectId();
    testUser2 = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await Coupon.deleteMany({ code: { $in: ['TEST10', 'TESTFLAT', 'TESTFIRST', 'TESTLIMIT', 'TESTEXPIRED'] } });
  });

  test('validates percentage coupon with cap and min order', async () => {
    const coupon = await Coupon.create({
      code: 'TEST10',
      description: '10% discount max 100 on 500+',
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 500,
      maxDiscountCap: 100,
      validTo: new Date(Date.now() + 86400000),
      isActive: true
    });

    // Subtotal below min order
    const belowMin = await CouponUtils.validateCoupon('TEST10', 400, testUser1);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.code).toBe('MIN_ORDER_NOT_MET');

    // Subtotal meeting min order (discount 60)
    const validRes = await CouponUtils.validateCoupon('TEST10', 600, testUser1);
    expect(validRes.valid).toBe(true);
    expect(validRes.discount).toBe(60);

    // Subtotal with cap (10% of 2000 is 200, capped at 100)
    const cappedRes = await CouponUtils.validateCoupon('TEST10', 2000, testUser1);
    expect(cappedRes.valid).toBe(true);
    expect(cappedRes.discount).toBe(100);
  });

  test('validates flat amount coupon', async () => {
    await Coupon.create({
      code: 'TESTFLAT',
      discountType: 'flat',
      discountValue: 75,
      minOrderValue: 200,
      validTo: new Date(Date.now() + 86400000),
      isActive: true
    });

    const res = await CouponUtils.validateCoupon('TESTFLAT', 300, testUser1);
    expect(res.valid).toBe(true);
    expect(res.discount).toBe(75);
    expect(res.type).toBe('flat');
  });

  test('rejects expired or inactive coupons', async () => {
    await Coupon.create({
      code: 'TESTEXPIRED',
      discountType: 'percentage',
      discountValue: 20,
      validTo: new Date(Date.now() - 86400000),
      isActive: true
    });

    const res = await CouponUtils.validateCoupon('TESTEXPIRED', 500, testUser1);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('EXPIRED_COUPON');
  });

  test('enforces per-user limit and records redemptions atomically', async () => {
    await Coupon.create({
      code: 'TESTLIMIT',
      discountType: 'percentage',
      discountValue: 15,
      minOrderValue: 100,
      perUserLimit: 1,
      totalUsageLimit: 5,
      validTo: new Date(Date.now() + 86400000),
      isActive: true
    });

    // First use is valid
    const firstCheck = await CouponUtils.validateCoupon('TESTLIMIT', 500, testUser1);
    expect(firstCheck.valid).toBe(true);

    // Record redemption for user1
    await CouponUtils.recordRedemption('TESTLIMIT', testUser1, 'AGR-2026-TEST1', 75);

    // Second check for user1 fails with ALREADY_USED
    const secondCheck = await CouponUtils.validateCoupon('TESTLIMIT', 500, testUser1);
    expect(secondCheck.valid).toBe(false);
    expect(secondCheck.code).toBe('ALREADY_USED');

    // But user2 can still use it
    const user2Check = await CouponUtils.validateCoupon('TESTLIMIT', 500, testUser2);
    expect(user2Check.valid).toBe(true);

    // Check DB doc updated
    const couponDoc = await Coupon.findOne({ code: 'TESTLIMIT' });
    expect(couponDoc.usedCount).toBe(1);
    expect(couponDoc.redemptions.length).toBe(1);
    expect(couponDoc.redemptions[0].orderId).toBe('AGR-2026-TEST1');
  });
});
