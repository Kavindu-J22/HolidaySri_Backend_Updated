const mongoose = require('mongoose');

const rentPropertyBuyingSellingSchema = new mongoose.Schema({
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
  
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'e.g., Luxury Villa in Colombo 7'
  },
  type: {
    type: String,
    required: true,
    enum: ['Rent', 'Buy', 'Sell'],
    description: 'Property transaction type'
  },
  category: {
    type: String,
    required: true,
    enum: ['House', 'Apartment', 'Land', 'Commercial', 'Office', 'Shop', 'Warehouse', 'Other'],
    description: 'Property category'
  },
  condition: {
    type: String,
    required: true,
    enum: ['New', 'Pre-Used', 'Under Construction'],
    description: 'Property condition'
  },
  
  // Property Details
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price in LKR'
  },
  urgent: {
    type: Boolean,
    default: false,
    description: 'Mark as urgent listing'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
    description: 'Detailed property description'
  },
  specialFeatures: [{
    type: String,
    enum: [
      'Swimming Pool',
      'Garden',
      'Parking',
      'Security',
      'Furnished',
      'AC',
      'Generator',
      'Smart Home'
    ]
  }],
  
  // Location
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
  
  // Contact Information
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number - supports all formats and countries'
  },
  
  // Images
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    alt: String
  }],
  
  // Status and Metadata
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
  
  // Reviews
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries
rentPropertyBuyingSellingSchema.index({ userId: 1 });
rentPropertyBuyingSellingSchema.index({ 'location.province': 1, 'location.city': 1 });
rentPropertyBuyingSellingSchema.index({ type: 1 });
rentPropertyBuyingSellingSchema.index({ category: 1 });
rentPropertyBuyingSellingSchema.index({ isActive: 1 });

module.exports = mongoose.model('RentPropertyBuyingSelling', rentPropertyBuyingSellingSchema);

