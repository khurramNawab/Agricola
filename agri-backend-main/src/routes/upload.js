const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadBuffer, deleteObject, isS3Configured } = require('../utils/s3Client');

const router = express.Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB (supports images & video clips)
const ALLOWED_TYPES = (
  process.env.ALLOWED_FILE_TYPES ||
  'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/ogg,video/quicktime'
)
  .split(',')
  .map((t) => t.trim().toLowerCase());

// Ensure local uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create uploads directory:', err);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype.toLowerCase())) return cb(null, true);
    const err = new Error(
      `Unsupported file type (${file.mimetype}). Allowed types: images (jpeg, png, webp, gif, svg) and videos (mp4, webm, mov)`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

// All upload endpoints are admin-only.
router.use(authenticate, requireAdmin);

// @route   GET /api/v1/admin/upload
// @desc    Report whether storage is configured (always true now with local fallback).
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      configured: true,
      mode: isS3Configured() ? 's3' : 'local',
      maxSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES,
    },
  });
});

// @route   POST /api/v1/admin/upload
// @desc    Upload one or more files (images/videos). Stores on S3 if configured, or local disk fallback.
//          Returns { url, key } or array of files.
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

    const folder = req.query.folder || req.body.folder || 'media';
    const files = [];

    try {
      if (isS3Configured()) {
        for (const file of req.files) {
          files.push(await uploadBuffer(file.buffer, file.mimetype, folder));
        }
      } else {
        // Local disk storage fallback
        const host = req.get('host') || 'localhost:5000';
        const protocol = req.protocol === 'https' ? 'https' : 'http';

        for (const file of req.files) {
          const origExt = path.extname(file.originalname);
          const fallbackExt = file.mimetype.startsWith('video/') ? '.mp4' : '.png';
          const ext = origExt || fallbackExt;
          const cleanName = path
            .basename(file.originalname, origExt)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 30);
          const filename = `${folder}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${cleanName}${ext}`;
          const targetPath = path.join(uploadDir, filename);

          await fs.promises.writeFile(targetPath, file.buffer);
          const url = `${protocol}://${host}/uploads/${filename}`;
          files.push({
            url,
            key: filename,
            isLocal: true,
            mimetype: file.mimetype,
            size: file.size,
          });
        }
      }

      res.status(201).json({
        success: true,
        data: files.length === 1 ? files[0] : files,
        files,
      });
    } catch (e) {
      console.error('Upload storage error:', e);
      res.status(500).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'Failed to process file upload: ' + e.message },
      });
    }
  });
});

// @route   DELETE /api/v1/admin/upload
// @desc    Delete an uploaded object by its key or URL.
// @access  Private (Admin)
router.delete('/', async (req, res) => {
  const keyOrUrl = req.query.key || req.body?.key || req.query.url || req.body?.url;
  if (!keyOrUrl) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_KEY', message: 'An object key or URL is required' },
    });
  }

  // Extract key if a full URL was passed
  let key = keyOrUrl;
  if (key.includes('/uploads/')) {
    key = key.split('/uploads/').pop();
  }

  try {
    // Check if local file exists
    const localPath = path.join(uploadDir, path.basename(key));
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      return res.json({ success: true, message: 'Local media file deleted successfully' });
    }

    // Try S3 if configured
    if (isS3Configured()) {
      await deleteObject(key);
      return res.json({ success: true, message: 'File deleted successfully from storage' });
    }

    res.json({ success: true, message: 'File reference removed' });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete file' },
    });
  }
});

module.exports = router;
