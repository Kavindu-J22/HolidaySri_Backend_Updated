const mongoose = require('mongoose');

// Location types as specified in requirements
const locationTypes = [
  'Cultural and religious site',
  'Historical landmark', 
  'Traditional shopping area',
  'Natural attraction',
  'Adventure site',
  'Beach destination',
  'Mountain location',
  'Wildlife sanctuary',
  'Archaeological site',
  'Scenic viewpoint',
  'Waterfall',
  'National park',
  'Temple complex',
  'Colonial architecture',
  'Local market',
  'Tea plantation',
  'Spice garden',
  'Botanical garden',
  'Lake',
  'River',
  'Cave system',
  'Rock formation',
  'Lighthouse',
  'Fort',
  'Museum'
];

// Provinces and districts as specified
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

// Climate options as specified
const climateOptions = [
  "Dry zone",
  "Intermediate zone", 
  "Montane zone",
  "Semi-Arid zone",
  "Oceanic zone",
  "Tropical Wet zone",
  "Tropical Submontane",
  "Tropical Dry Zone",
  "Tropical Monsoon Climate",
  "Tropical Savanna Climate"
];

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  locationType: {
    type: String,
    enum: locationTypes,
    required: true
  },
  description: {
    type: String,
    required: true,
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
  mapUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https:\/\/(www\.)?google\.com\/maps/.test(v) || /^https:\/\/maps\.google\.com/.test(v) || /^https:\/\/goo\.gl\/maps/.test(v);
      },
      message: 'Please provide a valid Google Maps URL'
    }
  },
  distanceFromColombo: {
    type: Number,
    required: true,
    min: 0,
    max: 500 // Maximum distance in km
  },
  province: {
    type: String,
    enum: Object.keys(provincesAndDistricts),
    required: true
  },
  district: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return provincesAndDistricts[this.province]?.includes(v);
      },
      message: 'District must be valid for the selected province'
    }
  },
  climate: {
    type: String,
    enum: climateOptions,
    required: true
  },
  recommendedToVisit: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  enteringFee: {
    isFree: {
      type: Boolean,
      default: true
    },
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      default: 'LKR'
    }
  },
  facilities: [{
    type: String,
    trim: true
  }],
  nearbyActivities: [{
    type: String,
    trim: true
  }],
  mainDestination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Destination',
    required: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

// Index for search functionality
locationSchema.index({ name: 'text', description: 'text' });
locationSchema.index({ locationType: 1 });
locationSchema.index({ climate: 1 });
locationSchema.index({ province: 1 });
locationSchema.index({ district: 1 });
locationSchema.index({ averageRating: -1 });
locationSchema.index({ createdAt: -1 });
locationSchema.index({ mainDestination: 1 });

// Virtual for formatted distance
locationSchema.virtual('formattedDistance').get(function() {
  return `${this.distanceFromColombo} km from Colombo`;
});

// Virtual for formatted entering fee
locationSchema.virtual('formattedEnteringFee').get(function() {
  if (this.enteringFee.isFree) {
    return 'Free';
  }
  return `${this.enteringFee.currency} ${this.enteringFee.amount}`;
});

// Method to update average rating
locationSchema.methods.updateAverageRating = async function() {
  const Review = mongoose.model('LocationReview');
  const stats = await Review.aggregate([
    { $match: { locationId: this._id, isActive: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].averageRating * 10) / 10;
    this.totalReviews = stats[0].totalReviews;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }

  await this.save();
};

// Export constants for use in routes
locationSchema.statics.locationTypes = locationTypes;
locationSchema.statics.provincesAndDistricts = provincesAndDistricts;
locationSchema.statics.climateOptions = climateOptions;

module.exports = mongoose.model('Location', locationSchema);
