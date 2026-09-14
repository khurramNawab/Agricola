const express = require('express');
const router = express.Router();
const HeroCampaign = require('../models/HeroCampaign');
const Coupon = require('../models/Coupon');

// Default brand slides when no festival campaign is active
const DEFAULT_SLIDES = [
  {
    image: '/assets/makhana1.png',
    title: 'Jumbo Phool Makhana (Raw Sun-Dried)',
    description: 'Hand-picked organic seeds, sun-dried Mithila jumbo makhana, and single-origin stone-ground spices directly from verified partner farms. No middlemen, zero synthetic polish.',
    ctaText: 'Explore Fresh Harvest',
    ctaLink: '/products',
    order: 0
  },
  {
    image: '/assets/black tea.jpeg',
    title: 'High-Altitude Whole Leaf Kangra Tea',
    description: 'Single-estate hand-plucked tea leaves from the misty slopes of Kangra Valley. Rich in natural antioxidants, unblended and pure.',
    ctaText: 'Explore Pure Teas',
    ctaLink: '/products',
    order: 1
  },
  {
    image: '/assets/herbal tea.jpeg',
    title: 'Handcrafted Herbal Ayurvedic Infusions',
    description: 'Traditionally balanced herbal wellness teas infused with whole botanicals, chamomile flowers, and medicinal roots.',
    ctaText: 'Shop Wellness Blends',
    ctaLink: '/products',
    order: 2
  }
];

/**
 * Dynamically discover the active coupon created by admin in "Coupons & Deals":
 * 1. Campaign-linked coupon code
 * 2. Festival-tagged coupon (isFestivalOffer or matching festival keywords)
 * 3. Any active coupon in Coupons & Deals
 */
async function getDynamicActiveCoupon(activeCampaign, now) {
  try {
    let coupon = null;

    const baseFilter = {
      isActive: true,
      $or: [
        { validFrom: null },
        { validFrom: { $exists: false } },
        { validFrom: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { validTo: null },
            { validTo: { $exists: false } },
            { validTo: { $gte: now } }
          ]
        },
        {
          $or: [
            { totalUsageLimit: null },
            { totalUsageLimit: { $exists: false } },
            { $expr: { $lt: ['$usedCount', '$totalUsageLimit'] } }
          ]
        }
      ]
    };

    // 1. If active campaign explicitly links a couponCode
    if (activeCampaign && activeCampaign.couponCode) {
      coupon = await Coupon.findOne({
        ...baseFilter,
        code: activeCampaign.couponCode.toUpperCase().trim()
      });
    }

    // 2. If festivalType exists, match festival tags or keywords
    if (!coupon && activeCampaign && activeCampaign.festivalType) {
      const festivalPattern = activeCampaign.festivalType.replace('_', '.*');
      coupon = await Coupon.findOne({
        ...baseFilter,
        $or: [
          { isFestivalOffer: true },
          { code: { $regex: festivalPattern, $options: 'i' } },
          { description: { $regex: festivalPattern, $options: 'i' } },
          { code: { $regex: 'festival|festive|puja|diwali|celebration', $options: 'i' } }
        ]
      }).sort({ createdAt: -1 });
    }

    // 3. Fallback: Any active coupon created in "Coupons & Deals"
    if (!coupon) {
      coupon = await Coupon.findOne(baseFilter).sort({ createdAt: -1 });
    }

    if (!coupon) return null;

    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      description: coupon.description,
      minOrderValue: coupon.minOrderValue,
      isFestivalOffer: Boolean(coupon.isFestivalOffer)
    };
  } catch (err) {
    console.error('Error finding dynamic coupon:', err);
    return null;
  }
}

// @route   GET /api/v1/campaigns/active
// @desc    Get currently active festival campaign & hero slides for the storefront
// @access  Public
router.get('/active', async (req, res) => {
  try {
    const now = new Date();

    const activeCampaign = await HeroCampaign.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ priority: -1, createdAt: -1 });

    const dynamicCoupon = await getDynamicActiveCoupon(activeCampaign, now);

    if (!activeCampaign) {
      return res.status(200).json({
        success: true,
        data: {
          isCustomCampaign: false,
          campaignName: 'Default Hero',
          festivalType: 'other',
          slides: DEFAULT_SLIDES,
          videoModule: {
            isEnabled: false,
            videoUrl: '',
            position: 'hero_banner'
          },
          activeCoupon: dynamicCoupon
        }
      });
    }

    const sortedSlides = [...(activeCampaign.slides || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

    res.status(200).json({
      success: true,
      data: {
        isCustomCampaign: true,
        campaignId: activeCampaign._id,
        campaignName: activeCampaign.name,
        festivalType: activeCampaign.festivalType,
        couponCode: activeCampaign.couponCode || '',
        slides: sortedSlides,
        videoModule: activeCampaign.videoModule || { isEnabled: false },
        activeCoupon: dynamicCoupon
      }
    });
  } catch (error) {
    console.error('Fetch active campaign error:', error);
    res.status(200).json({
      success: true,
      data: {
        isCustomCampaign: false,
        campaignName: 'Default Hero',
        festivalType: 'other',
        slides: DEFAULT_SLIDES,
        videoModule: { isEnabled: false },
        activeCoupon: null
      }
    });
  }
});

module.exports = router;
