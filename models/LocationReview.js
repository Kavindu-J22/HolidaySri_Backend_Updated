const mongoose = require('mongoose');

const locationReviewSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
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
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    }
  }],
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

// Compound index to ensure one active review per user per location
locationReviewSchema.index(
  { locationId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Index for efficient queries
locationReviewSchema.index({ locationId: 1, createdAt: -1 });
locationReviewSchema.index({ userId: 1, createdAt: -1 });
locationReviewSchema.index({ rating: -1 });

// Post-save middleware to update location average rating
locationReviewSchema.post('save', async function() {
  const Location = mongoose.model('Location');
  const location = await Location.findById(this.locationId);
  if (location) {
    await location.updateAverageRating();
  }
});

// Post-remove middleware to update location average rating
locationReviewSchema.post('remove', async function() {
  const Location = mongoose.model('Location');
  const location = await Location.findById(this.locationId);
  if (location) {
    await location.updateAverageRating();
  }
});

// Post-findOneAndDelete middleware to update location average rating
locationReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const Location = mongoose.model('Location');
    const location = await Location.findById(doc.locationId);
    if (location) {
      await location.updateAverageRating();
    }
  }
});

module.exports = mongoose.model('LocationReview', locationReviewSchema);
