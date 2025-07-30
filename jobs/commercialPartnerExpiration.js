const cron = require('node-cron');
const { CommercialPartner } = require('../models/CommercialPartner');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendCommercialPartnerExpirationWarning, sendCommercialPartnerExpiredEmail } = require('../utils/emailService');

// Check for expiring commercial partnerships (7 days before expiration)
const checkExpiringCommercialPartnerships = async () => {
  try {
    console.log('Checking for expiring commercial partnerships...');
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const expiringPartnerships = await CommercialPartner.find({
      status: 'active',
      expirationDate: {
        $lte: sevenDaysFromNow,
        $gt: new Date()
      },
      expirationWarningEmailSent: false
    }).populate('userId', 'name email');

    console.log(`Found ${expiringPartnerships.length} expiring commercial partnerships`);

    for (const partnership of expiringPartnerships) {
      try {
        // Send expiration warning email
        const emailResult = await sendCommercialPartnerExpirationWarning(
          partnership.userId.email,
          partnership.userId.name,
          {
            companyName: partnership.companyName,
            expirationDate: partnership.expirationDate
          }
        );

        if (emailResult.success) {
          // Mark warning email as sent
          partnership.expirationWarningEmailSent = true;
          await partnership.save();

          // Create notification
          const notification = new Notification({
            userId: partnership.userId,
            title: 'Commercial Partnership Expiring Soon',
            message: `Your commercial partnership for ${partnership.companyName} will expire on ${partnership.expirationDate.toLocaleDateString()}. Renew now to continue enjoying partner benefits.`,
            type: 'warning',
            data: {
              partnerId: partnership._id,
              companyName: partnership.companyName,
              expirationDate: partnership.expirationDate
            }
          });

          await notification.save();
          console.log(`Expiration warning sent for partnership: ${partnership.companyName}`);
        } else {
          console.error(`Failed to send expiration warning for partnership: ${partnership.companyName}`, emailResult.error);
        }
      } catch (error) {
        console.error(`Error processing expiring partnership ${partnership._id}:`, error);
      }
    }

    return {
      success: true,
      processed: expiringPartnerships.length
    };

  } catch (error) {
    console.error('Error checking expiring commercial partnerships:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check for expired commercial partnerships
const checkExpiredCommercialPartnerships = async () => {
  try {
    console.log('Checking for expired commercial partnerships...');
    
    const now = new Date();
    
    const expiredPartnerships = await CommercialPartner.find({
      status: 'active',
      expirationDate: { $lt: now }
    }).populate('userId', 'name email');

    console.log(`Found ${expiredPartnerships.length} expired commercial partnerships`);

    for (const partnership of expiredPartnerships) {
      try {
        // Update partnership status
        partnership.status = 'expired';
        await partnership.save();

        // Update user partner status
        const user = await User.findById(partnership.userId);
        if (user) {
          user.isPartner = false;
          user.partnerExpirationDate = null;
          await user.save();
        }

        // Send expired email if not already sent
        if (!partnership.expiredNotificationEmailSent) {
          const emailResult = await sendCommercialPartnerExpiredEmail(
            partnership.userId.email,
            partnership.userId.name,
            {
              companyName: partnership.companyName,
              expirationDate: partnership.expirationDate
            }
          );

          if (emailResult.success) {
            partnership.expiredNotificationEmailSent = true;
            await partnership.save();
          }
        }

        // Create notification
        const notification = new Notification({
          userId: partnership.userId,
          title: 'Commercial Partnership Expired',
          message: `Your commercial partnership for ${partnership.companyName} has expired. You can renew it anytime to restore your partner benefits.`,
          type: 'warning',
          data: {
            partnerId: partnership._id,
            companyName: partnership.companyName,
            expirationDate: partnership.expirationDate
          }
        });

        await notification.save();
        console.log(`Partnership expired and user updated: ${partnership.companyName}`);

      } catch (error) {
        console.error(`Error processing expired partnership ${partnership._id}:`, error);
      }
    }

    return {
      success: true,
      processed: expiredPartnerships.length
    };

  } catch (error) {
    console.error('Error checking expired commercial partnerships:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Start commercial partnership expiration jobs
const startCommercialPartnershipJobs = () => {
  console.log('Starting commercial partnership expiration jobs...');

  // Check for expiring partnerships daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily commercial partnership expiration check...');
    await checkExpiringCommercialPartnerships();
  });

  // Check for expired partnerships every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly expired commercial partnership check...');
    await checkExpiredCommercialPartnerships();
  });

  console.log('Commercial partnership expiration jobs started successfully');
};

module.exports = {
  checkExpiringCommercialPartnerships,
  checkExpiredCommercialPartnerships,
  startCommercialPartnershipJobs
};
