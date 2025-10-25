const mongoose = require('mongoose');

const provincesAndDistricts = {
  "Western Province": ["Colombo", "Gampaha", "Kalutara"],
  "Central Province": ["Kandy", "Matale", "Nuwara Eliya"],
  "Southern Province": ["Galle", "Matara", "Hambantota"],
  "Northern Province": ["Jaffna", "Mannar", "Vavuniya", "Kilinochchi", "Mullaitivu"],
  "Eastern Province": ["Batticaloa", "Ampara", "Trincomalee"],
  "North Western Province": ["Kurunegala", "Puttalam"],
  "North Central Province": ["Anuradhapura", "Polonnaruwa"],
  "Uva Province": ["Badulla", "Monaragala"],
  "Sabaragamuwa Province": ["Kegalle", "Ratnapura"]
};

const adventureTypes = [
  'Beach',
  'Mountain',
  'Cultural',
  'Wildlife',
  'Adventure Sports',
  'Historical',
  'Religious',
  'Nature',
  'Urban',
  'Eco-Tourism',
  'Food & Culinary',
  'Photography'
];

const localTourPackageSchema = new mongoose.Schema({
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
  categoryType: {
    type: String,
    default: 'local_tour_packages'
  },
  adventureType: {
    type: String,
    enum: adventureTypes,
    required: true
  },
  location: {
    province: {
      type: String,
      enum: Object.keys(provincesAndDistricts),
      required: true
    },
    city: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return provincesAndDistricts[this.location.province]?.includes(v);
        },
        message: 'City must be valid for the selected province'
      }
    }
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
  pax: {
    min: {
      type: Number,
      required: true,
      min: 1
    },
    max: {
      type: Number,
      required: true,
      min: 1
    }
  },
  availableDates: [{
    type: Date,
    required: true
  }],
  includes: [{
    type: String,
    trim: true
  }],
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'LKR'
    }
  },
  provider: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    }
  },
  facebook: {
    type: String,
    trim: true,
    default: null
  },
  website: {
    type: String,
    trim: true,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
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
    reviewText: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
localTourPackageSchema.index({ userId: 1 });
localTourPackageSchema.index({ publishedAdId: 1 });
localTourPackageSchema.index({ 'location.province': 1 });
localTourPackageSchema.index({ 'location.city': 1 });
localTourPackageSchema.index({ adventureType: 1 });
localTourPackageSchema.index({ isActive: 1, publishedAt: -1 });
localTourPackageSchema.index({ title: 'text', description: 'text' });

// Method to increment view count
localTourPackageSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment contact count
localTourPackageSchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

// Method to add review and update average rating
localTourPackageSchema.methods.addReview = function(userId, userName, rating, reviewText) {
  this.reviews.push({
    userId,
    userName,
    rating,
    reviewText
  });

  // Calculate average rating
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.averageRating = totalRating / this.reviews.length;
  this.totalReviews = this.reviews.length;

  return this.save();
};

module.exports = mongoose.model('LocalTourPackage', localTourPackageSchema);

