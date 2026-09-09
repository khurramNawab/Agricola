const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    trim: true,
    default: '',
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  // Email is required for password-based (admin/legacy) accounts but optional
  // for storefront OTP accounts. Sparse unique allows multiple docs without email.
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  // Optional: only set on password-based accounts.
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  // Phone is the primary identifier for OTP login. Stored as +91XXXXXXXXXX.
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    sparse: true,
    match: [/^\+91[0-9]{10}$/, 'Please enter a valid Indian phone number']
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'banned', 'inactive'],
    default: 'active'
  },
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  orders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  lastLogin: Date
}, {
  timestamps: true
});

// Generate user ID before validation (required field must exist pre-validate)
userSchema.pre('validate', async function(next) {
  if (!this.userId) {
    const count = await mongoose.model('User').countDocuments();
    this.userId = `U${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method (returns false for OTP-only accounts with no password)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Minimal profile used by storefront OTP auth responses
userSchema.methods.getStorefrontProfile = function() {
  return {
    id: this._id,
    userId: this.userId,
    name: this.name || '',
    phone: this.phone,
    email: this.email || null
  };
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.emailVerificationToken;
  return user;
};

module.exports = mongoose.model('User', userSchema);