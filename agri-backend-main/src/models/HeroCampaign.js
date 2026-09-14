const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, 'Slide image URL is required']
    },
    title: {
      type: String,
      required: [true, 'Slide title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    ctaText: {
      type: String,
      default: 'Shop Products',
      trim: true
    },
    ctaLink: {
      type: String,
      default: '/products',
      trim: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: true }
);

const heroCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true
    },
    festivalType: {
      type: String,
      enum: [
        'diwali',
        'durga_puja',
        'chhath',
        'eid',
        'christmas',
        'republic_day',
        'independence_day',
        'holi',
        'new_year',
        'seasonal',
        'other'
      ],
      default: 'other'
    },
    slides: {
      type: [heroSlideSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'Campaign must have at least one hero slide'
      }
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0
    },
    couponCode: {
      type: String,
      trim: true,
      default: ''
    },
    videoModule: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      title: {
        type: String,
        trim: true
      },
      subtitle: {
        type: String,
        trim: true
      },
      videoType: {
        type: String,
        enum: ['upload', 'url', 'youtube'],
        default: 'url'
      },
      videoUrl: {
        type: String,
        trim: true
      },
      autoplay: {
        type: Boolean,
        default: false
      },
      muted: {
        type: Boolean,
        default: true
      },
      loop: {
        type: Boolean,
        default: true
      },
      position: {
        type: String,
        enum: ['hero_banner', 'standalone_section'],
        default: 'hero_banner'
      }
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

heroCampaignSchema.index({ isActive: 1, startDate: 1, endDate: 1, priority: -1 });

module.exports = mongoose.model('HeroCampaign', heroCampaignSchema);
