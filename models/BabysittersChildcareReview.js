const mongoose = require('mongoose');

const babysittersChildcareReviewSchema = new mongoose.Schema({
  babysitterProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BabysittersChildcare',
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
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userAvatar: {
    type: String,
    default: ''
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
}, {
  timestamps: true
});

// Index for faster queries
babysittersChildcareReviewSchema.index({ babysitterProfileId: 1 });
babysittersChildcareReviewSchema.index({ userId: 1 });
babysittersChildcareReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BabysittersChildcareReview', babysittersChildcareReviewSchema);

