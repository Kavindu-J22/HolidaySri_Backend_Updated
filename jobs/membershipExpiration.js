const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMembershipExpirationWarning, sendMembershipExpiredEmail } = require('../utils/emailService');

// Check for memberships expiring in 3 days and send warning
const checkExpiringMemberships = async () => {
  try {
    console.log('Checking for expiring memberships...');
    
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // Find memberships expiring in 1-3 days
    const expiringUsers = await User.find({
      isMember: true,
      membershipExpirationDate: {
        $gte: oneDayFromNow,
        $lte: threeDaysFromNow
      }
    });

    console.log(`Found ${expiringUsers.length} memberships expiring soon`);

    for (const user of expiringUsers) {
      try {
        // Send expiration warning notification
        await Notification.createNotification(
          user._id,
          '⚠️ Membership Expiring Soon',
          `Your Holidaysri ${user.membershipType} membership expires on ${user.membershipExpirationDate.toLocaleDateString()}. Renew now to continue enjoying premium benefits!`,
          'warning',
          {
            membershipExpiring: true,
            expirationDate: user.membershipExpirationDate,
            membershipType: user.membershipType
          },
          'high'
        );

        // Send expiration warning email
        await sendMembershipExpirationWarning(
          user.email,
          user.name,
          user.membershipType,
          user.membershipExpirationDate
        );

        console.log(`Sent expiration warning to user: ${user.email}`);
      } catch (error) {
        console.error(`Error sending expiration warning to user ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking expiring memberships:', error);
  }
};

// Check for expired memberships and update status
const checkExpiredMemberships = async () => {
  try {
    console.log('Checking for expired memberships...');

    const now = new Date();

    // Find expired memberships
    const expiredUsers = await User.find({
      isMember: true,
      membershipExpirationDate: { $lt: now }
    });

    console.log(`Found ${expiredUsers.length} expired memberships`);

    for (const user of expiredUsers) {
      try {
        console.log(`Processing expired membership for user: ${user.email}`);

        // Update user membership status
        user.isMember = false;
        user.membershipType = null;
        user.membershipStartDate = null;
        user.membershipExpirationDate = null;
        await user.save();

        console.log(`Updated user status for: ${user.email}`);

        // Send expiration notification
        await Notification.createNotification(
          user._id,
          '❌ Membership Expired',
          'Your Holidaysri membership has expired. You can still use our platform, but premium features are no longer available. Renew your membership to restore all benefits.',
          'warning',
          {
            membershipExpired: true,
            expiredDate: now
          },
          'high'
        );

        console.log(`Created notification for: ${user.email}`);

        // Send expiration email
        try {
          const emailResult = await sendMembershipExpiredEmail(user.email, user.name);
          console.log(`Email sent to ${user.email}:`, emailResult);
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
        }

        console.log(`Successfully expired membership for user: ${user.email}`);
      } catch (error) {
        console.error(`Error expiring membership for user ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking expired memberships:', error);
  }
};

// Schedule jobs
const startMembershipJobs = () => {
  console.log('Starting membership expiration jobs...');

  // Check for expiring memberships daily at 9 AM
  cron.schedule('0 9 * * *', () => {
    console.log('Running membership expiration warning job...');
    checkExpiringMemberships();
  }, {
    timezone: "Asia/Colombo"
  });

  // Check for expired memberships every 10 minutes (for testing - change to hourly in production)
  cron.schedule('*/10 * * * *', () => {
    console.log('Running membership expiration job...');
    checkExpiredMemberships();
  }, {
    timezone: "Asia/Colombo"
  });

  console.log('Membership expiration jobs scheduled successfully');
};

module.exports = {
  startMembershipJobs,
  checkExpiringMemberships,
  checkExpiredMemberships
};
