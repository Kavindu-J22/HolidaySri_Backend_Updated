const mongoose = require('mongoose');

const exclusiveGiftPacksSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'e.g., Relaxation Package, Luxury Package, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Wellness, Romance, Adventure, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price in LKR'
  },
  available: {
    type: Boolean,
    default: true
  },
  includes: [{
    type: String,
    trim: true,
    maxlength: 200,
    description: 'e.g., Aromatic oils, Bath salts, Scented candles, etc.'
  }],
  location: {
    province: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    }
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number - supports all formats and countries'
  },
  facebook: {
    type: String,
    trim: true,
    default: null
  },
  website: {
    type: String,
    trim: true,
    default: null
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  viewCount: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
exclusiveGiftPacksSchema.index({ userId: 1 });
exclusiveGiftPacksSchema.index({ publishedAdId: 1 });
exclusiveGiftPacksSchema.index({ 'location.province': 1, 'location.city': 1 });
exclusiveGiftPacksSchema.index({ specialization: 1 });
exclusiveGiftPacksSchema.index({ category: 1 });
exclusiveGiftPacksSchema.index({ isActive: 1 });

module.exports = mongoose.model('ExclusiveGiftPacks', exclusiveGiftPacksSchema);

