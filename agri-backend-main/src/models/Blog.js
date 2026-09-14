const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    slug: {
      type: String,
      required: [true, 'Blog slug is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    excerpt: {
      type: String,
      required: [true, 'Short excerpt is required'],
      trim: true,
      maxlength: [400, 'Excerpt cannot exceed 400 characters']
    },
    content: {
      type: String,
      required: [true, 'Blog content is required']
    },
    coverImage: {
      type: String,
      default: ''
    },
    author: {
      name: { type: String, default: 'Agricola Team' },
      avatar: { type: String, default: '' },
      role: { type: String, default: 'Editorial Team' }
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'General'
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },
    readTime: {
      type: String,
      default: '3 min read'
    },
    viewCount: {
      type: Number,
      default: 0
    },
    featured: {
      type: Boolean,
      default: false
    },
    publishedAt: {
      type: Date,
      default: null
    },
    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      focusKeyword: { type: String, default: '' },
      canonicalUrl: { type: String, default: '' }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast searching and filtering
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

module.exports = mongoose.model('Blog', blogSchema);
