const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const mailer = require('../utils/email');
const { optionalAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Support API endpoint', data: [] });
});

// @desc    Submit website/general feedback (stored + emailed to the store)
// @route   POST /api/v1/support/feedback
// @access  Public (user attached when logged in)
router.post('/feedback', optionalAuth, async (req, res) => {
  try {
    const { name, email, rating, message, page } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please enter your feedback message' }
      });
    }

    const fb = await Feedback.create({
      user: req.user?._id,
      name: (name || req.user?.name || '').trim(),
      email: (email || req.user?.email || '').trim().toLowerCase(),
      rating: rating ? Math.min(5, Math.max(1, Number(rating))) : undefined,
      message: String(message).trim().slice(0, 2000),
      page: (page || '').slice(0, 300),
    });

    // Notify the store (best-effort — never fail the request on an email error).
    const to = process.env.STORE_ORDER_EMAIL || process.env.NOTIFY_FALLBACK_EMAIL || process.env.EMAIL_USER;
    if (to) {
      const esc = (s) => String(s || '').replace(/</g, '&lt;');
      mailer
        .sendMail({
          to,
          replyTo: fb.email || undefined,
          subject: `Website feedback${fb.rating ? ` (${fb.rating}★)` : ''}`,
          text: `From: ${fb.name || 'Anonymous'} <${fb.email || 'no email'}>\nPage: ${fb.page || '-'}\nRating: ${fb.rating || '-'}\n\n${fb.message}`,
          html: `<p><strong>From:</strong> ${esc(fb.name) || 'Anonymous'} ${fb.email ? `&lt;${esc(fb.email)}&gt;` : ''}</p>
                 <p><strong>Page:</strong> ${esc(fb.page) || '-'} &nbsp;·&nbsp; <strong>Rating:</strong> ${fb.rating || '-'}</p>
                 <p>${esc(fb.message)}</p>`,
        })
        .catch((e) => console.error('[feedback] email failed:', e.message));
    }

    res.status(201).json({ success: true, message: 'Thanks for your feedback!' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' } });
  }
});

module.exports = router;
