const mongoose = require('mongoose');

const travelBuddyReportSchema = new mongoose.Schema({
  travelBuddyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelBuddy',
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: [
      'inappropriate_content',
      'fake_profile',
      'harassment',
      'spam',
      'safety_concern',
      'other'
    ],
    default: 'other'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  adminNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reports from same user
travelBuddyReportSchema.index({ travelBuddyId: 1, reportedBy: 1 }, { unique: true });

// Index for efficient queries
travelBuddyReportSchema.index({ travelBuddyId: 1, status: 1 });
travelBuddyReportSchema.index({ reportedBy: 1, createdAt: -1 });
travelBuddyReportSchema.index({ status: 1, createdAt: -1 });

// Post-save middleware to update travel buddy report count
travelBuddyReportSchema.post('save', async function() {
  const TravelBuddy = mongoose.model('TravelBuddy');
  
  // Count total reports for this travel buddy
  const reportCount = await mongoose.model('TravelBuddyReport').countDocuments({
    travelBuddyId: this.travelBuddyId
  });
  
  // Update the travel buddy's report count
  await TravelBuddy.findByIdAndUpdate(this.travelBuddyId, {
    reportCount: reportCount
  });
});

module.exports = mongoose.model('TravelBuddyReport', travelBuddyReportSchema);
