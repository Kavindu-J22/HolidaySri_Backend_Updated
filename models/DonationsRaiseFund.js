const mongoose = require('mongoose');

const donationsRaiseFundSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  organizer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  }],
  category: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'Education',
      'Medical & Healthcare',
      'Disaster Relief',
      'Community Development',
      'Animal Welfare',
      'Environmental Conservation',
      'Children & Youth',
      'Elderly Care',
      'Poverty Alleviation',
      'Arts & Culture',
      'Sports & Recreation',
      'Religious & Spiritual',
      'Emergency & Crisis',
      'Other'
    ]
  },
  province: {
    type: String,
    required: true,
    enum: [
      'Western Province',
      'Central Province',
      'Southern Province',
      'Northern Province',
      'Eastern Province',
      'North Western Province',
      'North Central Province',
      'Uva Province',
      'Sabaragamuwa Province'
    ]
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  requestedAmountLKR: {
    type: Number,
    required: true,
    min: 0
  },
  requestedAmountHSC: {
    type: Number,
    required: true,
    min: 0
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
  donationCount: {
    type: Number,
    default: 0
  },
  totalDonatedLKR: {
    type: Number,
    default: 0
  },
  totalDonatedHSC: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
  // Fund transfers (HSC donations)
  fundTransfers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    amountHSC: {
      type: Number,
      required: true
    },
    amountLKR: {
      type: Number,
      required: true
    },
    comment: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Withdrawal request
  withdrawalRequest: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    requestedAt: {
      type: Date
    },
    adminNote: {
      type: String,
      default: ''
    },
    processedAt: {
      type: Date
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Ratings and Reviews
  ratings: [{
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
    review: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
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
donationsRaiseFundSchema.index({ userId: 1 });
donationsRaiseFundSchema.index({ publishedAdId: 1 }, { unique: true }); // Ensure unique publishedAdId
donationsRaiseFundSchema.index({ category: 1 });
donationsRaiseFundSchema.index({ province: 1, city: 1 });
donationsRaiseFundSchema.index({ isActive: 1 });
donationsRaiseFundSchema.index({ publishedAt: -1 });

// Methods
donationsRaiseFundSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

donationsRaiseFundSchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

donationsRaiseFundSchema.methods.addDonation = function(amount) {
  this.donationCount += 1;
  this.totalDonatedLKR += amount;
  return this.save();
};

module.exports = mongoose.model('DonationsRaiseFund', donationsRaiseFundSchema);

