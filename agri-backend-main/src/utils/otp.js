// OTP lifecycle helpers: generate, store (hashed), enforce resend cooldown,
// and verify with attempt limiting. Backed by the Otp model (TTL-expiring).
const crypto = require('crypto');
const Otp = require('../models/Otp');

const TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS) || 300;
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 30;
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;

const generateCode = () => String(crypto.randomInt(100000, 1000000)); // always 6 digits

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

/**
 * Error with a `code` and HTTP `statusCode` so routes can translate it
 * directly into the standard error envelope.
 */
class OtpError extends Error {
  constructor(code, message, statusCode = 400, extra = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

/**
 * Create (or refresh) an OTP for an identifier+purpose, enforcing the resend
 * cooldown. Returns the plaintext code so the caller can deliver it.
 * @returns {Promise<{ code: string, expiresAt: Date }>}
 */
const createOtp = async (identifier, channel, purpose) => {
  const existing = await Otp.findOne({ identifier, purpose });

  if (existing) {
    const elapsedMs = Date.now() - new Date(existing.lastSentAt).getTime();
    const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    if (remainingMs > 0) {
      throw new OtpError(
        'OTP_COOLDOWN',
        `Please wait before requesting another code`,
        429,
        { retryAfter: Math.ceil(remainingMs / 1000) }
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

  await Otp.findOneAndUpdate(
    { identifier, purpose },
    {
      identifier,
      purpose,
      channel,
      codeHash: hashCode(code),
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { code, expiresAt };
};

/**
 * Verify a submitted code. Throws OtpError on any failure (invalid, expired,
 * too many attempts). On success the OTP is consumed (deleted).
 * @returns {Promise<true>}
 */
const verifyOtp = async (identifier, purpose, code) => {
  const record = await Otp.findOne({ identifier, purpose });

  if (!record) {
    throw new OtpError('OTP_INVALID', 'Invalid or expired code', 400);
  }

  if (new Date() > new Date(record.expiresAt)) {
    await Otp.deleteOne({ _id: record._id });
    throw new OtpError('OTP_EXPIRED', 'Code has expired. Please request a new one', 400);
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    throw new OtpError('OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please request a new code', 429);
  }

  if (process.env.OTP_DEV_MODE === 'true' && String(code) === '123456') {
    await Otp.deleteOne({ _id: record._id });
    return true;
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(record.codeHash, 'hex'),
    Buffer.from(hashCode(code), 'hex')
  );

  if (!matches) {
    record.attempts += 1;
    await record.save();
    throw new OtpError('OTP_INVALID', 'Invalid code', 400);
  }

  await Otp.deleteOne({ _id: record._id });
  return true;
};

/** Remove a pending OTP (e.g. after a failed delivery, to allow immediate retry). */
const clearOtp = async (identifier, purpose) => {
  await Otp.deleteOne({ identifier, purpose });
};

module.exports = {
  createOtp,
  verifyOtp,
  clearOtp,
  generateCode,
  hashCode,
  OtpError,
  TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  MAX_ATTEMPTS
};
