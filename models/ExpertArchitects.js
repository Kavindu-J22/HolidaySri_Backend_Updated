const mongoose = require('mongoose');

const expertArchitectsSchema = new mongoose.Schema({
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
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Interior Architecture, Landscape Architecture, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Retail Spaces, Residential, Commercial, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  experience: {
    type: Number,
    required: true,
    min: 0,
    max: 70,
    description: 'Years of experience'
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
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number or contact information (any type and any countries allowed)'
  },
  available: {
    type: Boolean,
    default: true
  },
  availability: {
    weekdays: {
      type: String,
      default: '',
      description: 'e.g., "9:00 AM - 6:00 PM"'
    },
    weekends: {
      type: String,
      default: '',
      description: 'e.g., "11:00 AM - 3:00 PM"'
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
      default: 'Portfolio image'
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

module.exports = mongoose.model('ExpertArchitects', expertArchitectsSchema);

