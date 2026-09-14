const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');

// @route   GET /api/v1/blogs/categories
// @desc    Get all categories with post counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({
      success: true,
      data: categories.map((c) => ({ name: c._id, count: c.count }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/blogs/recent
// @desc    Get recent published blogs (e.g. for homepage or widgets)
// @access  Public
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 3;
    const blogs = await Blog.find({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select('title slug excerpt coverImage author category tags readTime publishedAt viewCount');

    res.json({
      success: true,
      data: blogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/blogs
// @desc    Get all published blogs with filters, search, and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, tag, search, page = 1, limit = 9 } = req.query;
    const query = { status: 'published' };

    if (category && category !== 'All') {
      query.category = new RegExp(`^${category}$`, 'i');
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { excerpt: { $regex: search.trim(), $options: 'i' } },
        { tags: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 9));
    const skip = (pageNum - 1) * limitNum;

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ featured: -1, publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('title slug excerpt coverImage author category tags readTime publishedAt featured viewCount'),
      Blog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/blogs/:slug
// @desc    Get single published blog by slug + related posts
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { slug: req.params.slug, status: 'published' },
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    // Get 3 related articles from same category or general published
    const related = await Blog.find({
      _id: { $ne: blog._id },
      status: 'published',
      $or: [{ category: blog.category }, { tags: { $in: blog.tags || [] } }]
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select('title slug excerpt coverImage author category tags readTime publishedAt');

    res.json({
      success: true,
      data: {
        blog,
        related
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;