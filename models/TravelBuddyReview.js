const mongoose = require('mongoose');

const travelBuddyReviewSchema = new mongoose.Schema({
  travelBuddyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelBuddy',
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

// Compound index to ensure one review per user per travel buddy
travelBuddyReviewSchema.index({ travelBuddyId: 1, userId: 1 }, { unique: true });

// Index for efficient queries
travelBuddyReviewSchema.index({ travelBuddyId: 1, createdAt: -1 });
travelBuddyReviewSchema.index({ userId: 1, createdAt: -1 });
travelBuddyReviewSchema.index({ rating: -1 });

// Post-save middleware to update travel buddy average rating
travelBuddyReviewSchema.post('save', async function() {
  const TravelBuddy = mongoose.model('TravelBuddy');
  const travelBuddy = await TravelBuddy.findById(this.travelBuddyId);
  if (travelBuddy) {
    await travelBuddy.updateAverageRating();
  }
});

// Post-remove middleware to update travel buddy average rating
travelBuddyReviewSchema.post('remove', async function() {
  const TravelBuddy = mongoose.model('TravelBuddy');
  const travelBuddy = await TravelBuddy.findById(this.travelBuddyId);
  if (travelBuddy) {
    await travelBuddy.updateAverageRating();
  }
});

// Post-findOneAndDelete middleware to update travel buddy average rating
travelBuddyReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const TravelBuddy = mongoose.model('TravelBuddy');
    const travelBuddy = await TravelBuddy.findById(doc.travelBuddyId);
    if (travelBuddy) {
      await travelBuddy.updateAverageRating();
    }
  }
});

module.exports = mongoose.model('TravelBuddyReview', travelBuddyReviewSchema);
