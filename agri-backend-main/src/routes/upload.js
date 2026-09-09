const express = require('express');
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadBuffer, deleteObject, isS3Configured } = require('../utils/s3Client');

const router = express.Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = (
  process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/gif'
)
  .split(',')
  .map((t) => t.trim());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 6 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error(
      `Unsupported file type. Allowed: ${ALLOWED_TYPES.join(', ')}`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

// All upload endpoints are admin-only.
router.use(authenticate, requireAdmin);

// @route   GET /api/v1/admin/upload
// @desc    Report whether storage is configured (handy for the admin UI).
router.get('/', (req, res) => {
  res.json({ success: true, data: { configured: isS3Configured() } });
});

// @route   POST /api/v1/admin/upload
// @desc    Upload one or more images to S3. Accepts any file field(s).
//          Returns `data` as a single { url, key } when one file is sent,
//          or an array when multiple are sent. `files` is always the array.
// @access  Private (Admin)
router.post('/', (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      const code =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'FILE_TOO_LARGE'
          : err.code === 'LIMIT_FILE_COUNT'
          ? 'TOO_MANY_FILES'
          : err.code || 'UPLOAD_ERROR';
      const message =
        code === 'FILE_TOO_LARGE'
          ? `File exceeds the ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`
          : err.message;
      return res.status(400).json({ success: false, error: { code, message } });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    if (!isS3Configured()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'S3_NOT_CONFIGURED',
          message:
            'Image storage is not configured yet. Set AWS_* and S3_BUCKET in the backend .env.',
        },
      });
    }

    try {
      const folder = req.query.folder || req.body.folder || 'uploads';
      const files = [];
      for (const file of req.files) {
        files.push(await uploadBuffer(file.buffer, file.mimetype, folder));
      }
      res.status(201).json({
        success: true,
        data: files.length === 1 ? files[0] : files,
        files,
      });
    } catch (e) {
      console.error('S3 upload error:', e);
      res.status(502).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'Failed to upload image to storage' },
      });
    }
  });
});

// @route   DELETE /api/v1/admin/upload
// @desc    Delete an uploaded object by its S3 key (?key= or body { key }).
// @access  Private (Admin)
router.delete('/', async (req, res) => {
  const key = req.query.key || req.body?.key;
  if (!key) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_KEY', message: 'An object key is required' },
    });
  }
  try {
    await deleteObject(key);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (e) {
    console.error('S3 delete error:', e);
    res.status(502).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete file' },
    });
  }
});

module.exports = router;
