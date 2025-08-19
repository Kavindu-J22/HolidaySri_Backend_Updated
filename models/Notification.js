const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['welcome', 'purchase', 'earning', 'system', 'promotion', 'warning', 'advertisement', 'error'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // For storing additional data like transaction IDs, promo codes, etc.
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Notifications expire after 30 days
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return thirtyDays;
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, title, message, type = 'system', data = {}, priority = 'medium') {
  try {
    const notification = new this({
      userId,
      title,
      message,
      type,
      data,
      priority
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    return await this.countDocuments({ userId, isRead: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds) {
  try {
    const query = { userId, isRead: false };
    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    return await this.updateMany(query, { isRead: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

// Static method to bulk delete notifications
notificationSchema.statics.bulkDelete = async function(userId, notificationIds) {
  try {
    const query = { userId };
    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    return await this.deleteMany(query);
  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    throw error;
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
