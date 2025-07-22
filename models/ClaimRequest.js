const mongoose = require('mongoose');

const claimRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  earningIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Earning',
    required: true
  }],
  totalAmount: {
    type: Number,
    required: true
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
claimRequestSchema.index({ userId: 1 });
claimRequestSchema.index({ userEmail: 1 });
claimRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ClaimRequest', claimRequestSchema);
