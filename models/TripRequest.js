const mongoose = require('mongoose');

const tripRequestSchema = new mongoose.Schema({
  // Organizer Information
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizerTravelBuddyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelBuddy',
    required: true
  },
  organizerName: {
    type: String,
    required: true,
    trim: true
  },
  organizerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  organizerWhatsapp: {
    type: String,
    required: true,
    trim: true
  },
  organizerAvatar: {
    type: String,
    default: ''
  },

  // Trip Details
  destinations: [{
    type: String,
    required: true,
    trim: true
  }],
  startLocation: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    mapLink: {
      type: String,
      required: true,
      trim: true
    }
  },
  endLocation: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    mapLink: {
      type: String,
      required: true,
      trim: true
    }
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  days: {
    type: Number,
    required: true,
    min: 1
  },
  requiredBuddies: {
    type: Number,
    required: true,
    min: 1
  },
  budgetPerPerson: {
    type: Number,
    required: true,
    min: 0
  },
  wishToExplore: [{
    type: String,
    trim: true
  }],
  activities: [{
    type: String,
    required: true,
    trim: true
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  accommodation: {
    type: String,
    required: true,
    trim: true
  },
  transport: {
    type: String,
    required: true,
    trim: true
  },
  whatsappGroupLink: {
    type: String,
    trim: true,
    default: ''
  },

  // Payment Information
  hscCharge: {
    type: Number,
    required: true
  },
  paymentTransactionId: {
    type: String,
    required: true
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  viewCount: {
    type: Number,
    default: 0
  },
  interestedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
tripRequestSchema.index({ organizerId: 1, createdAt: -1 });
tripRequestSchema.index({ isActive: 1, startDate: 1 });
tripRequestSchema.index({ destinations: 1 });
tripRequestSchema.index({ createdAt: -1 });

// Validation: endDate must be after startDate
tripRequestSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

// Method to increment view count
tripRequestSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment interested count
tripRequestSchema.methods.incrementInterestedCount = function() {
  this.interestedCount += 1;
  return this.save();
};

module.exports = mongoose.model('TripRequest', tripRequestSchema);

