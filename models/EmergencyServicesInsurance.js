const mongoose = require('mongoose');

const emergencyServicesInsuranceSchema = new mongoose.Schema({
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
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Comprehensive Travel, Medical Insurance, Emergency Response, etc.'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Contact number - any type and any country allowed'
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
  website: {
    type: String,
    trim: true,
    default: ''
  },
  facebook: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  includes: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
    description: 'e.g., Medical, Trip Cancellation, Baggage'
  },
  logo: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  specialOffers: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
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

// Indexes for efficient queries
emergencyServicesInsuranceSchema.index({ userId: 1 });
emergencyServicesInsuranceSchema.index({ publishedAdId: 1 });
emergencyServicesInsuranceSchema.index({ city: 1, province: 1 });
emergencyServicesInsuranceSchema.index({ category: 1 });
emergencyServicesInsuranceSchema.index({ isActive: 1, publishedAt: -1 });

// Method to increment view count
emergencyServicesInsuranceSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment contact count
emergencyServicesInsuranceSchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

module.exports = mongoose.model('EmergencyServicesInsurance', emergencyServicesInsuranceSchema);

