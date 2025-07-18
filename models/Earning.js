const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
  buyerEmail: {
    type: String,
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    default: 'Promo Codes'
  },
  amount: {
    type: Number,
    required: true // Amount in LKR
  },
  usedPromoCode: {
    type: String,
    required: true,
    uppercase: true
  },
  usedPromoCodeOwner: {
    type: String,
    required: true // Email of the promo code owner
  },
  usedPromoCodeOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  item: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  processedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
earningSchema.index({ usedPromoCodeOwner: 1 });
earningSchema.index({ buyerEmail: 1 });
earningSchema.index({ usedPromoCode: 1 });
earningSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Earning', earningSchema);
