const mongoose = require('mongoose');

const tokenDistributionSchema = new mongoose.Schema({
  adminUsername: {
    type: String,
    required: true
  },
  tokenType: {
    type: String,
    enum: ['HSC', 'HSG', 'HSD'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  adminMessage: {
    type: String,
    required: true,
    trim: true
  },
  recipients: [{
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
    balanceBefore: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HSCTransaction'
    }
  }],
  totalRecipients: {
    type: Number,
    required: true
  },
  totalAmountDistributed: {
    type: Number,
    required: true
  },
  distributionStatus: {
    type: String,
    enum: ['completed', 'partial', 'failed'],
    default: 'completed'
  },
  failedRecipients: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    userEmail: String,
    error: String
  }],
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
tokenDistributionSchema.index({ createdAt: -1 });
tokenDistributionSchema.index({ adminUsername: 1, createdAt: -1 });
tokenDistributionSchema.index({ tokenType: 1, createdAt: -1 });
tokenDistributionSchema.index({ 'recipients.userId': 1 });

// Virtual for success rate
tokenDistributionSchema.virtual('successRate').get(function() {
  if (this.totalRecipients === 0) return 0;
  const successfulRecipients = this.totalRecipients - (this.failedRecipients?.length || 0);
  return Math.round((successfulRecipients / this.totalRecipients) * 100);
});

// Static method to create distribution record
tokenDistributionSchema.statics.createDistribution = async function(distributionData) {
  try {
    const distribution = new this(distributionData);
    await distribution.save();
    return distribution;
  } catch (error) {
    console.error('Error creating token distribution record:', error);
    throw error;
  }
};

module.exports = mongoose.model('TokenDistribution', tokenDistributionSchema);
