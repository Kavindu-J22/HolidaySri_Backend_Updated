const mongoose = require('mongoose');

const liveRidesCarpoolingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  advertisementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  },
  
  // Vehicle Images
  images: {
    vehicleImage: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    },
    numberPlate: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    },
    ownerPhoto: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    },
    ownerNICFront: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    },
    ownerNICBack: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    }
  },

  // Vehicle Details
  vehicleNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  vehicleBrand: {
    type: String,
    required: true,
    trim: true
  },
  vehicleOwnerName: {
    type: String,
    required: true,
    trim: true
  },

  // Owner Location
  ownerLocation: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    province: {
      type: String,
      required: true,
      trim: true
    }
  },

  // Contact Information
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },

  // Ride Route
  rideRoute: {
    from: {
      type: String,
      required: true,
      trim: true
    },
    to: {
      type: String,
      required: true,
      trim: true
    }
  },

  // Ride Details
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  maxPassengerCount: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  availablePassengerCount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['Ongoing Ride', 'Starting Soon', 'Over Soon', 'Upcoming Ride', 'Over'],
    default: 'Upcoming Ride'
  },
  pricePerSeat: {
    type: Number,
    required: true,
    min: 0
  },
  rideDate: {
    type: Date,
    required: true
  },
  rideTime: {
    type: String,
    required: true,
    trim: true
  },
  approximateTimeToRide: {
    type: String,
    required: true,
    trim: true
  },

  // Engagement Metrics
  viewCount: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  bookingCount: {
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
    userProfileImage: {
      type: String
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

  // Status
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

// Indexes for better query performance
liveRidesCarpoolingSchema.index({ userId: 1 });
liveRidesCarpoolingSchema.index({ advertisementId: 1 });
liveRidesCarpoolingSchema.index({ status: 1 });
liveRidesCarpoolingSchema.index({ rideDate: 1 });
liveRidesCarpoolingSchema.index({ 'rideRoute.from': 1, 'rideRoute.to': 1 });
liveRidesCarpoolingSchema.index({ 'ownerLocation.city': 1 });
liveRidesCarpoolingSchema.index({ 'ownerLocation.province': 1 });
liveRidesCarpoolingSchema.index({ isActive: 1 });
liveRidesCarpoolingSchema.index({ publishedAt: -1 });

// Validation: availablePassengerCount should not exceed maxPassengerCount
liveRidesCarpoolingSchema.pre('save', function(next) {
  if (this.availablePassengerCount > this.maxPassengerCount) {
    next(new Error('Available passenger count cannot exceed maximum passenger count'));
  }
  next();
});

const LiveRidesCarpooling = mongoose.model('LiveRidesCarpooling', liveRidesCarpoolingSchema);

module.exports = LiveRidesCarpooling;

