const mongoose = require('mongoose');

const localSimMobileDataSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
    description: 'Company/Provider name (e.g., Dialog, Mobitel, Hutch)'
  },
  logo: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Telecommunication, Mobile Network, Internet Service Provider'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  experienceYears: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    description: 'Years of experience in the industry'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'Contact number or email (any type, any country allowed)'
  },
  packagesPDF: {
    url: {
      type: String
    },
    publicId: {
      type: String
    },
    fileName: {
      type: String
    }
  },
  facebook: {
    type: String,
    trim: true,
    maxlength: 200
  },
  website: {
    type: String,
    trim: true,
    maxlength: 200
  },
  specialties: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 10;
      },
      message: 'Maximum 10 specialties allowed'
    },
    description: 'e.g., 4G LTE, Broadband, Mobile Payments, International Roaming'
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

// Indexes for efficient queries
localSimMobileDataSchema.index({ userId: 1 });
localSimMobileDataSchema.index({ publishedAdId: 1 });
localSimMobileDataSchema.index({ name: 1 });
localSimMobileDataSchema.index({ category: 1 });
localSimMobileDataSchema.index({ isActive: 1, publishedAt: -1 });

// Method to increment view count
localSimMobileDataSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment contact count
localSimMobileDataSchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

// Method to update average rating
localSimMobileDataSchema.methods.updateAverageRating = function(newRating) {
  const totalRating = this.averageRating * this.totalReviews;
  this.totalReviews += 1;
  this.averageRating = (totalRating + newRating) / this.totalReviews;
  return this.save();
};

module.exports = mongoose.model('LocalSimMobileData', localSimMobileDataSchema);

