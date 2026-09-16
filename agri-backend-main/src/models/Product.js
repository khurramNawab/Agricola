const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  compareAtPrice: {
    type: Number,
    min: [0, 'Compare at price cannot be negative']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  subcategory: {
    type: String,
    trim: true
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    publicId: String // Cloudinary public ID for deletion
  }],
  video: {
    url: String,
    publicId: String
  },
  videoUrl: {
    type: String,
    trim: true
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb'],
      default: 'kg'
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch'],
      default: 'cm'
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock'],
    default: 'active'
  },
  tags: [String],
  // Storefront-facing content fields (consumed by ProductDetail.tsx)
  sizes: [String], // e.g. ["250g", "500g", "1kg"]
  variantStocks: [{
    size: {
      type: String,
      required: true
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Variant stock cannot be negative']
    },
    price: {
      type: Number,
      min: [0, 'Variant price cannot be negative']
    }
  }],
  about: {
    type: String,
    maxlength: [5000, 'About cannot exceed 5000 characters']
  },
  usageInstructions: {
    type: String,
    maxlength: [5000, 'Usage instructions cannot exceed 5000 characters']
  },
  whyChoose: {
    type: String,
    maxlength: [5000, 'Why-choose cannot exceed 5000 characters']
  },
  newlyAdded: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  variants: [{
    name: String, // e.g., "Size", "Color"
    options: [String] // e.g., ["Small", "Medium", "Large"]
  }],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    servingSize: String
  },
  origin: {
    country: String,
    region: String,
    farm: String
  },
  certifications: [String], // e.g., ["Organic", "Fair Trade"]
  shelfLife: {
    duration: Number,
    unit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'months'
    }
  },
  // Admin-controlled organic status — shown as a badge on the storefront.
  // Default: true (organic-focused store). Existing products without this field
  // will serialize as Organic (p.isOrganic !== false = true). A backfill migration
  // is optional; see audit report for the one-liner.
  isOrganic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate product ID before validation using an atomic counter
productSchema.pre('validate', async function(next) {
  if (!this.productId) {
    const Counter = require('./Counter');
    let counter = await Counter.findOne({ _id: 'productId' });
    if (!counter) {
      const existing = await mongoose.model('Product')
        .find({ productId: /^P\d+$/ })
        .select('productId')
        .lean();
      const maxNum = existing.reduce(
        (max, doc) => Math.max(max, parseInt(doc.productId.slice(1), 10) || 0),
        0
      );
      await Counter.updateOne(
        { _id: 'productId' },
        { $setOnInsert: { seq: maxNum } },
        { upsert: true }
      );
    }
    counter = await Counter.findOneAndUpdate(
      { _id: 'productId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.productId = `P${String(counter.seq).padStart(3, '0')}`;
  }
  next();
});

// Update stock status based on quantity
productSchema.pre('save', function(next) {
  if (this.stock <= 0 && this.status === 'active') {
    this.status = 'out_of_stock';
  } else if (this.stock > 0 && this.status === 'out_of_stock') {
    this.status = 'active';
  }
  next();
});

// Text search index
productSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text'
});

// Compound indexes for common queries
productSchema.index({ category: 1, status: 1, featured: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ featured: -1, 'rating.average': -1 });

module.exports = mongoose.model('Product', productSchema);