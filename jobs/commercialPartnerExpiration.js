const cron = require('node-cron');
const { CommercialPartner } = require('../models/CommercialPartner');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendCommercialPartnerExpirationWarning, sendCommercialPartnerExpiredEmail } = require('../utils/emailService');

// Check for expiring commercial partnerships (7 days before expiration)
const checkExpiringCommercialPartnerships = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expiring commercial partnerships...');

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Use lean() for better performance and limit batch size
    const expiringPartnerships = await CommercialPartner.find({
      status: 'active',
      expirationDate: {
        $lte: sevenDaysFromNow,
        $gt: new Date()
      },
      expirationWarningEmailSent: false
    })
    .populate('userId', 'name email')
    .lean()
    .limit(50); // Process max 50 at a time to prevent blocking

    console.log(`[CRON] Found ${expiringPartnerships.length} expiring commercial partnerships`);

    if (expiringPartnerships.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in smaller batches to prevent event loop blocking
    const batchSize = 5;
    for (let i = 0; i < expiringPartnerships.length; i += batchSize) {
      const batch = expiringPartnerships.slice(i, i + batchSize);

      // Process batch with Promise.allSettled to handle individual failures
      const results = await Promise.allSettled(
        batch.map(async (partnership) => {
          try {
            // Send expiration warning email with timeout
            const emailPromise = sendCommercialPartnerExpirationWarning(
              partnership.userId.email,
              partnership.userId.name,
              {
                companyName: partnership.companyName,
                expirationDate: partnership.expirationDate
              }
            );

            // Add 30-second timeout to prevent hanging
            const emailResult = await Promise.race([
              emailPromise,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Email timeout')), 30000)
              )
            ]);

            if (emailResult.success) {
              // Update partnership and create notification in parallel
              const [updateResult] = await Promise.allSettled([
                CommercialPartner.findByIdAndUpdate(partnership._id, {
                  expirationWarningEmailSent: true
                }),
                new Notification({
                  userId: partnership.userId._id,
                  title: 'Commercial Partnership Expiring Soon',
                  message: `Your commercial partnership for ${partnership.companyName} will expire on ${new Date(partnership.expirationDate).toLocaleDateString()}. Renew now to continue enjoying partner benefits.`,
                  type: 'warning',
                  data: {
                    partnerId: partnership._id,
                    companyName: partnership.companyName,
                    expirationDate: partnership.expirationDate
                  }
                }).save()
              ]);

              if (updateResult.status === 'fulfilled') {
                console.log(`[CRON] Expiration warning sent for partnership: ${partnership.companyName}`);
                processedCount++;
              }
            } else {
              console.error(`[CRON] Failed to send expiration warning for partnership: ${partnership.companyName}`, emailResult.error);
            }
          } catch (error) {
            console.error(`[CRON] Error processing expiring partnership ${partnership._id}:`, error.message);
          }
        })
      );

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < expiringPartnerships.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expiring partnerships check completed: ${processedCount}/${expiringPartnerships.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiringPartnerships.length,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expiring commercial partnerships:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Check for expired commercial partnerships
const checkExpiredCommercialPartnerships = async () => {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    console.log('[CRON] Checking for expired commercial partnerships...');

    const now = new Date();

    // Use lean() for better performance and limit batch size
    const expiredPartnerships = await CommercialPartner.find({
      status: 'active',
      expirationDate: { $lt: now }
    })
    .populate('userId', 'name email')
    .lean()
    .limit(100); // Process max 100 at a time

    console.log(`[CRON] Found ${expiredPartnerships.length} expired commercial partnerships`);

    if (expiredPartnerships.length === 0) {
      return { success: true, processed: 0, duration: Date.now() - startTime };
    }

    // Process in smaller batches to prevent event loop blocking
    const batchSize = 10;
    for (let i = 0; i < expiredPartnerships.length; i += batchSize) {
      const batch = expiredPartnerships.slice(i, i + batchSize);

      // Process batch with Promise.allSettled to handle individual failures
      await Promise.allSettled(
        batch.map(async (partnership) => {
          try {
            // Use transactions for data consistency
            const session = await require('mongoose').startSession();
            session.startTransaction();

            try {
              // Update partnership status
              await CommercialPartner.findByIdAndUpdate(
                partnership._id,
                {
                  status: 'expired',
                  expiredNotificationEmailSent: true // Mark as sent to prevent duplicate processing
                },
                { session }
              );

              // Update user partner status
              await User.findByIdAndUpdate(
                partnership.userId._id,
                {
                  isPartner: false,
                  partnerExpirationDate: null
                },
                { session }
              );

              // Create notification
              await new Notification({
                userId: partnership.userId._id,
                title: 'Commercial Partnership Expired',
                message: `Your commercial partnership for ${partnership.companyName} has expired. You can renew it anytime to restore your partner benefits.`,
                type: 'warning',
                data: {
                  partnerId: partnership._id,
                  companyName: partnership.companyName,
                  expirationDate: partnership.expirationDate
                }
              }).save({ session });

              await session.commitTransaction();
              session.endSession();

              // Send expired email asynchronously (don't wait for it)
              if (!partnership.expiredNotificationEmailSent) {
                sendCommercialPartnerExpiredEmail(
                  partnership.userId.email,
                  partnership.userId.name,
                  {
                    companyName: partnership.companyName,
                    expirationDate: partnership.expirationDate
                  }
                ).catch(error => {
                  console.error(`[CRON] Failed to send expired email for ${partnership.companyName}:`, error.message);
                });
              }

              console.log(`[CRON] Partnership expired and user updated: ${partnership.companyName}`);
              processedCount++;

            } catch (error) {
              await session.abortTransaction();
              session.endSession();
              throw error;
            }

          } catch (error) {
            console.error(`[CRON] Error processing expired partnership ${partnership._id}:`, error.message);
          }
        })
      );

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < expiredPartnerships.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expired partnerships check completed: ${processedCount}/${expiredPartnerships.length} processed in ${duration}ms`);

    return {
      success: true,
      processed: processedCount,
      total: expiredPartnerships.length,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error checking expired commercial partnerships:', error.message);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      duration
    };
  }
};

// Run startup checks for expired partnerships
const runStartupChecks = async () => {
  console.log('[STARTUP] Running commercial partnership startup checks...');

  try {
    // Check for expired partnerships immediately on startup
    const expiredResult = await checkExpiredCommercialPartnerships();
    console.log(`[STARTUP] Expired partnerships check: ${expiredResult.processed} processed in ${expiredResult.duration}ms`);

    // Check for expiring partnerships
    const expiringResult = await checkExpiringCommercialPartnerships();
    console.log(`[STARTUP] Expiring partnerships check: ${expiringResult.processed} processed in ${expiringResult.duration}ms`);

    console.log('[STARTUP] Commercial partnership startup checks completed');
  } catch (error) {
    console.error('[STARTUP] Error during commercial partnership startup checks:', error.message);
  }
};

// Start commercial partnership expiration jobs
const startCommercialPartnershipJobs = () => {
  console.log('[CRON] Starting commercial partnership expiration jobs...');

  // Check for expiring partnerships daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily commercial partnership expiration check...');
    try {
      const result = await checkExpiringCommercialPartnerships();
      console.log(`[CRON] Daily expiring check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] Daily expiring check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Sri Lanka timezone
  });

  // Check for expired partnerships every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running hourly expired commercial partnership check...');
    try {
      const result = await checkExpiredCommercialPartnerships();
      console.log(`[CRON] Hourly expired check completed: ${result.processed} processed`);
    } catch (error) {
      console.error('[CRON] Hourly expired check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Sri Lanka timezone
  });

  console.log('[CRON] Commercial partnership expiration jobs started successfully');
  console.log('[CRON] - Daily expiring check: 9:00 AM (Asia/Colombo)');
  console.log('[CRON] - Hourly expired check: Every hour at :00');

  // Run startup checks after a short delay to ensure database is ready
  setTimeout(runStartupChecks, 5000);
};

module.exports = {
  checkExpiringCommercialPartnerships,
  checkExpiredCommercialPartnerships,
  startCommercialPartnershipJobs,
  runStartupChecks
};
