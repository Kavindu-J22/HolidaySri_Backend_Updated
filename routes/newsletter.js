const express = require('express');
const NewsletterSubscriber = require('../models/Newsletter');
const User = require('../models/User');
const { verifyAdminToken } = require('../middleware/auth');
const { sendNewsletterSubscriptionConfirmation, sendNewsletterEmail } = require('../utils/emailService');

const router = express.Router();

// Public route - Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Get client metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    // Subscribe email
    const result = await NewsletterSubscriber.subscribeEmail(email, 'website_footer', metadata);

    if (!result.success) {
      return res.status(400).json({ 
        message: result.message,
        alreadySubscribed: result.alreadySubscribed 
      });
    }

    // Send confirmation email
    try {
      await sendNewsletterSubscriptionConfirmation(email);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the subscription if email fails
    }

    res.status(200).json({
      message: result.message,
      newSubscriber: result.newSubscriber,
      resubscribed: result.resubscribed
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public route - Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await NewsletterSubscriber.unsubscribeEmail(email);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.status(200).json({ message: result.message });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Get all subscribers with pagination and filters
router.get('/subscribers', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = '',
      sortBy = 'subscriptionDate',
      sortOrder = 'desc',
      type = 'subscribers' // 'subscribers', 'users', or 'all'
    } = req.query;

    let result = {};

    if (type === 'subscribers') {
      // Get newsletter subscribers only
      const filter = {};

      if (status !== 'all') {
        filter.status = status;
      }

      if (search) {
        filter.email = { $regex: search, $options: 'i' };
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [subscribers, total] = await Promise.all([
        NewsletterSubscriber.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('-__v'),
        NewsletterSubscriber.countDocuments(filter)
      ]);

      result = {
        subscribers: subscribers.map(sub => ({
          ...sub.toObject(),
          type: 'subscriber',
          name: sub.email.split('@')[0], // Extract name from email
          joinedDate: sub.subscriptionDate
        })),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };

    } else if (type === 'users') {
      // Get registered users only
      const filter = { isActive: true };

      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ];
      }

      const sort = {};
      sort[sortBy === 'subscriptionDate' ? 'createdAt' : sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [users, total] = await Promise.all([
        User.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('email name createdAt isEmailVerified profileImage isMember isPartner -_id'),
        User.countDocuments(filter)
      ]);

      result = {
        subscribers: users.map(user => ({
          _id: user._id,
          email: user.email,
          name: user.name,
          type: 'user',
          status: 'active',
          joinedDate: user.createdAt,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
          isMember: user.isMember,
          isPartner: user.isPartner,
          source: 'registered_user'
        })),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };

    } else if (type === 'all') {
      // Get both subscribers and users, avoiding duplicates
      const searchFilter = search ? { $regex: search, $options: 'i' } : null;

      // Get subscribers
      const subscriberFilter = {};
      if (status !== 'all') {
        subscriberFilter.status = status;
      }
      if (searchFilter) {
        subscriberFilter.email = searchFilter;
      }

      // Get users
      const userFilter = { isActive: true };
      if (searchFilter) {
        userFilter.$or = [
          { email: searchFilter },
          { name: searchFilter }
        ];
      }

      const [subscribers, users] = await Promise.all([
        NewsletterSubscriber.find(subscriberFilter).select('-__v'),
        User.find(userFilter).select('email name createdAt isEmailVerified profileImage isMember isPartner')
      ]);

      // Create a map to avoid duplicates
      const emailMap = new Map();

      // Add subscribers first
      subscribers.forEach(sub => {
        emailMap.set(sub.email, {
          _id: sub._id,
          email: sub.email,
          name: sub.email.split('@')[0],
          type: 'subscriber',
          status: sub.status,
          joinedDate: sub.subscriptionDate,
          source: sub.source,
          emailsSent: sub.emailsSent
        });
      });

      // Add users, but don't overwrite existing subscribers
      users.forEach(user => {
        if (!emailMap.has(user.email)) {
          emailMap.set(user.email, {
            _id: user._id,
            email: user.email,
            name: user.name,
            type: 'user',
            status: 'active',
            joinedDate: user.createdAt,
            isEmailVerified: user.isEmailVerified,
            profileImage: user.profileImage,
            isMember: user.isMember,
            isPartner: user.isPartner,
            source: 'registered_user',
            emailsSent: 0
          });
        } else {
          // If email exists in subscribers, mark as both
          const existing = emailMap.get(user.email);
          existing.type = 'both';
          existing.name = user.name; // Use actual name from user
          existing.isEmailVerified = user.isEmailVerified;
          existing.profileImage = user.profileImage;
          existing.isMember = user.isMember;
          existing.isPartner = user.isPartner;
        }
      });

      // Convert to array and sort
      let allContacts = Array.from(emailMap.values());

      // Apply sorting
      allContacts.sort((a, b) => {
        const aValue = a[sortBy === 'subscriptionDate' ? 'joinedDate' : sortBy];
        const bValue = b[sortBy === 'subscriptionDate' ? 'joinedDate' : sortBy];

        if (sortOrder === 'desc') {
          return new Date(bValue) - new Date(aValue);
        } else {
          return new Date(aValue) - new Date(bValue);
        }
      });

      // Apply pagination
      const total = allContacts.length;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      allContacts = allContacts.slice(skip, skip + parseInt(limit));

      result = {
        subscribers: allContacts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };
    }

    // Get stats with proper deduplication calculation
    const stats = await NewsletterSubscriber.getStats();
    const userStats = await User.countDocuments({ isActive: true });

    // Calculate actual deduplicated total contacts
    let actualTotalContacts = stats.total + userStats;

    if (type === 'all') {
      // For 'all' type, we already have the deduplicated count from the result
      actualTotalContacts = result.pagination.total;
    } else {
      // Calculate deduplicated count by finding overlapping emails
      const [subscriberEmails, userEmails] = await Promise.all([
        NewsletterSubscriber.find({}).distinct('email'),
        User.find({ isActive: true }).distinct('email')
      ]);

      // Create a set to count unique emails
      const uniqueEmails = new Set([...subscriberEmails, ...userEmails]);
      actualTotalContacts = uniqueEmails.size;
    }

    result.stats = {
      ...stats,
      totalUsers: userStats,
      totalContacts: actualTotalContacts
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Get subscriber by ID
router.get('/subscribers/:id', verifyAdminToken, async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findById(req.params.id);

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    res.status(200).json({ subscriber });

  } catch (error) {
    console.error('Get subscriber error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Update subscriber status
router.put('/subscribers/:id/status', verifyAdminToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'unsubscribed', 'bounced'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const subscriber = await NewsletterSubscriber.findById(req.params.id);

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    subscriber.status = status;
    if (status === 'unsubscribed') {
      subscriber.unsubscribeDate = new Date();
    } else if (status === 'active') {
      subscriber.unsubscribeDate = undefined;
    }

    await subscriber.save();

    res.status(200).json({ 
      message: 'Subscriber status updated successfully',
      subscriber 
    });

  } catch (error) {
    console.error('Update subscriber status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Delete subscriber
router.delete('/subscribers/:id', verifyAdminToken, async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findByIdAndDelete(req.params.id);

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    res.status(200).json({ message: 'Subscriber deleted successfully' });

  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Send newsletter to selected subscribers/users
router.post('/send-newsletter', verifyAdminToken, async (req, res) => {
  try {
    const {
      subscriberIds,
      subject,
      body,
      sendToAll = false,
      sendToAllUsers = false,
      sendToAllSubscribers = false,
      recipientType = 'selected' // 'selected', 'all_subscribers', 'all_users', 'all_contacts'
    } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    let emailList = [];

    if (recipientType === 'all_contacts' || sendToAll) {
      // Send to all subscribers and users
      const [subscribers, users] = await Promise.all([
        NewsletterSubscriber.find({ status: 'active' }),
        User.find({ isActive: true }).select('email name')
      ]);

      // Create email list avoiding duplicates
      const emailMap = new Map();

      subscribers.forEach(sub => {
        emailMap.set(sub.email, {
          email: sub.email,
          name: sub.email.split('@')[0],
          type: 'subscriber',
          subscriberId: sub._id
        });
      });

      users.forEach(user => {
        if (!emailMap.has(user.email)) {
          emailMap.set(user.email, {
            email: user.email,
            name: user.name,
            type: 'user'
          });
        }
      });

      emailList = Array.from(emailMap.values());

    } else if (recipientType === 'all_subscribers' || sendToAllSubscribers) {
      // Send to all active subscribers only
      const subscribers = await NewsletterSubscriber.find({ status: 'active' });
      emailList = subscribers.map(sub => ({
        email: sub.email,
        name: sub.email.split('@')[0],
        type: 'subscriber',
        subscriberId: sub._id
      }));

    } else if (recipientType === 'all_users' || sendToAllUsers) {
      // Send to all active users only
      const users = await User.find({ isActive: true }).select('email name');
      emailList = users.map(user => ({
        email: user.email,
        name: user.name,
        type: 'user'
      }));

    } else {
      // Send to selected recipients
      if (!subscriberIds || !Array.isArray(subscriberIds) || subscriberIds.length === 0) {
        return res.status(400).json({ message: 'Recipient IDs are required when not sending to all' });
      }

      // Get selected subscribers and users
      const [subscribers, users] = await Promise.all([
        NewsletterSubscriber.find({
          _id: { $in: subscriberIds },
          status: 'active'
        }),
        User.find({
          _id: { $in: subscriberIds },
          isActive: true
        }).select('email name')
      ]);

      emailList = [
        ...subscribers.map(sub => ({
          email: sub.email,
          name: sub.email.split('@')[0],
          type: 'subscriber',
          subscriberId: sub._id
        })),
        ...users.map(user => ({
          email: user.email,
          name: user.name,
          type: 'user'
        }))
      ];
    }

    if (emailList.length === 0) {
      return res.status(400).json({ message: 'No active recipients found' });
    }

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 50;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);

      const emailPromises = batch.map(async (recipient) => {
        try {
          await sendNewsletterEmail(recipient.email, subject, body);

          // Track email sent for subscribers
          if (recipient.type === 'subscriber' && recipient.subscriberId) {
            const subscriber = await NewsletterSubscriber.findById(recipient.subscriberId);
            if (subscriber) {
              await subscriber.trackEmailSent();
            }
          }

          successCount++;
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          failureCount++;
        }
      });

      await Promise.all(emailPromises);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < emailList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({
      message: 'Newsletter sending completed',
      totalRecipients: emailList.length,
      successCount,
      failureCount,
      recipientBreakdown: {
        subscribers: emailList.filter(r => r.type === 'subscriber').length,
        users: emailList.filter(r => r.type === 'user').length
      }
    });

  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin route - Get newsletter statistics
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const stats = await NewsletterSubscriber.getStats();
    
    if (!stats) {
      return res.status(500).json({ message: 'Failed to get statistics' });
    }

    res.status(200).json({ stats });

  } catch (error) {
    console.error('Get newsletter stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
