const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Warehouse code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Warehouse display name is required'],
    trim: true
  },
  shiprocketPickupNickname: {
    type: String,
    trim: true,
    default: ''
  },
  ekartPickupAlias: {
    type: String,
    trim: true,
    default: ''
  },
  ekartGstin: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    street: { type: String, required: [true, 'Street address is required'], trim: true },
    city: { type: String, required: [true, 'City is required'], trim: true },
    state: { type: String, required: [true, 'State is required'], trim: true },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      match: [/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian pincode']
    },
    phone: { type: String, trim: true }
  },
  spocName: { type: String, trim: true, default: '' },
  spocPhone: { type: String, trim: true, default: '' },
  isDefault: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  climateControl: {
    type: String,
    trim: true,
    default: '18°C Cold Sealed'
  },
  sameDayCutoff: {
    type: String,
    trim: true,
    default: '4:00 PM Same-Day Cutoff'
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
