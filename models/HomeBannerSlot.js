const mongoose = require('mongoose');

const homeBannerSlotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  },
  slotNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
    validate: {
      validator: Number.isInteger,
      message: 'Slot number must be an integer between 1 and 6'
    }
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  image: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  link: {
    type: String,
    required: true,
    trim: true
  },
  buttonText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 15
  },
  viewCount: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
homeBannerSlotSchema.index({ userId: 1, isActive: 1 });
homeBannerSlotSchema.index({ publishedAdId: 1 });
homeBannerSlotSchema.index({ isActive: 1, publishedAt: -1 });
homeBannerSlotSchema.index({ slotNumber: 1, isActive: 1 });

// Unique constraint: Only one active banner per slot number
homeBannerSlotSchema.index(
  { slotNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'unique_active_slot'
  }
);

module.exports = mongoose.model('HomeBannerSlot', homeBannerSlotSchema);

