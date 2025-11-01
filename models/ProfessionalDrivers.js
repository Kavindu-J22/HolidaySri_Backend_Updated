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

const professionalDriversSchema = new mongoose.Schema({
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
    maxlength: 100,
    description: 'e.g., School Bus Driver, Taxi Driver, etc.'
  },
  categories: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., Child Transport, Safety Certified, etc.'
  }],
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
  city: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  available: {
    type: Boolean,
    default: true
  },
  weekdayAvailability: {
    type: String,
    trim: true,
    description: 'e.g., 6:00 AM - 8:00 AM, 1:00 PM - 3:00 PM or 24/7 or On request'
  },
  weekendAvailability: {
    type: String,
    trim: true,
    description: 'e.g., 6:00 AM - 8:00 AM, 1:00 PM - 3:00 PM or 24/7 or On request'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    match: [/^\+?[0-9\s\-\(\)]{7,20}$/, 'Please enter a valid contact number']
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

// Indexes for better query performance
professionalDriversSchema.index({ userId: 1 });
professionalDriversSchema.index({ publishedAdId: 1 });
professionalDriversSchema.index({ specialization: 1 });
professionalDriversSchema.index({ categories: 1 });
professionalDriversSchema.index({ isActive: 1 });
professionalDriversSchema.index({ province: 1, city: 1 });

module.exports = mongoose.model('ProfessionalDrivers', professionalDriversSchema);

