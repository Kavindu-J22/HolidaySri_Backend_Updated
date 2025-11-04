const mongoose = require('mongoose');

const jobOpportunitiesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  companyLogo: {
    url: String,
    publicId: String
  },
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Full Time', 'Part Time', 'Contract Basis', 'Task'],
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['Urgent', 'Medium', 'Low'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  salary: {
    type: String,
    required: true,
    trim: true
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
  requirements: {
    type: [String],
    default: []
  },
  workType: {
    type: String,
    enum: ['On-site', 'Remote', 'Hybrid'],
    required: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  website: {
    type: String,
    trim: true
  },
  linkedin: {
    type: String,
    trim: true
  },
  pdfDocument: {
    url: String,
    publicId: String
  },
  
  // Reviews and Ratings
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    userAvatar: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
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
    default: 0
  },
  
  // Status and timestamps
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,
  
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
jobOpportunitiesSchema.index({ userId: 1 });
jobOpportunitiesSchema.index({ title: 'text', company: 'text', specialization: 'text' });
jobOpportunitiesSchema.index({ category: 1, type: 1, priority: 1 });
jobOpportunitiesSchema.index({ province: 1, city: 1 });
jobOpportunitiesSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('JobOpportunities', jobOpportunitiesSchema);

