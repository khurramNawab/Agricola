const express = require('express');
const router = express.Router();
const Address = require('../models/Address');
const { authenticate } = require('../middleware/auth');

const REQUIRED = ['name', 'mobile', 'pincode', 'state', 'address', 'city'];

const normalizeAddressBody = (body = {}) => {
  const mobile = String(body.mobile || body.phone || '').replace(/\D/g, '').slice(-10);
  const rawType = String(body.type || body.addressType || 'Home').trim().toLowerCase();
  const type = rawType === 'office' ? 'Office' : 'Home';

  return {
    name: String(body.name || '').trim(),
    mobile,
    pincode: String(body.pincode || '').trim(),
    state: String(body.state || '').trim(),
    house: String(body.house || body.addressLine2 || '').trim(),
    address: String(body.address || body.street || '').trim(),
    locality: String(body.locality || body.landmark || '').trim(),
    city: String(body.city || '').trim(),
    type,
    isDefault: body.isDefault === true
  };
};

const validatePayload = (normalized) => {
  const missing = REQUIRED.filter((f) => !normalized[f] || String(normalized[f]).trim() === '');
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!/^[6-9][0-9]{9}$/.test(normalized.mobile)) return 'Enter a valid 10-digit Indian mobile number';
  if (!/^[1-9][0-9]{5}$/.test(normalized.pincode)) return 'Enter a valid 6-digit pincode';
  return null;
};

// @desc    List saved addresses
// @route   GET /api/v1/addresses
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, updatedAt: -1 });
    res.status(200).json({ success: true, data: addresses.map((a) => a.toApi()) });
  } catch (error) {
    console.error('List addresses error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch addresses' } });
  }
});

// @desc    Save a new address
// @route   POST /api/v1/addresses
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const norm = normalizeAddressBody(req.body);
    const err = validatePayload(norm);
    if (err) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err } });
    }

    const count = await Address.countDocuments({ user: req.user._id });
    const isDefault = norm.isDefault || count === 0;

    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const address = await Address.create({
      user: req.user._id,
      name: norm.name,
      mobile: norm.mobile,
      pincode: norm.pincode,
      state: norm.state,
      house: norm.house,
      address: norm.address,
      locality: norm.locality,
      city: norm.city,
      type: norm.type,
      isDefault
    });

    res.status(201).json({ success: true, data: address.toApi(), message: 'Address saved' });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save address' } });
  }
});

// @desc    Edit an address
// @route   PUT /api/v1/addresses/:id
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
    if (!address) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
    }

    const fields = ['name', 'mobile', 'pincode', 'state', 'house', 'address', 'locality', 'city', 'type'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) address[f] = req.body[f];
    });

    if (req.body.isDefault === true) {
      await Address.updateMany({ user: req.user._id, _id: { $ne: address._id } }, { isDefault: false });
      address.isDefault = true;
    }

    await address.save();
    res.status(200).json({ success: true, data: address.toApi(), message: 'Address updated' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: messages.join(', ') } });
    }
    console.error('Update address error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update address' } });
  }
});

// @desc    Delete an address
// @route   DELETE /api/v1/addresses/:id
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!address) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
    }

    // Promote another address to default if we removed the default one
    if (address.isDefault) {
      const next = await Address.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete address' } });
  }
});

module.exports = router;
