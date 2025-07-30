const mongoose = require('mongoose');

const commercialPartnerConfigSchema = new mongoose.Schema({
  monthlyCharge: {
    type: Number,
    required: true,
    default: 5000 // LKR
  },
  yearlyCharge: {
    type: Number,
    required: true,
    default: 50000 // LKR
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  features: {
    type: [String],
    default: [
      'Partner badge for advertisements',
      'All Published ads shows in Featured Ads',
      'All Published ads shows in Premium Listings',
      'HSD (Diamond) given Random chance increase',
      'Your advertisements suggest for more customers',
      'Can access to Customize Travel Requests',
      'Can Access to Customize Event Requests',
      'Priority customer support',
      'Enhanced business visibility',
      'Advanced analytics and insights'
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

// Ensure only one active config exists
commercialPartnerConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

const commercialPartnerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  businessType: {
    type: String,
    required: true,
    enum: ['Tourism Agency', 'Event Planning Company', 'Advertising Agency', 'Other'],
    default: 'Other'
  },
  businessLogo: {
    type: String, // Cloudinary URL
    required: true
  },
  documents: {
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
  partnershipType: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  amount: {
    type: Number,
    required: true // Amount paid in LKR
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
    required: true,
    default: Date.now
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
  isActive: {
    type: Boolean,
    default: true
  },
  transactionId: {
    type: String,
    unique: true
  },
  paymentMethod: {
    type: String,
    default: 'HSC'
  },
  // Email tracking fields for expiration management
  expirationWarningEmailSent: {
    type: Boolean,
    default: false
  },
  expiredNotificationEmailSent: {
    type: Boolean,
    default: false
  },
  // Renewal tracking
  renewalCount: {
    type: Number,
    default: 0
  },
  lastRenewalDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
commercialPartnerSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `CP_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  next();
});

// Calculate expiration date based on partnership type
commercialPartnerSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('partnershipType') || this.isModified('startDate')) {
    const startDate = this.startDate || new Date();
    if (this.partnershipType === 'yearly') {
      this.expirationDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
    } else if (this.partnershipType === 'monthly') {
      this.expirationDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
    }
  }
  next();
});

// Index for efficient queries
commercialPartnerSchema.index({ userId: 1 });
commercialPartnerSchema.index({ status: 1 });
commercialPartnerSchema.index({ expirationDate: 1 });
commercialPartnerSchema.index({ transactionId: 1 });
commercialPartnerSchema.index({ isActive: 1 });

const CommercialPartnerConfig = mongoose.model('CommercialPartnerConfig', commercialPartnerConfigSchema);
const CommercialPartner = mongoose.model('CommercialPartner', commercialPartnerSchema);

module.exports = {
  CommercialPartnerConfig,
  CommercialPartner
};
