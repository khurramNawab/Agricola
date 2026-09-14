const express = require('express');
const router = express.Router();
const LaunchSubscriber = require('../models/LaunchSubscriber');

// Helper to normalize phone number
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

// @route   POST /api/v1/subscribers/notify-launch
// @desc    Register user interest for upcoming Utensils & Gardening product collections
// @access  Public
router.post('/notify-launch', async (req, res) => {
  try {
    const { name, email, phone, category = 'both', preferredChannel = 'email', interestTags = [], source = 'storefront' } = req.body;

    const trimmedEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = normalizePhone(phone);

    if (!trimmedEmail && !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least a valid Email address or WhatsApp phone number.'
      });
    }

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address.'
        });
      }
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit mobile number.'
      });
    }

    // Build search query for idempotent upsert
    const orConditions = [];
    if (trimmedEmail) orConditions.push({ email: trimmedEmail });
    if (cleanPhone) orConditions.push({ phone: cleanPhone });

    let subscriber = await LaunchSubscriber.findOne({ $or: orConditions });

    if (subscriber) {
      // Update existing record with additional interest tags & category
      if (name && !subscriber.name) subscriber.name = name.trim();
      if (trimmedEmail && !subscriber.email) subscriber.email = trimmedEmail;
      if (cleanPhone && !subscriber.phone) subscriber.phone = cleanPhone;

      if (category !== subscriber.category) {
        subscriber.category = 'both'; // if they previously requested one and now the other
      }

      if (preferredChannel) subscriber.preferredChannel = preferredChannel;
      if (Array.isArray(interestTags) && interestTags.length > 0) {
        const mergedTags = new Set([...(subscriber.interestTags || []), ...interestTags]);
        subscriber.interestTags = Array.from(mergedTags);
      }
      if (source) subscriber.source = source;

      await subscriber.save();

      return res.status(200).json({
        success: true,
        message: "You're already on our VIP launch list! We've updated your preferences with an exclusive 15% launch privilege.",
        data: subscriber
      });
    }

    // Create new subscriber
    subscriber = await LaunchSubscriber.create({
      name: name ? String(name).trim() : '',
      email: trimmedEmail || undefined,
      phone: cleanPhone || undefined,
      category: ['utensils', 'gardening', 'both'].includes(category) ? category : 'both',
      preferredChannel: ['email', 'whatsapp', 'sms'].includes(preferredChannel) ? preferredChannel : 'email',
      interestTags: Array.isArray(interestTags) ? interestTags : [],
      source: source || 'storefront',
      ipAddress: req.ip || req.connection?.remoteAddress
    });

    res.status(201).json({
      success: true,
      message: "You're on the VIP launch list! We'll notify you first with an exclusive 15% early-bird launch privilege.",
      data: subscriber
    });
  } catch (error) {
    console.error('Launch subscriber registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to register launch notification. Please try again in a moment.'
    });
  }
});

module.exports = router;
