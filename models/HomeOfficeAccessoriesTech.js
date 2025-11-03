const mongoose = require('mongoose');

const homeOfficeAccessoriesTechSchema = new mongoose.Schema({
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
    maxlength: 150,
    description: 'Product/Business name'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Home Office, Tech Gadgets, Accessories, etc.'
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Professionals, Retailers, Wholesalers, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    description: 'Detailed product/service description'
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
    default: true,
    description: 'Product/service availability status'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number or any contact method (any country allowed)'
  },
  website: {
    type: String,
    trim: true,
    default: '',
    description: 'Optional website URL'
  },
  facebook: {
    type: String,
    trim: true,
    default: '',
    description: 'Optional Facebook profile URL'
  },
  paymentMethods: {
    type: [String],
    enum: ['card', 'koko', 'cod', 'cash'],
    default: [],
    description: 'Accepted payment methods'
  },
  deliveryAvailable: {
    type: Boolean,
    default: false,
    description: 'Whether delivery service is available'
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

module.exports = mongoose.model('HomeOfficeAccessoriesTech', homeOfficeAccessoriesTechSchema);

