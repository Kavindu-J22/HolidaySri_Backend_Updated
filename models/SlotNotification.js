const mongoose = require('mongoose');

const slotNotificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isNotified: {
    type: Boolean,
    default: false
  },
  notifiedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
slotNotificationSchema.index({ email: 1, isNotified: 1 });
slotNotificationSchema.index({ userId: 1 });
slotNotificationSchema.index({ isNotified: 1, createdAt: -1 });

// Prevent duplicate notification requests from same user
slotNotificationSchema.index(
  { userId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { isNotified: false },
    name: 'unique_pending_notification_per_user'
  }
);

module.exports = mongoose.model('SlotNotification', slotNotificationSchema);

