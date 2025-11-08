const mongoose = require('mongoose');

const eventsUpdatesSchema = new mongoose.Schema({
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
  // Event Details
  eventName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  categoryType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 3000
  },
  // Location
  city: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  eventLocation: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  mapLink: {
    type: String,
    trim: true
  },
  // Date and Time
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    trim: true
  },
  // Pricing
  ticketPrice: {
    type: String,
    required: true,
    trim: true
  },
  ticketsAvailable: {
    type: Boolean,
    default: true
  },
  // Contact Information
  contact: {
    type: String,
    required: true,
    trim: true
  },
  organizer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  // Social Media & Website
  facebook: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  // Additional Features
  includes: [{
    type: String,
    trim: true
  }],
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
      default: 'Event image'
    }
  }],
  featured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  // Engagement metrics
  viewCount: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
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
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Method to calculate average rating
eventsUpdatesSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = (sum / this.reviews.length).toFixed(1);
    this.totalReviews = this.reviews.length;
  }
};

// Indexes for better query performance
eventsUpdatesSchema.index({ userId: 1 });
eventsUpdatesSchema.index({ publishedAdId: 1 });
eventsUpdatesSchema.index({ province: 1, city: 1 });
eventsUpdatesSchema.index({ categoryType: 1 });
eventsUpdatesSchema.index({ date: 1 });
eventsUpdatesSchema.index({ featured: 1 });
eventsUpdatesSchema.index({ isActive: 1 });

module.exports = mongoose.model('EventsUpdates', eventsUpdatesSchema);

