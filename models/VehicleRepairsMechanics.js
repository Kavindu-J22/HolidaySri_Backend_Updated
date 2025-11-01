const mongoose = require('mongoose');

const vehicleRepairsMechanicsSchema = new mongoose.Schema({
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
    maxlength: 100
  },
  avatar: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'e.g., "Engine Repair, Transmission, Brake System"'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., "General Mechanic", "Specialist", "Certified Technician"'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  experience: {
    type: Number,
    required: true,
    min: 0,
    max: 70,
    description: 'Years of experience'
  },
  location: {
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
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number - supports all formats and countries'
  },
  available: {
    type: Boolean,
    default: true
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
  availability: {
    weekdays: {
      type: String,
      description: 'e.g., "8:00 AM - 6:00 PM"'
    },
    weekends: {
      type: String,
      description: 'e.g., "9:00 AM - 3:00 PM"'
    }
  },
  services: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., "Engine Diagnostics", "Oil Change", "Brake Repair"'
  }],
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
  }
}, {
  timestamps: true
});

// Index for search functionality
vehicleRepairsMechanicsSchema.index({ 'location.province': 1, 'location.city': 1 });
vehicleRepairsMechanicsSchema.index({ userId: 1 });
vehicleRepairsMechanicsSchema.index({ publishedAdId: 1 });
vehicleRepairsMechanicsSchema.index({ isActive: 1 });

module.exports = mongoose.model('VehicleRepairsMechanics', vehicleRepairsMechanicsSchema);

