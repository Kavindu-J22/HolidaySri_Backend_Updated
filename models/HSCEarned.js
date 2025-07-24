const mongoose = require('mongoose');

const hscEarnedSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  earnedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['Promocode Sold', 'Referral Bonus', 'Advertisement Revenue', 'Other']
  },
  itemDetails: {
    promoCode: {
      type: String,
      required: true
    },
    promoCodeType: {
      type: String,
      required: true,
      enum: ['silver', 'gold', 'diamond']
    },
    sellingPrice: {
      type: Number,
      required: true
    },
    sellingPriceLKR: {
      type: Number,
      required: true
    }
  },
  buyerDetails: {
    buyerName: {
      type: String,
      required: true
    },
    buyerEmail: {
      type: String,
      required: true
    },
    purchaseDate: {
      type: Date,
      default: Date.now
    }
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
hscEarnedSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
hscEarnedSchema.index({ userId: 1, createdAt: -1 });
hscEarnedSchema.index({ buyerUserId: 1, createdAt: -1 });
hscEarnedSchema.index({ category: 1 });
hscEarnedSchema.index({ transactionId: 1 });

const HSCEarned = mongoose.model('HSCEarned', hscEarnedSchema);

module.exports = HSCEarned;
