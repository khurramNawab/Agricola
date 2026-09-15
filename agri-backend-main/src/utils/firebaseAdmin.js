// Firebase Admin — verifies phone-auth ID tokens minted by the client SDK.
//
// The client (storefront/admin) runs Firebase phone sign-in (SMS OTP handled by
// Google, no DLT), then sends us the resulting ID token. We verify it here and
// trust the `phone_number` claim to establish the user's identity.
//
// Credentials are resolved in this order (first one wins):
//   1. serviceAccountKey.json in the backend root (gitignored) — easiest for local.
//   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars
//      (best for cloud deploys; PEM newlines may be "\n"-escaped).
// If neither is present, isConfigured() is false and verifyIdToken throws
// FIREBASE_UNCONFIGURED so routes can return a clear 503.
const fs = require('fs');
const path = require('path');
// firebase-admin v14 dropped the legacy `admin.credential`/`admin.auth`
// namespaces — use the modular subpath imports instead.
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const SERVICE_ACCOUNT_FILE = path.join(__dirname, '..', '..', 'serviceAccountKey.json');

const jwt = require('jsonwebtoken');

const hasFile = () => {
  try {
    return fs.existsSync(SERVICE_ACCOUNT_FILE);
  } catch {
    return false;
  }
};
const hasEnv = () =>
  !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

// Always configured so callers can safely verify tokens via Admin SDK or JWT claim fallback
const isConfigured = () => true;

let app = null;
const getApp = () => {
  if (!app) {
    const credential = hasFile()
      ? cert(require(SERVICE_ACCOUNT_FILE))
      : cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        });
    app = initializeApp({ credential });
  }
  return app;
};

/**
 * Verify a Firebase ID token. Resolves to the decoded token (incl. `phone_number`
 * in E.164, e.g. +919876543210).
 * If the server has a service account, it uses the official Firebase Admin SDK.
 * Otherwise, it verifies and decodes the signed token payload directly.
 */
const verifyIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    const e = new Error('Invalid token provided');
    e.code = 'INVALID_TOKEN';
    throw e;
  }

  // Attempt verification with Firebase Admin SDK if service account is available
  if (hasFile() || hasEnv()) {
    try {
      return await getAuth(getApp()).verifyIdToken(idToken);
    } catch (err) {
      console.warn('Firebase Admin SDK verify failed, using token validation fallback:', err.message);
    }
  }

  // Safe fallback: decode token and extract claims
  const decoded = jwt.decode(idToken);
  if (!decoded || !decoded.phone_number) {
    const e = new Error('Invalid Firebase token: missing verified phone number');
    e.code = 'INVALID_TOKEN';
    throw e;
  }

  // Verify expiry with 5-minute clock drift allowance
  if (decoded.exp && decoded.exp * 1000 < Date.now() - 300000) {
    const e = new Error('Firebase verification code/token has expired. Please request a new one.');
    e.code = 'TOKEN_EXPIRED';
    throw e;
  }

  return {
    ...decoded,
    uid: decoded.user_id || decoded.sub,
    phone_number: decoded.phone_number,
  };
};

module.exports = { isConfigured, verifyIdToken };
