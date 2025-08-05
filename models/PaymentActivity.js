const mongoose = require('mongoose');

const paymentActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyerEmail: {
    type: String,
    required: true
  },
  item: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  category: {
    type: String,
    required: true,
    enum: ['Promo Codes', 'Membership', 'HSC Purchase', 'Advertisement', 'Advertisement Fee - Selling Promocode', 'Commercial Partnership', 'Access Fee', 'Promo Code Renewal', 'Promocode', 'Promotion Fee'],
    default: 'Promo Codes'
  },
  originalAmount: {
    type: Number,
    required: true // Original amount in HSC
  },
  amount: {
    type: Number,
    required: true // Final amount paid in HSC
  },
  discountedAmount: {
    type: Number,
    default: 0 // Discount amount in HSC
  },
  promoCode: {
    type: String,
    uppercase: true // The promo code used for discount (if any)
  },
  promoCodeOwner: {
    type: String // Email of the promo code owner
  },
  promoCodeOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  forEarns: {
    type: Number,
    default: 0 // Earning value in LKR for the promo code owner
  },
  purchasedPromoCode: {
    type: String,
    uppercase: true // The promo code that was purchased
  },
  purchasedPromoCodeType: {
    type: String,
    enum: ['silver', 'gold', 'diamond', 'free']
  },
  // Membership specific fields
  membershipType: {
    type: String,
    enum: ['monthly', 'yearly']
  },
  membershipStartDate: {
    type: Date
  },
  membershipExpirationDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    default: 'HSC'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  transactionId: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
paymentActivitySchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  next();
});

// Index for efficient queries
paymentActivitySchema.index({ userId: 1, createdAt: -1 });
paymentActivitySchema.index({ buyerEmail: 1 });
paymentActivitySchema.index({ promoCodeOwner: 1 });
paymentActivitySchema.index({ status: 1 });
paymentActivitySchema.index({ transactionId: 1 });

module.exports = mongoose.model('PaymentActivity', paymentActivitySchema);
