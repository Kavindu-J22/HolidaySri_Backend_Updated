const mongoose = require('mongoose');

const souvenirsCollectiblesSchema = new mongoose.Schema({
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
    description: 'e.g., Traditional Art, Handicrafts, Antiques, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    description: 'e.g., Handicrafts, Antiques, Collectibles, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
    }
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
    description: 'e.g., Certificate of Authenticity, Handcrafted Wooden Box'
  }],
  website: {
    type: String,
    trim: true,
    default: null
  },
  facebook: {
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

// Indexes for optimal performance
souvenirsCollectiblesSchema.index({ userId: 1 });
souvenirsCollectiblesSchema.index({ publishedAdId: 1 });
souvenirsCollectiblesSchema.index({ 'location.province': 1, 'location.city': 1 });
souvenirsCollectiblesSchema.index({ category: 1 });
souvenirsCollectiblesSchema.index({ specialization: 1 });
souvenirsCollectiblesSchema.index({ isActive: 1 });

module.exports = mongoose.model('SouvenirsCollectibles', souvenirsCollectiblesSchema);

