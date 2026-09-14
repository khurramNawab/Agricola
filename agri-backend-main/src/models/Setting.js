const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_config'
    },
    storeName: {
      type: String,
      default: 'AgriCola Organics'
    },
    supportEmail: {
      type: String,
      default: 'support@agricola.co.in'
    },
    supportPhone: {
      type: String,
      default: '+91 9012659000'
    },
    supportWhatsApp: {
      type: String,
      default: '+91 9012659000'
    },
    businessHours: {
      type: String,
      default: 'Mon - Sat: 9:00 AM - 7:00 PM IST'
    },
    storeAddress: {
      type: String,
      default: 'AgriCola Headquarters, Corporate Center, Patna, Bihar - 800001'
    },
    enableMultiWarehouse: {
      type: Boolean,
      default: true
    },
    defaultCarrier: {
      type: String,
      enum: ['both', 'ekart', 'shiprocket'],
      default: 'both'
    },
    freeShippingThreshold: {
      type: Number,
      default: 999
    },
    standardDeliveryCharge: {
      type: Number,
      default: 50
    },
    enableWhatsAppNotifications: {
      type: Boolean,
      default: true
    },
    enableEmailNotifications: {
      type: Boolean,
      default: true
    },
    enableCod: {
      type: Boolean,
      default: true
    },
    maxCodAmount: {
      type: Number,
      default: 49999
    },
    allowCouponStacking: {
      type: Boolean,
      default: false
    },
    maxStackedCoupons: {
      type: Number,
      default: 2,
      min: 1,
      max: 3
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Setting', settingSchema);
