const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const { optionalAuth } = require('../middleware/auth');
const { toProduct, toProductCard } = require('../utils/serializers');

// @desc    Product search results
// @route   GET /api/v1/search?q=
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    if (!q) {
      return res.status(200).json({ success: true, data: [], query: '' });
    }

    // Prefer text index; fall back to a sanitised regex for partial matches.
    let products = await Product.find(
      { $text: { $search: q }, status: { $in: ['active', 'out_of_stock'] } },
      { score: { $meta: 'textScore' } }
    )
      .populate('category', 'name slug')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limitNum);

    if (products.length === 0) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      products = await Product.find({
        status: { $in: ['active', 'out_of_stock'] },
        $or: [
          { name: { $regex: safe, $options: 'i' } },
          { tags: { $regex: safe, $options: 'i' } }
        ]
      })
        .populate('category', 'name slug')
        .limit(limitNum);
    }

    res.status(200).json({
      success: true,
      data: products.map(toProduct),
      query: q
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Search failed' }
    });
  }
});

// @desc    Popular search terms
// @route   GET /api/v1/search/popular
// @access  Public
router.get('/popular', async (req, res) => {
  try {
    // Derive popular terms from active category names + most common product tags.
    const categories = await Category.find({ status: 'active' })
      .sort({ sortOrder: 1 })
      .limit(6)
      .select('name');

    const tagAgg = await Product.aggregate([
      { $match: { status: 'active' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    const terms = [
      ...categories.map((c) => c.name),
      ...tagAgg.map((t) => t._id)
    ].filter(Boolean);

    // De-duplicate, cap at 10
    const unique = [...new Set(terms)].slice(0, 10);

    res.status(200).json({ success: true, data: unique });
  } catch (error) {
    console.error('Popular searches error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch popular searches' }
    });
  }
});

// @desc    Trending products (cards)
// @route   GET /api/v1/search/trending
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const limitNum = Math.min(20, Math.max(1, parseInt(req.query.limit) || 6));

    const products = await Product.find({ status: 'active' })
      .sort({ 'rating.count': -1, 'rating.average': -1, createdAt: -1 })
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: products.map(toProductCard)
    });
  } catch (error) {
    console.error('Trending products error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trending products' }
    });
  }
});

module.exports = router;
