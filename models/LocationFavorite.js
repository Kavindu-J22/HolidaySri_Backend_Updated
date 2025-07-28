const mongoose = require('mongoose');

const locationFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one favorite per user per location
locationFavoriteSchema.index({ userId: 1, locationId: 1 }, { unique: true });

// Index for efficient queries
locationFavoriteSchema.index({ userId: 1, createdAt: -1 });
locationFavoriteSchema.index({ locationId: 1 });

module.exports = mongoose.model('LocationFavorite', locationFavoriteSchema);
