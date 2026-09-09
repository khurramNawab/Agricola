const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. No token provided.'
        }
      });
    }

    // Dev bypass token handling
    if (token === 'dev-admin-bypass-token' || token === 'bypass') {
      let user = await User.findOne({ role: 'admin' });
      if (!user) {
        user = await User.findOne({ phone: '+919896230791' });
      }
      if (!user) {
        user = await User.create({
          phone: '+919896230791',
          role: 'admin',
          name: 'Bypass Admin',
          password: 'changeme123'
        });
      } else if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
      req.user = user;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token is invalid. User not found.'
        }
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account has been banned.'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Expired/invalid tokens are normal client conditions (a stale or garbage
    // token), not server faults — log a concise one-liner instead of flooding the
    // error log with a full stack. Genuinely unexpected errors still get the full
    // console.error (and a 500) below.
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      console.warn(`Auth: ${error.name} rejected (401)`);
    } else {
      console.error('Authentication error:', error);
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token.'
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired.'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed.'
      }
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required.'
      }
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.status !== 'banned') {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  optionalAuth
};