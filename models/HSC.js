const mongoose = require('mongoose');

const hscConfigSchema = new mongoose.Schema({
  hscValue: {
    type: Number,
    required: true,
    default: 100 // 1 HSC = 100 LKR by default
  },
  hsgValue: {
    type: Number,
    required: true,
    default: 1 // 1 HSG = 1 LKR by default
  },
  hsdValue: {
    type: Number,
    required: true,
    default: 1 // 1 HSD = 1 LKR by default
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const hscTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tokenType: {
    type: String,
    enum: ['HSC', 'HSG', 'HSD'],
    required: true,
    default: 'HSC'
  },
  type: {
    type: String,
    enum: ['purchase', 'spend', 'refund', 'bonus', 'gift'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'admin_credit'],
    required: function() {
      return this.type === 'purchase';
    }
  },
  paymentDetails: {
    transactionId: String,
    cardLast4: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    }
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  relatedAdvertisement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement'
  }
}, {
  timestamps: true
});

const hscPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  hscAmount: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  discount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String
  },
  features: [{
    type: String
  }]
}, {
  timestamps: true
});

const HSCConfig = mongoose.model('HSCConfig', hscConfigSchema);
const HSCTransaction = mongoose.model('HSCTransaction', hscTransactionSchema);
const HSCPackage = mongoose.model('HSCPackage', hscPackageSchema);

module.exports = {
  HSCConfig,
  HSCTransaction,
  HSCPackage
};
