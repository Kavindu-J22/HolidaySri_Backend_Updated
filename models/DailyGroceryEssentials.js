const mongoose = require('mongoose');

const dailyGroceryEssentialsSchema = new mongoose.Schema({
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
    maxlength: 100,
    description: 'e.g., Fresh & Organic, Locally Sourced, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Fruits, Vegetables, Dairy, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price in LKR'
  },
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
  paymentMethods: [{
    type: String,
    enum: ['cash', 'cards', 'koko'],
    required: true
  }],
  deliveryAvailable: {
    type: Boolean,
    default: false
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
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: 'Discount percentage'
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
  available: {
    type: Boolean,
    default: true
  },
  mapLink: {
    type: String,
    trim: true,
    default: null,
    description: 'Google Maps link'
  },
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

module.exports = mongoose.model('DailyGroceryEssentials', dailyGroceryEssentialsSchema);

