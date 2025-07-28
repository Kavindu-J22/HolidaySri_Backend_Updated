const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    enum: ['Famous', 'Popular', 'Hidden', 'Adventure', 'Cultural', 'Beach', 'Mountain', 'Historical', 'Wildlife', 'Religious'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
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
  },
  distanceFromColombo: {
    type: Number,
    required: true,
    min: 0,
    max: 500 // Maximum distance in km
  },
  province: {
    type: String,
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
    ],
    required: true
  },
  district: {
    type: String,
    required: true,
    validate: {
      validator: function(district) {
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
        return provincesAndDistricts[this.province]?.includes(district);
      },
      message: 'District must be valid for the selected province'
    }
  },
  climate: {
    type: String,
    enum: [
      'Dry zone',
      'Intermediate zone',
      'Montane zone',
      'Semi-Arid zone',
      'Oceanic zone',
      'Tropical Wet zone',
      'Tropical Submontane',
      'Tropical Dry Zone',
      'Tropical Monsoon Climate',
      'Tropical Savanna Climate'
    ],
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
destinationSchema.index({ name: 'text', description: 'text' });
destinationSchema.index({ type: 1 });
destinationSchema.index({ climate: 1 });
destinationSchema.index({ province: 1 });
destinationSchema.index({ district: 1 });
destinationSchema.index({ averageRating: -1 });
destinationSchema.index({ createdAt: -1 });

// Virtual for formatted distance
destinationSchema.virtual('formattedDistance').get(function() {
  return `${this.distanceFromColombo} km from Colombo`;
});

// Method to update average rating
destinationSchema.methods.updateAverageRating = async function() {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { destinationId: this._id } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].averageRating * 10) / 10; // Round to 1 decimal
    this.totalReviews = stats[0].totalReviews;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }

  await this.save();
};

module.exports = mongoose.model('Destination', destinationSchema);
