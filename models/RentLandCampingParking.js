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

const rentLandCampingParkingSchema = new mongoose.Schema({
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
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., RV Parking, Camping Site, etc.'
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
          // Get province from the document (works for both save and update)
          const province = this.location?.province || this.get?.('location.province') || this._update?.$set?.['location.province'];
          if (!province) return true; // Skip validation if province is not available
          return provincesAndDistricts[province]?.includes(v);
        },
        message: 'City must be valid for the selected province'
      }
    }
  },
  nearby: [{
    type: String,
    trim: true
  }],
  activities: [{
    type: String,
    trim: true
  }],
  includes: [{
    type: String,
    trim: true
  }],
  contact: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[0-9\s\-\(\)]{7,20}$/.test(v);
      },
      message: 'Contact number must be valid (7-20 digits, allows +, -, (), spaces)'
    }
  },
  website: {
    type: String,
    trim: true,
    default: null
  },
  facebook: {
    type: String,
    trim: true,
    default: null
  },
  available: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Daily rate in LKR'
  },
  weekendPrice: {
    type: Number,
    required: true,
    min: 0,
    description: 'Weekend rate in LKR'
  },
  availability: {
    weekdays: {
      type: Boolean,
      default: true
    },
    weekends: {
      type: Boolean,
      default: true
    },
    time: {
      type: String,
      default: '8:00 AM - 8:00 PM'
    }
  },
  mapLink: {
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
  // Reviews array
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
    userImage: {
      type: String,
      default: ''
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      default: ''
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
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
rentLandCampingParkingSchema.index({ userId: 1 });
rentLandCampingParkingSchema.index({ publishedAdId: 1 });
rentLandCampingParkingSchema.index({ 'location.province': 1, 'location.city': 1 });
rentLandCampingParkingSchema.index({ isActive: 1 });
rentLandCampingParkingSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('RentLandCampingParking', rentLandCampingParkingSchema);

