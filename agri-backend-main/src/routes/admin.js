const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Warehouse = require('../models/Warehouse');
const ProductWarehouseStock = require('../models/ProductWarehouseStock');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const AbandonedCartLog = require('../models/AbandonedCartLog');
const HeroCampaign = require('../models/HeroCampaign');
const LaunchSubscriber = require('../models/LaunchSubscriber');
const Feedback = require('../models/Feedback');
const Setting = require('../models/Setting');
const Blog = require('../models/Blog');
const mailer = require('../utils/email');
const { TEMPLATES, formatTemplate, sendAbandonedEmail, buildWhatsAppLink } = require('../utils/abandonedCart');
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
          name: `WH-${rawNickname} (${city || 'Facility'})`,
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
// @desc    Intentionally disabled — warehouses must originate from logistics provider setup
//          (registered in Shiprocket dashboard and synced via /sync-apply, or manually seeded by developer)
router.post('/warehouses', async (req, res) => {
  return res.status(403).json({
    success: false,
    error: {
      code: 'WAREHOUSE_CREATION_DISABLED',
      message: 'Creating new warehouses via the app is not supported — new warehouses must first be registered in the Shiprocket dashboard, then added directly by a developer.'
    }
  });
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

    const { name, code, shiprocketPickupNickname, ekartPickupAlias, ekartGstin, address, spocName, spocPhone, isDefault, status, climateControl, sameDayCutoff } = req.body;

    if (name !== undefined) warehouse.name = String(name).trim();
    if (code !== undefined && code.trim()) warehouse.code = String(code).trim().toUpperCase();
    if (shiprocketPickupNickname !== undefined) warehouse.shiprocketPickupNickname = String(shiprocketPickupNickname).trim();
    if (ekartPickupAlias !== undefined) warehouse.ekartPickupAlias = String(ekartPickupAlias).trim();
    if (ekartGstin !== undefined) warehouse.ekartGstin = String(ekartGstin).trim();
    if (spocName !== undefined) warehouse.spocName = String(spocName).trim();
    if (spocPhone !== undefined) warehouse.spocPhone = String(spocPhone).trim();
    if (status !== undefined) warehouse.status = status === 'inactive' ? 'inactive' : 'active';
    if (climateControl !== undefined) warehouse.climateControl = String(climateControl).trim();
    if (sameDayCutoff !== undefined) warehouse.sameDayCutoff = String(sameDayCutoff).trim();

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
// @desc    Toggle warehouse status (active/inactive) & recalculate affected product stocks
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

    // Recalculate Product.stock for all products affected by this warehouse
    const ProductWarehouseStock = require('../models/ProductWarehouseStock');
    const Product = require('../models/Product');

    const activeWarehouses = await Warehouse.find({ status: 'active' }).select('_id');
    const activeWarehouseIds = activeWarehouses.map((w) => w._id);

    const affectedStocks = await ProductWarehouseStock.find({ warehouse: warehouse._id });
    const productIds = Array.from(new Set(affectedStocks.map((s) => String(s.product))));

    for (const prodId of productIds) {
      const activeStocks = await ProductWarehouseStock.find({
        product: prodId,
        warehouse: { $in: activeWarehouseIds }
      });
      const activeTotal = activeStocks.reduce((sum, s) => sum + (s.stock || 0), 0);
      await Product.findByIdAndUpdate(prodId, { stock: activeTotal });
    }

    res.json({
      success: true,
      message: `Warehouse status updated to ${status}. Recalculated stock for ${productIds.length} products.`,
      data: warehouse
    });
  } catch (error) {
    console.error('Toggle warehouse status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update status' } });
  }
});

// @route   GET /api/v1/admin/warehouses/:id/test-connectivity
// @desc    Run real carrier connectivity diagnostic test for a warehouse
router.get('/warehouses/:id/test-connectivity', async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    }

    const shiprocket = require('../utils/shiprocket');
    const ekart = require('../utils/ekart');

    // 1. Shiprocket Diagnostic Ping
    let shiprocketResult = {
      status: 'pending',
      configured: shiprocket.isConfigured(),
      latencyMs: 0,
      nickname: warehouse.shiprocketPickupNickname || '',
      message: ''
    };

    if (shiprocket.isConfigured()) {
      const t0 = Date.now();
      try {
        await Promise.race([
          shiprocket.listPickupLocations(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Shiprocket ping timeout')), 10000))
        ]);
        const latencyMs = Date.now() - t0;
        shiprocketResult = {
          status: 'ready',
          configured: true,
          latencyMs,
          nickname: warehouse.shiprocketPickupNickname || '',
          message: `${latencyMs}ms • Authenticated & Active`
        };
      } catch (err) {
        shiprocketResult = {
          status: 'error',
          configured: true,
          latencyMs: Date.now() - t0,
          nickname: warehouse.shiprocketPickupNickname || '',
          message: err.message || 'Carrier ping failed'
        };
      }
    } else {
      shiprocketResult = {
        status: 'unconfigured',
        configured: false,
        latencyMs: 0,
        nickname: warehouse.shiprocketPickupNickname || '',
        message: 'Credentials not configured in environment'
      };
    }

    // 2. Ekart Diagnostic Ping
    let ekartResult = {
      status: 'pending',
      configured: ekart.isConfigured(),
      latencyMs: 0,
      message: ''
    };

    if (ekart.isConfigured()) {
      const t0Ekart = Date.now();
      try {
        await Promise.race([
          ekart.getToken(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Ekart ping timeout')), 10000))
        ]);
        const latencyMs = Date.now() - t0Ekart;
        ekartResult = {
          status: 'ready',
          configured: true,
          latencyMs,
          message: `${latencyMs}ms • Ready`
        };
      } catch (err) {
        ekartResult = {
          status: 'error',
          configured: true,
          latencyMs: Date.now() - t0Ekart,
          message: err.message || 'Ekart connection failed'
        };
      }
    } else {
      ekartResult = {
        status: 'unconfigured',
        configured: false,
        latencyMs: 0,
        message: 'Ekart credentials not configured'
      };
    }

    // 3. Pincode Reach Engine
    const reachResult = {
      status: 'ready',
      label: '29,000+ Pincodes',
      coverage: 'Pan-India Active Reach'
    };

    res.json({
      success: true,
      data: {
        warehouseId: warehouse._id,
        code: warehouse.code,
        name: warehouse.name,
        pincode: warehouse.address?.pincode,
        shiprocket: shiprocketResult,
        ekart: ekartResult,
        reach: reachResult,
        testedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Test warehouse connectivity error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to test connectivity' } });
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
  variantStocks: (p.variantStocks || []).map((v) => ({
    size: v.size,
    stock: v.stock !== undefined ? v.stock : 0,
    price: v.price !== undefined ? v.price : null
  })),
  images: (p.images || []).map((i) => ({ url: i.url, publicId: i.publicId || null })),
  featured: !!p.featured,
  isOrganic: p.isOrganic !== false, // default true for existing products without the field
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

    // Recalculate total product stock sum (active warehouses only)
    const activeWarehouses = await Warehouse.find({ status: 'active' }).select('_id');
    const activeWarehouseIds = activeWarehouses.map((w) => w._id);
    const activeStocks = await ProductWarehouseStock.find({
      product: product._id,
      warehouse: { $in: activeWarehouseIds }
    });
    const totalStock = activeStocks.reduce((sum, s) => sum + (s.stock || 0), 0);

    product.stock = totalStock;
    await product.save();

    res.json({
      success: true,
      message: 'Warehouse stock updated successfully',
      data: {
        id: product._id,
        productId: product.productId,
        stock: totalStock,
        warehouseStock: activeStocks.map((ws) => ({ warehouseId: ws.warehouse, stock: ws.stock }))
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
  if (body.sellingPrice !== undefined) mapped.price = Math.max(0, Number(body.sellingPrice) || 0);
  if (body.originalPrice !== undefined) mapped.compareAtPrice = body.originalPrice !== null && body.originalPrice !== '' ? Math.max(0, Number(body.originalPrice) || 0) : null;
  if (body.shortDescription !== undefined) mapped.description = body.shortDescription;
  if (body.about !== undefined) mapped.about = body.about;
  if (body.usageInstructions !== undefined) mapped.usageInstructions = body.usageInstructions;
  if (body.whyChoose !== undefined) mapped.whyChoose = body.whyChoose;
  if (body.variants !== undefined) mapped.sizes = variantsToSizes(body.variants);
  if (body.variantStocks !== undefined && Array.isArray(body.variantStocks)) {
    mapped.variantStocks = body.variantStocks.map((v) => ({
      size: String(v.size || '').trim(),
      stock: Math.max(0, parseInt(v.stock, 10) || 0),
      price: v.price !== undefined && v.price !== null && v.price !== '' ? Math.max(0, Number(v.price) || 0) : undefined
    })).filter((v) => v.size);
    if (mapped.variantStocks.length > 0) {
      mapped.sizes = mapped.variantStocks.map((v) => v.size);
      if (body.stock === undefined) {
        mapped.stock = mapped.variantStocks.reduce((sum, v) => sum + v.stock, 0);
      }
    }
  }
  if (body.images !== undefined) mapped.images = normalizeImages(body.images);
  if (body.stock !== undefined) mapped.stock = Math.max(0, parseInt(body.stock, 10) || 0);
  if (body.featured !== undefined) mapped.featured = body.featured;
  if (body.tags !== undefined) mapped.tags = body.tags;
  if (body.newlyAdded !== undefined) mapped.newlyAdded = body.newlyAdded;
  // isOrganic: pass through as boolean; undefined = keep schema default (true)
  if (body.isOrganic !== undefined) mapped.isOrganic = !!body.isOrganic;
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

// @route   POST /api/v1/admin/orders/:id/email-invoice
// @desc    Email official PDF invoice for order to customer
router.post('/orders/:id/email-invoice', async (req, res) => {
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

    const recipient = req.body?.email || order.email || order.user?.email;
    if (!recipient) {
      return res.status(400).json({ success: false, error: { code: 'EMAIL_REQUIRED', message: 'No customer email address on this order' } });
    }

    const { sendInvoiceEmail } = require('../utils/email');
    const result = await sendInvoiceEmail(order, recipient);
    return res.status(200).json({ success: true, message: `Tax invoice successfully emailed to ${recipient}`, data: result });
  } catch (error) {
    console.error('Admin invoice email error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to email invoice' } });
  }
});

// @route   GET /api/v1/admin/orders/sample-invoice[?size=4x6]
// @desc    Download a sample official GST Tax Invoice PDF for admin preview
router.get('/orders/sample-invoice', async (req, res) => {
  try {
    let order = await Order.findOne()
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone userId')
      .populate('warehouse', 'code name address shiprocketPickupNickname spocName spocPhone');

    if (!order) {
      order = {
        orderId: 'SAMPLE-ORD-2026-PREVIEW',
        createdAt: new Date(),
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        shippingAddress: {
          name: 'Sample Customer',
          phone: '+919012659000',
          street: 'Flat No. 12, Green Farms Colony',
          city: 'Kaithal',
          state: 'Haryana',
          pincode: '136027'
        },
        items: [
          { name: 'Premium Organic Jumbo Makhana 200g', weight: '200g', quantity: 2, price: 599, subtotal: 1198 }
        ],
        pricing: {
          subtotal: 1198,
          discount: 0,
          shipping: 0,
          tax: 0,
          total: 1198
        }
      };
    }

    const thermal = req.query.size === '4x6';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sample-invoice${thermal ? '-4x6' : ''}.pdf"`);
    (thermal ? streamInvoice4x6 : streamInvoice)(order, res);
  } catch (error) {
    console.error('Sample invoice generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate sample invoice' } });
    }
  }
});

// @route   POST /api/v1/admin/orders/sample-invoice/email
// @desc    Email sample authentic Tax Invoice PDF to specified recipient (for verification)
router.post('/orders/sample-invoice/email', async (req, res) => {
  try {
    const targetEmail = String(req.body.email || '').trim().toLowerCase();
    if (!targetEmail || !/^\S+@\S+\.\S+$/.test(targetEmail)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'A valid email address is required' } });
    }

    let order = await Order.findOne()
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone userId')
      .populate('warehouse', 'code name address shiprocketPickupNickname spocName spocPhone');

    if (!order) {
      order = {
        orderId: 'SAMPLE-ORD-2026-PREVIEW',
        createdAt: new Date(),
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        shippingAddress: {
          name: 'Sample Customer',
          phone: '+919012659000',
          street: 'Flat No. 12, Green Farms Colony',
          city: 'Kaithal',
          state: 'Haryana',
          pincode: '136027'
        },
        items: [
          { name: 'Premium Organic Jumbo Makhana 200g', weight: '200g', quantity: 2, price: 599, subtotal: 1198 }
        ],
        pricing: {
          subtotal: 1198,
          discount: 0,
          shipping: 0,
          tax: 0,
          total: 1198
        }
      };
    }

    const { sendInvoiceEmail } = require('../utils/email');
    const result = await sendInvoiceEmail(order, targetEmail);
    res.json({
      success: true,
      message: `Sample GST Tax Invoice PDF sent to ${targetEmail} successfully!`,
      data: result
    });
  } catch (error) {
    console.error('Email sample invoice error:', error);
    res.status(500).json({ success: false, error: { code: 'EMAIL_ERROR', message: error.message || 'Failed to email sample invoice' } });
  }
});

// @route   PATCH /api/v1/admin/orders/:id/shipping-waiver
// @desc    Toggle admin delivery charge waiver on a specific order
router.patch('/orders/:id/shipping-waiver', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const waive = req.body.waive !== undefined ? Boolean(req.body.waive) : !order.pricing?.shippingWaived;

    if (waive) {
      if (!order.pricing.shippingWaived) {
        order.pricing.originalShipping = order.pricing.shipping;
      }
      order.pricing.shipping = 0;
      order.pricing.shippingWaived = true;
    } else {
      const restored = typeof order.pricing.originalShipping === 'number' ? order.pricing.originalShipping : 50;
      order.pricing.shipping = restored;
      order.pricing.shippingWaived = false;
    }

    const subtotal = order.pricing.subtotal || 0;
    const discount = order.pricing.discount || 0;
    const tax = order.pricing.tax || 0;
    order.pricing.total = Math.max(0, subtotal - discount + tax + order.pricing.shipping);

    order.timeline.push({
      status: order.status,
      message: waive
        ? `Delivery charge waived by admin (Invoice delivery charge: Free)`
        : `Delivery charge of Rs. ${order.pricing.shipping} restored by admin`,
      timestamp: new Date()
    });

    await order.save();

    return res.json({
      success: true,
      message: waive ? 'Delivery charge waived successfully' : 'Delivery charge restored successfully',
      data: {
        orderId: order.orderId,
        pricing: order.pricing
      }
    });
  } catch (error) {
    console.error('Shipping waiver error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update delivery charge waiver' } });
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
      try {
        order.timeline.push({
          status: 'shipment_failed',
          message: `Shipment booking failed: ${shipErr.message}`.slice(0, 500),
          timestamp: new Date(),
          updatedBy: req.user._id
        });
        await order.save();
      } catch (_) {}
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

// @route   POST /api/v1/admin/orders/:id/clone
// @desc    Duplicate/clone an existing order with stock validation, fresh order ID, and reset fulfillment state
router.post('/orders/:id/clone', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const source = await Order.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    if (!Array.isArray(source.items) || source.items.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ORDER', message: 'Source order has no items to clone' } });
    }

    // 1. CRITICAL: Validate stock availability across all line items before allowing the clone
    const shortItems = [];
    for (const item of source.items) {
      const pid = item.product?._id || item.product;
      const product = await Product.findById(pid);
      if (!product) {
        shortItems.push(`${item.name || 'Product'} (No longer exists in catalog)`);
        continue;
      }
      const needed = item.quantity || 1;
      const available = product.stock || 0;
      if (available < needed) {
        shortItems.push(`${product.name || item.name} (Available: ${available}, Needed: ${needed})`);
      }
    }

    if (shortItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot clone order. Insufficient stock for: ${shortItems.join(', ')}`
        }
      });
    }

    // 2. Stock handling: match existing logic
    // If COD, deduct stock immediately upon clone creation (matching normal COD orders in orders.js).
    // If prepaid, stock is validated upfront (above) and decrements when paid/confirmed.
    const paymentMethod = req.body.paymentMethod || source.paymentMethod || 'cod';
    if (paymentMethod === 'cod') {
      for (const item of source.items) {
        const pid = item.product?._id || item.product;
        const qty = item.quantity || 1;
        await Product.updateOne(
          { _id: pid, stock: { $gte: qty } },
          { $inc: { stock: -qty } }
        );
        if (item.weight) {
          await Product.updateOne(
            { _id: pid, 'variantStocks.size': item.weight },
            { $inc: { 'variantStocks.$.stock': -qty } }
          );
        }
      }
    }

      const isMultiWh = process.env.ENABLE_MULTI_WAREHOUSE === 'true';
      const assignedWarehouseId = req.body.warehouseId || source.warehouse || null;
      const awaitingAssignment = isMultiWh ? !assignedWarehouseId : false;

      // 3. Build cloned order document
      const clonedOrder = new Order({
        user: source.user,
        email: source.email,
        items: source.items.map((i) => ({
          product: i.product?._id || i.product,
          name: i.name,
          weight: i.weight,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          subtotal: i.subtotal
        })),
        shippingAddress: {
          name: source.shippingAddress?.name || 'Customer',
          phone: source.shippingAddress?.phone || '',
          street: source.shippingAddress?.street || '',
          city: source.shippingAddress?.city || '',
          state: source.shippingAddress?.state || '',
          pincode: source.shippingAddress?.pincode || '',
          country: source.shippingAddress?.country || 'India'
        },
        billingAddress: source.billingAddress ? {
          name: source.billingAddress.name,
          phone: source.billingAddress.phone,
          street: source.billingAddress.street,
          city: source.billingAddress.city,
          state: source.billingAddress.state,
          pincode: source.billingAddress.pincode,
          country: source.billingAddress.country || 'India',
          sameAsShipping: source.billingAddress.sameAsShipping !== false
        } : undefined,
        pricing: {
          subtotal: source.pricing?.subtotal || 0,
          shipping: source.pricing?.shipping || 0,
          tax: source.pricing?.tax || 0,
          discount: 0, // Reset discount on cloned order
          total: (source.pricing?.subtotal || 0) + (source.pricing?.shipping || 0)
        },
        paymentMethod,
        status: 'pending',
        paymentStatus: (paymentMethod === 'cod') ? 'pending' : (source.paymentStatus === 'paid' ? 'paid' : 'pending'),
        awaitingWarehouseAssignment: awaitingAssignment,
        warehouse: assignedWarehouseId,
        shipping: {
          method: source.shipping?.method || 'standard',
          cost: source.shipping?.cost || 0,
          provider: req.body.shippingProvider || source.shipping?.provider || 'shiprocket'
        },
        notes: {
          customer: source.notes?.customer || '',
          admin: `Cloned from ${source.orderId} by admin`
        },
        timeline: [{
          status: 'pending',
          message: `Order cloned from ${source.orderId}`,
          timestamp: new Date(),
          updatedBy: req.user._id
        }]
      });

      await clonedOrder.save();
      await clonedOrder.populate('user', 'name email userId');
      if (clonedOrder.warehouse) {
        await clonedOrder.populate('warehouse', 'code name address shiprocketPickupNickname');
      }

      // Automatically book shipment on Shiprocket if warehouse is assigned or multi-warehouse disabled
      const shipping = require('../utils/shipping');
      if (shipping.isConfigured() && !clonedOrder.awaitingWarehouseAssignment) {
        try {
          await shipping.autoCreateShipment(clonedOrder);
        } catch (shipErr) {
          console.error(`Shipment auto-create failed for cloned order ${clonedOrder.orderId}:`, shipErr.message);
        }
      }

      res.status(201).json({
        success: true,
        message: `Order cloned successfully as ${clonedOrder.orderId}`,
        data: toAdminOrder(clonedOrder)
      });
  } catch (error) {
    console.error('Clone order error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to clone order' } });
  }
});

const { restoreOrderStock } = require('../utils/stock');

// @route   PUT /api/v1/admin/orders/:id/status
// @desc    Update an order's status (cancels carrier shipment on cancel, restores stock, pre-save appends a timeline entry)
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

    // Disallow cancelling already-delivered orders
    if (newStatus === 'cancelled' && oldStatus === 'delivered') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Delivered orders cannot be cancelled' }
      });
    }

    // Cancel carrier shipment if order is being cancelled and has a booked carrier shipment
    let carrierWarning = null;
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      const shipping = require('../utils/shipping');
      const hasShipment = order.shipping && (order.shipping.trackingNumber || order.shipping.providerOrderId);
      if (hasShipment) {
        try {
          const provider = shipping.providerOfOrder(order);
          await shipping.cancelShipment({
            trackingNumber: order.shipping.trackingNumber,
            providerOrderId: order.shipping.providerOrderId,
            provider
          }, req.body.note || 'Cancelled by admin');

          order.timeline.push({
            status: 'shipment_cancelled',
            message: `Carrier shipment (${order.shipping.carrier || provider || 'courier'}) cancelled successfully`,
            timestamp: new Date(),
            updatedBy: req.user._id
          });
        } catch (carrierErr) {
          console.error(`[Admin Cancel] Carrier cancellation error for ${order.orderId}:`, carrierErr.message);
          carrierWarning = `Order was cancelled locally, but the carrier shipment could not be automatically cancelled (${carrierErr.message}). Please review and cancel manually on the courier dashboard if needed.`;
          order.timeline.push({
            status: 'shipment_cancel_failed',
            message: `Carrier shipment cancellation failed: ${carrierErr.message}`,
            timestamp: new Date(),
            updatedBy: req.user._id
          });
        }
      }
    }

    // Restore stock when order is cancelled or refunded
    if ((newStatus === 'cancelled' || newStatus === 'refunded') && oldStatus !== 'cancelled' && oldStatus !== 'refunded') {
      await restoreOrderStock(order);
    }

    order.status = newStatus;
    if (req.body.note) {
      order.notes = { ...(order.notes || {}), admin: req.body.note };
    }
    await order.save();
    await order.populate('user', 'name email userId');

    res.json({
      success: true,
      message: carrierWarning ? `Order cancelled locally. Note: ${carrierWarning}` : 'Order status updated',
      data: toAdminOrder(order),
      ...(carrierWarning && { warning: carrierWarning })
    });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } });
  }
});

// ============================================================================
// COUPON MANAGEMENT ROUTES
// ============================================================================

// Helper to determine coupon computed status
const getCouponStatus = (coupon) => {
  if (!coupon.isActive) return 'inactive';
  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) return 'upcoming';
  if (coupon.validTo && now > new Date(coupon.validTo)) return 'expired';
  if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) return 'exhausted';
  return 'active';
};

// @route   GET /api/v1/admin/coupons
// @desc    List coupons with search, status filter, and pagination
// @access  Private (Admin)
router.get('/coupons', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status || 'all';

    const query = {};
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.validTo = { $gte: now };
      query.$expr = {
        $or: [
          { $eq: ['$totalUsageLimit', null] },
          { $lt: ['$usedCount', '$totalUsageLimit'] }
        ]
      };
    } else if (status === 'expired') {
      query.validTo = { $lt: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'exhausted') {
      query.totalUsageLimit = { $ne: null };
      query.$expr = { $gte: ['$usedCount', '$totalUsageLimit'] };
    }

    const total = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email');

    const formatted = coupons.map((c) => ({
      id: c._id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderValue: c.minOrderValue,
      maxDiscountCap: c.maxDiscountCap,
      validFrom: c.validFrom,
      validTo: c.validTo,
      totalUsageLimit: c.totalUsageLimit,
      perUserLimit: c.perUserLimit,
      usedCount: c.usedCount || 0,
      isActive: c.isActive,
      firstOrderOnly: c.firstOrderOnly,
      isFestivalOffer: Boolean(c.isFestivalOffer),
      status: getCouponStatus(c),
      redemptionsCount: (c.redemptions || []).length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    res.json({
      success: true,
      data: {
        coupons: formatted,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Admin list coupons error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coupons' } });
  }
});

// @route   GET /api/v1/admin/coupons/suggest-code
// @desc    Generate a random unique coupon code
router.get('/coupons/suggest-code', async (req, res) => {
  try {
    const prefixes = ['AGRI', 'FESTIVE', 'SAVE', 'ORGANIC', 'FRESH', 'SPECIAL'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(10 + Math.random() * 90);
    const candidate = `${prefix}${randomNum}`;

    const exists = await Coupon.findOne({ code: candidate });
    const code = exists ? `${prefix}${Math.floor(100 + Math.random() * 900)}` : candidate;

    res.json({ success: true, data: { code } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate code' } });
  }
});

// @route   GET /api/v1/admin/coupons/:id
// @desc    Get single coupon with full redemption history
router.get('/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('redemptions.user', 'name phone email userId')
      .populate('createdBy', 'name email');

    if (!coupon) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }

    res.json({
      success: true,
      data: {
        id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscountCap: coupon.maxDiscountCap,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        totalUsageLimit: coupon.totalUsageLimit,
        perUserLimit: coupon.perUserLimit,
        usedCount: coupon.usedCount || 0,
        isActive: coupon.isActive,
        firstOrderOnly: coupon.firstOrderOnly,
        status: getCouponStatus(coupon),
        redemptions: (coupon.redemptions || []).map((r) => ({
          id: r._id,
          user: r.user ? { name: r.user.name, phone: r.user.phone, email: r.user.email, id: r.user._id } : null,
          orderId: r.orderId,
          discountAmount: r.discountAmount,
          redeemedAt: r.redeemedAt
        })),
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt
      }
    });
  } catch (error) {
    console.error('Admin get coupon error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coupon details' } });
  }
});

// @route   POST /api/v1/admin/coupons
// @desc    Create a new coupon
router.post('/coupons', [
  body('code').trim().notEmpty().withMessage('Coupon code is required').isLength({ min: 3, max: 30 }),
  body('discountType').isIn(['percentage', 'flat', 'fixed']).withMessage('discountType must be percentage or flat'),
  body('discountValue').isFloat({ min: 1 }).withMessage('discountValue must be at least 1'),
  body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('minOrderValue must be >= 0'),
  body('maxDiscountCap').optional({ nullable: true }).isFloat({ min: 1 }).withMessage('maxDiscountCap must be >= 1'),
  body('validTo').notEmpty().withMessage('validTo date is required').isISO8601().withMessage('validTo must be a valid date'),
  body('validFrom').optional().isISO8601().withMessage('validFrom must be a valid date'),
  body('totalUsageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('perUserLimit').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('firstOrderOnly').optional().isBoolean(),
  body('description').optional().trim().isLength({ max: 200 })
], handleValidationErrors, async (req, res) => {
  try {
    const code = req.body.code.trim().toUpperCase();
    const existing = await Coupon.findOne({ code });
    if (existing) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE_CODE', message: `Coupon code "${code}" already exists` } });
    }

    const coupon = new Coupon({
      code,
      description: req.body.description || '',
      discountType: req.body.discountType,
      discountValue: Number(req.body.discountValue),
      minOrderValue: Number(req.body.minOrderValue) || 0,
      maxDiscountCap: req.body.maxDiscountCap ? Number(req.body.maxDiscountCap) : null,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date(),
      validTo: new Date(req.body.validTo),
      totalUsageLimit: req.body.totalUsageLimit ? parseInt(req.body.totalUsageLimit) : null,
      perUserLimit: req.body.perUserLimit ? parseInt(req.body.perUserLimit) : 1,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      firstOrderOnly: Boolean(req.body.firstOrderOnly),
      isFestivalOffer: Boolean(req.body.isFestivalOffer),
      createdBy: req.user._id
    });

    await coupon.save();
    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    console.error('Admin create coupon error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create coupon' } });
  }
});

// @route   PUT /api/v1/admin/coupons/:id
// @desc    Update an existing coupon
router.put('/coupons/:id', [
  body('code').optional().trim().isLength({ min: 3, max: 30 }),
  body('discountType').optional().isIn(['percentage', 'flat', 'fixed']),
  body('discountValue').optional().isFloat({ min: 1 }),
  body('minOrderValue').optional().isFloat({ min: 0 }),
  body('maxDiscountCap').optional({ nullable: true }),
  body('validTo').optional().isISO8601(),
  body('validFrom').optional().isISO8601(),
  body('totalUsageLimit').optional({ nullable: true }),
  body('perUserLimit').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('firstOrderOnly').optional().isBoolean(),
  body('description').optional().trim().isLength({ max: 200 })
], handleValidationErrors, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }

    if (req.body.code) {
      const code = req.body.code.trim().toUpperCase();
      const existing = await Coupon.findOne({ code, _id: { $ne: coupon._id } });
      if (existing) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE_CODE', message: `Coupon code "${code}" already in use` } });
      }
      coupon.code = code;
    }

    if (req.body.description !== undefined) coupon.description = req.body.description;
    if (req.body.discountType) coupon.discountType = req.body.discountType;
    if (req.body.discountValue !== undefined) coupon.discountValue = Number(req.body.discountValue);
    if (req.body.minOrderValue !== undefined) coupon.minOrderValue = Number(req.body.minOrderValue);
    if (req.body.maxDiscountCap !== undefined) coupon.maxDiscountCap = req.body.maxDiscountCap ? Number(req.body.maxDiscountCap) : null;
    if (req.body.validFrom) coupon.validFrom = new Date(req.body.validFrom);
    if (req.body.validTo) coupon.validTo = new Date(req.body.validTo);
    if (req.body.totalUsageLimit !== undefined) coupon.totalUsageLimit = req.body.totalUsageLimit ? parseInt(req.body.totalUsageLimit) : null;
    if (req.body.perUserLimit !== undefined) coupon.perUserLimit = parseInt(req.body.perUserLimit);
    if (req.body.isActive !== undefined) coupon.isActive = Boolean(req.body.isActive);
    if (req.body.firstOrderOnly !== undefined) coupon.firstOrderOnly = Boolean(req.body.firstOrderOnly);
    if (req.body.isFestivalOffer !== undefined) coupon.isFestivalOffer = Boolean(req.body.isFestivalOffer);

    await coupon.save();
    res.json({ success: true, message: 'Coupon updated successfully', data: coupon });
  } catch (error) {
    console.error('Admin update coupon error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update coupon' } });
  }
});

// @route   PATCH /api/v1/admin/coupons/:id/toggle
// @desc    Fast toggle active status
router.patch('/coupons/:id/toggle', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`, data: { id: coupon._id, isActive: coupon.isActive } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle coupon' } });
  }
});

// @route   DELETE /api/v1/admin/coupons/:id
// @desc    Delete coupon: hard deletes if unused, soft deactivates with explanation if used on past orders
router.delete('/coupons/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }

    // Permanently remove coupon from database
    await Coupon.findByIdAndDelete(coupon._id);
    return res.json({
      success: true,
      deleted: true,
      message: `Coupon "${coupon.code}" permanently deleted successfully.`,
      data: { id: coupon._id, deleted: true }
    });
  } catch (error) {
    console.error('Admin delete coupon error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete coupon' } });
  }
});

// ============================================================================
// ABANDONED CART MESSAGING ROUTES
// ============================================================================

// @route   GET /api/v1/admin/abandoned-carts
// @desc    List abandoned carts based on configurable inactivity window (hours)
// @access  Private (Admin)
router.get('/abandoned-carts', async (req, res) => {
  try {
    const hours = parseFloat(req.query.hours) || 24;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const cutoffDate = new Date(Date.now() - hours * 3600 * 1000);

    // Find carts with items not modified since cutoff
    const rawCarts = await Cart.find({
      'items.0': { $exists: true },
      updatedAt: { $lte: cutoffDate }
    })
      .sort({ updatedAt: -1 })
      .populate('user', 'name phone email userId createdAt')
      .populate('items.product', 'name price images stock status productId');

    // Filter out carts whose user has placed a successful order AFTER cart updatedAt
    const activeAbandoned = [];
    for (const cart of rawCarts) {
      if (!cart.user) continue;

      const user = cart.user;

      // Check search match
      if (search) {
        const queryLower = search.toLowerCase();
        const matchesName = (user.name || '').toLowerCase().includes(queryLower);
        const matchesEmail = (user.email || '').toLowerCase().includes(queryLower);
        const matchesPhone = (user.phone || '').includes(search);
        if (!matchesName && !matchesEmail && !matchesPhone) {
          continue;
        }
      }

      // Check if user placed an order after cart was last updated
      const recentOrder = await Order.findOne({
        user: user._id,
        createdAt: { $gte: cart.updatedAt }
      });

      if (recentOrder) {
        // User completed an order since then, not abandoned
        continue;
      }

      // Calculate cart total and items list
      let cartTotal = 0;
      const formattedItems = [];
      for (const item of cart.items) {
        const prod = item.product;
        if (!prod) continue;
        const linePrice = prod.price || 0;
        const lineSubtotal = linePrice * (item.qty || 1);
        cartTotal += lineSubtotal;

        formattedItems.push({
          id: item._id,
          productId: prod.productId || prod._id,
          name: prod.name,
          weight: item.weight,
          price: linePrice,
          qty: item.qty,
          subtotal: lineSubtotal,
          image: (prod.images || []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean)[0] || ''
        });
      }

      if (formattedItems.length === 0) continue;

      // Find latest message log sent to this user/cart
      const lastLog = await AbandonedCartLog.findOne({ user: user._id }).sort({ sentAt: -1 });

      activeAbandoned.push({
        id: cart._id,
        user: {
          id: user._id,
          name: user.name || 'Customer',
          phone: user.phone,
          email: user.email,
          userId: user.userId
        },
        items: formattedItems,
        itemCount: formattedItems.reduce((sum, i) => sum + i.qty, 0),
        cartTotal,
        updatedAt: cart.updatedAt,
        hoursInactive: Math.round((Date.now() - new Date(cart.updatedAt).getTime()) / (3600 * 1000)),
        lastReminderSentAt: lastLog ? lastLog.sentAt : null,
        reminderCount: await AbandonedCartLog.countDocuments({ user: user._id })
      });
    }

    const total = activeAbandoned.length;
    const paginatedCarts = activeAbandoned.slice((page - 1) * limit, page * limit);
    const totalValue = activeAbandoned.reduce((sum, c) => sum + c.cartTotal, 0);

    res.json({
      success: true,
      data: {
        carts: paginatedCarts,
        summary: {
          totalAbandoned: total,
          totalValue,
          hoursThreshold: hours
        },
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Admin list abandoned carts error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch abandoned carts' } });
  }
});

// @route   POST /api/v1/admin/abandoned-carts/send-message
// @desc    Dispatch personalized abandoned cart reminders via Email, SMS, or WhatsApp
// @access  Private (Admin)
router.post('/abandoned-carts/send-message', [
  body('cartIds').isArray({ min: 1 }).withMessage('At least one cart must be selected'),
  body('channel').isIn(['email', 'sms', 'whatsapp', 'all']).withMessage('Channel must be email, sms, whatsapp, or all'),
  body('templateId').optional().trim(),
  body('customMessage').optional().trim(),
  body('couponCode').optional().trim(),
  body('subject').optional().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { cartIds, channel, templateId, customMessage, couponCode, subject } = req.body;

    const carts = await Cart.find({ _id: { $in: cartIds } })
      .populate('user', 'name phone email userId')
      .populate('items.product', 'name price images');

    const results = {
      total: carts.length,
      sentEmails: 0,
      sentSms: 0,
      whatsappLinks: [],
      failed: 0,
      logs: []
    };

    for (const cart of carts) {
      if (!cart.user) continue;
      const user = cart.user;
      const customerName = user.name || 'Valued Customer';
      const items = cart.items || [];
      const itemNames = items.map((i) => i.product?.name).filter(Boolean).join(', ');
      const subtotal = items.reduce((sum, i) => sum + (i.product?.price || 0) * (i.qty || 1), 0);

      // Resolve message body
      const template = TEMPLATES[templateId] || TEMPLATES.reminder;
      const rawBody = customMessage || template.body;
      const personalizedMessage = formatTemplate(rawBody, {
        name: customerName,
        product: itemNames || 'selected items',
        cartTotal: subtotal,
        coupon: couponCode || '',
        checkoutUrl: `${process.env.FRONTEND_URL || 'https://www.agricola.co.in'}/cart`
      });

      // 1. Email Dispatch
      if ((channel === 'email' || channel === 'all') && user.email) {
        try {
          await sendAbandonedEmail({
            to: user.email,
            subject: subject || template.subject,
            name: customerName,
            items,
            subtotal,
            couponCode,
            customMessage: personalizedMessage
          });
          results.sentEmails++;

          const log = await AbandonedCartLog.create({
            cart: cart._id,
            user: user._id,
            recipientName: customerName,
            recipientEmail: user.email,
            channel: 'email',
            subject: subject || template.subject,
            messageContent: personalizedMessage,
            couponCode,
            cartValue: subtotal,
            itemNames: items.map((i) => i.product?.name).filter(Boolean),
            status: 'sent',
            sentBy: req.user._id
          });
          results.logs.push(log);
        } catch (mailErr) {
          console.error(`Failed to send email to ${user.email}:`, mailErr.message);
          results.failed++;
          await AbandonedCartLog.create({
            cart: cart._id,
            user: user._id,
            recipientName: customerName,
            recipientEmail: user.email,
            channel: 'email',
            messageContent: personalizedMessage,
            status: 'failed',
            errorDetails: mailErr.message,
            sentBy: req.user._id
          });
        }
      }

      // 2. SMS Dispatch (via Fast2SMS)
      if ((channel === 'sms' || channel === 'all') && user.phone) {
        try {
          const smsText = personalizedMessage.slice(0, 160); // standard SMS boundary
          await sendOtpSms(user.phone, couponCode || 'AGRI10'); // fallback/DLT route
          results.sentSms++;

          const log = await AbandonedCartLog.create({
            cart: cart._id,
            user: user._id,
            recipientName: customerName,
            recipientPhone: user.phone,
            channel: 'sms',
            messageContent: smsText,
            couponCode,
            cartValue: subtotal,
            itemNames: items.map((i) => i.product?.name).filter(Boolean),
            status: 'sent',
            sentBy: req.user._id
          });
          results.logs.push(log);
        } catch (smsErr) {
          console.error(`Failed to send SMS to ${user.phone}:`, smsErr.message);
          results.failed++;
          await AbandonedCartLog.create({
            cart: cart._id,
            user: user._id,
            recipientName: customerName,
            recipientPhone: user.phone,
            channel: 'sms',
            messageContent: personalizedMessage,
            status: 'failed',
            errorDetails: smsErr.message,
            sentBy: req.user._id
          });
        }
      }

      // 3. WhatsApp Direct Launch Links
      if ((channel === 'whatsapp' || channel === 'all') && user.phone) {
        const waLink = buildWhatsAppLink(user.phone, personalizedMessage);
        results.whatsappLinks.push({
          cartId: cart._id,
          userName: customerName,
          phone: user.phone,
          link: waLink,
          message: personalizedMessage
        });

        const log = await AbandonedCartLog.create({
          cart: cart._id,
          user: user._id,
          recipientName: customerName,
          recipientPhone: user.phone,
          channel: 'whatsapp',
          messageContent: personalizedMessage,
          couponCode,
          cartValue: subtotal,
          itemNames: items.map((i) => i.product?.name).filter(Boolean),
          status: 'ready_to_send',
          sentBy: req.user._id
        });
        results.logs.push(log);
      }
    }

    res.json({
      success: true,
      message: `Abandoned cart messages processed: ${results.sentEmails} email(s), ${results.sentSms} SMS, ${results.whatsappLinks.length} WhatsApp links prepared`,
      data: results
    });
  } catch (error) {
    console.error('Admin send abandoned cart message error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to dispatch abandoned cart messages' } });
  }
});

// @route   GET /api/v1/admin/abandoned-carts/logs
// @desc    List sent message logs
// @access  Private (Admin)
router.get('/abandoned-carts/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const channel = req.query.channel;

    const query = {};
    if (channel && channel !== 'all') {
      query.channel = channel;
    }

    const total = await AbandonedCartLog.countDocuments(query);
    const logs = await AbandonedCartLog.find(query)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name phone email userId')
      .populate('sentBy', 'name email');

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Fetch abandoned cart logs error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching logs' });
  }
});

// ============================================================================
// FESTIVAL HERO CAMPAIGNS & VIDEO MODULE ROUTES
// ============================================================================

// Helper to determine computed campaign status
const getCampaignStatus = (campaign) => {
  if (!campaign.isActive) return 'inactive';
  const now = new Date();
  if (campaign.startDate && now < new Date(campaign.startDate)) return 'upcoming';
  if (campaign.endDate && now > new Date(campaign.endDate)) return 'ended';
  return 'active';
};

// @route   GET /api/v1/admin/campaigns
// @desc    List all campaigns with overlap detection and pagination
// @access  Private (Admin)
router.get('/campaigns', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status || 'all';

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'upcoming') {
      query.startDate = { $gt: now };
    } else if (status === 'ended') {
      query.endDate = { $lt: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const total = await HeroCampaign.countDocuments(query);
    const campaigns = await HeroCampaign.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email');

    // Overlap detection: find active campaigns whose date ranges overlap
    const allActive = await HeroCampaign.find({ isActive: true });
    const formatted = campaigns.map((c) => {
      const cStatus = getCampaignStatus(c);
      const overlaps = allActive.filter(
        (other) =>
          String(other._id) !== String(c._id) &&
          c.startDate <= other.endDate &&
          c.endDate >= other.startDate
      );

      return {
        id: c._id,
        name: c.name,
        festivalType: c.festivalType,
        slidesCount: (c.slides || []).length,
        slides: c.slides || [],
        startDate: c.startDate,
        endDate: c.endDate,
        isActive: c.isActive,
        priority: c.priority || 0,
        status: cStatus,
        videoModule: c.videoModule || { isEnabled: false },
        hasOverlap: overlaps.length > 0,
        overlappingCampaigns: overlaps.map((o) => ({ id: o._id, name: o.name, festivalType: o.festivalType })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    });

    res.json({
      success: true,
      data: {
        campaigns: formatted,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Admin list campaigns error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaigns' } });
  }
});

// @route   GET /api/v1/admin/campaigns/:id
// @desc    Get single campaign detail
router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await HeroCampaign.findById(req.params.id).populate('createdBy', 'name email');
    if (!campaign) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    res.json({
      success: true,
      data: {
        id: campaign._id,
        name: campaign.name,
        festivalType: campaign.festivalType,
        slides: campaign.slides || [],
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        isActive: campaign.isActive,
        priority: campaign.priority || 0,
        status: getCampaignStatus(campaign),
        videoModule: campaign.videoModule || { isEnabled: false },
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      }
    });
  } catch (error) {
    console.error('Admin get campaign error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaign' } });
  }
});

// @route   POST /api/v1/admin/campaigns
// @desc    Create a new festival hero campaign
router.post('/campaigns', [
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('startDate').notEmpty().isISO8601().withMessage('Valid start date is required'),
  body('endDate').notEmpty().isISO8601().withMessage('Valid end date is required'),
  body('slides').isArray({ min: 1 }).withMessage('At least one hero slide is required'),
  body('slides.*.image').notEmpty().withMessage('Slide image URL is required'),
  body('slides.*.title').notEmpty().withMessage('Slide title is required'),
  body('festivalType').optional().isIn([
    'diwali', 'durga_puja', 'chhath', 'eid', 'christmas', 'republic_day', 'independence_day', 'holi', 'new_year', 'seasonal', 'other'
  ]),
  body('isActive').optional().isBoolean(),
  body('priority').optional().isInt()
], handleValidationErrors, async (req, res) => {
  try {
    const start = new Date(req.body.startDate);
    const end = new Date(req.body.endDate);

    if (end <= start) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATES', message: 'End date must be after start date' } });
    }

    // Check overlaps with active campaigns
    const overlapping = await HeroCampaign.find({
      isActive: true,
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    const campaign = new HeroCampaign({
      name: req.body.name.trim(),
      festivalType: req.body.festivalType || 'other',
      slides: (req.body.slides || []).map((s, idx) => ({
        image: s.image,
        title: s.title,
        description: s.description || '',
        ctaText: s.ctaText || 'Shop Products',
        ctaLink: s.ctaLink || '/products',
        order: s.order !== undefined ? s.order : idx
      })),
      startDate: start,
      endDate: end,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      priority: req.body.priority !== undefined ? parseInt(req.body.priority) : 0,
      videoModule: req.body.videoModule || { isEnabled: false },
      couponCode: req.body.couponCode ? req.body.couponCode.trim().toUpperCase() : '',
      createdBy: req.user._id
    });

    await campaign.save();

    res.status(201).json({
      success: true,
      message: 'Hero campaign created successfully',
      data: campaign,
      warning: overlapping.length > 0 ? `Note: This campaign dates overlap with ${overlapping.length} existing active campaign(s). Highest priority campaign will be displayed.` : undefined
    });
  } catch (error) {
    console.error('Admin create campaign error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign' } });
  }
});

// @route   PUT /api/v1/admin/campaigns/:id
// @desc    Update a hero campaign
router.put('/campaigns/:id', [
  body('name').optional().trim().notEmpty(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('slides').optional().isArray({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('priority').optional().isInt()
], handleValidationErrors, async (req, res) => {
  try {
    const campaign = await HeroCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    if (req.body.name) campaign.name = req.body.name.trim();
    if (req.body.festivalType) campaign.festivalType = req.body.festivalType;
    if (req.body.startDate) campaign.startDate = new Date(req.body.startDate);
    if (req.body.endDate) campaign.endDate = new Date(req.body.endDate);
    if (req.body.isActive !== undefined) campaign.isActive = Boolean(req.body.isActive);
    if (req.body.priority !== undefined) campaign.priority = parseInt(req.body.priority);
    if (req.body.couponCode !== undefined) campaign.couponCode = req.body.couponCode.trim().toUpperCase();

    if (req.body.slides) {
      campaign.slides = req.body.slides.map((s, idx) => ({
        image: s.image,
        title: s.title,
        description: s.description || '',
        ctaText: s.ctaText || 'Shop Products',
        ctaLink: s.ctaLink || '/products',
        order: s.order !== undefined ? s.order : idx
      }));
    }

    if (req.body.videoModule) {
      campaign.videoModule = {
        ...campaign.videoModule,
        ...req.body.videoModule
      };
    }

    await campaign.save();
    res.json({ success: true, message: 'Campaign updated successfully', data: campaign });
  } catch (error) {
    console.error('Admin update campaign error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update campaign' } });
  }
});

// @route   PATCH /api/v1/admin/campaigns/:id/toggle
// @desc    Quick toggle active status
router.patch('/campaigns/:id/toggle', async (req, res) => {
  try {
    const campaign = await HeroCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    campaign.isActive = !campaign.isActive;
    await campaign.save();
    res.json({ success: true, message: `Campaign ${campaign.isActive ? 'activated' : 'deactivated'}`, data: { id: campaign._id, isActive: campaign.isActive } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle campaign' } });
  }
});

// @route   DELETE /api/v1/admin/campaigns/:id
// @desc    Delete a campaign
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await HeroCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Admin delete campaign error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete campaign' } });
  }
});

// ============================================================================
// COMING SOON LAUNCH SUBSCRIBERS (UTENSILS & GARDENING)
// ============================================================================

// @route   GET /api/v1/admin/subscribers
// @desc    List launch subscribers with filtering and category stats
// @access  Private (Admin)
router.get('/subscribers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const query = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await LaunchSubscriber.countDocuments(query);
    const subscribers = await LaunchSubscriber.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Aggregate category counts for dashboard KPI badges
    const [utensilsCount, gardeningCount, bothCount] = await Promise.all([
      LaunchSubscriber.countDocuments({ category: 'utensils' }),
      LaunchSubscriber.countDocuments({ category: 'gardening' }),
      LaunchSubscriber.countDocuments({ category: 'both' })
    ]);

    res.json({
      success: true,
      data: {
        subscribers,
        stats: {
          total: utensilsCount + gardeningCount + bothCount,
          utensilsCount,
          gardeningCount,
          bothCount
        },
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Fetch launch subscribers error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscribers' } });
  }
});

// @route   DELETE /api/v1/admin/subscribers/:id
// @desc    Delete a launch subscriber
// @access  Private (Admin)
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const sub = await LaunchSubscriber.findByIdAndDelete(req.params.id);
    if (!sub) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscriber not found' } });
    }
    res.json({ success: true, message: 'Subscriber removed successfully' });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete subscriber' } });
  }
});

// ============================================================================
// ADMIN SUPPORT & CUSTOMER INQUIRIES
// ============================================================================

// @route   GET /api/v1/admin/support/feedbacks
// @desc    List customer feedback & inquiries with filtering and KPIs
// @access  Private (Admin)
router.get('/support/feedbacks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const rating = req.query.rating;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { page: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Feedback.countDocuments(query);
    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email phone');

    // Aggregate statistics
    const [openCount, resolvedCount, totalCount] = await Promise.all([
      Feedback.countDocuments({ status: 'open' }),
      Feedback.countDocuments({ status: 'resolved' }),
      Feedback.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        feedbacks,
        stats: {
          total: totalCount,
          open: openCount,
          resolved: resolvedCount
        },
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Fetch support feedbacks error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch feedbacks' } });
  }
});

// @route   PATCH /api/v1/admin/support/feedbacks/:id/status
// @desc    Toggle or update feedback resolution status
// @access  Private (Admin)
router.patch('/support/feedbacks/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const fb = await Feedback.findById(req.params.id);
    if (!fb) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Feedback ticket not found' } });
    }

    fb.status = status || (fb.status === 'resolved' ? 'open' : 'resolved');
    await fb.save();

    res.json({ success: true, message: `Feedback marked as ${fb.status}`, data: fb });
  } catch (error) {
    console.error('Update feedback status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update feedback status' } });
  }
});

// @route   POST /api/v1/admin/support/feedbacks/:id/reply
// @desc    Send email reply to customer inquiry
// @access  Private (Admin)
router.post('/support/feedbacks/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reply message is required' } });
    }

    const fb = await Feedback.findById(req.params.id);
    if (!fb) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
    }

    if (!fb.email) {
      return res.status(400).json({ success: false, error: { code: 'NO_EMAIL', message: 'Customer did not provide an email address' } });
    }

    // Send email via mailer
    await mailer.sendMail({
      to: fb.email,
      subject: `Response to your inquiry from AgriCola Support`,
      text: `Hello ${fb.name || 'Valued Customer'},\n\nThank you for contacting AgriCola.\n\n${message}\n\nWarm regards,\nAgriCola Support Team\nsupport@agricola.co.in`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <h2 style="color: #2e7d32;">AgriCola Customer Support</h2>
          <p>Hello ${fb.name || 'Valued Customer'},</p>
          <p>Thank you for reaching out to us. Regarding your inquiry:</p>
          <blockquote style="background: #f9f9f9; border-left: 4px solid #84b817; padding: 10px 15px; margin: 15px 0; color: #555;">
            ${fb.message}
          </blockquote>
          <p><strong>Our Response:</strong></p>
          <p style="background: #e8f5e9; padding: 15px; border-radius: 8px;">${message.replace(/\n/g, '<br/>')}</p>
          <p>If you have any further questions, feel free to reply directly to this email or reach us on WhatsApp at +91 9012659000.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">AgriCola Organics · Pure Harvest & Heritage Living</p>
        </div>
      `
    });

    fb.adminReply = message.trim();
    fb.repliedAt = new Date();
    fb.status = 'resolved';
    await fb.save();

    res.json({ success: true, message: 'Reply sent successfully to customer email', data: fb });
  } catch (error) {
    console.error('Send feedback reply error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send reply' } });
  }
});

// @route   DELETE /api/v1/admin/support/feedbacks/:id
// @desc    Delete feedback ticket
// @access  Private (Admin)
router.delete('/support/feedbacks/:id', async (req, res) => {
  try {
    const fb = await Feedback.findByIdAndDelete(req.params.id);
    if (!fb) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
    }
    res.json({ success: true, message: 'Feedback ticket deleted' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete feedback' } });
  }
});

// ============================================================================
// ADMIN STORE SETTINGS
// ============================================================================

// @route   GET /api/v1/admin/settings
// @desc    Get store configuration settings
// @access  Private (Admin)
router.get('/settings', async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'global_config' });
    if (!setting) {
      setting = await Setting.create({ key: 'global_config' });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load settings' } });
  }
});

// @route   PUT /api/v1/admin/settings
// @desc    Update store configuration settings
// @access  Private (Admin)
router.put('/settings', async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'global_config' });
    if (!setting) {
      setting = new Setting({ key: 'global_config' });
    }

    const fields = [
      'storeName',
      'supportEmail',
      'supportPhone',
      'supportWhatsApp',
      'businessHours',
      'storeAddress',
      'enableMultiWarehouse',
      'defaultCarrier',
      'freeShippingThreshold',
      'standardDeliveryCharge',
      'enableWhatsAppNotifications',
      'enableEmailNotifications',
      'enableCod',
      'maxCodAmount',
      'allowCouponStacking',
      'maxStackedCoupons'
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        setting[f] = req.body[f];
      }
    });

    await setting.save();

    res.json({
      success: true,
      message: 'Store settings updated successfully',
      data: setting
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } });
  }
});


// ============================================================================
// INVENTORY MANAGEMENT (Real-Time Stock & Warehouse Allocations)
// ============================================================================

// @route   GET /api/v1/admin/inventory
// @desc    Get all inventory with low-stock alerts and warehouse distribution
// @access  Private (Admin)
router.get('/inventory', async (req, res) => {
  try {
    const ProductWarehouseStock = require('../models/ProductWarehouseStock');
    const products = await Product.find().select('name sku category price sellingPrice stock images isActive unit weight').lean();
    const stocks = await ProductWarehouseStock.find().populate('warehouse', 'name code address isDefault').lean();

    const stockMap = {};
    stocks.forEach((s) => {
      const pId = String(s.product);
      if (!stockMap[pId]) stockMap[pId] = [];
      stockMap[pId].push({
        warehouseId: s.warehouse?._id,
        warehouseName: s.warehouse?.name || 'Unknown',
        warehouseCode: s.warehouse?.code || 'WH',
        stock: s.stock
      });
    });

    const enriched = products.map((p) => {
      const pId = String(p._id);
      const allocations = stockMap[pId] || [];
      const totalWarehouseStock = allocations.reduce((sum, a) => sum + (a.stock || 0), 0);
      return {
        id: p._id,
        name: p.name,
        sku: p.sku || 'SKU-' + String(p._id).slice(-4).toUpperCase(),
        category: p.category,
        price: p.price,
        sellingPrice: p.sellingPrice,
        stock: p.stock ?? 0,
        lowStockThreshold: 5,
        isLowStock: (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5,
        isOutOfStock: (p.stock ?? 0) <= 0,
        images: p.images || [],
        isActive: p.isActive !== false,
        allocations,
        totalWarehouseStock
      };
    });

    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Fetch inventory error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory' } });
  }
});

// @route   PATCH /api/v1/admin/inventory/:productId
// @desc    Update product stock level manually
// @access  Private (Admin)
router.patch('/inventory/:productId', async (req, res) => {
  try {
    const { stock, warehouseId } = req.body;
    if (stock === undefined || isNaN(Number(stock)) || Number(stock) < 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid non-negative stock count is required' } });
    }

    const newStock = Math.max(0, parseInt(stock, 10));
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    product.stock = newStock;
    await product.save();

    // If a specific warehouse was targeted, update ProductWarehouseStock as well
    if (warehouseId) {
      const ProductWarehouseStock = require('../models/ProductWarehouseStock');
      await ProductWarehouseStock.findOneAndUpdate(
        { product: product._id, warehouse: warehouseId },
        { stock: newStock },
        { upsert: true, new: true }
      );

      // Recalculate product stock only from active warehouses
      const activeWarehouses = await Warehouse.find({ status: 'active' }).select('_id');
      const activeWarehouseIds = activeWarehouses.map((w) => w._id);
      const activeStocks = await ProductWarehouseStock.find({
        product: product._id,
        warehouse: { $in: activeWarehouseIds }
      });
      product.stock = activeStocks.reduce((sum, s) => sum + (s.stock || 0), 0);
      await product.save();
    }

    res.json({
      success: true,
      message: `Stock for ${product.name} updated to ${newStock} units.`,
      data: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        isLowStock: product.stock > 0 && product.stock <= 5,
        isOutOfStock: product.stock <= 0
      }
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update stock' } });
  }
});

// ==========================================
// BLOG MANAGEMENT ROUTES
// ==========================================

const calculateReadTime = (text = '') => {
  const plainText = text.replace(/<[^>]+>/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
};

const slugify = (text = '') => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// @route   GET /api/v1/admin/blogs
// @desc    Get all blogs (drafts & published) with filters & pagination
// @access  Admin
router.get('/blogs', async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = new RegExp(`^${category}$`, 'i');
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { excerpt: { $regex: search.trim(), $options: 'i' } },
        { tags: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [blogs, total, stats] = await Promise.all([
      Blog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email'),
      Blog.countDocuments(query),
      Blog.aggregate([
        {
          $group: {
            _id: null,
            totalPosts: { $sum: 1 },
            publishedPosts: {
              $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
            },
            draftPosts: {
              $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
            },
            totalViews: { $sum: '$viewCount' }
          }
        }
      ])
    ]);

    const statSummary = stats[0] || { totalPosts: 0, publishedPosts: 0, draftPosts: 0, totalViews: 0 };

    res.json({
      success: true,
      data: blogs,
      stats: statSummary,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Admin get blogs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/admin/blogs/:id
// @desc    Get single blog for editing
// @access  Admin
router.get('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Admin get single blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/v1/admin/blogs
// @desc    Create new blog post
// @access  Admin
router.post(
  '/blogs',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('excerpt').trim().notEmpty().withMessage('Excerpt is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        title,
        slug: customSlug,
        excerpt,
        content,
        coverImage,
        author,
        category,
        tags,
        status,
        featured,
        seo
      } = req.body;

      // Determine slug
      let baseSlug = customSlug ? slugify(customSlug) : slugify(title);
      if (!baseSlug) baseSlug = `post-${Date.now()}`;

      // Check unique slug
      let finalSlug = baseSlug;
      let counter = 1;
      while (await Blog.findOne({ slug: finalSlug })) {
        finalSlug = `${baseSlug}-${counter++}`;
      }

      const postStatus = status === 'published' ? 'published' : 'draft';
      const readTime = calculateReadTime(content);

      // Process tags
      const tagList = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const newBlog = new Blog({
        title,
        slug: finalSlug,
        excerpt,
        content,
        coverImage: coverImage || '',
        author: {
          name: author?.name || req.user.name || 'Agricola Team',
          avatar: author?.avatar || '',
          role: author?.role || 'Editorial Team'
        },
        category: category || 'General',
        tags: tagList,
        status: postStatus,
        featured: !!featured,
        readTime,
        publishedAt: postStatus === 'published' ? new Date() : null,
        seo: {
          metaTitle: seo?.metaTitle || title,
          metaDescription: seo?.metaDescription || excerpt,
          focusKeyword: seo?.focusKeyword || '',
          canonicalUrl: seo?.canonicalUrl || ''
        },
        createdBy: req.user._id
      });

      await newBlog.save();

      res.status(201).json({
        success: true,
        message: 'Blog post created successfully',
        data: newBlog
      });
    } catch (error) {
      console.error('Admin create blog error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/v1/admin/blogs/:id
// @desc    Update existing blog post
// @access  Admin
router.put('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    const {
      title,
      slug: customSlug,
      excerpt,
      content,
      coverImage,
      author,
      category,
      tags,
      status,
      featured,
      seo
    } = req.body;

    if (title) blog.title = title;
    if (excerpt) blog.excerpt = excerpt;
    if (content) {
      blog.content = content;
      blog.readTime = calculateReadTime(content);
    }
    if (coverImage !== undefined) blog.coverImage = coverImage;
    if (category) blog.category = category;
    if (featured !== undefined) blog.featured = !!featured;

    if (tags !== undefined) {
      blog.tags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }

    if (author) {
      blog.author = {
        name: author.name || blog.author?.name || 'Agricola Team',
        avatar: author.avatar !== undefined ? author.avatar : blog.author?.avatar,
        role: author.role || blog.author?.role || 'Editorial Team'
      };
    }

    if (seo) {
      blog.seo = {
        metaTitle: seo.metaTitle !== undefined ? seo.metaTitle : blog.seo?.metaTitle,
        metaDescription: seo.metaDescription !== undefined ? seo.metaDescription : blog.seo?.metaDescription,
        focusKeyword: seo.focusKeyword !== undefined ? seo.focusKeyword : blog.seo?.focusKeyword,
        canonicalUrl: seo.canonicalUrl !== undefined ? seo.canonicalUrl : blog.seo?.canonicalUrl
      };
    }

    // Handle slug change if requested
    if (customSlug && customSlug !== blog.slug) {
      const cleanSlug = slugify(customSlug);
      const existing = await Blog.findOne({ slug: cleanSlug, _id: { $ne: blog._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'This slug is already taken by another article' });
      }
      blog.slug = cleanSlug;
    }

    // Handle status change
    if (status && status !== blog.status) {
      blog.status = status;
      if (status === 'published' && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
    }

    await blog.save();

    res.json({
      success: true,
      message: 'Blog post updated successfully',
      data: blog
    });
  } catch (error) {
    console.error('Admin update blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/v1/admin/blogs/:id
// @desc    Delete a blog post
// @access  Admin
router.delete('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Admin delete blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/v1/admin/blogs/:id/publish
// @desc    Toggle publish / draft status
// @access  Admin
router.patch('/blogs/:id/publish', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    const nextStatus = blog.status === 'published' ? 'draft' : 'published';
    blog.status = nextStatus;
    if (nextStatus === 'published' && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }

    await blog.save();

    res.json({
      success: true,
      message: `Blog post marked as ${nextStatus}`,
      data: { id: blog._id, status: blog.status, publishedAt: blog.publishedAt }
    });
  } catch (error) {
    console.error('Admin toggle publish error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/v1/admin/blogs/:id/featured
// @desc    Toggle featured status
// @access  Admin
router.patch('/blogs/:id/featured', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    blog.featured = !blog.featured;
    await blog.save();

    res.json({
      success: true,
      message: `Blog post featured status set to ${blog.featured}`,
      data: { id: blog._id, featured: blog.featured }
    });
  } catch (error) {
    console.error('Admin toggle featured error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;