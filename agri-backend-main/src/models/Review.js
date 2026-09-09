const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Display-name snapshot so reviews keep their author even if the user changes their name.
    name: { type: String, default: 'Anonymous', trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    // Approved by default; flip to a moderation queue later if needed.
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved'
    },
    verifiedPurchase: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// One review per user per product (POST upserts on this key).
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Recompute and persist a product's aggregate rating from its approved reviews.
reviewSchema.statics.recalcProductRating = async function (productId) {
  const Product = mongoose.model('Product');
  const agg = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: { _id: '$product', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const average = agg[0] ? Math.round(agg[0].average * 10) / 10 : 0;
  const count = agg[0] ? agg[0].count : 0;
  await Product.findByIdAndUpdate(productId, {
    'rating.average': average,
    'rating.count': count
  });
  return { average, count };
};

reviewSchema.methods.toApi = function () {
  return {
    id: String(this._id),
    name: this.name || 'Anonymous',
    rating: this.rating,
    title: this.title || '',
    comment: this.comment,
    verifiedPurchase: !!this.verifiedPurchase,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Review', reviewSchema);
