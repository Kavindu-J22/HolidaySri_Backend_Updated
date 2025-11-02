const mongoose = require('mongoose');

const educationalTutoringSchema = new mongoose.Schema({
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
  specialization: [{
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  }],
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., University Level, High School, Primary School'
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
    description: 'Phone or Email - supports all formats and countries'
  },
  available: {
    type: Boolean,
    default: true
  },
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
  availability: {
    weekdays: {
      type: String,
      trim: true,
      description: 'e.g., 4:00 PM - 8:00 PM'
    },
    weekends: {
      type: String,
      trim: true,
      description: 'e.g., 9:00 AM - 6:00 PM'
    }
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

// Index for better query performance
educationalTutoringSchema.index({ userId: 1 });
educationalTutoringSchema.index({ publishedAdId: 1 });
educationalTutoringSchema.index({ 'location.province': 1, 'location.city': 1 });
educationalTutoringSchema.index({ category: 1 });
educationalTutoringSchema.index({ isActive: 1 });

module.exports = mongoose.model('EducationalTutoring', educationalTutoringSchema);

