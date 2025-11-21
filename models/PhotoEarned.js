const mongoose = require('mongoose');

const photoEarnedSchema = new mongoose.Schema({
  // Photo owner (who earns)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  
  // Post details
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HolidayMemory',
    required: true
  },
  postLocation: {
    name: String,
    city: String,
    province: String
  },
  postImage: {
    type: String
  },
  
  // Buyer details (who downloaded)
  buyerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyerEmail: {
    type: String,
    required: true
  },
  buyerName: {
    type: String,
    required: true
  },
  
  // Earning details
  hscEarnAmount: {
    type: Number,
    required: true,
    default: 1.5 // Photo owner earns 1.5 HSC per download
  },
  hscPaidByBuyer: {
    type: Number,
    required: true,
    default: 2.5 // Buyer pays 2.5 HSC
  },
  
  // Transaction details
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  },
  
  // Metadata
  downloadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
photoEarnedSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `PHOTO_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  next();
});

// Indexes for efficient queries
photoEarnedSchema.index({ userId: 1, createdAt: -1 });
photoEarnedSchema.index({ buyerUserId: 1, createdAt: -1 });
photoEarnedSchema.index({ postId: 1 });
photoEarnedSchema.index({ transactionId: 1 });
photoEarnedSchema.index({ status: 1 });

module.exports = mongoose.model('PhotoEarned', photoEarnedSchema);

