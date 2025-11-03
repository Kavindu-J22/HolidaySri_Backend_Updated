const mongoose = require('mongoose');

const fitnessHealthSpasGymSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['Service', 'Professionals'],
    required: true,
    description: 'Service or Professionals'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Spa, Gym, Yoga Studio, Wellness Center, etc.'
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'e.g., Ayurvedic Treatments, Weight Loss, Fitness Training, etc.'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
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
  availability: {
    weekdays: {
      type: String,
      required: true,
      description: 'e.g., 9:00 AM - 8:00 PM'
    },
    weekends: {
      type: String,
      required: true,
      description: 'e.g., 10:00 AM - 6:00 PM'
    },
    available: {
      type: Boolean,
      default: true
    }
  },
  includes: {
    type: [String],
    required: true,
    description: 'e.g., Massage, Herbal bath, Lunch, Sauna'
  },
  contact: {
    phone: {
      type: String,
      required: true,
      description: 'Phone number (any country allowed)'
    },
    facebook: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    }
  },
  packages: {
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search and filtering
fitnessHealthSpasGymSchema.index({ userId: 1 });
fitnessHealthSpasGymSchema.index({ category: 1 });
fitnessHealthSpasGymSchema.index({ specialization: 1 });
fitnessHealthSpasGymSchema.index({ city: 1, province: 1 });
fitnessHealthSpasGymSchema.index({ publishedAdId: 1 });

module.exports = mongoose.model('FitnessHealthSpasGym', fitnessHealthSpasGymSchema);

