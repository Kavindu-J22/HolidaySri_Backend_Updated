const cron = require('node-cron');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendAdvertisementExpiredEmail, sendAdvertisementExpiringWarning } = require('../utils/emailService');

// Check for advertisements expiring in 24 hours and send warning
const checkExpiringAdvertisements = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expiring advertisements...');

    const twentyFourHoursFromNow = new Date();
    twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);

    const sixHoursFromNow = new Date();
    sixHoursFromNow.setHours(sixHoursFromNow.getHours() + 6);

    // Find advertisements expiring in 6-24 hours
    const expiringAds = await Advertisement.find({
      status: { $in: ['active', 'Published'] },
      expiresAt: {
        $gte: sixHoursFromNow,
        $lte: twentyFourHoursFromNow
      }
    }).populate('userId', 'email name').lean().limit(50); // Process max 50 at a time

    console.log(`[CRON] Found ${expiringAds.length} advertisements expiring soon`);

    if (expiringAds.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in batches
    const batchSize = 5;
    for (let i = 0; i < expiringAds.length; i += batchSize) {
      const batch = expiringAds.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (ad) => {
          try {
            if (!ad.userId) {
              console.warn(`[CRON] Advertisement ${ad.slotId} has no user associated`);
              return;
            }

            const user = ad.userId;
            const categoryName = ad.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const expirationDate = new Date(ad.expiresAt);

            // Send expiration warning notification and email in parallel
            const [notificationResult, emailResult] = await Promise.allSettled([
              Notification.createNotification(
                user._id,
                '⚠️ Advertisement Expiring Soon',
                `Your ${categoryName} advertisement slot (${ad.slotId}) expires on ${expirationDate.toLocaleDateString()} at ${expirationDate.toLocaleTimeString()}. Use "Pause Expiration" to prevent expiration or renew your slot.`,
                'warning',
                {
                  advertisementExpiring: true,
                  slotId: ad.slotId,
                  category: ad.category,
                  expirationDate: ad.expiresAt,
                  advertisementId: ad._id
                },
                'high'
              ),
              Promise.race([
                sendAdvertisementExpiringWarning(
                  user.email,
                  user.name,
                  ad.slotId,
                  categoryName,
                  ad.expiresAt
                ),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Email timeout')), 30000)
                )
              ])
            ]);

            if (notificationResult.status === 'fulfilled') {
              console.log(`[CRON] Sent expiration warning for ad ${ad.slotId} to user: ${user.email}`);
              processedCount++;
            }
          } catch (error) {
            console.error(`[CRON] Error sending expiration warning for ad ${ad.slotId}:`, error.message);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < expiringAds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expiring advertisements check completed: ${processedCount}/${expiringAds.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiringAds.length,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expiring advertisements:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Check for expired advertisements and update status
const checkExpiredAdvertisements = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expired advertisements...');

    const now = new Date();

    // Find expired advertisements with limit
    const expiredAds = await Advertisement.find({
      status: { $in: ['active', 'Published'] },
      expiresAt: { $lt: now, $ne: null }
    }).populate('userId', 'email name').lean().limit(100); // Process max 100 at a time

    console.log(`[CRON] Found ${expiredAds.length} expired advertisements`);

    if (expiredAds.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < expiredAds.length; i += batchSize) {
      const batch = expiredAds.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (ad) => {
          try {
            console.log(`[CRON] Processing expired advertisement: ${ad.slotId}`);

            // Update advertisement status to expired
            await Advertisement.findByIdAndUpdate(ad._id, {
              status: 'expired'
            });

            console.log(`[CRON] Updated advertisement status for: ${ad.slotId}`);

            if (!ad.userId) {
              console.warn(`[CRON] Advertisement ${ad.slotId} has no user associated`);
              return;
            }

            const user = ad.userId;
            const categoryName = ad.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Send expiration notification
            await Notification.createNotification(
              user._id,
              '❌ Advertisement Expired',
              `Your ${categoryName} advertisement slot (${ad.slotId}) has expired. You can renew this slot to continue advertising your business on our platform.`,
              'error',
              {
                advertisementExpired: true,
                slotId: ad.slotId,
                category: ad.category,
                expiredDate: now,
                advertisementId: ad._id
              },
              'high'
            );

            console.log(`[CRON] Created notification for expired ad: ${ad.slotId}`);

            // Send expiration email asynchronously (don't wait for it)
            sendAdvertisementExpiredEmail(
              user.email,
              user.name,
              ad.slotId,
              categoryName,
              ad.expiresAt
            ).catch(emailError => {
              console.error(`[CRON] Failed to send email for ad ${ad.slotId} to ${user.email}:`, emailError.message);
            });

            console.log(`[CRON] Successfully expired advertisement: ${ad.slotId}`);
            processedCount++;
          } catch (error) {
            console.error(`[CRON] Error expiring advertisement ${ad.slotId}:`, error.message);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < expiredAds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expired advertisements check completed: ${processedCount}/${expiredAds.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiredAds.length,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expired advertisements:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Run startup checks for expired advertisements
const runAdvertisementStartupChecks = async () => {
  console.log('[STARTUP] Running advertisement startup checks...');

  try {
    // Check for expired advertisements immediately on startup
    const expiredResult = await checkExpiredAdvertisements();
    console.log(`[STARTUP] Expired advertisements check: ${expiredResult.processed} processed in ${expiredResult.duration}ms`);

    // Check for expiring advertisements
    const expiringResult = await checkExpiringAdvertisements();
    console.log(`[STARTUP] Expiring advertisements check: ${expiringResult.processed} processed in ${expiringResult.duration}ms`);

    console.log('[STARTUP] Advertisement startup checks completed');
  } catch (error) {
    console.error('[STARTUP] Error during advertisement startup checks:', error.message);
  }
};

// Schedule jobs
const startAdvertisementJobs = () => {
  console.log('[CRON] Starting advertisement expiration jobs...');

  // Check for expiring advertisements every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Running advertisement expiration warning job...');
    try {
      const result = await checkExpiringAdvertisements();
      console.log(`[CRON] 6-hourly expiring check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] 6-hourly expiring check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  // Check for expired advertisements every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running advertisement expiration job...');
    try {
      const result = await checkExpiredAdvertisements();
      console.log(`[CRON] 30-minute expired check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] 30-minute expired check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  console.log('[CRON] Advertisement expiration jobs scheduled successfully');
  console.log('[CRON] - 6-hourly expiring check: Every 6 hours at :00');
  console.log('[CRON] - 30-minute expired check: Every 30 minutes');

  // Run startup checks after a short delay to ensure database is ready
  setTimeout(runAdvertisementStartupChecks, 4000);
};

module.exports = {
  startAdvertisementJobs,
  checkExpiringAdvertisements,
  checkExpiredAdvertisements,
  runAdvertisementStartupChecks
};
