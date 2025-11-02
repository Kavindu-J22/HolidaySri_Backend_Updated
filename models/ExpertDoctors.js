const mongoose = require('mongoose');

const expertDoctorsSchema = new mongoose.Schema({
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
    maxlength: 100,
    description: 'e.g., Neurologist, Cardiologist, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Brain & Nerve Specialist, Heart Specialist, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  experienceYears: {
    type: Number,
    required: true,
    min: 0,
    max: 70
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
    type: String,
    required: true,
    trim: true,
    description: 'Phone number or email - any format and country allowed'
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
  available: {
    type: Boolean,
    default: true
  },
  availability: {
    weekdays: {
      type: [String],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      default: []
    },
    weekends: {
      type: [String],
      enum: ['Sat', 'Sun'],
      default: []
    },
    times: {
      type: [String],
      default: [],
      description: 'e.g., ["8:00 AM - 11:00 AM", "4:00 PM - 7:00 PM"]'
    }
  },
  socialLinks: {
    facebook: {
      type: String,
      trim: true,
      default: null
    },
    website: {
      type: String,
      trim: true,
      default: null
    }
  },
  engagement: {
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

// Indexes for efficient queries
expertDoctorsSchema.index({ userId: 1 });
expertDoctorsSchema.index({ publishedAdId: 1 });
expertDoctorsSchema.index({ 'location.province': 1 });
expertDoctorsSchema.index({ 'location.city': 1 });
expertDoctorsSchema.index({ specialization: 1 });
expertDoctorsSchema.index({ category: 1 });
expertDoctorsSchema.index({ isActive: 1, publishedAt: -1 });

module.exports = mongoose.model('ExpertDoctors', expertDoctorsSchema);

