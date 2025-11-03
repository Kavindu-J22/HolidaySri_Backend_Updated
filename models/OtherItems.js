const mongoose = require('mongoose');

const otherItemsSchema = new mongoose.Schema({
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
    maxlength: 200,
    description: 'e.g., Ergonomic design with multiple compartments'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Bags & Luggage'
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
  paymentMethods: {
    type: [String],
    enum: ['cash', 'cards', 'COD'],
    required: true,
    description: 'Array of accepted payment methods'
  },
  delivery: {
    type: Boolean,
    default: false,
    description: 'Whether delivery is available'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number or any contact method (any type and any countries allowed)'
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  facebook: {
    type: String,
    trim: true,
    default: ''
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  }],
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
  },
  // Reviews and ratings
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    review: {
      type: String,
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

module.exports = mongoose.model('OtherItems', otherItemsSchema);

