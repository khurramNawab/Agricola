const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // ignore if restricted
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Startup validation: fail fast in production if critical variables are missing
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  } else {
    console.warn(`[WARN] Missing environment variables in dev: ${missingEnv.join(', ')}`);
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const paymentRoutes = require('./routes/payments');
const shippingRoutes = require('./routes/shipping');
const adminAuthRoutes = require('./routes/adminAuth');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const blogRoutes = require('./routes/blog');
const supportRoutes = require('./routes/support');
const searchRoutes = require('./routes/search');
const addressRoutes = require('./routes/addresses');
const checkoutRoutes = require('./routes/checkout');
const campaignRoutes = require('./routes/campaigns');
const subscriberRoutes = require('./routes/subscribers');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Behind a reverse proxy (nginx/ALB on EC2) the client IP arrives in the
// X-Forwarded-For header. Trust one proxy hop so express-rate-limit can read the
// real client IP (without this it throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
// Bump to the number of proxy hops if you add more (e.g. ALB -> nginx -> app = 2).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CORS configuration.
// Comma-separated allowlist via CORS_ORIGIN (falls back to FRONTEND_URL, then
// localhost). Lets the deployed site and local dev hit the API at the same time.
const allowedOrigins = (
  process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header = non-browser client (curl, server-to-server, health checks).
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any localhost / 127.0.0.1 port for local development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow any Vercel domain (*.vercel.app) including preview builds
    if (/^https?:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin) || /^https?:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

const isLoopback = (ip) => !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

// Minimum safe limit: prevent accidental throttling from legacy RATE_LIMIT_MAX_REQUESTS=100
const configuredLimit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
const generalMax = (!isNaN(configuredLimit) && configuredLimit >= 5000) ? configuredLimit : 10000;

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isLoopback(req.ip)) return true;
    // Admins and staff managing products/inventory/orders must NEVER be rate limited
    if (req.originalUrl && (req.originalUrl.includes('/admin') || req.originalUrl.includes('/upload'))) return true;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) return true;
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again shortly.'
      }
    });
  }
});
app.use(limiter);

// Stricter limiter for public auth/login/OTP endpoints to slow credential brute-forcing.
const configuredAuthLimit = parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10);
const authMax = (!isNaN(configuredAuthLimit) && configuredAuthLimit >= 100) ? configuredAuthLimit : 1000;

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isLoopback(req.ip)) return true;
    if (req.originalUrl && req.originalUrl.includes('/admin')) return true;
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many authentication attempts. Please wait a moment.'
      }
    });
  }
});

// Body parsing middleware. The `verify` hook stashes the raw body buffer so
// webhook handlers can verify provider signatures (which are computed over the
// exact bytes, not the re-serialised JSON).
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AgriCola API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/admin/auth', authLimiter, adminAuthRoutes); // before /admin so login bypasses the admin guard
app.use('/api/v1/admin/upload', uploadRoutes); // before /admin so the route isn't shadowed by the admin guard chain
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/blogs', blogRoutes);
app.use('/api/v1/blog', blogRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/subscribers', subscriberRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 5,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB runtime error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Reconnecting automatically...');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully.');
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api/v1`);
    });

    const shutdown = () => {
      server.close(() => {
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}

module.exports = app;