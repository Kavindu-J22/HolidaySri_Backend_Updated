const mongoose = require('mongoose');

const petCareAnimalServicesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: [String],
    required: true,
    enum: ['Dogs', 'Cats', 'Birds', 'Rabbits', 'Hamsters', 'Guinea Pigs', 'Reptiles', 'Fish', 'Exotic Animals', 'Other'],
    default: []
  },
  category: {
    type: String,
    required: true,
    enum: ['Veterinary', 'Grooming', 'Training', 'Pet Sitting', 'Pet Boarding', 'Pet Supplies', 'Other'],
    default: 'Veterinary'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  experience: {
    type: Number,
    required: true,
    min: 0
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
  services: {
    type: [String],
    required: true,
    default: []
  },
  availability: {
    type: [String],
    required: true,
    default: []
  },
  facebook: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
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
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
petCareAnimalServicesSchema.index({ userId: 1 });
petCareAnimalServicesSchema.index({ city: 1, province: 1 });
petCareAnimalServicesSchema.index({ category: 1 });
petCareAnimalServicesSchema.index({ isActive: 1 });

module.exports = mongoose.model('PetCareAnimalServices', petCareAnimalServicesSchema);

