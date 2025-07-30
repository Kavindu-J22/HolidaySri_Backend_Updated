const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMembershipExpirationWarning, sendMembershipExpiredEmail } = require('../utils/emailService');

// Check for memberships expiring in 3 days and send warning
const checkExpiringMemberships = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expiring memberships...');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // Find memberships expiring in 1-3 days with limit
    const expiringUsers = await User.find({
      isMember: true,
      membershipExpirationDate: {
        $gte: oneDayFromNow,
        $lte: threeDaysFromNow
      }
    }).lean().limit(50); // Process max 50 at a time

    console.log(`[CRON] Found ${expiringUsers.length} memberships expiring soon`);

    if (expiringUsers.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in batches
    const batchSize = 5;
    for (let i = 0; i < expiringUsers.length; i += batchSize) {
      const batch = expiringUsers.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            // Send expiration warning notification and email in parallel
            const [notificationResult, emailResult] = await Promise.allSettled([
              Notification.createNotification(
                user._id,
                '⚠️ Membership Expiring Soon',
                `Your Holidaysri ${user.membershipType} membership expires on ${new Date(user.membershipExpirationDate).toLocaleDateString()}. Renew now to continue enjoying premium benefits!`,
                'warning',
                {
                  membershipExpiring: true,
                  expirationDate: user.membershipExpirationDate,
                  membershipType: user.membershipType
                },
                'high'
              ),
              Promise.race([
                sendMembershipExpirationWarning(
                  user.email,
                  user.name,
                  user.membershipType,
                  user.membershipExpirationDate
                ),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Email timeout')), 30000)
                )
              ])
            ]);

            if (notificationResult.status === 'fulfilled') {
              console.log(`[CRON] Sent expiration warning to user: ${user.email}`);
              processedCount++;
            }
          } catch (error) {
            console.error(`[CRON] Error sending expiration warning to user ${user.email}:`, error.message);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < expiringUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expiring memberships check completed: ${processedCount}/${expiringUsers.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiringUsers.length,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expiring memberships:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Check for expired memberships and update status
const checkExpiredMemberships = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expired memberships...');

    const now = new Date();

    // Find expired memberships with limit
    const expiredUsers = await User.find({
      isMember: true,
      membershipExpirationDate: { $lt: now }
    }).lean().limit(100); // Process max 100 at a time

    console.log(`[CRON] Found ${expiredUsers.length} expired memberships`);

    if (expiredUsers.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < expiredUsers.length; i += batchSize) {
      const batch = expiredUsers.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            console.log(`[CRON] Processing expired membership for user: ${user.email}`);

            // Update user membership status
            await User.findByIdAndUpdate(user._id, {
              isMember: false,
              membershipType: null,
              membershipStartDate: null,
              membershipExpirationDate: null
            });

            console.log(`[CRON] Updated user status for: ${user.email}`);

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

            console.log(`[CRON] Created notification for: ${user.email}`);

            // Send expiration email asynchronously (don't wait for it)
            sendMembershipExpiredEmail(user.email, user.name).catch(emailError => {
              console.error(`[CRON] Failed to send email to ${user.email}:`, emailError.message);
            });

            console.log(`[CRON] Successfully expired membership for user: ${user.email}`);
            processedCount++;
          } catch (error) {
            console.error(`[CRON] Error expiring membership for user ${user.email}:`, error.message);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < expiredUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expired memberships check completed: ${processedCount}/${expiredUsers.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiredUsers.length,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expired memberships:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Run startup checks for expired memberships
const runMembershipStartupChecks = async () => {
  console.log('[STARTUP] Running membership startup checks...');

  try {
    // Check for expired memberships immediately on startup
    const expiredResult = await checkExpiredMemberships();
    console.log(`[STARTUP] Expired memberships check: ${expiredResult.processed} processed in ${expiredResult.duration}ms`);

    // Check for expiring memberships
    const expiringResult = await checkExpiringMemberships();
    console.log(`[STARTUP] Expiring memberships check: ${expiringResult.processed} processed in ${expiringResult.duration}ms`);

    console.log('[STARTUP] Membership startup checks completed');
  } catch (error) {
    console.error('[STARTUP] Error during membership startup checks:', error.message);
  }
};

// Schedule jobs
const startMembershipJobs = () => {
  console.log('[CRON] Starting membership expiration jobs...');

  // Check for expiring memberships daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running membership expiration warning job...');
    try {
      const result = await checkExpiringMemberships();
      console.log(`[CRON] Daily expiring check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] Daily expiring check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  // Check for expired memberships every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running membership expiration job...');
    try {
      const result = await checkExpiredMemberships();
      console.log(`[CRON] Hourly expired check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] Hourly expired check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  console.log('[CRON] Membership expiration jobs scheduled successfully');
  console.log('[CRON] - Daily expiring check: 9:00 AM (Asia/Colombo)');
  console.log('[CRON] - Hourly expired check: Every hour at :00');

  // Run startup checks after a short delay to ensure database is ready
  setTimeout(runMembershipStartupChecks, 3000);
};

module.exports = {
  startMembershipJobs,
  checkExpiringMemberships,
  checkExpiredMemberships,
  runMembershipStartupChecks
};
