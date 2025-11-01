const mongoose = require('mongoose');

const salonMakeupArtistsSchema = new mongoose.Schema({
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
    description: 'e.g., Bridal Makeup & Hair, Party Makeup, etc.'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Premium Salon, Budget Salon, etc.'
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
  includes: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., Makeup, Hair Styling, Nails, Consultation'
  }],
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
  website: {
    type: String,
    trim: true,
    default: null
  },
  available: {
    type: Boolean,
    default: true
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
  }]
}, {
  timestamps: true
});

// Index for search functionality
salonMakeupArtistsSchema.index({ userId: 1 });
salonMakeupArtistsSchema.index({ publishedAdId: 1 });
salonMakeupArtistsSchema.index({ 'location.province': 1, 'location.city': 1 });
salonMakeupArtistsSchema.index({ specialization: 1 });
salonMakeupArtistsSchema.index({ category: 1 });
salonMakeupArtistsSchema.index({ isActive: 1 });

module.exports = mongoose.model('SalonMakeupArtists', salonMakeupArtistsSchema);

