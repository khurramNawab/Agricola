const mongoose = require('mongoose');

// Saved delivery address. Field names mirror AddressModal.tsx / Checkout.tsx.
const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: { type: String, required: [true, 'Name is required'], trim: true },
  mobile: {
    type: String,
    required: [true, 'Mobile is required'],
    match: [/^[6-9][0-9]{9}$/, 'Enter a valid 10-digit Indian mobile number']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode']
  },
  state: { type: String, required: [true, 'State is required'], trim: true },
  house: { type: String, trim: true, default: '' },
  address: { type: String, required: [true, 'Address is required'], trim: true },
  locality: { type: String, trim: true, default: '' },
  city: { type: String, required: [true, 'City is required'], trim: true },
  type: {
    type: String,
    enum: ['Home', 'Office'],
    default: 'Home'
  },
  isDefault: { type: Boolean, default: false }
}, {
  timestamps: true
});

addressSchema.methods.toApi = function () {
  return {
    id: String(this._id),
    name: this.name,
    mobile: this.mobile,
    pincode: this.pincode,
    state: this.state,
    house: this.house,
    address: this.address,
    locality: this.locality,
    city: this.city,
    type: this.type,
    isDefault: this.isDefault
  };
};

module.exports = mongoose.model('Address', addressSchema);
