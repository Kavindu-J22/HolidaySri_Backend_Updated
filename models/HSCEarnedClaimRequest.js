const mongoose = require('mongoose');

const hscEarnedClaimRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  hscEarnedIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSCEarned',
    required: true
  }],
  claimType: {
    type: String,
    enum: ['HSC', 'LKR'],
    required: true
  },
  totalHSCAmount: {
    type: Number,
    required: true
  },
  totalLKRAmount: {
    type: Number,
    required: true
  },
  hscToLKRRate: {
    type: Number,
    required: true // HSC value at time of claim
  },
  bankDetails: {
    bank: String,
    branch: String,
    accountNo: String,
    accountName: String,
    postalCode: String,
    binanceId: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String
  },
  processedBy: {
    type: String // Admin email who processed the request
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
hscEarnedClaimRequestSchema.index({ userId: 1 });
hscEarnedClaimRequestSchema.index({ userEmail: 1 });
hscEarnedClaimRequestSchema.index({ status: 1, createdAt: -1 });
hscEarnedClaimRequestSchema.index({ claimType: 1 });

module.exports = mongoose.model('HSCEarnedClaimRequest', hscEarnedClaimRequestSchema);
