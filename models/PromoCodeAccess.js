const mongoose = require('mongoose');

const promoCodeAccessSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Each user can only have one access record
  },
  userEmail: {
    type: String,
    required: true
  },
  hasAccess: {
    type: Boolean,
    default: false
  },
  accessType: {
    type: String,
    enum: ['agent', 'paid'], // 'agent' for free access, 'paid' for one-time payment
    required: function() {
      return this.hasAccess;
    }
  },
  paidAmount: {
    type: Number,
    default: 0 // HSC amount paid for access
  },
  paymentDate: {
    type: Date
  },
  paymentTransactionId: {
    type: String // Reference to PaymentActivity transaction
  },
  // Favorites system
  favoritePromoCodes: [{
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true
    },
    promoCode: {
      type: String,
      required: true,
      uppercase: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
promoCodeAccessSchema.index({ userId: 1 });
promoCodeAccessSchema.index({ userEmail: 1 });
promoCodeAccessSchema.index({ hasAccess: 1 });
promoCodeAccessSchema.index({ 'favoritePromoCodes.agentId': 1 });

// Method to add favorite promo code
promoCodeAccessSchema.methods.addFavorite = function(agentId, promoCode) {
  // Check if already in favorites
  const existingFavorite = this.favoritePromoCodes.find(
    fav => fav.agentId.toString() === agentId.toString()
  );
  
  if (!existingFavorite) {
    this.favoritePromoCodes.push({
      agentId,
      promoCode: promoCode.toUpperCase(),
      addedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to remove favorite promo code
promoCodeAccessSchema.methods.removeFavorite = function(agentId) {
  this.favoritePromoCodes = this.favoritePromoCodes.filter(
    fav => fav.agentId.toString() !== agentId.toString()
  );
  
  return this.save();
};

// Method to check if promo code is in favorites
promoCodeAccessSchema.methods.isFavorite = function(agentId) {
  return this.favoritePromoCodes.some(
    fav => fav.agentId.toString() === agentId.toString()
  );
};

module.exports = mongoose.model('PromoCodeAccess', promoCodeAccessSchema);
