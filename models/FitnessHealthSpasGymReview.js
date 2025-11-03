const mongoose = require('mongoose');

const fitnessHealthSpasGymReviewSchema = new mongoose.Schema({
  fitnessProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitnessHealthSpasGym',
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
    max: 5,
    description: 'Rating from 1 to 5 stars'
  },
  review: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    description: 'Review text'
  },
  isVerified: {
    type: Boolean,
    default: false,
    description: 'Whether the reviewer has actually used the service'
  },
  helpful: {
    type: Number,
    default: 0,
    description: 'Number of people who found this review helpful'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for queries
fitnessHealthSpasGymReviewSchema.index({ fitnessProfileId: 1 });
fitnessHealthSpasGymReviewSchema.index({ userId: 1 });
fitnessHealthSpasGymReviewSchema.index({ rating: 1 });
fitnessHealthSpasGymReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FitnessHealthSpasGymReview', fitnessHealthSpasGymReviewSchema);

