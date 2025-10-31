const mongoose = require('mongoose');

const vehicleRentalsHireSchema = new mongoose.Schema({
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
    maxlength: 150
  },
  vehicleCategory: {
    type: String,
    required: true,
    trim: true,
    enum: ['Three Wheeler', 'Car', 'Van', 'Bus', 'Truck', 'Motorcycle', 'Bicycle', 'Other'],
    description: 'e.g., Three Wheeler, Car, Van, Bus, etc.'
  },
  serviceCategory: {
    type: String,
    required: true,
    trim: true,
    enum: ['Hire', 'Rent', 'Taxi', 'Tour', 'Delivery'],
    description: 'e.g., Hire, Rent, Taxi, Tour, Delivery'
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
  province: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number in any format and country code'
  },
  pricePerKm: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price per kilometer in LKR'
  },
  features: [{
    type: String,
    trim: true,
    description: 'e.g., City Tours, Cheap, Local Guide, AC, WiFi, etc.'
  }],
  driverStatus: {
    type: String,
    required: true,
    enum: ['Available', 'Unavailable', 'On Demand'],
    description: 'e.g., Available, Unavailable, On Demand'
  },
  driverGender: {
    type: String,
    required: true,
    enum: ['Male Driver', 'Female Driver', 'Any'],
    description: 'e.g., Male Driver, Female Driver, Any'
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
    description: 'Number of passengers the vehicle can accommodate'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
  // Engagement metrics
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
  }
}, {
  timestamps: true
});

// Index for search functionality
vehicleRentalsHireSchema.index({ userId: 1 });
vehicleRentalsHireSchema.index({ publishedAdId: 1 });
vehicleRentalsHireSchema.index({ vehicleCategory: 1 });
vehicleRentalsHireSchema.index({ serviceCategory: 1 });
vehicleRentalsHireSchema.index({ province: 1, city: 1 });
vehicleRentalsHireSchema.index({ isActive: 1 });

module.exports = mongoose.model('VehicleRentalsHire', vehicleRentalsHireSchema);

