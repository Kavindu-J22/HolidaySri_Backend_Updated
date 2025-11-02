const mongoose = require('mongoose');

const petCareAnimalServicesReviewSchema = new mongoose.Schema({
  petCareProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetCareAnimalServices',
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
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure one active review per user per pet care profile
petCareAnimalServicesReviewSchema.index(
  { petCareProfileId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Index for fetching reviews by profile
petCareAnimalServicesReviewSchema.index({ petCareProfileId: 1, isActive: 1 });

module.exports = mongoose.model('PetCareAnimalServicesReview', petCareAnimalServicesReviewSchema);

