const mongoose = require('mongoose');

const membershipConfigSchema = new mongoose.Schema({
  monthlyCharge: {
    type: Number,
    required: true,
    default: 2500 // LKR
  },
  yearlyCharge: {
    type: Number,
    required: true,
    default: 25000 // LKR
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  features: {
    type: [String],
    default: [
      'Member badge for advertisements',
      'All published ads show in Featured Ads',
      'HSD (Diamond) given Random chance increase',
      'Your advertisements suggest for more customers',
      'Priority customer support',
      'Enhanced visibility for all listings'
    ]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true,
    default: 'admin'
  }
}, {
  timestamps: true
});

// Ensure only one active configuration exists
membershipConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

const membershipTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  membershipType: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  amount: {
    type: Number,
    required: true // Amount in LKR
  },
  hscAmount: {
    type: Number,
    required: true // Amount deducted in HSC
  },
  hscValue: {
    type: Number,
    required: true // HSC to LKR conversion rate at time of purchase
  },
  startDate: {
    type: Date,
    required: true
  },
  expirationDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  transactionId: {
    type: String,
    unique: true
  },
  paymentMethod: {
    type: String,
    default: 'HSC'
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
membershipTransactionSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `MEM_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  next();
});

// Index for efficient queries
membershipTransactionSchema.index({ userId: 1, createdAt: -1 });
membershipTransactionSchema.index({ status: 1 });
membershipTransactionSchema.index({ expirationDate: 1 });
membershipTransactionSchema.index({ transactionId: 1 });

const MembershipConfig = mongoose.model('MembershipConfig', membershipConfigSchema);
const MembershipTransaction = mongoose.model('MembershipTransaction', membershipTransactionSchema);

module.exports = {
  MembershipConfig,
  MembershipTransaction
};
