const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { createOtp, verifyOtp, clearOtp, OtpError } = require('../utils/otp');
const { sendOtpSms } = require('../utils/sms');
const firebaseAuth = require('../utils/firebaseAdmin');

const router = express.Router();

// --- helpers ---------------------------------------------------------------

const normalizePhone = (phone, countryCode = '+91') => {
  const local = String(phone || '').replace(/\D/g, '').slice(-10);
  const cc = String(countryCode || '+91').replace(/[^\d+]/g, '');
  return `${cc.startsWith('+') ? cc : '+' + cc}${local}`;
};

// Admin phones seeded from .env (comma-separated). Normalised once at load.
const seededAdminPhones = (process.env.ADMIN_PHONES || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => normalizePhone(p));

const isSeededAdminPhone = (phone) => seededAdminPhones.includes(phone);

/**
 * Ensure an admin user exists for a seeded phone. Creates it with the default
 * password on first use, or promotes an existing user to admin. Returns the
 * user doc WITH the password field selected, or null if the phone isn't an
 * admin (neither seeded nor already role=admin in the DB).
 */
const resolveAdminUser = async (phone) => {
  let user = await User.findOne({ phone }).select('+password');

  if (!user) {
    if (!isSeededAdminPhone(phone)) return null;
    user = await User.create({
      phone,
      role: 'admin',
      name: 'Admin',
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'changeme123'
    });
  } else if (isSeededAdminPhone(phone) && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }

  return user.role === 'admin' ? user : null;
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors.array() }
    });
  }
  next();
};

const signAdminToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });

// --- routes ----------------------------------------------------------------

// @route   POST /api/v1/admin/auth/request-otp
// @desc    Validate admin phone + password, then send an OTP (factor 2)
// @access  Public
router.post('/request-otp', [
  body('phone').notEmpty().withMessage('Phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { password, countryCode } = req.body;
    const phone = normalizePhone(req.body.phone, countryCode);

    const user = await resolveAdminUser(phone);

    // Validate password. Generic message either way to avoid leaking which
    // phones are admins.
    const passwordOk = user ? await user.comparePassword(password) : false;
    if (!user || !passwordOk) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' }
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'This admin account is disabled' }
      });
    }

    const { code } = await createOtp(phone, 'sms', 'admin_login');
    await sendOtpSms(phone, code);

    const echoOtp = process.env.OTP_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: 'OTP sent to the registered admin phone',
      ...(echoOtp && { data: { devOtp: code } })
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        ...(error.retryAfter && { retryAfter: error.retryAfter })
      });
    }
    if (error.code === 'SMS_SEND_FAILED') {
      await clearOtp(normalizePhone(req.body.phone, req.body.countryCode), 'admin_login').catch(() => {});
      return res.status(502).json({
        success: false,
        error: { code: 'SMS_SEND_FAILED', message: error.message }
      });
    }
    console.error('Admin request-otp error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to start admin login' }
    });
  }
});

// @route   POST /api/v1/admin/auth/verify-otp
// @desc    Verify the admin OTP and issue an admin session token
// @access  Public
router.post('/verify-otp', [
  body('phone').notEmpty().withMessage('Phone is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('A 6-digit code is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { code, countryCode } = req.body;
    const phone = normalizePhone(req.body.phone, countryCode);

    await verifyOtp(phone, 'admin_login', code);

    const user = await User.findOne({ phone });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not an admin account' }
      });
    }

    user.phoneVerified = true;
    user.lastLogin = new Date();
    await user.save();

    const token = signAdminToken(user._id);

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        user: { ...user.getStorefrontProfile(), role: user.role }
      }
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        ...(error.retryAfter && { retryAfter: error.retryAfter })
      });
    }
    console.error('Admin verify-otp error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify admin login' }
    });
  }
});

// @route   POST /api/v1/admin/auth/firebase-login
// @desc    Single-step admin login: verify a Firebase phone-auth ID token (proves
//          phone ownership) AND the admin password, then issue an admin session.
// @access  Public
router.post('/firebase-login', [
  body('idToken').notEmpty().withMessage('idToken is required'),
  body('password').notEmpty().withMessage('Password is required')
], handleValidationErrors, async (req, res) => {
  try {
    let phone = null;
    const isDevBypass =
      process.env.NODE_ENV !== 'production' &&
      (req.body.idToken === 'bypass' || req.body.idToken === 'mock' || req.body.idToken.startsWith('mock-'));

    if (isDevBypass) {
      const configuredPhones = (process.env.ADMIN_PHONES || '+917062201992').split(',').map((p) => p.trim());
      phone = req.body.phone || configuredPhones[0];
    } else {
      try {
        const decoded = await firebaseAuth.verifyIdToken(req.body.idToken);
        phone = decoded.phone_number;
      } catch (fbErr) {
        // In development only: fall back to the configured phone when Firebase is unconfigured.
        // In production this catch block is skipped so misconfiguration surfaces loudly.
        if (process.env.NODE_ENV !== 'production') {
          const configuredPhones = (process.env.ADMIN_PHONES || '+917062201992').split(',').map((p) => p.trim());
          phone = req.body.phone || configuredPhones[0];
        } else {
          throw fbErr; // Surfaces as FIREBASE_UNCONFIGURED or invalid-token in production
        }
      }
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_PHONE', message: 'This sign-in has no phone number' }
      });
    }

    let user = await resolveAdminUser(phone);
    let passwordOk = user ? await user.comparePassword(req.body.password) : false;

    // Dev-only bypass: skip password check when using mock/bypass idToken in non-production.
    if (isDevBypass && (!user || !passwordOk)) {
      if (!user) {
        user = await User.create({
          phone,
          role: 'admin',
          name: 'Admin',
          password: req.body.password || 'changeme123'
        });
      }
      passwordOk = true;
    }

    if (!user || !passwordOk) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' }
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'This admin account is disabled' }
      });
    }

    user.phoneVerified = true;
    user.lastLogin = new Date();
    await user.save();

    const token = signAdminToken(user._id);
    return res.json({
      success: true,
      message: 'Admin login successful',
      data: { token, user: { ...user.getStorefrontProfile(), role: user.role } }
    });
  } catch (error) {
    if (error.code === 'FIREBASE_UNCONFIGURED') {
      return res.status(503).json({
        success: false,
        error: { code: 'FIREBASE_UNCONFIGURED', message: 'Phone login is not configured' }
      });
    }
    console.error('Admin firebase-login error:', error.message);
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification. Please try again.' }
    });
  }
});

// @route   POST /api/v1/admin/auth/bypass-login
// @desc    One-click credential bypass for admin login (demo & testing)
// @access  Public
router.post('/bypass-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Bypass login is strictly disabled in production mode.' }
    });
  }
  try {
    let user = await User.findOne({ role: 'admin' });
    if (!user) {
      const configuredPhones = (process.env.ADMIN_PHONES || '+917062201992').split(',').map((p) => p.trim());
      const phone = configuredPhones[0] || '+917062201992';
      user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({
          phone,
          role: 'admin',
          name: 'Super Admin',
          password: 'changeme123'
        });
      } else {
        user.role = 'admin';
        await user.save();
      }
    }
    user.phoneVerified = true;
    user.lastLogin = new Date();
    await user.save();

    const token = signAdminToken(user._id);
    return res.json({
      success: true,
      message: 'Admin bypass login successful',
      data: { token, user: { ...user.getStorefrontProfile(), role: user.role } }
    });
  } catch (error) {
    console.error('Bypass login error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'BYPASS_FAILED', message: error.message }
    });
  }
});

// @route   POST /api/v1/admin/auth/logout
// @desc    End admin session (stateless token; client discards it)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
