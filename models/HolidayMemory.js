const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const holidayMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String
  },
  image: {
    type: String,
    required: true
  },
  imagePublicId: {
    type: String // Cloudinary public ID for deletion
  },
  caption: {
    type: String,
    required: true,
    maxlength: 1000
  },
  location: {
    name: {
      type: String,
      required: true
    },
    city: {
      type: String
    },
    province: {
      type: String
    },
    country: {
      type: String
    },
    isOtherCountry: {
      type: Boolean,
      default: false
    }
  },
  mapLink: {
    type: String, // Google Maps link
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid URL format'
    }
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [commentSchema],
  saves: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    savedAt: {
      type: Date,
      default: Date.now
    }
  }],
  downloads: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    hscPaid: {
      type: Number,
      default: 2.5
    }
  }],
  reports: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      required: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  downloadPrice: {
    type: Number,
    default: 2.5 // HSC price to download
  },
  totalEarnings: {
    type: Number,
    default: 0 // Total HSC earned from downloads
  },
  viewCount: {
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

// Indexes for efficient queries
holidayMemorySchema.index({ userId: 1, createdAt: -1 });
holidayMemorySchema.index({ 'location.city': 1 });
holidayMemorySchema.index({ 'location.province': 1 });
holidayMemorySchema.index({ tags: 1 });
holidayMemorySchema.index({ createdAt: -1 });
holidayMemorySchema.index({ isActive: 1 });

module.exports = mongoose.model('HolidayMemory', holidayMemorySchema);

