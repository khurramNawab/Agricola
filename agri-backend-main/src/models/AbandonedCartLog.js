const mongoose = require('mongoose');

const abandonedCartLogSchema = new mongoose.Schema(
  {
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipientName: {
      type: String,
      default: 'Customer'
    },
    recipientPhone: {
      type: String
    },
    recipientEmail: {
      type: String
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'multi'],
      required: true
    },
    subject: {
      type: String
    },
    messageContent: {
      type: String,
      required: true
    },
    couponCode: {
      type: String
    },
    cartValue: {
      type: Number,
      default: 0
    },
    itemNames: [
      {
        type: String
      }
    ],
    status: {
      type: String,
      enum: ['sent', 'failed', 'mocked', 'ready_to_send', 'skipped'],
      default: 'sent'
    },
    errorDetails: {
      type: String
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

abandonedCartLogSchema.index({ user: 1, createdAt: -1 });
abandonedCartLogSchema.index({ sentAt: -1 });

module.exports = mongoose.model('AbandonedCartLog', abandonedCartLogSchema);
