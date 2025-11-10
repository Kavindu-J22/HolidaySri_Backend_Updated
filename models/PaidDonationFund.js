const mongoose = require('mongoose');

const paidDonationFundSchema = new mongoose.Schema({
  // Campaign Information
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DonationsRaiseFund',
    required: true
  },
  campaignTitle: {
    type: String,
    required: true
  },
  organizer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  
  // User/Owner Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userContact: {
    type: String,
    required: true
  },
  
  // Bank Details
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountHolderName: String,
    branchName: String
  },
  
  // Fund Details
  requestedAmountLKR: {
    type: Number,
    required: true
  },
  requestedAmountHSC: {
    type: Number,
    required: true
  },
  raisedAmountHSC: {
    type: Number,
    required: true
  },
  raisedAmountLKR: {
    type: Number,
    required: true
  },
  
  // Withdrawal Request Details
  withdrawalRequestedAt: {
    type: Date,
    required: true
  },
  withdrawalApprovedAt: {
    type: Date,
    required: true
  },
  adminNote: {
    type: String,
    default: ''
  },
  
  // Payment Details
  paidAt: {
    type: Date,
    default: Date.now
  },
  paidBy: {
    type: String, // Admin username
    required: true
  },
  paymentNote: {
    type: String,
    default: ''
  },
  
  // Advertisement Details (for record keeping)
  advertisementId: {
    type: String,
    required: true
  },
  advertisementSlot: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
paidDonationFundSchema.index({ userId: 1 });
paidDonationFundSchema.index({ paidAt: -1 });
paidDonationFundSchema.index({ campaignId: 1 });

module.exports = mongoose.model('PaidDonationFund', paidDonationFundSchema);

