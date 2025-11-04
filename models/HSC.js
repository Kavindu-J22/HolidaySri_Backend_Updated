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
  // Customize Tour Package Request Charge (HSC)
  customizeTourPackageCharge: {
    type: Number,
    required: true,
    default: 100 // HSC - charge for submitting customize tour package request
  },
  // Selling advertisement fee
  sellAdFee: {
    type: Number,
    required: true,
    default: 100 // HSC
  },
  // Access Promo Code View page amount (HSC) - one-time payment for non-agents
  accessPromoCodeViewAmount: {
    type: Number,
    required: true,
    default: 50 // HSC - one-time payment to access promo code viewing page
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
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
hscTransactionSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `HSC_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  next();
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

// Promo Code Configuration Schema
const promoCodeConfigSchema = new mongoose.Schema({
  // Promo Code Types and their settings
  silver: {
    price: {
      type: Number,
      required: true,
      default: 8000 // LKR
    },
    discountRate: {
      type: Number,
      default: 0 // Percentage
    },
    earningForPurchase: {
      type: Number,
      required: true,
      default: 500 // LKR
    },
    earningForMonthlyAd: {
      type: Number,
      required: true,
      default: 1000 // LKR
    },
    earningForDailyAd: {
      type: Number,
      required: true,
      default: 100 // LKR
    },
    earningForHourlyAd: {
      type: Number,
      required: true,
      default: 50 // LKR for 1 hour
    },
    earningForYearlyAd: {
      type: Number,
      required: true,
      default: 12000 // LKR
    }
  },
  gold: {
    price: {
      type: Number,
      required: true,
      default: 15000 // LKR
    },
    discountRate: {
      type: Number,
      default: 0 // Percentage
    },
    earningForPurchase: {
      type: Number,
      required: true,
      default: 1000 // LKR
    },
    earningForMonthlyAd: {
      type: Number,
      required: true,
      default: 2000 // LKR
    },
    earningForDailyAd: {
      type: Number,
      required: true,
      default: 200 // LKR
    },
    earningForHourlyAd: {
      type: Number,
      required: true,
      default: 100 // LKR for 1 hour
    },
    earningForYearlyAd: {
      type: Number,
      required: true,
      default: 24000 // LKR
    }
  },
  diamond: {
    price: {
      type: Number,
      required: true,
      default: 25000 // LKR
    },
    discountRate: {
      type: Number,
      default: 0 // Percentage
    },
    earningForPurchase: {
      type: Number,
      required: true,
      default: 2000 // LKR
    },
    earningForMonthlyAd: {
      type: Number,
      required: true,
      default: 3000 // LKR
    },
    earningForDailyAd: {
      type: Number,
      required: true,
      default: 300 // LKR
    },
    earningForHourlyAd: {
      type: Number,
      required: true,
      default: 150 // LKR for 1 hour
    },
    earningForYearlyAd: {
      type: Number,
      required: true,
      default: 36000 // LKR
    }
  },
  free: {
    price: {
      type: Number,
      required: true,
      default: 0 // Always 0 LKR
    },
    discountRate: {
      type: Number,
      default: 0 // Percentage
    },
    earningForPurchase: {
      type: Number,
      required: true,
      default: 0 // LKR
    },
    earningForMonthlyAd: {
      type: Number,
      required: true,
      default: 50 // LKR
    },
    earningForDailyAd: {
      type: Number,
      required: true,
      default: 10 // LKR
    },
    earningForHourlyAd: {
      type: Number,
      required: true,
      default: 5 // LKR for 1 hour
    },
    earningForYearlyAd: {
      type: Number,
      required: true,
      default: 600 // LKR
    }
  },
  // Global discount settings (same for all types)
  discounts: {
    monthlyAdDiscount: {
      type: Number,
      required: true,
      default: 500 // LKR
    },
    dailyAdDiscount: {
      type: Number,
      required: true,
      default: 50 // LKR
    },
    hourlyAdDiscount: {
      type: Number,
      required: true,
      default: 25 // LKR
    },
    yearlyAdDiscount: {
      type: Number,
      required: true,
      default: 6000 // LKR
    },
    purchaseDiscount: {
      type: Number,
      required: true,
      default: 200 // LKR
    }
  },
  // Selling advertisement fee
  sellAdFee: {
    type: Number,
    required: true,
    default: 100 // HSC
  },
  // Access Promo Code View page amount (HSC) - one-time payment for non-agents
  accessPromoCodeViewAmount: {
    type: Number,
    required: true,
    default: 50 // HSC - one-time payment to access promo code viewing page
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

// Promo Code Transaction Schema (for tracking user purchases and usage)
const promoCodeTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  promoCodeType: {
    type: String,
    enum: ['silver', 'gold', 'diamond', 'free', 'pre-used'],
    required: true
  },
  transactionType: {
    type: String,
    enum: ['purchase', 'use_monthly_ad', 'use_daily_ad', 'use_hourly_ad', 'use_yearly_ad', 'use_purchase'],
    required: true
  },
  amount: {
    type: Number,
    required: true // Amount in LKR
  },
  hscEquivalent: {
    type: Number // HSC equivalent at time of transaction
  },
  description: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'admin_credit', 'free', 'hsc'],
    required: function() {
      return this.transactionType === 'purchase';
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
  relatedAdvertisement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement'
  },
  discountApplied: {
    type: Number,
    default: 0 // Discount amount in LKR
  }
}, {
  timestamps: true
});

const HSCConfig = mongoose.model('HSCConfig', hscConfigSchema);
const HSCTransaction = mongoose.model('HSCTransaction', hscTransactionSchema);
const HSCPackage = mongoose.model('HSCPackage', hscPackageSchema);
const PromoCodeConfig = mongoose.model('PromoCodeConfig', promoCodeConfigSchema);
const PromoCodeTransaction = mongoose.model('PromoCodeTransaction', promoCodeTransactionSchema);

module.exports = {
  HSCConfig,
  HSCTransaction,
  HSCPackage,
  PromoCodeConfig,
  PromoCodeTransaction
};
