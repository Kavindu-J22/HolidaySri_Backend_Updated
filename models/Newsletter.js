const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced'],
    default: 'active'
  },
  subscriptionDate: {
    type: Date,
    default: Date.now
  },
  unsubscribeDate: {
    type: Date
  },
  source: {
    type: String,
    enum: ['website_footer', 'admin_import', 'api'],
    default: 'website_footer'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  // Track email campaigns sent to this subscriber
  emailsSent: {
    type: Number,
    default: 0
  },
  lastEmailSent: {
    type: Date
  },
  // Preferences
  preferences: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    categories: [{
      type: String,
      enum: ['destinations', 'offers', 'events', 'news', 'tips']
    }]
  },
  // Engagement tracking
  engagement: {
    totalOpens: {
      type: Number,
      default: 0
    },
    totalClicks: {
      type: Number,
      default: 0
    },
    lastOpened: {
      type: Date
    },
    lastClicked: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
newsletterSubscriberSchema.index({ email: 1 });
newsletterSubscriberSchema.index({ status: 1 });
newsletterSubscriberSchema.index({ subscriptionDate: -1 });
newsletterSubscriberSchema.index({ 'preferences.frequency': 1 });

// Static method to subscribe email
newsletterSubscriberSchema.statics.subscribeEmail = async function(email, source = 'website_footer', metadata = {}) {
  try {
    // Check if email already exists
    const existingSubscriber = await this.findOne({ email: email.toLowerCase() });
    
    if (existingSubscriber) {
      if (existingSubscriber.status === 'active') {
        return { 
          success: false, 
          message: 'Email is already subscribed to our newsletter',
          alreadySubscribed: true,
          subscriber: existingSubscriber
        };
      } else {
        // Reactivate if previously unsubscribed
        existingSubscriber.status = 'active';
        existingSubscriber.subscriptionDate = new Date();
        existingSubscriber.unsubscribeDate = undefined;
        existingSubscriber.source = source;
        if (metadata.ipAddress) existingSubscriber.ipAddress = metadata.ipAddress;
        if (metadata.userAgent) existingSubscriber.userAgent = metadata.userAgent;
        
        await existingSubscriber.save();
        return { 
          success: true, 
          message: 'Successfully resubscribed to our newsletter',
          resubscribed: true,
          subscriber: existingSubscriber
        };
      }
    }

    // Create new subscriber
    const subscriber = new this({
      email: email.toLowerCase(),
      source,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      preferences: {
        categories: ['destinations', 'offers', 'events', 'news', 'tips'] // Default to all categories
      }
    });

    await subscriber.save();
    return { 
      success: true, 
      message: 'Successfully subscribed to our newsletter',
      newSubscriber: true,
      subscriber
    };
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return { 
      success: false, 
      message: 'Failed to subscribe to newsletter. Please try again.',
      error: error.message
    };
  }
};

// Static method to unsubscribe email
newsletterSubscriberSchema.statics.unsubscribeEmail = async function(email) {
  try {
    const subscriber = await this.findOne({ email: email.toLowerCase() });
    
    if (!subscriber) {
      return { success: false, message: 'Email not found in our newsletter list' };
    }

    if (subscriber.status === 'unsubscribed') {
      return { success: false, message: 'Email is already unsubscribed' };
    }

    subscriber.status = 'unsubscribed';
    subscriber.unsubscribeDate = new Date();
    await subscriber.save();

    return { success: true, message: 'Successfully unsubscribed from newsletter' };
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return { success: false, message: 'Failed to unsubscribe. Please try again.' };
  }
};

// Static method to get subscriber stats
newsletterSubscriberSchema.statics.getStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSubscribers = await this.countDocuments();
    const activeSubscribers = await this.countDocuments({ status: 'active' });
    const recentSubscribers = await this.countDocuments({
      subscriptionDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    return {
      total: totalSubscribers,
      active: activeSubscribers,
      recent: recentSubscribers,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Newsletter stats error:', error);
    return null;
  }
};

// Instance method to track email sent
newsletterSubscriberSchema.methods.trackEmailSent = function() {
  this.emailsSent += 1;
  this.lastEmailSent = new Date();
  return this.save();
};

// Instance method to track email opened
newsletterSubscriberSchema.methods.trackEmailOpened = function() {
  this.engagement.totalOpens += 1;
  this.engagement.lastOpened = new Date();
  return this.save();
};

// Instance method to track email clicked
newsletterSubscriberSchema.methods.trackEmailClicked = function() {
  this.engagement.totalClicks += 1;
  this.engagement.lastClicked = new Date();
  return this.save();
};

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);

module.exports = NewsletterSubscriber;
