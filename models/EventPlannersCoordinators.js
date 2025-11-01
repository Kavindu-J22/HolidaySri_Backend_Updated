const mongoose = require('mongoose');

const eventPlannersCoordinatorsSchema = new mongoose.Schema({
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
    type: [String],
    required: true,
    description: 'e.g., Weddings, Corporate Events, Birthday Parties, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Event Planner & Day Coordinator'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
    description: 'Phone number - supports all formats and countries'
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
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
  available: {
    type: Boolean,
    default: true
  },
  weekdayAvailability: {
    type: String,
    trim: true,
    description: 'e.g., 9:00 AM - 5:00 PM or 24/7 or On request'
  },
  weekendAvailability: {
    type: String,
    trim: true,
    description: 'e.g., 10:00 AM - 2:00 PM or 24/7 or On request'
  },
  packages: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    fileName: {
      type: String,
      default: null
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

// Index for search functionality
eventPlannersCoordinatorsSchema.index({ name: 1, city: 1, province: 1 });
eventPlannersCoordinatorsSchema.index({ userId: 1 });
eventPlannersCoordinatorsSchema.index({ publishedAdId: 1 });

module.exports = mongoose.model('EventPlannersCoordinators', eventPlannersCoordinatorsSchema);

