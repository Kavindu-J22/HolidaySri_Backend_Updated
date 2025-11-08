const mongoose = require('mongoose');

const customizeEventRequestSchema = new mongoose.Schema({
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
  
  // Event Details
  eventType: {
    type: String,
    required: true,
    enum: ['wedding', 'corporate-party', 'birthday', 'conference', 'concert', 'other']
  },
  eventTypeOther: {
    type: String,
    trim: true
  },
  numberOfGuests: {
    type: Number,
    required: true,
    min: 1
  },
  estimatedBudget: {
    type: String,
    required: true,
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
    enum: ['pending', 'under-review', 'approved', 'rejected', 'show-partners-members', 'open-acceptance'],
    default: 'pending'
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

  // Partner/Member Approval
  partnerApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  partnerApprovedEmail: {
    type: String,
    trim: true
  },
  partnerApprovedAt: {
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
customizeEventRequestSchema.index({ userId: 1, createdAt: -1 });
customizeEventRequestSchema.index({ status: 1, createdAt: -1 });
customizeEventRequestSchema.index({ email: 1 });

module.exports = mongoose.model('CustomizeEventRequest', customizeEventRequestSchema);

