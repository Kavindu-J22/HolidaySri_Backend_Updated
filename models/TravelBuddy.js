const mongoose = require('mongoose');

const travelBuddySchema = new mongoose.Schema({
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
  userName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  nickName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 100
  },
  whatsappNumber: {
    type: String,
    required: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid WhatsApp number']
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say']
  },
  interests: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  // Social Media Profiles (Optional)
  socialMedia: {
    facebook: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty values
          return /^https?:\/\/(www\.)?facebook\.com\//.test(v);
        },
        message: 'Please enter a valid Facebook profile URL'
      }
    },
    instagram: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty values
          return /^https?:\/\/(www\.)?instagram\.com\//.test(v);
        },
        message: 'Please enter a valid Instagram profile URL'
      }
    },
    tiktok: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty values
          return /^https?:\/\/(www\.)?tiktok\.com\//.test(v);
        },
        message: 'Please enter a valid TikTok profile URL'
      }
    }
  },
  coverPhoto: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  avatarImage: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  // Additional fields for future enhancements
  viewCount: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});

// Indexes for efficient queries
travelBuddySchema.index({ userId: 1 });
travelBuddySchema.index({ publishedAdId: 1 });
travelBuddySchema.index({ country: 1 });
travelBuddySchema.index({ gender: 1 });
travelBuddySchema.index({ isActive: 1, publishedAt: -1 });

// Virtual for formatted age display
travelBuddySchema.virtual('ageDisplay').get(function() {
  return `${this.age} years old`;
});

// Method to increment view count
travelBuddySchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment contact count
travelBuddySchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

// Method to update average rating
travelBuddySchema.methods.updateAverageRating = async function() {
  const TravelBuddyReview = require('./TravelBuddyReview');

  const stats = await TravelBuddyReview.aggregate([
    { $match: { travelBuddyId: this._id, isActive: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].averageRating * 10) / 10; // Round to 1 decimal place
    this.totalReviews = stats[0].totalReviews;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }

  return this.save();
};

module.exports = mongoose.model('TravelBuddy', travelBuddySchema);
