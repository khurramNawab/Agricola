const mongoose = require('mongoose');

const redemptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    orderId: {
      type: String
    },
    discountAmount: {
      type: Number,
      required: true
    },
    redeemedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [30, 'Coupon code cannot exceed 30 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat', 'fixed'],
      default: 'percentage',
      required: true
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1']
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative']
    },
    maxDiscountCap: {
      type: Number,
      default: null,
      min: [1, 'Maximum discount cap must be at least 1']
    },
    validFrom: {
      type: Date,
      default: Date.now
    },
    validTo: {
      type: Date,
      required: [true, 'Expiration date is required']
    },
    totalUsageLimit: {
      type: Number,
      default: null,
      min: [1, 'Total usage limit must be at least 1']
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per-user limit must be at least 1']
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    firstOrderOnly: {
      type: Boolean,
      default: false
    },
    isFestivalOffer: {
      type: Boolean,
      default: false
    },
    allowStacking: {
      type: Boolean,
      default: true
    },
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    redemptions: [redemptionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast lookup
couponSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
