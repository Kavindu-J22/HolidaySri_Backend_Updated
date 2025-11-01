const mongoose = require('mongoose');

const professionalDriversReviewSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProfessionalDrivers',
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
  isActive: {
    type: Boolean,
    default: true
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
professionalDriversReviewSchema.index({ profileId: 1 });
professionalDriversReviewSchema.index({ userId: 1 });
professionalDriversReviewSchema.index({ profileId: 1, isActive: 1 });

module.exports = mongoose.model('ProfessionalDriversReview', professionalDriversReviewSchema);

