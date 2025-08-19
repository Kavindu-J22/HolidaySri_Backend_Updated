const express = require('express');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      notifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count only
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notifications as read
router.put('/mark-read', verifyToken, async (req, res) => {
  try {
    const { notificationIds } = req.body; // Array of notification IDs, or empty for all

    await Notification.markAsRead(req.user._id, notificationIds);

    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      message: 'Notifications marked as read',
      unreadCount
    });

  } catch (error) {
    console.error('Mark notifications as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk delete notifications (must come before /:id route)
router.delete('/bulk', verifyToken, async (req, res) => {
  try {
    const { notificationIds } = req.body; // Array of notification IDs

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ message: 'Invalid notification IDs provided' });
    }

    // Delete notifications that belong to the user
    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId: req.user._id
    });

    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      message: `${result.deletedCount} notification(s) deleted successfully`,
      deletedCount: result.deletedCount,
      unreadCount
    });

  } catch (error) {
    console.error('Bulk delete notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      message: 'Notification deleted',
      unreadCount
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
