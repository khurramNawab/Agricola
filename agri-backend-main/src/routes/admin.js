const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Warehouse = require('../models/Warehouse');
const ProductWarehouseStock = require('../models/ProductWarehouseStock');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { streamInvoice, streamInvoice4x6, streamShippingLabel } = require('../utils/invoice');

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

// @route   GET /api/v1/admin/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get('/dashboard/stats', async (req, res) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get total users
    const totalUsers = await User.countDocuments({ role: 'customer' });
    
    // Get active users (logged in within last week)
    const activeUsers = await User.countDocuments({
      role: 'customer',
      lastLogin: { $gte: oneWeekAgo }
    });

    // Get total orders
    const totalOrders = await Order.countDocuments();
    
    // Get pending orders
    const pendingOrders = await Order.countDocuments({
      status: { $in: ['pending', 'confirmed'] }
    });

    // Get revenue (this week)
    const revenueResult = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' }
        }
      }
    ]);

    const revenue = revenueResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalOrders,
        pendingOrders,
        revenue: Math.round(revenue),
        enableMultiWarehouse: process.env.ENABLE_MULTI_WAREHOUSE === 'true'
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch dashboard statistics'
      }
    });
  }
});

// @route   GET /api/v1/admin/users
// @desc    Get all users with pagination and search
// @access  Private (Admin)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long')
], handleValidationErrors, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    let searchQuery = { role: 'customer' };
    
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(searchQuery)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USERS_FETCH_FAILED',
        message: 'Failed to fetch users'
      }
    });
  }
});

// @route   GET /api/v1/admin/users/:id
// @desc    Get user details
// @access  Private (Admin)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Get user's order statistics
    const orderStats = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' },
          averageOrderValue: { $avg: '$pricing.total' }
        }
      }
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0
    };

    res.json({
      success: true,
      data: {
        user: user.toObject(),
        orderStats: {
          totalOrders: stats.totalOrders,
          totalSpent: Math.round(stats.totalSpent || 0),
          averageOrderValue: Math.round(stats.averageOrderValue || 0)
        }
      }
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_FETCH_FAILED',
        message: 'Failed to fetch user details'
      }
    });
  }
});

// @route   PUT /api/v1/admin/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put('/users/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(/^\+91[0-9]{10}$/),
  body('status').optional().isIn(['active', 'banned', 'inactive'])
], handleValidationErrors, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Update fields
    const allowedFields = ['name', 'email', 'phone', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_UPDATE_FAILED',
        message: 'Failed to update user'
      }
    });
  }
});

// @route   POST /api/v1/admin/users/:id/ban
// @desc    Ban user
// @access  Private (Admin)
router.post('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    user.status = 'banned';
    await user.save();

    res.json({
      success: true,
      message: 'User banned successfully'
    });
  } catch (error) {
    console.error('User ban error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_BAN_FAILED',
        message: 'Failed to ban user'
      }
    });
  }
});

// @route   POST /api/v1/admin/users/:id/unban
// @desc    Unban user
// @access  Private (Admin)
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    user.status = 'active';
    await user.save();

    res.json({
      success: true,
      message: 'User unbanned successfully'
    });
  } catch (error) {
    console.error('User unban error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_UNBAN_FAILED',
        message: 'Failed to unban user'
      }
    });
  }
});

// @route   DELETE /api/v1/admin/users/:id
// @desc    Delete user
// @access  Private (Admin)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if user has orders
    const orderCount = await Order.countDocuments({ user: user._id });
    
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_HAS_ORDERS',
          message: 'Cannot delete user with existing orders. Consider banning instead.'
        }
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('User delete error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_DELETE_FAILED',
        message: 'Failed to delete user'
      }
    });
  }
});

// ============ ADMIN WAREHOUSES ============

// @route   GET /api/v1/admin/warehouses
// @desc    List all warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ isDefault: -1, code: 1 });
    res.json({
      success: true,
      data: warehouses.map((w) => ({
        id: w._id,
        code: w.code,
        name: w.name,
        shiprocketPickupNickname: w.shiprocketPickupNickname || '',
        ekartPickupAlias: w.ekartPickupAlias || '',
        ekartGstin: w.ekartGstin || '',
        address: w.address,
        spocName: w.spocName || '',
        spocPhone: w.spocPhone || '',
        isDefault: !!w.isDefault,
        status: w.status,
        createdAt: w.createdAt
      }))
    });
  } catch (error) {
    console.error('List warehouses error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch warehouses' } });
  }
});

// @route   GET /api/v1/admin/warehouses/sync-preview
// @desc    Fetch live pickup locations from Shiprocket and generate sync preview with conflict detection
router.get('/warehouses/sync-preview', async (req, res) => {
  try {
    const shiprocket = require('../utils/shiprocket');
    if (!shiprocket.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: { code: 'SHIPROCKET_UNCONFIGURED', message: 'Shiprocket API credentials are not configured.' }
      });
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shiprocket API sync request timed out (10s limit)')), 10000)
    );

    const locations = await Promise.race([shiprocket.listPickupLocations(), timeoutPromise]);
    const existingWarehouses = await Warehouse.find();

    const nicknameCounts = {};
    for (const loc of locations) {
      const nick = (loc.pickup_location || '').trim().toLowerCase();
      if (nick) nicknameCounts[nick] = (nicknameCounts[nick] || 0) + 1;
    }

    const items = [];
    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    let conflictCount = 0;

    for (const loc of locations) {
      const rawNickname = (loc.pickup_location || '').trim();
      const normNickname = rawNickname.toLowerCase();
      const city = (loc.city || '').trim();
      const state = (loc.state || '').trim();
      const pincode = String(loc.pin_code || loc.pincode || '').trim();
      const street = (loc.address || '').trim();
      const phone = String(loc.phone || '').trim();
      const spocName = String(loc.name || loc.first_name || '').trim();

      // REQUIRED Labeling format: "nickname (city, state, pincode)"
      const label = `${rawNickname} (${city || 'City'}, ${state || 'State'}, ${pincode || 'Pincode'})`;

      if (!normNickname) continue;

      if (nicknameCounts[normNickname] > 1) {
        conflictCount++;
        items.push({
          shiprocketNickname: rawNickname,
          label,
          address: { street, city, state, pincode, phone },
          spocName,
          spocPhone: phone,
          changeType: 'conflict',
          hasConflict: true,
          conflictMessage: `Duplicate pickup nickname '${rawNickname}' found in Shiprocket API response. Skipped auto-sync — manual review required.`
        });
        continue;
      }

      const match = existingWarehouses.find(
        (w) => (w.shiprocketPickupNickname || '').trim().toLowerCase() === normNickname
      );

      if (!match) {
        newCount++;
        items.push({
          shiprocketNickname: rawNickname,
          label,
          code: `WH-${rawNickname.toUpperCase().replace(/\W/g, '')}`,
          name: `WH-${rawNickname} (${city || 'Hub'})`,
          address: { street, city, state, pincode, phone },
          spocName,
          spocPhone: phone,
          status: loc.status === 1 || loc.status === 2 ? 'active' : 'inactive',
          matchedWarehouseId: null,
          changeType: 'new',
          hasConflict: false
        });
      } else {
        const addressChanged =
          match.address?.street !== street ||
          match.address?.city !== city ||
          match.address?.state !== state ||
          match.address?.pincode !== pincode;
        const changeType = addressChanged ? 'update' : 'unchanged';
        if (addressChanged) updateCount++;
        else unchangedCount++;

        items.push({
          shiprocketNickname: rawNickname,
          label,
          code: match.code,
          name: match.name,
          address: { street, city, state, pincode, phone },
          spocName: spocName || match.spocName,
          spocPhone: phone || match.spocPhone,
          status: match.status,
          matchedWarehouseId: match._id,
          changeType,
          hasConflict: false
        });
      }
    }

    res.json({
      success: true,
      data: {
        items,
        totalCount: items.length,
        newCount,
        updateCount,
        unchangedCount,
        conflictCount
      }
    });
  } catch (error) {
    console.error('Shiprocket sync preview error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SYNC_FAILED', message: error.message || 'Failed to sync pickup locations from Shiprocket' }
    });
  }
});

// @route   POST /api/v1/admin/warehouses/sync-apply
// @desc    Apply confirmed Shiprocket pickup locations sync changes
router.post('/warehouses/sync-apply', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'items array is required' } });
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const item of items) {
      if (item.hasConflict || item.changeType === 'conflict' || item.changeType === 'unchanged') {
        continue;
      }

      const rawNickname = (item.shiprocketNickname || '').trim();
      if (!rawNickname) continue;

      if (item.changeType === 'update' && item.matchedWarehouseId) {
        const wh = await Warehouse.findById(item.matchedWarehouseId);
        if (wh) {
          wh.address = {
            street: item.address?.street || wh.address.street,
            city: item.address?.city || wh.address.city,
            state: item.address?.state || wh.address.state,
            pincode: item.address?.pincode || wh.address.pincode,
            phone: item.address?.phone || wh.address.phone
          };
          if (item.spocName) wh.spocName = item.spocName;
          if (item.spocPhone) wh.spocPhone = item.spocPhone;
          await wh.save();
          updatedCount++;
        }
      } else if (item.changeType === 'new') {
        const normCode = (item.code || `WH-${rawNickname.toUpperCase().replace(/\W/g, '')}`).trim().toUpperCase();
        const existingCode = await Warehouse.findOne({ code: normCode });
        const finalCode = existingCode ? `${normCode}-${Date.now().toString().slice(-4)}` : normCode;

        await Warehouse.create({
          code: finalCode,
          name: item.name || `WH-${rawNickname}`,
          shiprocketPickupNickname: rawNickname,
          address: {
            street: item.address?.street || 'Pickup Address',
            city: item.address?.city || 'City',
            state: item.address?.state || 'State',
            pincode: item.address?.pincode || '100000',
            phone: item.address?.phone || ''
          },
          spocName: item.spocName || '',
          spocPhone: item.spocPhone || '',
          isDefault: false,
          status: 'active'
        });
        createdCount++;
      }
    }

    const warehouses = await Warehouse.find().sort({ isDefault: -1, code: 1 });
    res.json({
      success: true,
      message: `Sync complete: ${updatedCount} updated, ${createdCount} created.`,
      data: warehouses
    });
  } catch (error) {
    console.error('Shiprocket sync apply error:', error);
    res.status(500).json({ success: false, error: { code: 'SYNC_APPLY_FAILED', message: error.message || 'Failed to apply sync changes' } });
  }
});

// @route   POST /api/v1/admin/warehouses
// @desc    Disabled — warehouse creation must happen in Shiprocket first, then seeded by developer
router.post('/warehouses', async (req, res) => {
  return res.status(403).json({
    success: false,
    error: {
      code: 'WAREHOUSE_CREATION_DISABLED',
      message: 'Creating new warehouses via the app is not supported — new warehouses must first be registered in the Shiprocket dashboard, then added directly by a developer.'
    }
  });
});

// @route   POST /api/v1/admin/warehouses
// @desc    Create a new warehouse (custom / Ekart)
router.post('/warehouses', [
  body('name').trim().notEmpty().withMessage('Warehouse name is required'),
  body('code').optional().trim(),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.state').trim().notEmpty().withMessage('State is required'),
  body('address.pincode').matches(/^[1-9][0-9]{5}$/).withMessage('Valid 6-digit pincode is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { code, name, shiprocketPickupNickname, ekartPickupAlias, ekartGstin, address, spocName, spocPhone, isDefault, status } = req.body;

    let baseCode = (code || `WH-${(name || 'HUB').toUpperCase().replace(/[^A-Z0-9]/g, '')}`).trim().toUpperCase();
    if (!baseCode.startsWith('WH-')) baseCode = `WH-${baseCode}`;
    const existingCode = await Warehouse.findOne({ code: baseCode });
    const finalCode = existingCode ? `${baseCode}-${Date.now().toString().slice(-4)}` : baseCode;

    if (isDefault) {
      await Warehouse.updateMany({}, { isDefault: false });
    }

    const warehouse = await Warehouse.create({
      code: finalCode,
      name: String(name).trim(),
      shiprocketPickupNickname: String(shiprocketPickupNickname || '').trim(),
      ekartPickupAlias: String(ekartPickupAlias || '').trim(),
      ekartGstin: String(ekartGstin || '').trim(),
      address: {
        street: String(address.street).trim(),
        city: String(address.city).trim(),
        state: String(address.state).trim(),
        pincode: String(address.pincode).trim(),
        phone: String(address.phone || spocPhone || '').trim()
      },
      spocName: String(spocName || '').trim(),
      spocPhone: String(spocPhone || '').trim(),
      isDefault: !!isDefault,
      status: status === 'inactive' ? 'inactive' : 'active'
    });

    res.status(201).json({ success: true, message: 'Warehouse created successfully', data: warehouse });
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create warehouse' } });
  }
});

// @route   PUT /api/v1/admin/warehouses/:id
// @desc    Edit warehouse
router.put('/warehouses/:id', [
  body('name').optional().trim().notEmpty(),
  body('address.pincode').optional().matches(/^[1-9][0-9]{5}$/)
], handleValidationErrors, async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    }

    const { name, code, shiprocketPickupNickname, ekartPickupAlias, ekartGstin, address, spocName, spocPhone, isDefault, status } = req.body;

    if (name !== undefined) warehouse.name = String(name).trim();
    if (code !== undefined && code.trim()) warehouse.code = String(code).trim().toUpperCase();
    if (shiprocketPickupNickname !== undefined) warehouse.shiprocketPickupNickname = String(shiprocketPickupNickname).trim();
    if (ekartPickupAlias !== undefined) warehouse.ekartPickupAlias = String(ekartPickupAlias).trim();
    if (ekartGstin !== undefined) warehouse.ekartGstin = String(ekartGstin).trim();
    if (spocName !== undefined) warehouse.spocName = String(spocName).trim();
    if (spocPhone !== undefined) warehouse.spocPhone = String(spocPhone).trim();
    if (status !== undefined) warehouse.status = status === 'inactive' ? 'inactive' : 'active';

    if (address && typeof address === 'object') {
      if (address.street !== undefined) warehouse.address.street = String(address.street).trim();
      if (address.city !== undefined) warehouse.address.city = String(address.city).trim();
      if (address.state !== undefined) warehouse.address.state = String(address.state).trim();
      if (address.pincode !== undefined) warehouse.address.pincode = String(address.pincode).trim();
      if (address.phone !== undefined) warehouse.address.phone = String(address.phone).trim();
    }

    if (isDefault) {
      await Warehouse.updateMany({ _id: { $ne: warehouse._id } }, { isDefault: false });
      warehouse.isDefault = true;
    }

    await warehouse.save();
    res.json({ success: true, message: 'Warehouse updated successfully', data: warehouse });
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update warehouse' } });
  }
});

// @route   PATCH /api/v1/admin/warehouses/:id/status
// @desc    Toggle warehouse status (active/inactive)
router.patch('/warehouses/:id/status', async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    }
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be active or inactive' } });
    }
    warehouse.status = status;
    await warehouse.save();
    res.json({ success: true, message: `Warehouse status updated to ${status}`, data: warehouse });
  } catch (error) {
    console.error('Toggle warehouse status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update status' } });
  }
});

// ============ ADMIN CATALOG: PRODUCTS ============
// Consumes the AddProductModel.tsx payload and maps it onto the Product model.

// Admin table status string derived from stock level
const adminStockStatus = (stock) => {
  if (!stock || stock <= 0) return 'Out of Stock';
  if (stock <= 10) return 'Limited Stock';
  return 'In Stock';
};

// {250g:true,500g:false} -> ["250g"]
const variantsToSizes = (variants) => {
  if (Array.isArray(variants)) return variants;
  if (!variants || typeof variants !== 'object') return [];
  return Object.entries(variants).filter(([, on]) => !!on).map(([size]) => size);
};

// ["url1", {url}] -> [{url}]
const normalizeImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((img) => (typeof img === 'string' ? { url: img } : img))
    .filter((img) => img && img.url);

// Resolve a category by ObjectId or by name; returns the _id or null
const resolveCategoryId = async (category) => {
  if (!category) return null;
  if (mongoose.Types.ObjectId.isValid(category)) {
    const byId = await Category.findById(category);
    if (byId) return byId._id;
  }
  const byName = await Category.findOne({ name: category });
  return byName ? byName._id : null;
};

// Admin-facing product shape (table rows + detail)
const toAdminProduct = (p) => ({
  id: p._id,
  productId: p.productId,
  name: p.name,
  category: p.category && p.category.name ? p.category.name : null,
  categoryId: p.category && p.category._id ? p.category._id : p.category || null,
  sellingPrice: p.price,
  originalPrice: p.compareAtPrice || null,
  stock: p.stock,
  status: adminStockStatus(p.stock),
  sizes: p.sizes || [],
  images: (p.images || []).map((i) => ({ url: i.url, publicId: i.publicId || null })),
  featured: !!p.featured,
  shortDescription: p.description || '',
  about: p.about || '',
  usageInstructions: p.usageInstructions || '',
  whyChoose: p.whyChoose || '',
  createdAt: p.createdAt
});

// @route   GET /api/v1/admin/products
// @desc    Product table + stats (Total Products, Total Categories)
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = (req.query.search || '').trim();

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, total, totalProducts, totalCategories] = await Promise.all([
      Product.find(query).populate('category', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(query),
      Product.countDocuments(),
      Category.countDocuments()
    ]);

    res.json({
      success: true,
      data: products.map(toAdminProduct),
      stats: { totalProducts, totalCategories },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin list products error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch products' } });
  }
});

// @route   GET /api/v1/admin/products/:id
// @desc    Single product (full detail incl. image keys & warehouse stock) for the edit modal
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }
    const whStocks = await ProductWarehouseStock.find({ product: product._id })
      .populate('warehouse', 'code name address isDefault status');

    const warehouseStock = whStocks.map((ws) => ({
      warehouseId: ws.warehouse?._id,
      code: ws.warehouse?.code,
      name: ws.warehouse?.name,
      city: ws.warehouse?.address?.city,
      state: ws.warehouse?.address?.state,
      stock: ws.stock
    }));

    res.json({
      success: true,
      data: {
        ...toAdminProduct(product),
        warehouseStock
      }
    });
  } catch (error) {
    console.error('Admin get product error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch product' } });
  }
});

// @route   PUT /api/v1/admin/products/:id/warehouse-stock
// @desc    Update per-warehouse stock for a product
router.put('/products/:id/warehouse-stock', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    const { warehouseStock } = req.body;
    if (!Array.isArray(warehouseStock)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'warehouseStock must be an array' } });
    }

    for (const item of warehouseStock) {
      const qty = Math.max(0, parseInt(item.stock) || 0);
      await ProductWarehouseStock.findOneAndUpdate(
        { product: product._id, warehouse: item.warehouseId },
        { stock: qty },
        { upsert: true, new: true }
      );
    }

    // Recalculate total product stock sum
    const allStocks = await ProductWarehouseStock.find({ product: product._id });
    const totalStock = allStocks.reduce((sum, s) => sum + (s.stock || 0), 0);

    product.stock = totalStock;
    await product.save();

    res.json({
      success: true,
      message: 'Warehouse stock updated successfully',
      data: {
        id: product._id,
        productId: product.productId,
        stock: totalStock,
        warehouseStock: allStocks.map((ws) => ({ warehouseId: ws.warehouse, stock: ws.stock }))
      }
    });
  } catch (error) {
    console.error('Update warehouse stock error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update warehouse stock' } });
  }
});

// Map the AddProductModel payload onto Product fields (shared by create/update)
const mapProductPayload = async (body) => {
  const mapped = {};
  if (body.name !== undefined) mapped.name = body.name;
  if (body.sellingPrice !== undefined) mapped.price = body.sellingPrice;
  if (body.originalPrice !== undefined) mapped.compareAtPrice = body.originalPrice;
  if (body.shortDescription !== undefined) mapped.description = body.shortDescription;
  if (body.about !== undefined) mapped.about = body.about;
  if (body.usageInstructions !== undefined) mapped.usageInstructions = body.usageInstructions;
  if (body.whyChoose !== undefined) mapped.whyChoose = body.whyChoose;
  if (body.variants !== undefined) mapped.sizes = variantsToSizes(body.variants);
  if (body.images !== undefined) mapped.images = normalizeImages(body.images);
  if (body.stock !== undefined) mapped.stock = body.stock;
  if (body.featured !== undefined) mapped.featured = body.featured;
  if (body.tags !== undefined) mapped.tags = body.tags;
  if (body.newlyAdded !== undefined) mapped.newlyAdded = body.newlyAdded;
  return mapped;
};

// @route   POST /api/v1/admin/products
// @desc    Create product (AddProductModel payload)
router.post('/products', async (req, res) => {
  try {
    const { name, category, sellingPrice } = req.body;
    if (!name || !category || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name, category and sellingPrice are required' }
      });
    }

    const categoryId = await resolveCategoryId(category);
    if (!categoryId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid category' } });
    }

    const mapped = await mapProductPayload(req.body);
    // Model requires a description; fall back sensibly
    if (!mapped.description) mapped.description = req.body.about || name;
    if (mapped.stock === undefined) mapped.stock = 0;

    // productId is auto-generated from the highest existing id; on the rare
    // chance two creates race to the same id, retry so the second regenerates.
    let product;
    for (let attempt = 0; ; attempt++) {
      try {
        product = await Product.create({ ...mapped, category: categoryId });
        break;
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.productId && attempt < 3) continue;
        throw err;
      }
    }
    await product.populate('category', 'name');

    res.status(201).json({ success: true, data: toAdminProduct(product), message: 'Product created successfully' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: messages.join(', ') } });
    }
    console.error('Admin create product error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create product' } });
  }
});

// @route   PUT /api/v1/admin/products/:id
// @desc    Update product
router.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    if (req.body.category !== undefined) {
      const categoryId = await resolveCategoryId(req.body.category);
      if (!categoryId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid category' } });
      }
      product.category = categoryId;
    }

    const mapped = await mapProductPayload(req.body);
    Object.assign(product, mapped);
    await product.save();
    await product.populate('category', 'name');

    res.json({ success: true, data: toAdminProduct(product), message: 'Product updated successfully' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: messages.join(', ') } });
    }
    console.error('Admin update product error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update product' } });
  }
});

// @route   DELETE /api/v1/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete product' } });
  }
});

// ============ ADMIN CATALOG: CATEGORIES ============

const toAdminCategory = (c) => ({
  id: c._id,
  name: c.name,
  slug: c.slug,
  image: c.image ? c.image.url : null,
  productCount: typeof c.productCount === 'number' ? c.productCount : undefined,
  status: c.status
});

// Set the given products' category (accepts _id or productId like "P001")
const assignProductsToCategory = async (refs, categoryId) => {
  if (!Array.isArray(refs) || refs.length === 0) return;
  const objectIds = refs.filter((r) => mongoose.Types.ObjectId.isValid(r));
  const productIds = refs.filter((r) => !mongoose.Types.ObjectId.isValid(r));
  const or = [];
  if (objectIds.length) or.push({ _id: { $in: objectIds } });
  if (productIds.length) or.push({ productId: { $in: productIds } });
  if (or.length) await Product.updateMany({ $or: or }, { category: categoryId });
};

// @route   GET /api/v1/admin/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().populate('productCount').sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: categories.map(toAdminCategory) });
  } catch (error) {
    console.error('Admin list categories error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' } });
  }
});

// @route   GET /api/v1/admin/categories/:id
// @desc    Single category WITH its assigned products (for the edit modal)
router.get('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }
    const products = await Product.find({ category: category._id }).select('productId name').sort({ name: 1 });
    res.json({
      success: true,
      data: {
        ...toAdminCategory(category),
        productCount: products.length,
        products: products.map((p) => ({ id: p._id, productId: p.productId, name: p.name }))
      }
    });
  } catch (error) {
    console.error('Admin get category error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category' } });
  }
});

// @route   POST /api/v1/admin/categories
// @desc    Create category (AddCategoryModel payload: { name, products, image })
router.post('/categories', async (req, res) => {
  try {
    const { name, image, products } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Category name is required' } });
    }

    const exists = await Category.findOne({ name });
    if (exists) {
      return res.status(400).json({ success: false, error: { code: 'DUPLICATE_ERROR', message: 'Category with this name already exists' } });
    }

    const category = await Category.create({
      name,
      image: image ? (typeof image === 'string' ? { url: image } : image) : undefined
    });

    await assignProductsToCategory(products, category._id);

    res.status(201).json({ success: true, data: toAdminCategory(category), message: 'Category created successfully' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: messages.join(', ') } });
    }
    console.error('Admin create category error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' } });
  }
});

// @route   PUT /api/v1/admin/categories/:id
router.put('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    const { name, image, products } = req.body;
    if (name !== undefined) category.name = name;
    if (image !== undefined) category.image = typeof image === 'string' ? { url: image } : image;
    await category.save();

    if (products !== undefined) await assignProductsToCategory(products, category._id);

    res.json({ success: true, data: toAdminCategory(category), message: 'Category updated successfully' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: messages.join(', ') } });
    }
    console.error('Admin update category error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update category' } });
  }
});

// @route   DELETE /api/v1/admin/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONSTRAINT_ERROR', message: `Cannot delete: ${productCount} product(s) still use this category` }
      });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Admin delete category error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category' } });
  }
});

// ============ ADMIN PAYMENTS (derived from Orders) ============
// There is no separate Payment collection — payment data lives on the Order.

const PAYMENT_STATUS_LABEL = {
  paid: 'Success',
  failed: 'Failed',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded'
};
const PAYMENT_STATUS_FROM_LABEL = {
  Success: 'paid',
  Failed: 'failed',
  Pending: 'pending',
  Refunded: 'refunded',
  'Partially Refunded': 'partially_refunded'
};
const PAYMENT_METHOD_LABEL = {
  razorpay: 'Razorpay',
  cod: 'COD',
  bank_transfer: 'Bank Transfer'
};

const toAdminPayment = (order) => {
  const pd = order.paymentDetails || {};
  const user = order.user && typeof order.user === 'object' ? order.user : null;
  return {
    id: order._id,
    transactionId: pd.razorpayPaymentId || pd.transactionId || null,
    orderId: order.orderId,
    name: user ? user.name || '—' : '—',
    email: user ? user.email || null : null,
    method: PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod,
    status: PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus,
    amount: order.pricing ? order.pricing.total : 0,
    date: pd.paymentDate || order.createdAt
  };
};

// @route   GET /api/v1/admin/payments
// @desc    Payments table + stats (Total Transactions, Successful, Failed, Pending, Revenue)
router.get('/payments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = (req.query.search || '').trim();
    const statusLabel = req.query.status;

    const query = {};
    if (statusLabel && PAYMENT_STATUS_FROM_LABEL[statusLabel]) {
      query.paymentStatus = PAYMENT_STATUS_FROM_LABEL[statusLabel];
    }
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { userId: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'paymentDetails.razorpayPaymentId': { $regex: search, $options: 'i' } },
        { user: { $in: users.map((u) => u._id) } }
      ];
    }

    const [orders, total, statsAgg] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email userId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(query),
      Order.aggregate([
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            paidRevenue: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$pricing.total', 0] }
            }
          }
        }
      ])
    ]);

    const stats = { totalTransactions: 0, successful: 0, failed: 0, pending: 0, revenue: 0 };
    statsAgg.forEach((s) => {
      stats.totalTransactions += s.count;
      if (s._id === 'paid') {
        stats.successful = s.count;
        stats.revenue += s.paidRevenue;
      } else if (s._id === 'failed') {
        stats.failed = s.count;
      } else if (s._id === 'pending') {
        stats.pending = s.count;
      }
    });
    stats.revenue = Math.round(stats.revenue);

    res.json({
      success: true,
      data: orders.map(toAdminPayment),
      stats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin list payments error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payments' } });
  }
});

// @route   GET /api/v1/admin/payments/:id
// @desc    Payment detail (the "View" action) — :id is the order id
router.get('/payments/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    }
    const order = await Order.findById(req.params.id).populate('user', 'name email userId phone');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    }
    const pd = order.paymentDetails || {};
    res.json({
      success: true,
      data: {
        ...toAdminPayment(order),
        paymentMethodRaw: order.paymentMethod,
        statusRaw: order.paymentStatus,
        razorpayOrderId: pd.razorpayOrderId || null,
        razorpayPaymentId: pd.razorpayPaymentId || null,
        refundId: pd.refundId || null,
        refundAmount: pd.refundAmount || null,
        failureReason: pd.failureReason || null,
        pricing: order.pricing || null,
        items: (order.items || []).map((i) => ({
          name: i.name,
          weight: i.weight,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.subtotal
        })),
        customer: order.user
          ? { name: order.user.name, email: order.user.email, phone: order.user.phone, userId: order.user.userId }
          : null,
        createdAt: order.createdAt,
        paymentDate: pd.paymentDate || null
      }
    });
  } catch (error) {
    console.error('Admin get payment error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment' } });
  }
});

// ============ ADMIN ORDERS / SHIPMENT ============

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const toAdminOrder = (order) => {
  const user = order.user && typeof order.user === 'object' ? order.user : null;
  const wh = order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null;
  return {
    id: order._id,
    orderId: order.orderId,
    customer: user ? user.name || '—' : '—',
    email: user ? user.email || null : null,
    items: Array.isArray(order.items) ? order.items.length : 0,
    amount: order.pricing ? order.pricing.total : 0,
    paymentMethod: PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod,
    paymentStatus: PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus,
    status: capitalize(order.status),
    date: order.createdAt,
    awaitingWarehouseAssignment: !!order.awaitingWarehouseAssignment,
    warehouse: wh ? { id: wh._id, code: wh.code, name: wh.name, city: wh.address?.city, state: wh.address?.state } : (order.warehouse || null)
  };
};

// @route   GET /api/v1/admin/orders
// @desc    Orders table + stats (Total, Delivered, Shipped, Pending Dispatch, Cancelled/Returned)
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = (req.query.search || '').trim();
    const statusFilter = (req.query.status || '').toLowerCase();

    const query = {};
    if (ORDER_STATUSES.includes(statusFilter)) query.status = statusFilter;
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { userId: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { user: { $in: users.map((u) => u._id) } }
      ];
    }

    const [orders, total, statusAgg] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email userId')
        .populate('warehouse', 'code name address')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(query),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const byStatus = {};
    let totalOrders = 0;
    statusAgg.forEach((s) => {
      byStatus[s._id] = s.count;
      totalOrders += s.count;
    });
    const stats = {
      totalOrders,
      delivered: byStatus.delivered || 0,
      shipped: byStatus.shipped || 0,
      pendingDispatch: (byStatus.pending || 0) + (byStatus.confirmed || 0) + (byStatus.processing || 0),
      cancelledReturned: (byStatus.cancelled || 0) + (byStatus.refunded || 0)
    };

    res.json({
      success: true,
      data: orders.map(toAdminOrder),
      stats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin list orders error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } });
  }
});

// @route   GET /api/v1/admin/orders/:id/invoice[?size=4x6]
// @desc    Download a PDF invoice (A4 by default, or 4×6 thermal with ?size=4x6)
router.get('/orders/:id/invoice', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone userId')
      .populate('warehouse', 'code name address shiprocketPickupNickname spocName spocPhone');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const thermal = req.query.size === '4x6';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}${thermal ? '-4x6' : ''}.pdf"`);
    (thermal ? streamInvoice4x6 : streamInvoice)(order, res);
  } catch (error) {
    console.error('Invoice generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate invoice' } });
    }
  }
});

// @route   GET /api/v1/admin/orders/:id/label
// @desc    Download a 4×6 thermal shipping/address label for an order
router.get('/orders/:id/label', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone userId')
      .populate('warehouse', 'code name address shiprocketPickupNickname spocName spocPhone');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label-${order.orderId}.pdf"`);
    streamShippingLabel(order, res);
  } catch (error) {
    console.error('Label generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate label' } });
    }
  }
});

// @route   GET /api/v1/admin/orders/:id
// @desc    Order detail (View / Track) incl. items, shipping, timeline
router.get('/orders/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email userId phone')
      .populate('warehouse', 'code name address shiprocketPickupNickname');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const sh = order.shipping || {};
    res.json({
      success: true,
      data: {
        ...toAdminOrder(order),
        statusRaw: order.status,
        paymentStatusRaw: order.paymentStatus,
        items: (order.items || []).map((i) => ({
          name: i.name,
          weight: i.weight,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.subtotal,
          image: i.image || null
        })),
        pricing: order.pricing || null,
        customer: order.user
          ? { name: order.user.name, email: order.user.email, phone: order.user.phone, userId: order.user.userId }
          : null,
        shippingAddress: order.shippingAddress || null,
        shipping: {
          method: sh.method || null,
          carrier: sh.carrier || null,
          trackingNumber: sh.trackingNumber || null,
          provider: sh.provider || null,
          courierName: sh.courierName || null,
          providerShipmentId: sh.providerShipmentId || sh.ekartShipmentId || null,
          labelUrl: sh.labelUrl || null,
          trackingUrl: sh.trackingUrl || null,
          ekartShipmentId: sh.ekartShipmentId || null,
          estimatedDelivery: sh.estimatedDelivery || null,
          shippedAt: sh.shippedAt || null,
          deliveredAt: sh.deliveredAt || null
        },
        timeline: (order.timeline || []).map((t) => ({
          status: t.status,
          message: t.message,
          timestamp: t.timestamp
        })),
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Admin get order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch order' } });
  }
});

// @route   GET /api/v1/admin/orders/:id/warehouse-availability
// @desc    Check stock availability for each order item across active warehouses
router.get('/orders/:id/warehouse-availability', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findById(req.params.id).populate('items.product', 'name productId');
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const warehouses = await Warehouse.find({ status: 'active' }).sort({ isDefault: -1, name: 1 });
    const warehouseAvailability = [];

    for (const wh of warehouses) {
      let canFulfill = true;
      const itemsAvailability = [];

      for (const item of order.items) {
        const productId = item.product?._id || item.product;
        const required = item.quantity || 1;
        const whStockDoc = await ProductWarehouseStock.findOne({ product: productId, warehouse: wh._id });
        const available = whStockDoc ? whStockDoc.stock : 0;
        const sufficient = available >= required;
        if (!sufficient) canFulfill = false;

        itemsAvailability.push({
          productId: item.product?.productId || String(productId),
          name: item.name,
          required,
          available,
          sufficient
        });
      }

      warehouseAvailability.push({
        id: wh._id,
        code: wh.code,
        name: wh.name,
        shiprocketPickupNickname: wh.shiprocketPickupNickname || '',
        ekartPickupAlias: wh.ekartPickupAlias || '',
        city: wh.address?.city,
        state: wh.address?.state,
        pincode: wh.address?.pincode,
        isDefault: wh.isDefault,
        canFulfill,
        itemsAvailability
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        awaitingWarehouseAssignment: !!order.awaitingWarehouseAssignment,
        assignedWarehouseId: order.warehouse || null,
        warehouses: warehouseAvailability
      }
    });
  } catch (error) {
    console.error('Warehouse availability error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check warehouse availability' } });
  }
});

// @route   PUT /api/v1/admin/orders/:id/assign-warehouse
// @desc    Assign fulfillment warehouse to an order and auto-trigger shipment if ready
router.put('/orders/:id/assign-warehouse', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const { warehouseId, shippingProvider } = req.body;
    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid warehouseId is required' } });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const newWarehouse = await Warehouse.findById(warehouseId);
    if (!newWarehouse || newWarehouse.status !== 'active') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_WAREHOUSE', message: 'Warehouse not found or inactive' } });
    }

    if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot reassign warehouse for order in '${order.status}' status` } });
    }

    // Validate availability
    const shortItems = [];
    for (const item of order.items) {
      const productId = item.product?._id || item.product;
      const required = item.quantity || 1;
      const whStockDoc = await ProductWarehouseStock.findOne({ product: productId, warehouse: newWarehouse._id });
      const available = whStockDoc ? whStockDoc.stock : 0;
      if (available < required) {
        shortItems.push(`${item.name} (Available: ${available}, Needed: ${required})`);
      }
    }

    if (shortItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_WAREHOUSE_STOCK',
          message: `Warehouse ${newWarehouse.code} has insufficient stock for: ${shortItems.join(', ')}`
        }
      });
    }

    const oldWarehouseId = order.warehouse;
    const wasAssigned = !order.awaitingWarehouseAssignment && oldWarehouseId;

    // Run stock updates + order save. Uses a transaction when on a replica set;
    // falls back to non-transactional on standalone MongoDB (local dev).
    const runAssignment = async (opts) => {
      // If order was already assigned to a DIFFERENT warehouse, credit stock back to old warehouse
      if (wasAssigned && String(oldWarehouseId) !== String(newWarehouse._id)) {
        for (const item of order.items) {
          const productId = item.product?._id || item.product;
          await ProductWarehouseStock.updateOne(
            { product: productId, warehouse: oldWarehouseId },
            { $inc: { stock: item.quantity } },
            opts
          );
        }
      }

      // Deduct stock from new warehouse (if re-assigning or first assignment)
      if (!wasAssigned || String(oldWarehouseId) !== String(newWarehouse._id)) {
        for (const item of order.items) {
          const productId = item.product?._id || item.product;
          await ProductWarehouseStock.updateOne(
            { product: productId, warehouse: newWarehouse._id },
            { $inc: { stock: -item.quantity } },
            opts
          );
        }
      }

      order.warehouse = newWarehouse._id;
      order.awaitingWarehouseAssignment = false;

      // Stamp pickup address on order shipping subdocument
      if (!order.shipping) order.shipping = {};
      order.shipping.pickupAddress = {
        name: newWarehouse.name,
        phone: newWarehouse.address.phone || newWarehouse.spocPhone,
        address: newWarehouse.address.street,
        city: newWarehouse.address.city,
        state: newWarehouse.address.state,
        pincode: newWarehouse.address.pincode
      };

      const oldWhDoc = wasAssigned ? await Warehouse.findById(oldWarehouseId) : null;
      const msg = wasAssigned && String(oldWarehouseId) !== String(newWarehouse._id)
        ? `Warehouse reassigned from ${oldWhDoc?.name || oldWarehouseId} to ${newWarehouse.name} (${newWarehouse.code})`
        : `Assigned to warehouse ${newWarehouse.name} (${newWarehouse.code})`;

      order.timeline.push({
        status: 'warehouse_assigned',
        message: msg,
        timestamp: new Date(),
        updatedBy: req.user._id
      });

      await order.save(opts);
    };

    // Attempt with transaction on replica set; fall back to non-transactional on standalone MongoDB (local dev)
    let assigned = false;
    try {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await runAssignment({ session });
        await session.commitTransaction();
        assigned = true;
      } catch (txnErr) {
        try { await session.abortTransaction(); } catch (_) {}
        console.warn('MongoDB transaction omitted (standalone mode or error), falling back:', txnErr.message);
      } finally {
        try { await session.endSession(); } catch (_) {}
      }
    } catch (sessionErr) {
      console.warn('MongoDB session init omitted, falling back:', sessionErr.message);
    }

    // If transaction didn't run (standalone mode), execute non-transactionally
    if (!assigned) {
      await runAssignment({});
    }

    // Trigger autoCreateShipment if order is paid or COD
    const shipping = require('../utils/shipping');
    try {
      if (shipping.isConfigured() && !order.shipping?.trackingNumber) {
        // Resolve carrier: (1) admin-chosen via UI, (2) already stored on order, (3) env default
        const VALID_PROVIDERS = ['shiprocket', 'ekart'];
        const resolvedProvider =
          (shippingProvider && VALID_PROVIDERS.includes(String(shippingProvider).toLowerCase()))
            ? String(shippingProvider).toLowerCase()
            : shipping.providerOfOrder(order) || shipping.providerName();

        const shipment = await shipping.createShipment(order, {
          warehouse: newWarehouse,
          provider: resolvedProvider
        });
        shipping.applyShipment(order, shipment);
        if (order.status === 'pending' || order.status === 'confirmed') {
          order.status = 'processing';
        }
        await order.save();
      }
    } catch (shipErr) {
      console.error(`Shipment booking after warehouse assignment failed for ${order.orderId}:`, shipErr.message);
    }

    await order.populate('user', 'name email userId phone');
    await order.populate('warehouse', 'code name address shiprocketPickupNickname');
    res.json({
      success: true,
      message: `Warehouse ${newWarehouse.code} assigned successfully`,
      data: toAdminOrder(order)
    });
  } catch (error) {
    console.error('Assign warehouse error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to assign warehouse' } });
  }
});

const { restoreOrderStock } = require('../utils/stock');

// @route   PUT /api/v1/admin/orders/:id/status
// @desc    Update an order's status (pre-save appends a timeline entry)
router.put('/orders/:id/status', [
  body('status').isIn(ORDER_STATUSES).withMessage('Invalid status'),
  body('note').optional().isLength({ max: 500 })
], handleValidationErrors, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const newStatus = req.body.status;
    const oldStatus = order.status;
    if ((newStatus === 'cancelled' || newStatus === 'refunded') && oldStatus !== 'cancelled' && oldStatus !== 'refunded') {
      await restoreOrderStock(order);
    }
    order.status = newStatus;
    if (req.body.note) {
      order.notes = { ...(order.notes || {}), admin: req.body.note };
    }
    await order.save();
    await order.populate('user', 'name email userId');
    res.json({ success: true, message: 'Order status updated', data: toAdminOrder(order) });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } });
  }
});

module.exports = router;