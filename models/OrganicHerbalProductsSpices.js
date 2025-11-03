const mongoose = require('mongoose');

const organicHerbalProductsSpicesSchema = new mongoose.Schema({
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
    enum: ['Organic & Handpicked', 'Certified Organic', 'Fair Trade', 'Premium Selection', 'Bulk Wholesale'],
    description: 'Type of specialization'
  },
  category: {
    type: String,
    required: true,
    enum: ['Spices', 'Herbs', 'Tea & Infusions', 'Dried Fruits', 'Seeds & Nuts', 'Powders & Blends'],
    description: 'Product category'
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
  paymentMethods: [{
    type: String,
    enum: ['cash', 'card', 'koko', 'bank_transfer', 'online_payment'],
    required: true
  }],
  deliveryAvailable: {
    type: Boolean,
    default: false
  },
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
  website: {
    type: String,
    trim: true,
    default: null
  },
  available: {
    type: Boolean,
    default: true
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

// Indexes for optimal performance
organicHerbalProductsSpicesSchema.index({ userId: 1 });
organicHerbalProductsSpicesSchema.index({ publishedAdId: 1 });
organicHerbalProductsSpicesSchema.index({ 'location.province': 1, 'location.city': 1 });
organicHerbalProductsSpicesSchema.index({ category: 1 });
organicHerbalProductsSpicesSchema.index({ specialization: 1 });
organicHerbalProductsSpicesSchema.index({ isActive: 1 });

module.exports = mongoose.model('OrganicHerbalProductsSpices', organicHerbalProductsSpicesSchema);

