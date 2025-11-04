const mongoose = require('mongoose');

const localSimMobileDataReviewSchema = new mongoose.Schema({
  localSimMobileDataId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LocalSimMobileData',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reviews from same user
localSimMobileDataReviewSchema.index({ localSimMobileDataId: 1, userId: 1 }, { unique: true });

// Index for fetching active reviews
localSimMobileDataReviewSchema.index({ localSimMobileDataId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('LocalSimMobileDataReview', localSimMobileDataReviewSchema);

