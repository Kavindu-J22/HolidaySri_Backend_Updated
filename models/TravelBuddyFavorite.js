const mongoose = require('mongoose');

const travelBuddyFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  travelBuddyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelBuddy',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one favorite per user per travel buddy
travelBuddyFavoriteSchema.index({ userId: 1, travelBuddyId: 1 }, { unique: true });

// Index for efficient queries
travelBuddyFavoriteSchema.index({ userId: 1, createdAt: -1 });
travelBuddyFavoriteSchema.index({ travelBuddyId: 1 });

module.exports = mongoose.model('TravelBuddyFavorite', travelBuddyFavoriteSchema);
