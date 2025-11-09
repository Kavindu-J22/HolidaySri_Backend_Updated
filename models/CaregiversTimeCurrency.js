const mongoose = require('mongoose');

// Sri Lankan provinces and districts mapping for validation
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

const caregiversTimeCurrencySchema = new mongoose.Schema({
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
  careID: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    match: /^CHS\d{4}$/,
    description: 'Unique 7-character ID (CHS + 4 digits) - e.g., CHS1234'
  },
  type: {
    type: String,
    enum: ['Care Giver', 'Care Needer'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
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
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Any type of contact number'
  },
  available: {
    type: Boolean,
    default: true
  },
  occupied: {
    type: Boolean,
    default: false
  },
  facebook: {
    type: String,
    trim: true,
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
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
  speakingLanguages: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one speaking language is required'
    }
  },
  HSTC: {
    type: Number,
    required: true,
    description: 'HolidaySri Time Currency - 36 for Care Giver, 720 for Care Needer'
  },
  // Care Giver specific fields
  careGiverDetails: {
    experience: {
      type: Number,
      min: 0,
      max: 70,
      description: 'Years of experience as a care giver'
    },
    services: {
      type: [String],
      default: [],
      description: 'Services provided - e.g., ["Elderly Care", "Dementia Care", "Mobility Assistance"]'
    }
  },
  // Care Needer specific fields
  careNeederDetails: {
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      description: 'Reason for needing care'
    },
    specialNeeds: {
      type: [String],
      default: [],
      description: 'Special needs or requirements'
    }
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save validation hook
caregiversTimeCurrencySchema.pre('save', function(next) {
  // Validate province and city combination
  if (this.province && this.city) {
    const validCities = provincesAndDistricts[this.province];
    if (!validCities || !validCities.includes(this.city)) {
      return next(new Error(`Invalid city "${this.city}" for province "${this.province}"`));
    }
  }

  // Validate type-specific fields
  if (this.type === 'Care Giver') {
    // Care Giver must have experience and services
    if (this.careGiverDetails.experience === undefined || this.careGiverDetails.experience === null) {
      return next(new Error('Experience is required for Care Giver'));
    }
    if (!this.careGiverDetails.services || this.careGiverDetails.services.length === 0) {
      return next(new Error('At least one service is required for Care Giver'));
    }
    // Clear Care Needer fields
    this.careNeederDetails = {
      reason: '',
      specialNeeds: []
    };
    // Set HSTC to 36 for Care Giver ONLY on new documents (not on updates)
    if (this.isNew) {
      this.HSTC = 36;
    }
  } else if (this.type === 'Care Needer') {
    // Care Needer must have reason
    if (!this.careNeederDetails.reason || this.careNeederDetails.reason.trim() === '') {
      return next(new Error('Reason is required for Care Needer'));
    }
    // Clear Care Giver fields
    this.careGiverDetails = {
      experience: undefined,
      services: []
    };
    // Set HSTC to 720 for Care Needer ONLY on new documents (not on updates)
    if (this.isNew) {
      this.HSTC = 720;
    }
  }

  next();
});

// Index for faster queries
caregiversTimeCurrencySchema.index({ userId: 1 });
caregiversTimeCurrencySchema.index({ careID: 1 });
caregiversTimeCurrencySchema.index({ type: 1 });
caregiversTimeCurrencySchema.index({ province: 1, city: 1 });
caregiversTimeCurrencySchema.index({ available: 1, occupied: 1 });
caregiversTimeCurrencySchema.index({ createdAt: -1 });
caregiversTimeCurrencySchema.index({ publishedAdId: 1 });

// Review Schema for Caregivers Time Currency
const caregiverReviewSchema = new mongoose.Schema({
  caregiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CaregiversTimeCurrency',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Index for reviews
caregiverReviewSchema.index({ caregiverId: 1 });
caregiverReviewSchema.index({ userId: 1 });
caregiverReviewSchema.index({ createdAt: -1 });

const CaregiversTimeCurrency = mongoose.model('CaregiversTimeCurrency', caregiversTimeCurrencySchema);
const CaregiverReview = mongoose.model('CaregiverReview', caregiverReviewSchema);

module.exports = {
  CaregiversTimeCurrency,
  CaregiverReview
};

