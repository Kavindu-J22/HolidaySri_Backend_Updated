const mongoose = require('mongoose');

const booksAndMagazinesEducationalSchema = new mongoose.Schema({
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
    maxlength: 200
  },
  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  specialization: [{
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Web Development, Frontend, etc.'
  }],
  languages: [{
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    description: 'e.g., English, Spanish, etc.'
  }],
  categories: [{
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    description: 'e.g., Programming, Web Development, etc.'
  }],
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    description: 'Price in LKR'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    description: 'Phone or Email - supports all formats and countries'
  },
  whatsapp: {
    type: String,
    required: true,
    trim: true,
    description: 'WhatsApp number - supports all formats and countries'
  },
  available: {
    type: Boolean,
    default: true
  },
  includes: [{
    type: String,
    trim: true,
    maxlength: 100,
    description: 'e.g., PDF, ePub, Code Examples, etc.'
  }],
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
  pdfDocument: {
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
  },
  // Reviews and ratings
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    review: {
      type: String,
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

module.exports = mongoose.model('BooksAndMagazinesEducational', booksAndMagazinesEducationalSchema);

