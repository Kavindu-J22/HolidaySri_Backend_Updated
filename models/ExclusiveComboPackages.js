const mongoose = require('mongoose');

const exclusiveComboPackagesSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'e.g., Cultural Triangle Expedition'
  },
  categoryType: {
    type: String,
    required: true,
    trim: true,
    description: 'e.g., Cultural, Adventure, Beach, Mountain, Wildlife, etc.'
  },
  locations: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
    description: 'e.g., Anuradhapura, Polonnaruwa, Sigiriya'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
  days: {
    type: Number,
    required: true,
    min: 1,
    description: 'Number of days in the package'
  },
  pax: {
    type: String,
    required: true,
    trim: true,
    description: 'e.g., 2-6 or 1-4'
  },
  activities: [{
    type: String,
    trim: true,
    maxlength: 200,
    description: 'e.g., Temple Visits, Historical Sites, Local Cuisine'
  }],
  includes: [{
    type: String,
    trim: true,
    maxlength: 200,
    description: 'e.g., Accommodation, Meals, Entrance Fees'
  }],
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price in LKR'
  },
  provider: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    avatar: {
      url: {
        type: String,
        required: true
      },
      publicId: {
        type: String,
        required: true
      }
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
    contact: {
      type: String,
      required: true,
      trim: true,
      description: 'Phone/WhatsApp - supports all formats and countries'
    }
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

// Indexes for better query performance
exclusiveComboPackagesSchema.index({ userId: 1 });
exclusiveComboPackagesSchema.index({ publishedAdId: 1 });
exclusiveComboPackagesSchema.index({ categoryType: 1 });
exclusiveComboPackagesSchema.index({ isActive: 1 });

module.exports = mongoose.model('ExclusiveComboPackages', exclusiveComboPackagesSchema);

