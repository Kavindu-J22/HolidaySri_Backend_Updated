const express = require('express');
const NewsletterSubscriber = require('../models/Newsletter');
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
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.email = { $regex: search, $options: 'i' };
    }

    // Build sort query
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      NewsletterSubscriber.countDocuments(filter)
    ]);

    // Get stats
    const stats = await NewsletterSubscriber.getStats();

    res.status(200).json({
      subscribers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      stats
    });

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

// Admin route - Send newsletter to selected subscribers
router.post('/send-newsletter', verifyAdminToken, async (req, res) => {
  try {
    const { subscriberIds, subject, body, sendToAll = false } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    let subscribers;

    if (sendToAll) {
      subscribers = await NewsletterSubscriber.find({ status: 'active' });
    } else {
      if (!subscriberIds || !Array.isArray(subscriberIds) || subscriberIds.length === 0) {
        return res.status(400).json({ message: 'Subscriber IDs are required when not sending to all' });
      }
      subscribers = await NewsletterSubscriber.find({ 
        _id: { $in: subscriberIds },
        status: 'active'
      });
    }

    if (subscribers.length === 0) {
      return res.status(400).json({ message: 'No active subscribers found' });
    }

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 50;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const emailPromises = batch.map(async (subscriber) => {
        try {
          await sendNewsletterEmail(subscriber.email, subject, body);
          await subscriber.trackEmailSent();
          successCount++;
        } catch (error) {
          console.error(`Failed to send email to ${subscriber.email}:`, error);
          failureCount++;
        }
      });

      await Promise.all(emailPromises);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({
      message: 'Newsletter sending completed',
      totalSubscribers: subscribers.length,
      successCount,
      failureCount
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
