const mongoose = require('mongoose');

const cryptoConsultingSignalsSchema = new mongoose.Schema({
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
  
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Courses', 'Consultants'],
    required: true
  },
  specialist: [{
    type: String,
    required: true,
    trim: true
  }],
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Pricing
  charges: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Location
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
  
  // Service Type
  online: {
    type: Boolean,
    default: false
  },
  physical: {
    type: Boolean,
    default: false
  },
  
  // Includes
  includes: [{
    type: String,
    trim: true
  }],
  
  // Media
  image: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  
  // Contact Information
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },

  // Social Media & Documents (Optional)
  facebook: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  coursesPDF: {
    url: {
      type: String
    },
    publicId: {
      type: String
    }
  },
  
  // Engagement Metrics
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

  // Reviews
  reviews: [{
    user: {
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
    comment: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status
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

// Indexes for better query performance
cryptoConsultingSignalsSchema.index({ userId: 1 });
cryptoConsultingSignalsSchema.index({ publishedAdId: 1 });
cryptoConsultingSignalsSchema.index({ type: 1 });
cryptoConsultingSignalsSchema.index({ category: 1 });
cryptoConsultingSignalsSchema.index({ province: 1, city: 1 });
cryptoConsultingSignalsSchema.index({ isActive: 1, publishedAt: -1 });

module.exports = mongoose.model('CryptoConsultingSignals', cryptoConsultingSignalsSchema);

