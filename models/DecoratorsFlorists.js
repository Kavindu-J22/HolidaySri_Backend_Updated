const mongoose = require('mongoose');

const decoratorsFloristsSchema = new mongoose.Schema({
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
    maxlength: 100
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Floral Arrangements", "Wedding Decorations", etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Florist", "Decorator", "Event Decorator", etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  experience: {
    type: Number,
    required: true,
    min: 0,
    max: 70,
    description: 'Years of experience'
  },
  includes: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Wedding bouquets", "Event centerpieces", "Custom arrangements", "Delivery"'
  }],
  city: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number - supports all formats and countries'
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  available: {
    type: Boolean,
    default: true
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
  // Engagement metrics
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
  }
}, {
  timestamps: true
});

// Index for search functionality
decoratorsFloristsSchema.index({ name: 1, city: 1, province: 1 });
decoratorsFloristsSchema.index({ userId: 1 });
decoratorsFloristsSchema.index({ publishedAdId: 1 });

module.exports = mongoose.model('DecoratorsFlorists', decoratorsFloristsSchema);

