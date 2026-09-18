const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Contact email captured at checkout — where order-confirmation/updates are sent.
  // Stored on the order (not forced onto the unique User.email) so it always
  // reflects what the customer entered for this order.
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: String, // Store product name at time of order
    weight: String, // Selected variant/size at time of order (e.g. "250g")
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: String, // Store primary product image
    subtotal: {
      type: Number,
      required: true
    }
  }],
  shippingAddress: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'India'
    }
  },
  billingAddress: {
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    },
    sameAsShipping: {
      type: Boolean,
      default: true
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    shipping: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    shippingWaived: {
      type: Boolean,
      default: false
    },
    originalShipping: {
      type: Number
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod', 'bank_transfer'],
    required: true
  },
  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    transactionId: String,
    paymentDate: Date,
    refundId: String,
    refundAmount: Number,
    failureReason: String
  },
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'same_day'],
      default: 'standard'
    },
    cost: {
      type: Number,
      default: 0
    },
    estimatedDelivery: Date,
    trackingNumber: String,
    // The courier actually carrying the parcel (e.g. "Xpressbees Surface") — what
    // the customer needs; `provider` records who booked it.
    carrier: String,
    shippedAt: Date,
    deliveredAt: Date,
    // Logistics provider that booked this shipment ('shiprocket' | 'ekart').
    provider: String,
    // Provider-side identifiers. Shiprocket returns both an order id (used to cancel
    // before an AWB exists) and a shipment id (used for AWB/pickup/label calls).
    providerOrderId: String,
    providerShipmentId: String,
    courierName: String,
    // Courier AWB label PDF — the one couriers require at pickup.
    labelUrl: String,
    trackingUrl: String,
    // Legacy: Ekart tracking id on orders booked before the provider switch.
    ekartShipmentId: String,
    pickupAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String
    },
    weight: {
      type: Number,
      default: 0
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  },
  notes: {
    customer: String,
    admin: String
  },
  notifications: {
    orderConfirmationEmailSentAt: Date
  },
  timeline: [{
    status: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  coupon: {
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'flat']
    }
  },
  appliedCoupons: [
    {
      code: String,
      discount: Number,
      type: {
        type: String,
        enum: ['percentage', 'fixed', 'flat']
      },
      discountValue: Number
    }
  ],
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null
  },
  awaitingWarehouseAssignment: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate order ID before validation: ORD-YYYYMMDD-XXXX (date + random suffix).
// Avoids the count-based race/collision of sequential IDs.
orderSchema.pre('validate', function(next) {
  if (!this.orderId) {
    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000); // 4 digits
    this.orderId = `ORD-${datePart}-${rand}`;
  }
  next();
});

// Calculate total before saving
orderSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.pricing.subtotal = this.items.reduce((total, item) => total + item.subtotal, 0);
  
  // Calculate final total
  this.pricing.total = this.pricing.subtotal + this.pricing.shipping + this.pricing.tax - this.pricing.discount;
  
  next();
});

// Add timeline entry when status changes
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      message: `Order status changed to ${this.status}`,
      timestamp: new Date()
    });
  }
  next();
});

// Indexes for common queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'shipping.trackingNumber': 1 });

module.exports = mongoose.model('Order', orderSchema);