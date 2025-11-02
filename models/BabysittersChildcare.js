const mongoose = require('mongoose');

const babysittersChildcareSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Full-time Babysitter, Part-time Nanny, Daycare Provider, etc.'
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
    description: 'Phone number or any contact method (supports all formats and countries)'
  },
  available: {
    type: Boolean,
    default: true
  },
  includes: {
    type: [String],
    default: [],
    description: 'e.g., ["Meal Preparation", "Homework Help", "Bedtime Routine"]'
  },
  facebook: {
    type: String,
    trim: true,
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  availability: {
    weekdays: {
      type: String,
      default: '',
      description: 'e.g., "3:00 PM - 8:00 PM"'
    },
    weekends: {
      type: String,
      default: '',
      description: 'e.g., "8:00 AM - 8:00 PM"'
    }
  },
  images: {
    type: [
      {
        url: {
          type: String,
          required: true
        },
        publicId: {
          type: String,
          required: true
        }
      }
    ],
    default: [],
    description: 'Array of uploaded images (max 4)'
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
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BabysittersChildcare', babysittersChildcareSchema);

