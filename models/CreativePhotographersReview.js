const mongoose = require('mongoose');

const creativePhotographersReviewSchema = new mongoose.Schema({
  photographerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreativePhotographers',
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

// Compound index to ensure one active review per user per photographer
creativePhotographersReviewSchema.index(
  { photographerId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Index for efficient queries
creativePhotographersReviewSchema.index({ photographerId: 1, createdAt: -1 });
creativePhotographersReviewSchema.index({ userId: 1, createdAt: -1 });
creativePhotographersReviewSchema.index({ rating: -1 });

// Post-save middleware to update photographer average rating
creativePhotographersReviewSchema.post('save', async function() {
  const CreativePhotographers = mongoose.model('CreativePhotographers');
  const photographer = await CreativePhotographers.findById(this.photographerId);
  if (photographer) {
    await photographer.updateAverageRating();
  }
});

// Post-remove middleware to update photographer average rating
creativePhotographersReviewSchema.post('remove', async function() {
  const CreativePhotographers = mongoose.model('CreativePhotographers');
  const photographer = await CreativePhotographers.findById(this.photographerId);
  if (photographer) {
    await photographer.updateAverageRating();
  }
});

// Post-findOneAndDelete middleware to update photographer average rating
creativePhotographersReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const CreativePhotographers = mongoose.model('CreativePhotographers');
    const photographer = await CreativePhotographers.findById(doc.photographerId);
    if (photographer) {
      await photographer.updateAverageRating();
    }
  }
});

module.exports = mongoose.model('CreativePhotographersReview', creativePhotographersReviewSchema);

