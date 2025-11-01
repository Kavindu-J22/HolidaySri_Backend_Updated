const mongoose = require('mongoose');

const decoratorsFloristsReviewSchema = new mongoose.Schema({
  decoratorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DecoratorsFlorists',
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
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
decoratorsFloristsReviewSchema.index({ decoratorId: 1 });
decoratorsFloristsReviewSchema.index({ userId: 1 });
decoratorsFloristsReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DecoratorsFloristsReview', decoratorsFloristsReviewSchema);

