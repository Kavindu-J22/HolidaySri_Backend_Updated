const mongoose = require('mongoose');

const cafesRestaurantsSchema = new mongoose.Schema({
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
  categoryType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Seafood, Italian, Asian, Fast Food, etc.'
  },
  location: {
    province: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    }
  },
  operatingHours: {
    openTime: {
      type: String,
      required: true,
      description: 'e.g., 11:00 AM'
    },
    closeTime: {
      type: String,
      required: true,
      description: 'e.g., 10:00 PM'
    }
  },
  diningOptions: [{
    type: String,
    enum: ['Dine-in', 'Outdoor Seating', 'Delivery', 'Takeaway', 'Catering'],
    required: true
  }],
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone number - supports all formats and countries'
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
  menuPDF: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    fileName: {
      type: String,
      default: null
    }
  },
  mapLink: {
    type: String,
    trim: true,
    default: null,
    description: 'Google Maps link'
  },
  menuItems: [{
    image: {
      url: {
        type: String,
        required: true
      },
      publicId: {
        type: String,
        required: true
      }
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      description: 'Price in LKR'
    },
    createdAt: {
      type: Date,
      default: Date.now
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
  },
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for optimal performance
cafesRestaurantsSchema.index({ userId: 1 });
cafesRestaurantsSchema.index({ publishedAdId: 1 });
cafesRestaurantsSchema.index({ 'location.province': 1, 'location.city': 1 });
cafesRestaurantsSchema.index({ categoryType: 1 });
cafesRestaurantsSchema.index({ isActive: 1 });

module.exports = mongoose.model('CafesRestaurants', cafesRestaurantsSchema);

