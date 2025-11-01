const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true
  },
  slotId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  slotType: {
    type: String,
    default: 'category_slot'
  },

  // Payment and Plan Information
  selectedPlan: {
    type: String,
    enum: ['hourly', 'daily', 'monthly', 'yearly'],
    required: true
  },
  planDuration: {
    hours: {
      type: Number,
      min: 1
    },
    days: {
      type: Number,
      min: 1
    }
  },
  paymentMethod: {
    type: String,
    enum: ['HSC', 'HSD', 'HSG'],
    required: true
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Promo Code Information
  usedPromoCode: {
    type: String,
    uppercase: true
  },
  usedPromoCodeOwner: {
    type: String // Email of the promo code owner
  },
  usedPromoCodeOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'rejected', 'Published'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  isPromoted: {
    type: Boolean,
    default: false
  },
  promotionExpires: {
    type: Date
  },
  // Reference to published content (e.g., TravelBuddy profile)
  publishedAdId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'publishedAdModel'
  },
  publishedAdModel: {
    type: String,
    enum: ['TravelBuddy', 'TourGuider', 'LocalTourPackage', 'TravelSafeHelpProfessional', 'RentLandCampingParking', 'CafesRestaurants', 'FoodsBeverages', 'VehicleRentalsHire', 'ProfessionalDrivers', 'VehicleRepairsMechanics'] // Can be extended for other ad types in the future
  }
}, {
  timestamps: true
});

// Index for search functionality
advertisementSchema.index({ category: 1, status: 1 });
advertisementSchema.index({ userId: 1 });
advertisementSchema.index({ publishedAdId: 1 });

// Calculate expiry date before saving
advertisementSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'active' && !this.expiresAt) {
    let expirationTime;

    switch (this.selectedPlan) {
      case 'hourly':
        expirationTime = (this.planDuration.hours || 1) * 60 * 60 * 1000; // hours to milliseconds
        break;
      case 'daily':
        expirationTime = (this.planDuration.days || 1) * 24 * 60 * 60 * 1000; // days to milliseconds
        break;
      case 'monthly':
        expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        break;
      case 'yearly':
        expirationTime = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds
        break;
      default:
        expirationTime = 24 * 60 * 60 * 1000; // fallback to 1 day
    }

    this.expiresAt = new Date(Date.now() + expirationTime);
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Advertisement', advertisementSchema);
