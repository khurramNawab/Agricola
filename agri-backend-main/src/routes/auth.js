const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { createOtp, verifyOtp, clearOtp, OtpError } = require('../utils/otp');
const { sendOtpSms } = require('../utils/sms');
const firebaseAuth = require('../utils/firebaseAdmin');

const router = express.Router();

// Normalise a storefront phone (10 digits + countryCode) to +91XXXXXXXXXX
const normalizePhone = (phone, countryCode = '+91') => {
  const local = String(phone || '').replace(/\D/g, '').slice(-10);
  const cc = String(countryCode || '+91').replace(/[^\d+]/g, '');
  return `${cc.startsWith('+') ? cc : '+' + cc}${local}`;
};

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

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
  
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE
  });

  return { accessToken, refreshToken };
};

// @route   POST /api/v1/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^\+91[0-9]{10}$/).withMessage('Please enter a valid Indian phone number (+91XXXXXXXXXX)')
], handleValidationErrors, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email or phone already exists'
        }
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed'
      }
    });
  }
});

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Check if user is banned
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED',
          message: 'Your account has been banned'
        }
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed'
      }
    });
  }
});

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired refresh token'
      }
    });
  }
});

// @route   POST /api/v1/auth/otp/request
// @desc    Send a 6-digit OTP to a mobile number (storefront login)
// @access  Public
router.post('/otp/request', [
  body('phone').matches(/^[0-9]{10}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('countryCode').optional().matches(/^\+?\d{1,4}$/).withMessage('Invalid country code')
], handleValidationErrors, async (req, res) => {
  try {
    const { phone, countryCode = '+91', acceptedTerms } = req.body;

    if (acceptedTerms === false) {
      return res.status(400).json({
        success: false,
        error: { code: 'TERMS_NOT_ACCEPTED', message: 'You must accept the terms to continue' }
      });
    }

    const fullPhone = normalizePhone(phone, countryCode);
    const { code, expiresAt } = await createOtp(fullPhone, 'sms', 'login');

    await sendOtpSms(fullPhone, code);

    // In dev sandbox mode (never production), echo the code so the frontend can
    // complete login without a real SMS. Gated by OTP_DEV_MODE and non-production.
    const echoOtp = process.env.OTP_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: { phone: fullPhone, expiresAt, ...(echoOtp && { devOtp: code }) }
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        ...(error.retryAfter && { retryAfter: error.retryAfter })
      });
    }
    // SMS delivery failed: drop the pending OTP so the user can retry without
    // waiting out the resend cooldown, and surface the provider's reason.
    if (error.code === 'SMS_SEND_FAILED') {
      await clearOtp(normalizePhone(req.body.phone, req.body.countryCode), 'login').catch(() => {});
      return res.status(502).json({
        success: false,
        error: { code: 'SMS_SEND_FAILED', message: error.message }
      });
    }
    console.error('OTP request error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'OTP_SEND_FAILED', message: 'Failed to send OTP. Please try again.' }
    });
  }
});

// @route   POST /api/v1/auth/otp/verify
// @desc    Verify OTP, create/return session token + user
// @access  Public
router.post('/otp/verify', [
  body('phone').matches(/^[0-9]{10}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('countryCode').optional().matches(/^\+?\d{1,4}$/),
  body('otp').matches(/^[0-9]{6}$/).withMessage('OTP must be 6 digits')
], handleValidationErrors, async (req, res) => {
  try {
    const { phone, countryCode = '+91', otp, name } = req.body;
    const fullPhone = normalizePhone(phone, countryCode);

    await verifyOtp(fullPhone, 'login', otp);

    // Find or create the customer account
    let user = await User.findOne({ phone: fullPhone });
    if (!user) {
      user = await User.create({
        phone: fullPhone,
        name: name || '',
        role: 'customer',
        phoneVerified: true
      });
    } else if (!user.phoneVerified) {
      user.phoneVerified = true;
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'Your account has been banned' }
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: accessToken,
        refreshToken,
        user: user.getStorefrontProfile()
      }
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }
    console.error('OTP verify error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'OTP_VERIFY_FAILED', message: 'Failed to verify OTP. Please try again.' }
    });
  }
});

// @route   POST /api/v1/auth/firebase
// @desc    Exchange a Firebase phone-auth ID token for a storefront session.
//          Find-or-creates the customer by verified phone (first login = signup).
// @access  Public
router.post('/firebase', [
  body('idToken').notEmpty().withMessage('idToken is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { idToken, name } = req.body;
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const phone = decoded.phone_number; // E.164, e.g. +919876543210

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_PHONE', message: 'This sign-in has no phone number' }
      });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, name: name || '', role: 'customer', phoneVerified: true });
    } else if (!user.phoneVerified) {
      user.phoneVerified = true;
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'Your account has been banned' }
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token: accessToken, refreshToken, user: user.getStorefrontProfile() }
    });
  } catch (error) {
    if (error.code === 'FIREBASE_UNCONFIGURED') {
      return res.status(503).json({
        success: false,
        error: { code: 'FIREBASE_UNCONFIGURED', message: 'Phone login is not configured' }
      });
    }
    console.error('Firebase auth error:', error.message);
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification. Please try again.' }
    });
  }
});

// @route   POST /api/v1/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user.getPublicProfile()
    }
  });
});

module.exports = router;