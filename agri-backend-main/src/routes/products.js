const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { toProduct } = require('../utils/serializers');

// Resolve a ?category= filter that may be a Mongo id or a category slug
const resolveCategoryId = async (category) => {
  if (!category) return null;
  if (mongoose.Types.ObjectId.isValid(category)) return category;
  const found = await Category.findOne({ slug: category }).select('_id');
  return found ? found._id : null;
};

// @desc    Get all products with filtering and search
// @route   GET /api/v1/products
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      featured,
      status = 'active',
      sort = '-createdAt',
      tags,
      ids
    } = req.query;

    // Build query (coerce user input to strings to avoid operator injection)
    const query = { status: String(status) };

    if (ids) {
      const rawIds = String(ids).split(',').map(s => s.trim()).filter(Boolean);
      if (rawIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { current: 1, pages: 0, total: 0, limit: 12 }
        });
      }
      const objectIds = rawIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      query.$or = [
        { _id: { $in: objectIds } },
        { productId: { $in: rawIds } }
      ];
    }

    if (category) {
      const categoryId = await resolveCategoryId(String(category));
      // Unknown slug → return empty result set rather than all products
      query.category = categoryId || new mongoose.Types.ObjectId();
    }

    if (search) {
      query.$text = { $search: String(search) };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (featured !== undefined) {
      query.featured = String(featured) === 'true';
    }

    if (tags) {
      query.tags = { $in: String(tags).split(',') };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = ids
      ? Math.min(250, Math.max(1, parseInt(limit) || 100))
      : Math.min(100, Math.max(1, parseInt(limit) || 12));

    // Execute query with pagination
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(String(sort))
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .exec();

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products.map(toProduct),
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch products'
      }
    });
  }
});

// @desc    Get featured products ("Our Best Sellers")
// @route   GET /api/v1/products/featured
// @access  Public
router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 8));

    const products = await Product.find({ featured: true, status: 'active' })
      .populate('category', 'name slug')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: products.map(toProduct)
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch featured products' }
    });
  }
});

// Helper: find a product by Mongo _id or by productId ("P001")
const findProductByIdentifier = async (identifier) => {
  let product = null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    product = await Product.findById(identifier).populate('category', 'name slug description');
  }
  if (!product) {
    product = await Product.findOne({ productId: identifier }).populate('category', 'name slug description');
  }
  return product;
};

// @desc    Get product by ID or productId
// @route   GET /api/v1/products/:identifier
// @access  Public
router.get('/:identifier', optionalAuth, async (req, res) => {
  try {
    const product = await findProductByIdentifier(req.params.identifier);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: toProduct(product)
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch product'
      }
    });
  }
});

// @desc    Get similar products ("Similar Products" carousel)
// @route   GET /api/v1/products/:identifier/similar
// @access  Public
router.get('/:identifier/similar', optionalAuth, async (req, res) => {
  try {
    const limitNum = Math.min(20, Math.max(1, parseInt(req.query.limit) || 8));
    const product = await findProductByIdentifier(req.params.identifier);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' }
      });
    }

    let similar = await Product.find({
      _id: { $ne: product._id },
      category: product.category?._id || product.category,
      status: 'active'
    })
      .populate('category', 'name slug')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .limit(limitNum);

    // Never return an empty carousel: top up with featured/recent products from
    // other categories when the product has few (or no) same-category siblings.
    if (similar.length < limitNum) {
      const excludeIds = [product._id, ...similar.map((s) => s._id)];
      const fillers = await Product.find({
        _id: { $nin: excludeIds },
        status: 'active'
      })
        .populate('category', 'name slug')
        .sort({ featured: -1, 'rating.average': -1, createdAt: -1 })
        .limit(limitNum - similar.length);
      similar = similar.concat(fillers);
    }

    res.status(200).json({
      success: true,
      data: similar.map(toProduct)
    });
  } catch (error) {
    console.error('Get similar products error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch similar products' }
    });
  }
});

// @desc    List approved reviews for a product (+ aggregate summary)
// @route   GET /api/v1/products/:identifier/reviews
// @access  Public
router.get('/:identifier/reviews', optionalAuth, async (req, res) => {
  try {
    const product = await findProductByIdentifier(req.params.identifier);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const filter = { product: product._id, status: 'approved' };
    const reviews = await Review.find(filter)
      .sort('-createdAt')
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);
    const total = await Review.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        reviews: reviews.map((r) => r.toApi()),
        summary: {
          average: product.rating?.average || 0,
          count: product.rating?.count || 0
        }
      },
      pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } });
  }
});

// @desc    Create/update the current user's review for a product
// @route   POST /api/v1/products/:identifier/reviews
// @access  Private (one review per user per product — re-posting updates it)
router.post('/:identifier/reviews', authenticate, async (req, res) => {
  try {
    const product = await findProductByIdentifier(req.params.identifier);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    const rating = parseInt(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'rating must be an integer from 1 to 5' } });
    }
    if (!comment) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'comment is required' } });
    }

    // Flag the review as a verified purchase if the user has ordered this product.
    const purchased = await Order.exists({ user: req.user._id, 'items.product': product._id });

    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      {
        name: req.user.name || 'Anonymous',
        rating,
        title: String(req.body.title || '').trim(),
        comment,
        verifiedPurchase: !!purchased,
        status: 'approved'
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const summary = await Review.recalcProductRating(product._id);

    res.status(201).json({
      success: true,
      data: { review: review.toApi(), summary },
      message: 'Review submitted'
    });
  } catch (error) {
    // Duplicate key (race on the unique index) → treat as a successful resubmit.
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE_REVIEW', message: 'You have already reviewed this product' } });
    }
    console.error('Create review error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit review' } });
  }
});

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Admin only
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      subcategory,
      images,
      video,
      videoUrl,
      stock,
      sku,
      weight,
      dimensions,
      featured,
      status,
      tags,
      seo,
      variants,
      nutritionInfo,
      origin,
      certifications,
      shelfLife
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, description, price, and category are required'
        }
      });
    }

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category'
        }
      });
    }

    // Check if SKU already exists (if provided)
    if (sku) {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_ERROR',
            message: 'Product with this SKU already exists'
          }
        });
      }
    }

    const resolvedVideo = video || (videoUrl ? { url: videoUrl } : undefined);
    const product = new Product({
      name,
      description,
      price,
      compareAtPrice,
      category,
      subcategory,
      images,
      video: resolvedVideo,
      videoUrl: videoUrl || video?.url,
      stock: stock || 0,
      sku,
      weight,
      dimensions,
      featured,
      status,
      tags,
      seo,
      variants,
      nutritionInfo,
      origin,
      certifications,
      shelfLife
    });

    await product.save();
    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: messages.join(', ')
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create product'
      }
    });
  }
});

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found'
        }
      });
    }

    // Validate category if being updated
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid category'
          }
        });
      }
    }

    // Check SKU uniqueness if being updated
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: updateData.sku, _id: { $ne: id } });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_ERROR',
            message: 'Product with this SKU already exists'
          }
        });
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: messages.join(', ')
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update product'
      }
    });
  }
});

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found'
        }
      });
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete product'
      }
    });
  }
});

// @desc    Get featured products
// @route   GET /api/v1/products/featured/all
// @access  Public
router.get('/featured/all', optionalAuth, async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      featured: true,
      status: 'active'
    })
      .populate('category', 'name slug')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: products.map(toProduct)
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch featured products'
      }
    });
  }
});

// @desc    Update product stock
// @route   PATCH /api/v1/products/:id/stock
// @access  Admin only
router.patch('/:id/stock', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid stock quantity is required'
        }
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found'
        }
      });
    }

    let newStock;
    switch (operation) {
      case 'add':
        newStock = product.stock + parseInt(stock);
        break;
      case 'subtract':
        newStock = Math.max(0, product.stock - parseInt(stock));
        break;
      default:
        newStock = parseInt(stock);
    }

    product.stock = newStock;
    await product.save();

    res.status(200).json({
      success: true,
      data: {
        productId: product.productId,
        name: product.name,
        previousStock: operation === 'set' ? null : (operation === 'add' ? product.stock - parseInt(stock) : product.stock + parseInt(stock)),
        currentStock: newStock,
        status: product.status
      },
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update stock'
      }
    });
  }
});

// @desc    Bulk update products
// @route   PATCH /api/v1/products/bulk/update
// @access  Admin only
router.patch('/bulk/update', authenticate, requireAdmin, async (req, res) => {
  try {
    const { productIds, updateData } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product IDs array is required'
        }
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      updateData,
      { runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      },
      message: `${result.modifiedCount} products updated successfully`
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update products'
      }
    });
  }
});

// @desc    Get product analytics
// @route   GET /api/v1/products/analytics/summary
// @access  Admin only
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const outOfStockProducts = await Product.countDocuments({ status: 'out_of_stock' });
    const featuredProducts = await Product.countDocuments({ featured: true });
    
    const averagePrice = await Product.aggregate([
      { $group: { _id: null, avgPrice: { $avg: '$price' } } }
    ]);

    const categoryCounts = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $project: { _id: 0, categoryName: '$category.name', count: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        featuredProducts,
        averagePrice: averagePrice[0]?.avgPrice || 0,
        categoryCounts
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch analytics'
      }
    });
  }
});

module.exports = router;