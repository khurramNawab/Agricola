const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { toCategory } = require('../utils/serializers');

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      parent,
      sort = 'sortOrder',
      search
    } = req.query;

    // Build query (coerce to strings to avoid operator injection).
    // Storefront default: only active categories.
    const query = { status: status ? String(status) : 'active' };

    if (parent) {
      query.parent = parent === 'null' ? null : String(parent);
    }

    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Execute query with pagination
    const categories = await Category.find(query)
      .populate('productCount')
      .sort({ [String(sort)]: 1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .exec();

    const total = await Category.countDocuments(query);

    res.status(200).json({
      success: true,
      data: categories.map(toCategory),
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch categories'
      }
    });
  }
});

// @desc    Get category by ID or slug
// @route   GET /api/v1/categories/:identifier
// @access  Public
router.get('/:identifier', optionalAuth, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let category = await Category.findById(identifier)
      .populate('subcategories')
      .populate('productCount');
    
    if (!category) {
      category = await Category.findOne({ slug: identifier })
        .populate('subcategories')
        .populate('productCount');
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch category'
      }
    });
  }
});

// @desc    Create new category
// @route   POST /api/v1/categories
// @access  Admin only
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      parent,
      status,
      sortOrder,
      seo
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category name is required'
        }
      });
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Category with this name already exists'
        }
      });
    }

    // Validate parent category if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid parent category'
          }
        });
      }
    }

    const category = new Category({
      name,
      description,
      image,
      parent: parent || null,
      status,
      sortOrder,
      seo
    });

    await category.save();

    // Populate the created category
    await category.populate('subcategories');
    await category.populate('productCount');

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Create category error:', error);
    
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
        message: 'Failed to create category'
      }
    });
  }
});

// @desc    Update category
// @route   PUT /api/v1/categories/:id
// @access  Admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      image,
      parent,
      status,
      sortOrder,
      seo
    } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_ERROR',
            message: 'Category with this name already exists'
          }
        });
      }
    }

    // Validate parent category if provided
    if (parent && parent !== category.parent?.toString()) {
      // Check if trying to set self as parent
      if (parent === id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Category cannot be its own parent'
          }
        });
      }

      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid parent category'
          }
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (parent !== undefined) category.parent = parent || null;
    if (status !== undefined) category.status = status;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (seo !== undefined) category.seo = seo;

    await category.save();

    // Populate the updated category
    await category.populate('subcategories');
    await category.populate('productCount');

    res.status(200).json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Update category error:', error);
    
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
        message: 'Failed to update category'
      }
    });
  }
});

// @desc    Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: id });
    if (subcategories.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONSTRAINT_ERROR',
          message: 'Cannot delete category with subcategories. Delete subcategories first.'
        }
      });
    }

    // Check if category has products (you'll need to implement this check)
    // For now, we'll assume this check will be done
    
    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete category'
      }
    });
  }
});

// @desc    Get category tree (hierarchical structure)
// @route   GET /api/v1/categories/tree
// @access  Public
router.get('/tree/all', optionalAuth, async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    // Get all categories
    const categories = await Category.find({ status })
      .populate('productCount')
      .sort({ sortOrder: 1 });

    // Build tree structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap.set(category._id.toString(), {
        ...category.toObject(),
        children: []
      });
    });

    // Second pass: build tree structure
    categories.forEach(category => {
      const categoryObj = categoryMap.get(category._id.toString());
      
      if (category.parent) {
        const parentObj = categoryMap.get(category.parent.toString());
        if (parentObj) {
          parentObj.children.push(categoryObj);
        }
      } else {
        rootCategories.push(categoryObj);
      }
    });

    res.status(200).json({
      success: true,
      data: rootCategories
    });
  } catch (error) {
    console.error('Get category tree error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch category tree'
      }
    });
  }
});

// @desc    Reorder categories
// @route   POST /api/v1/categories/reorder
// @access  Admin only
router.post('/reorder', authenticate, requireAdmin, async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Categories must be an array'
        }
      });
    }

    // Update sort order for each category
    const updatePromises = categories.map((cat, index) => 
      Category.findByIdAndUpdate(cat.id, { sortOrder: index })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reorder categories'
      }
    });
  }
});

module.exports = router;