const cron = require('node-cron');
const SlotNotification = require('../models/SlotNotification');
const HomeBannerSlot = require('../models/HomeBannerSlot');
const Advertisement = require('../models/Advertisement');
const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Check slot availability and notify waiting users
const checkSlotAvailabilityAndNotify = async () => {
  const startTime = Date.now();
  let notifiedCount = 0;

  try {
    console.log('[CRON] Checking slot availability for notifications...');

    // Get all active home banner slots
    const activeSlots = await HomeBannerSlot.find({ isActive: true })
      .populate({
        path: 'publishedAdId',
        select: 'status expiresAt'
      })
      .select('slotNumber publishedAdId');

    // Count available slots
    let availableSlots = 0;
    const occupiedSlots = new Set();

    for (const slot of activeSlots) {
      if (slot.publishedAdId) {
        const ad = slot.publishedAdId;
        
        // Check if advertisement is expired
        const isExpired = ad.status === 'expired' || 
                         (ad.expiresAt && new Date(ad.expiresAt) < new Date());
        
        if (isExpired) {
          // Deactivate expired slot
          await HomeBannerSlot.findByIdAndUpdate(slot._id, { isActive: false });
        } else {
          occupiedSlots.add(slot.slotNumber);
        }
      }
    }

    availableSlots = 6 - occupiedSlots.size;

    console.log(`[CRON] Available slots: ${availableSlots}/6`);

    // If no slots available, skip notification
    if (availableSlots === 0) {
      console.log('[CRON] No available slots. Skipping notifications.');
      return { success: true, notified: 0, duration: Date.now() - startTime };
    }

    // Get pending notification requests
    const pendingNotifications = await SlotNotification.find({
      isNotified: false
    })
      .populate('userId', 'name email')
      .limit(50) // Process max 50 at a time
      .lean();

    console.log(`[CRON] Found ${pendingNotifications.length} pending notification requests`);

    if (pendingNotifications.length === 0) {
      return { success: true, notified: 0, duration: Date.now() - startTime };
    }

    const transporter = createTransporter();

    // Process notifications in batches
    const batchSize = 5;
    for (let i = 0; i < pendingNotifications.length; i += batchSize) {
      const batch = pendingNotifications.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (notification) => {
          try {
            // Send email notification
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: notification.email,
              subject: '🎉 Home Banner Slot Available - Holidaysri',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      color: #333;
                    }
                    .container {
                      max-width: 600px;
                      margin: 0 auto;
                      padding: 20px;
                      background-color: #f9f9f9;
                    }
                    .header {
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 30px;
                      text-align: center;
                      border-radius: 10px 10px 0 0;
                    }
                    .content {
                      background: white;
                      padding: 30px;
                      border-radius: 0 0 10px 10px;
                    }
                    .button {
                      display: inline-block;
                      padding: 12px 30px;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      text-decoration: none;
                      border-radius: 5px;
                      margin-top: 20px;
                    }
                    .slots-info {
                      background: #f0f4ff;
                      padding: 15px;
                      border-radius: 5px;
                      margin: 20px 0;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🎉 Great News!</h1>
                      <p>Home Banner Slots Are Now Available</p>
                    </div>
                    <div class="content">
                      <p>Hello ${notification.userId?.name || 'Valued User'},</p>
                      
                      <p>Good news! We wanted to let you know that <strong>${availableSlots} home banner slot${availableSlots > 1 ? 's are' : ' is'} now available</strong> on Holidaysri.</p>
                      
                      <div class="slots-info">
                        <h3>📊 Current Availability</h3>
                        <p><strong>${availableSlots} out of 6 slots available</strong></p>
                        <p>Don't miss this opportunity to showcase your business on our home page!</p>
                      </div>
                      
                      <p>Home banner slots offer premium visibility with:</p>
                      <ul>
                        <li>✨ Prime placement on the home page</li>
                        <li>🎯 Maximum exposure to all visitors</li>
                        <li>📈 Higher click-through rates</li>
                        <li>💼 Professional slideshow presentation</li>
                      </ul>
                      
                      <p>Click the button below to publish your home banner advertisement now:</p>
                      
                      <center>
                        <a href="${process.env.FRONTEND_URL || 'https://www.holidaysri.com'}/profile?section=advertisements" class="button">
                          Publish My Banner Now
                        </a>
                      </center>
                      
                      <p style="margin-top: 30px; font-size: 14px; color: #666;">
                        <em>Note: Slots are allocated on a first-come, first-served basis. Act quickly to secure your preferred slot!</em>
                      </p>
                      
                      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                      
                      <p style="font-size: 12px; color: #999;">
                        You received this email because you requested to be notified when home banner slots become available on Holidaysri.
                      </p>
                    </div>
                  </div>
                </body>
                </html>
              `
            };

            await transporter.sendMail(mailOptions);

            // Mark notification as sent
            await SlotNotification.findByIdAndUpdate(notification._id, {
              isNotified: true,
              notifiedAt: new Date()
            });

            notifiedCount++;
            console.log(`[CRON] Notified user: ${notification.email}`);
          } catch (error) {
            console.error(`[CRON] Error notifying ${notification.email}:`, error.message);
          }
        })
      );

      // Small delay between batches to avoid overwhelming email service
      if (i + batchSize < pendingNotifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Slot notification check completed. Notified: ${notifiedCount}, Duration: ${duration}ms`);

    return { success: true, notified: notifiedCount, duration };
  } catch (error) {
    console.error('[CRON] Error in slot notification job:', error);
    return { success: false, error: error.message, duration: Date.now() - startTime };
  }
};

// Start the cron job - runs every hour
const startSlotNotificationJob = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Starting hourly slot notification check...');
    await checkSlotAvailabilityAndNotify();
  });

  console.log('[CRON] Slot notification job scheduled (runs hourly)');
};

module.exports = {
  startSlotNotificationJob,
  checkSlotAvailabilityAndNotify
};

