const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  promoCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  promoCodeType: {
    type: String,
    enum: ['silver', 'gold', 'diamond', 'free'],
    required: true
  },
  usedPromoCode: {
    type: String,
    uppercase: true
  },
  usedPromoCodeOwner: {
    type: String // Email of the promo code owner
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expirationDate: {
    type: Date,
    required: true,
    default: function() {
      // Set expiration to one year from now
      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      return oneYear;
    }
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  usedCount: {
    type: Number,
    default: 0 // How many times this promo code has been successfully used for discounts
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationDocuments: {
    nicFront: {
      type: String // Cloudinary URL
    },
    nicBack: {
      type: String // Cloudinary URL
    },
    passport: {
      type: String // Cloudinary URL
    }
  },
  verificationSubmittedAt: {
    type: Date
  },
  verificationCompletedAt: {
    type: Date
  },
  verificationNotes: {
    type: String // Admin notes for verification
  },
  // Email tracking fields for expiration management
  expirationWarningEmailSent: {
    type: Boolean,
    default: false
  },
  expiredNotificationEmailSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
agentSchema.index({ promoCode: 1 });
agentSchema.index({ userId: 1 });
agentSchema.index({ email: 1 });
agentSchema.index({ isActive: 1, expirationDate: 1 });

module.exports = mongoose.model('Agent', agentSchema);
