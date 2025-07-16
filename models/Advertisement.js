const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['hotel', 'guide', 'vehicle', 'restaurant', 'other'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  images: [{
    url: String,
    alt: String
  }],
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    website: String,
    whatsapp: String
  },
  pricing: {
    currency: {
      type: String,
      default: 'LKR'
    },
    priceRange: {
      min: Number,
      max: Number
    },
    priceDescription: String
  },
  features: [{
    type: String
  }],
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    availableHours: {
      open: String,
      close: String
    }
  },
  hscCost: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number, // Duration in days
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'rejected'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  views: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPromoted: {
    type: Boolean,
    default: false
  },
  promotionExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for search functionality
advertisementSchema.index({ title: 'text', description: 'text' });
advertisementSchema.index({ category: 1, status: 1 });
advertisementSchema.index({ 'location.city': 1, 'location.district': 1 });
advertisementSchema.index({ userId: 1 });

// Calculate expiry date before saving
advertisementSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'active' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + (this.duration * 24 * 60 * 60 * 1000));
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Advertisement', advertisementSchema);
