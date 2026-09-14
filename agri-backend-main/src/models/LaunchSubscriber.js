const mongoose = require('mongoose');

const launchSubscriberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true
    },
    phone: {
      type: String,
      trim: true,
      sparse: true
    },
    category: {
      type: String,
      enum: ['utensils', 'gardening', 'both'],
      default: 'both'
    },
    preferredChannel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      default: 'email'
    },
    interestTags: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      default: 'storefront'
    },
    isNotified: {
      type: Boolean,
      default: false
    },
    notifiedAt: {
      type: Date
    },
    ipAddress: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

launchSubscriberSchema.index({ email: 1, category: 1 });
launchSubscriberSchema.index({ phone: 1, category: 1 });
launchSubscriberSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LaunchSubscriber', launchSubscriberSchema);
