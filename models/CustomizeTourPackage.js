const mongoose = require('mongoose');

const customizeTourPackageSchema = new mongoose.Schema({
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Personal Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Travel Details
  startDate: {
    type: Date,
    required: true
  },
  numberOfTravelers: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // Number of days
  },
  
  // Accommodation Preference
  accommodation: {
    type: String,
    required: true,
    enum: ['budget', 'comfort', 'luxury', 'villas-boutique', 'other']
  },
  accommodationOther: {
    type: String,
    trim: true
  },
  
  // Activities & Interests (Multiple selection)
  activities: [{
    type: String,
    trim: true
  }],
  
  // Special Requests/Description
  specialRequests: {
    type: String,
    trim: true
  },
  
  // Request Status
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'rejected', 'show-partners'],
    default: 'pending'
  },

  // Partner Information (when status is 'show-partners')
  partnerApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  partnerApprovedAt: {
    type: Date
  },
  partnerEmail: {
    type: String,
    trim: true
  },
  
  // HSC Charge Information
  hscCharge: {
    type: Number,
    required: true
  },
  
  // Payment Information
  paymentStatus: {
    type: String,
    enum: ['completed', 'failed', 'refunded'],
    default: 'completed'
  },
  paymentActivityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentActivity'
  },
  
  // Admin Response
  adminNote: {
    type: String,
    trim: true
  },
  processedBy: {
    type: String,
    trim: true
  },
  processedAt: {
    type: Date
  },
  
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
customizeTourPackageSchema.index({ userId: 1, createdAt: -1 });
customizeTourPackageSchema.index({ status: 1, createdAt: -1 });
customizeTourPackageSchema.index({ email: 1 });

module.exports = mongoose.model('CustomizeTourPackage', customizeTourPackageSchema);

