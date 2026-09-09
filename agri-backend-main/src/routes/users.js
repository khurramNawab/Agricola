const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const { authenticate, requireAdmin } = require('../middleware/auth');

// @desc    Get current user profile
// @route   GET /api/v1/users/profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile'
      }
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Update fields
    if (typeof name === 'string') user.name = name.trim();
    if (phone) user.phone = phone;
    if (typeof email === 'string') user.email = email.trim().toLowerCase() || undefined;

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(userId).select('-password');

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'That email is already in use by another account.' }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile'
      }
    });
  }
});

// @desc    Get user addresses
// @route   GET /api/v1/users/addresses
// @access  Private
router.get('/addresses', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    
    res.status(200).json({
      success: true,
      data: user.addresses || []
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch addresses'
      }
    });
  }
});

// @desc    Add new address
// @route   POST /api/v1/users/addresses
// @access  Private
router.post('/addresses', authenticate, async (req, res) => {
  try {
    const { type, street, city, state, pincode, country, isDefault } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!street || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Street, city, state, and pincode are required'
        }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // If this is set as default, unset other default addresses
    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Add new address
    const newAddress = {
      type: type || 'home',
      street,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || user.addresses.length === 0 // First address is default
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      data: newAddress,
      message: 'Address added successfully'
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add address'
      }
    });
  }
});

// @desc    Update address
// @route   PUT /api/v1/users/addresses/:addressId
// @access  Private
router.put('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const { addressId } = req.params;
    const { type, street, city, state, pincode, country, isDefault } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Address not found'
        }
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Update address fields
    if (type) address.type = type;
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (country) address.country = country;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.status(200).json({
      success: true,
      data: address,
      message: 'Address updated successfully'
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update address'
      }
    });
  }
});

// @desc    Delete address
// @route   DELETE /api/v1/users/addresses/:addressId
// @access  Private
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Address not found'
        }
      });
    }

    const wasDefault = address.isDefault;
    user.addresses.pull(addressId);

    // If deleted address was default, set first remaining address as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete address'
      }
    });
  }
});

// @desc    Get user orders history
// @route   GET /api/v1/users/orders
// @access  Private
router.get('/orders', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sort = '-createdAt'
    } = req.query;

    const userId = req.user._id;

    // Build query
    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    // Execute query with pagination
    const orders = await Order.find(query)
      .populate('items.product', 'name images')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch orders'
      }
    });
  }
});

// @desc    Get user dashboard stats
// @route   GET /api/v1/users/dashboard
// @access  Private
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('orders totalSpent');
    
    const orderStats = await Order.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$pricing.total' }
        }
      }
    ]);

    const recentOrders = await Order.find({ user: userId })
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        user: {
          orders: user.orders,
          totalSpent: user.totalSpent
        },
        orderStats,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard data'
      }
    });
  }
});

// ============ ADMIN ROUTES ============

// @desc    Get all users (Admin only)
// @route   GET /api/v1/users
// @access  Admin
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      role,
      search,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch users'
      }
    });
  }
});

// @desc    Get user by ID (Admin only)
// @route   GET /api/v1/users/:id
// @access  Admin
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Get user's order stats
    const orderStats = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' },
          avgOrderValue: { $avg: '$pricing.total' }
        }
      }
    ]);

    const recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId status pricing.total createdAt');

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 },
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user'
      }
    });
  }
});

// @desc    Update user status (Admin only)
// @route   PATCH /api/v1/users/:id/status
// @access  Admin
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'banned', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status. Must be active, banned, or inactive'
        }
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Prevent admin from banning themselves
    if (user._id.toString() === req.user._id.toString() && status === 'banned') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'You cannot ban yourself'
        }
      });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        status: user.status
      },
      message: `User status updated to ${status}`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user status'
      }
    });
  }
});

// @desc    Get user analytics (Admin only)
// @route   GET /api/v1/users/analytics/summary
// @access  Admin
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    const userRegistrations = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    const topSpenders = await User.aggregate([
      { $match: { totalSpent: { $gt: 0 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      { $project: { name: 1, email: 1, totalSpent: 1, orders: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        bannedUsers,
        adminUsers,
        userRegistrations,
        topSpenders
      }
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
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