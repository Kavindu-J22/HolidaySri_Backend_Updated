const mongoose = require('mongoose');

const foodsBeveragesSchema = new mongoose.Schema({
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
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Bakery, Cafe, Juice Bar, etc.'
  },
  type: [{
    type: String,
    enum: ['Vegetarian', 'Vegan Options', 'Gluten-Free Options'],
    required: true
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
  contact: {
    phone: {
      type: String,
      required: true,
      trim: true,
      description: 'Phone number - supports all formats and countries'
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    facebook: {
      type: String,
      trim: true,
      default: null
    },
    whatsapp: {
      type: String,
      trim: true,
      default: null
    }
  },
  delivery: {
    type: Boolean,
    default: false
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

// Indexes for optimal performance
foodsBeveragesSchema.index({ userId: 1 });
foodsBeveragesSchema.index({ publishedAdId: 1 });
foodsBeveragesSchema.index({ 'location.province': 1, 'location.city': 1 });
foodsBeveragesSchema.index({ category: 1 });
foodsBeveragesSchema.index({ isActive: 1 });

module.exports = mongoose.model('FoodsBeverages', foodsBeveragesSchema);

