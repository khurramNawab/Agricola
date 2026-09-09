// Jest setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.RAZORPAY_KEY_ID = 'test-razorpay-key';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.EKART_API_URL = 'https://api.test-ekart.com';
process.env.EKART_API_KEY = 'test-ekart-key';
// Never let a suite reach a live carrier API: both provider clients default to their
// built-in mocks. Individual suites override SHIPPING_PROVIDER as needed.
process.env.SHIPROCKET_MOCK = 'true';
process.env.SHIPROCKET_EMAIL = 'test-api-user@example.com';
process.env.SHIPROCKET_PASSWORD = 'test-shiprocket-password';
process.env.SHIPROCKET_PICKUP_LOCATION = 'Home';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);