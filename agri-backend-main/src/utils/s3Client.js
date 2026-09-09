// AWS S3 storage helper for admin image uploads.
//
// Follows the same graceful-degradation pattern as the Razorpay/Ekart clients:
// if the bucket/keys aren't configured (or still hold placeholder values), the
// helper reports "not configured" instead of throwing cryptic SDK errors, so the
// upload route can return a clear 503.

const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET = process.env.S3_BUCKET || '';
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

const isPlaceholder = (v) => !v || v.startsWith('your-') || v.startsWith('YOUR_');

const isS3Configured = () =>
  !isPlaceholder(BUCKET) && !isPlaceholder(ACCESS_KEY) && !isPlaceholder(SECRET_KEY);

let _client = null;
const getClient = () => {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return _client;
};

// Public URL for a key. Override the base with S3_PUBLIC_BASE_URL when serving
// through CloudFront or a custom domain.
const publicUrl = (key) => {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
};

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const sanitizeFolder = (folder) =>
  String(folder || 'uploads').replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') ||
  'uploads';

/**
 * Upload a buffer to S3 and return its public URL + key.
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadBuffer(buffer, mimetype, folder = 'uploads') {
  if (!isS3Configured()) {
    const err = new Error(
      'S3 storage is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION and S3_BUCKET.'
    );
    err.code = 'S3_NOT_CONFIGURED';
    throw err;
  }

  const ext = EXT_BY_MIME[mimetype] || '';
  const key = `${sanitizeFolder(folder)}/${Date.now()}-${crypto
    .randomBytes(8)
    .toString('hex')}${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { url: publicUrl(key), key };
}

/** Best-effort delete of a previously uploaded object. */
async function deleteObject(key) {
  if (!isS3Configured() || !key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadBuffer, deleteObject, isS3Configured };
