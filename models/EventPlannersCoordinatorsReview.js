const mongoose = require('mongoose');

const eventPlannersCoordinatorsReviewSchema = new mongoose.Schema({
  eventPlannerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EventPlannersCoordinators',
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
});

// Index for faster queries
eventPlannersCoordinatorsReviewSchema.index({ eventPlannerId: 1 });
eventPlannersCoordinatorsReviewSchema.index({ userId: 1 });
eventPlannersCoordinatorsReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EventPlannersCoordinatorsReview', eventPlannersCoordinatorsReviewSchema);

