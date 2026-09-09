#!/usr/bin/env node
/*
 * Third-party service connectivity check (pre-deploy pre-flight).
 *
 * Loads the backend .env and pings every external integration the API depends
 * on, using the SAME client code the app uses where possible. Prints only
 * PASS/FAIL + masked identifiers — it NEVER prints secret values.
 *
 * All checks are read-only / non-destructive EXCEPT the S3 check, which uploads
 * a tiny temp object and immediately deletes it (net-zero) to verify the real
 * PutObject + DeleteObject permissions the upload route needs.
 *
 *   npm run services:check
 *
 * Exit code is non-zero if any configured service FAILS (CI-friendly).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');

// ---- output helpers --------------------------------------------------------
const PAD = 18;
const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  fail: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
};
const results = [];
const line = (name, status, detail) => {
  results.push({ name, status, detail });
  const tag =
    status === 'OK' ? C.ok('OK  ') :
    status === 'FAIL' ? C.fail('FAIL') :
    status === 'WARN' ? C.warn('WARN') :
    C.dim('SKIP');
  console.log(`${name.padEnd(PAD, '.')} ${tag}  ${detail || ''}`);
};

// Show the shape of an identifier without leaking the secret part.
const tail = (v, keep = 4) => {
  if (!v) return '(unset)';
  const s = String(v);
  return s.length <= keep ? '****' : `${'*'.repeat(Math.min(6, s.length - keep))}${s.slice(-keep)}`;
};
const isPlaceholder = (v) => !v || /^your-|^YOUR_/.test(String(v));

// ---- individual checks -----------------------------------------------------

async function checkMongo() {
  const uri = process.env.MONGODB_URI;
  if (isPlaceholder(uri)) return line('MongoDB', 'SKIP', 'MONGODB_URI not set');
  const mongoose = require('mongoose');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const host = mongoose.connection.host;
    const dbName = mongoose.connection.name;
    let products = 'n/a';
    try {
      products = await mongoose.connection.db.collection('products').countDocuments();
    } catch { /* collection may not exist */ }
    line('MongoDB', 'OK', C.dim(`${host} · db "${dbName}" · products: ${products}`));
  } catch (err) {
    line('MongoDB', 'FAIL', C.fail(err.message));
  } finally {
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

async function checkRazorpay() {
  const razorpay = require('../src/utils/razorpayClient');
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  if (!razorpay.isConfigured()) return line('Razorpay', 'SKIP', 'keys not configured (placeholder)');
  const mode = keyId.startsWith('rzp_live_') ? 'LIVE' : keyId.startsWith('rzp_test_') ? 'TEST' : 'unknown';
  try {
    // Read-only auth check: list 1 order. Authenticates without creating anything.
    await razorpay.getClient().orders.all({ count: 1 });
    const webhook = isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET) ? ' · webhook secret MISSING' : ' · webhook secret set';
    const status = mode === 'TEST' ? 'WARN' : 'OK';
    line('Razorpay', status, C.dim(`key ${tail(keyId)} · ${mode} mode${webhook}`));
  } catch (err) {
    const desc = err.error?.description || err.message;
    line('Razorpay', 'FAIL', C.fail(`auth failed: ${desc}`));
  }
}

async function checkEkart() {
  const ekart = require('../src/utils/ekart');
  if (ekart.isMock()) {
    return line('Ekart', 'WARN', 'MOCK mode ON (EKART_MOCK=true) — live API NOT tested. Disable for prod.');
  }
  if (!ekart.isConfigured()) return line('Ekart', 'SKIP', 'credentials not configured (placeholder)');
  try {
    await ekart.getToken(); // auth only, no shipment side effects
    let serv = '';
    try {
      const pin = ekart.warehousePincode();
      const s = await ekart.checkServiceability(pin);
      serv = ` · serviceability(${pin}): ${s?.status === true ? 'yes' : JSON.stringify(s?.status ?? s)}`;
    } catch (e) {
      serv = ` · serviceability check errored: ${e.message}`;
    }
    line('Ekart', 'OK', C.dim(`token acquired · client ${tail(process.env.EKART_CLIENT_ID)}${serv}`));
  } catch (err) {
    const data = err.response?.data;
    line('Ekart', 'FAIL', C.fail(`auth failed: ${data ? JSON.stringify(data) : err.message}`));
  }
}

async function checkShiprocket() {
  const shiprocket = require('../src/utils/shiprocket');
  const active = String(process.env.SHIPPING_PROVIDER || 'shiprocket').toLowerCase() === 'shiprocket';
  const label = active ? 'Shiprocket' : 'Shiprocket*'; // * = configured but not the active provider

  if (shiprocket.isMock()) {
    return line(label, 'WARN', 'MOCK mode ON (SHIPROCKET_MOCK=true) — live API NOT tested. Disable for prod.');
  }
  if (!shiprocket.isConfigured()) return line(label, 'SKIP', 'API user not configured (placeholder)');

  try {
    await shiprocket.getToken(); // auth only, no booking side effects

    // The #1 cause of booking failures: SHIPROCKET_PICKUP_LOCATION not matching a
    // registered pickup-address nickname exactly.
    const wanted = process.env.SHIPROCKET_PICKUP_LOCATION || '';
    const locations = await shiprocket.listPickupLocations();
    const match = locations.find((l) => l.pickup_location === wanted);
    const nicknames = locations.map((l) => `"${l.pickup_location}"`).join(', ') || '(none)';

    // Read-only rate probe from the warehouse to itself-adjacent pincode.
    let rate = '';
    try {
      const pin = shiprocket.warehousePincode();
      const { couriers } = await shiprocket.getRates({ toPincode: pin, weight: 0.5, declaredValue: 500 });
      rate = couriers.length
        ? ` · rates(${pin}→${pin}): ${couriers.length} couriers, cheapest ₹${couriers[0].rate} (${couriers[0].courierName})`
        : ` · rates(${pin}→${pin}): no courier available`;
    } catch (e) {
      rate = ` · rate probe errored: ${e.message}`;
    }

    if (!match) {
      return line(
        label,
        'FAIL',
        C.fail(`pickup location "${wanted}" not found — registered: ${nicknames}`) + C.dim(rate)
      );
    }
    const status = active ? 'OK' : 'WARN';
    line(
      label,
      status,
      C.dim(
        `token acquired · user ${tail(process.env.SHIPROCKET_EMAIL, 12)} · pickup "${match.pickup_location}" ` +
          `(${match.city} ${match.pin_code}, phone_verified=${match.phone_verified})${rate}` +
          (active ? '' : ' · NOT the active provider (SHIPPING_PROVIDER=' + process.env.SHIPPING_PROVIDER + ')')
      )
    );
  } catch (err) {
    const data = err.response?.data;
    line(label, 'FAIL', C.fail(`auth failed: ${data ? JSON.stringify(data) : err.message}`));
  }
}

async function checkS3() {
  const s3 = require('../src/utils/s3Client');
  if (!s3.isS3Configured()) return line('AWS S3', 'SKIP', 'bucket/keys not configured (placeholder)');
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION || 'ap-south-1';
  try {
    // Real upload path (PutObject), then clean up (DeleteObject). 1x1 transparent PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const { url, key } = await s3.uploadBuffer(png, 'image/png', 'healthcheck');
    await s3.deleteObject(key);
    line('AWS S3', 'OK', C.dim(`bucket "${bucket}" (${region}) · put+delete ok · ${url.replace(/healthcheck.*/, 'healthcheck/…')}`));
  } catch (err) {
    line('AWS S3', 'FAIL', C.fail(`${err.name || ''} ${err.message}`));
  }
}

async function checkFast2SMS() {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (isPlaceholder(apiKey)) return line('Fast2SMS', 'SKIP', 'FAST2SMS_API_KEY not configured (placeholder)');
  try {
    // Wallet balance: validates the key WITHOUT sending an SMS or spending credits.
    const { data } = await axios.get('https://www.fast2sms.com/dev/wallet', {
      params: { authorization: apiKey },
      timeout: 15000,
    });
    if (data?.return === true) {
      line('Fast2SMS', 'OK', C.dim(`key valid · wallet balance ₹${data.wallet}`));
    } else {
      const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
      line('Fast2SMS', 'FAIL', C.fail(msg || JSON.stringify(data)));
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    line('Fast2SMS', 'FAIL', C.fail(Array.isArray(msg) ? msg.join(', ') : msg));
  }
}

async function checkSmtp() {
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;
  if (isPlaceholder(EMAIL_HOST) || isPlaceholder(EMAIL_USER) || isPlaceholder(EMAIL_PASS)) {
    return line('Email (SMTP)', 'SKIP', C.dim('dormant — not wired into backend code; set EMAIL_* to test'));
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT) || 587,
      secure: Number(EMAIL_PORT) === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    await transporter.verify(); // SMTP handshake + login, no email sent
    line('Email (SMTP)', 'WARN', C.dim(`login ok (${EMAIL_HOST}) — but no code in src/ sends email yet`));
  } catch (err) {
    line('Email (SMTP)', 'FAIL', C.fail(err.message));
  }
}

function checkDormant() {
  if (!isPlaceholder(process.env.CLOUDINARY_API_KEY)) {
    line('Cloudinary', 'WARN', C.dim('configured but unused in src/ (superseded by S3) — can remove'));
  } else {
    line('Cloudinary', 'SKIP', C.dim('legacy/unused'));
  }
  if (!isPlaceholder(process.env.GOOGLE_MAPS_API_KEY)) {
    line('Google Maps', 'WARN', C.dim('configured but unused in src/'));
  } else {
    line('Google Maps', 'SKIP', C.dim('unused'));
  }
}

// ---- run --------------------------------------------------------------------
(async () => {
  console.log('\nAgriCola — third-party service connectivity check');
  console.log(C.dim(`env: .env · NODE_ENV=${process.env.NODE_ENV || '(unset)'}\n`));

  console.log(C.dim(`active logistics provider: ${process.env.SHIPPING_PROVIDER || 'shiprocket (default)'}\n`));

  await checkMongo();
  await checkRazorpay();
  await checkShiprocket();
  await checkEkart();
  await checkS3();
  await checkFast2SMS();
  await checkSmtp();
  checkDormant();

  const ok = results.filter((r) => r.status === 'OK').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const warn = results.filter((r) => r.status === 'WARN').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log(`\nSummary: ${C.ok(ok + ' OK')}, ${fail ? C.fail(fail + ' FAIL') : '0 FAIL'}, ${C.warn(warn + ' WARN')}, ${C.dim(skip + ' SKIP')}\n`);

  process.exit(fail > 0 ? 1 : 0);
})();
