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

module.exports = mongoose.model('TravelBuddy', travelBuddySchema);
