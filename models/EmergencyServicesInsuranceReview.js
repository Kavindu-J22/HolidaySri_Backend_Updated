const mongoose = require('mongoose');

const emergencyServicesInsuranceReviewSchema = new mongoose.Schema({
  emergencyServicesInsuranceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmergencyServicesInsurance',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reviews from same user
emergencyServicesInsuranceReviewSchema.index({ emergencyServicesInsuranceId: 1, userId: 1 }, { unique: true });

// Index for sorting by date
emergencyServicesInsuranceReviewSchema.index({ createdAt: -1 });

// Index for filtering active reviews
emergencyServicesInsuranceReviewSchema.index({ isActive: 1, createdAt: -1 });

// Method to increment helpful count
emergencyServicesInsuranceReviewSchema.methods.incrementHelpfulCount = function() {
  this.helpfulCount += 1;
  return this.save();
};

// Method to increment report count
emergencyServicesInsuranceReviewSchema.methods.incrementReportCount = function() {
  this.reportCount += 1;
  return this.save();
};

// Static method to calculate average rating for a profile
emergencyServicesInsuranceReviewSchema.statics.calculateAverageRating = async function(emergencyServicesInsuranceId) {
  const result = await this.aggregate([
    {
      $match: {
        emergencyServicesInsuranceId: mongoose.Types.ObjectId(emergencyServicesInsuranceId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { averageRating: 0, totalReviews: 0 };
};

module.exports = mongoose.model('EmergencyServicesInsuranceReview', emergencyServicesInsuranceReviewSchema);

