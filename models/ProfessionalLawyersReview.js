const mongoose = require('mongoose');

const professionalLawyersReviewSchema = new mongoose.Schema({
  professionalLawyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProfessionalLawyers',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userAvatar: {
    type: String,
    default: null
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
  isVerifiedClient: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
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

// Index for efficient queries
professionalLawyersReviewSchema.index({ professionalLawyerId: 1 });
professionalLawyersReviewSchema.index({ userId: 1 });
professionalLawyersReviewSchema.index({ rating: 1 });

module.exports = mongoose.model('ProfessionalLawyersReview', professionalLawyersReviewSchema);

