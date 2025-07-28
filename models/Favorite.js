const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Destination',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one favorite per user per destination
favoriteSchema.index({ userId: 1, destinationId: 1 }, { unique: true });

// Index for efficient queries
favoriteSchema.index({ userId: 1, createdAt: -1 });
favoriteSchema.index({ destinationId: 1 });

module.exports = mongoose.model('Favorite', favoriteSchema);
