const mongoose = require('mongoose');

// Stores a single active OTP per (identifier, purpose). Codes are hashed,
// never stored in plaintext. Documents auto-expire via a TTL index.
const otpSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    trim: true
  },
  channel: {
    type: String,
    enum: ['sms', 'email'],
    required: true
  },
  purpose: {
    type: String,
    enum: ['login', 'admin_login'],
    required: true
  },
  codeHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// One active OTP per identifier+purpose
otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true });

// TTL: Mongo removes the document once expiresAt passes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
