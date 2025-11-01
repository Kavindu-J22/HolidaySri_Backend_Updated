const mongoose = require('mongoose');

const creativePhotographersSchema = new mongoose.Schema({
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
    maxlength: 200,
    description: 'e.g., "Fashion & Commercial Photography"'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Fashion Photography"'
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
  includes: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Concept development", "Studio setup", "Professional lighting"'
  }],
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
    match: [/^\+?[0-9\s\-\(\)]{7,20}$/, 'Please enter a valid contact number']
  },
  available: {
    type: Boolean,
    default: true
  },
  social: {
    facebook: {
      type: String,
      trim: true,
      default: null
    },
    instagram: {
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
  packages: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    }
  },
  availability: {
    weekdays: {
      type: String,
      trim: true,
      description: 'e.g., "10:00 AM - 5:00 PM"'
    },
    weekends: {
      type: String,
      trim: true,
      description: 'e.g., "By appointment"'
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CreativePhotographers', creativePhotographersSchema);

