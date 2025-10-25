const mongoose = require('mongoose');

const tourGuiderReviewSchema = new mongoose.Schema({
  tourGuiderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourGuider',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isActive: {
    type: Boolean,
    default: true
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure one active review per user per tour guide
tourGuiderReviewSchema.index(
  { tourGuiderId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Index for sorting by rating and date
tourGuiderReviewSchema.index({ tourGuiderId: 1, createdAt: -1 });

module.exports = mongoose.model('TourGuiderReview', tourGuiderReviewSchema);

