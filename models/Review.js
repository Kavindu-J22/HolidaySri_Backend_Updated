const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Destination',
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

// Compound index to ensure one review per user per destination
reviewSchema.index({ destinationId: 1, userId: 1 }, { unique: true });

// Index for efficient queries
reviewSchema.index({ destinationId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ rating: -1 });

// Post-save middleware to update destination average rating
reviewSchema.post('save', async function() {
  const Destination = mongoose.model('Destination');
  const destination = await Destination.findById(this.destinationId);
  if (destination) {
    await destination.updateAverageRating();
  }
});

// Post-remove middleware to update destination average rating
reviewSchema.post('remove', async function() {
  const Destination = mongoose.model('Destination');
  const destination = await Destination.findById(this.destinationId);
  if (destination) {
    await destination.updateAverageRating();
  }
});

// Post-findOneAndDelete middleware to update destination average rating
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const Destination = mongoose.model('Destination');
    const destination = await Destination.findById(doc.destinationId);
    if (destination) {
      await destination.updateAverageRating();
    }
  }
});

module.exports = mongoose.model('Review', reviewSchema);
