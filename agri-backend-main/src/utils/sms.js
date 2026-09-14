// SMS delivery via Fast2SMS (https://www.fast2sms.com).
// Uses the OTP route, which sends "Your OTP: <code>" to Indian numbers.
const axios = require('axios');

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/**
 * Normalise a phone number to the bare 10-digit form Fast2SMS expects.
 * Accepts "+919876543210", "919876543210", "9876543210".
 * @param {string} phone
 * @returns {string} 10-digit number
 */
const toLocalNumber = (phone) => {
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10);
};

/**
 * Send a one-time password over SMS.
 * In non-production, if no API key is configured, the OTP is logged to the
 * console instead of being sent (so local dev works without credentials).
 * @param {string} phone - any accepted phone format
 * @param {string} otp - the 6-digit code
 * @returns {Promise<object>} provider response (or a mock marker)
 */
const sendOtpSms = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const number = toLocalNumber(phone);
  const devMode = process.env.OTP_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

  // Dev sandbox: skip the real provider and log the OTP. Use when the Fast2SMS
  // account isn't verified/funded yet, or for local testing. Also the fallback
  // when no API key is configured (outside production).
  if (devMode || !apiKey) {
    if (!devMode && !apiKey && process.env.NODE_ENV === 'production') {
      throw new Error('SMS provider is not configured (FAST2SMS_API_KEY missing)');
    }
    console.log(`[DEV SMS] OTP for ${number}: ${otp}`);
    return { mocked: true, number };
  }

  // DLT route (route=dlt) is required for SMS OTP in India once a DLT header +
  // OTP content template are registered. Set FAST2SMS_DLT_SENDER_ID (the approved
  // 3-6 char sender/header) and FAST2SMS_DLT_MESSAGE_ID (the template/Message ID
  // from DLT Manager); the OTP value fills the template's single {#var#}.
  // When not set, we use Fast2SMS Quick SMS ('q') route which delivers immediately
  // without blocking on domain/website verification.
  const senderId = process.env.FAST2SMS_DLT_SENDER_ID;
  const messageId = process.env.FAST2SMS_DLT_MESSAGE_ID;
  const otpMessage = `Your AgriCola verification OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;
  const payload =
    senderId && messageId
      ? { route: 'dlt', sender_id: senderId, message: messageId, variables_values: String(otp), numbers: number }
      : { route: 'q', message: otpMessage, language: 'english', numbers: number };

  let response;
  try {
    response = await axios.post(FAST2SMS_URL, payload, {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
  } catch (err) {
    // If DLT route failed (e.g. pending template approval or invalid header), auto-fallback to Quick SMS
    if (payload.route === 'dlt') {
      try {
        console.warn(`[SMS] DLT route attempt failed (${err.response?.data?.message || err.message}). Falling back to Quick SMS route.`);
        const fallbackPayload = {
          route: 'q',
          message: otpMessage,
          language: 'english',
          numbers: number
        };
        response = await axios.post(FAST2SMS_URL, fallbackPayload, {
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
      } catch (fallbackErr) {
        const data = fallbackErr.response?.data;
        const raw = data?.message || fallbackErr.message || 'Failed to send OTP SMS';
        const e = new Error(Array.isArray(raw) ? raw.join(', ') : raw);
        e.code = 'SMS_SEND_FAILED';
        e.providerStatus = data?.status_code;
        throw e;
      }
    } else {
      // Fast2SMS returns the real reason in the 4xx body (e.g. account not
      // verified, insufficient balance). Surface it instead of a raw axios error.
      const data = err.response?.data;
      const raw = data?.message || err.message || 'Failed to send OTP SMS';
      const e = new Error(Array.isArray(raw) ? raw.join(', ') : raw);
      e.code = 'SMS_SEND_FAILED';
      e.providerStatus = data?.status_code;
      throw e;
    }
  }

  // Fast2SMS responds with { return: true, request_id, message: [...] }
  if (!response.data || response.data.return !== true) {
    const message = response.data?.message || 'Failed to send OTP SMS';
    const e = new Error(Array.isArray(message) ? message.join(', ') : message);
    e.code = 'SMS_SEND_FAILED';
    throw e;
  }

  return response.data;
};

module.exports = {
  sendOtpSms,
  toLocalNumber
};
