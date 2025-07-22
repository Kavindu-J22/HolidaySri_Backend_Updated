const cron = require('node-cron');
const Agent = require('../models/Agent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPromoCodeExpirationWarning, sendPromoCodeExpiredNotification } = require('./emailService');

// Check for promo codes expiring in 2 days and send warning emails
const checkExpiringPromoCodes = async () => {
  try {
    console.log('🔍 Checking for promo codes expiring in 2 days...');
    
    // Calculate date 2 days from now
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(23, 59, 59, 999); // End of day
    
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    oneDayFromNow.setHours(23, 59, 59, 999); // End of day
    
    // Find agents whose promo codes expire in exactly 2 days
    const expiringAgents = await Agent.find({
      expirationDate: {
        $gte: oneDayFromNow,
        $lte: twoDaysFromNow
      },
      isActive: true, // Only warn active agents
      expirationWarningEmailSent: { $ne: true } // Haven't sent warning email yet
    }).populate('userId', 'name email');
    
    console.log(`📧 Found ${expiringAgents.length} promo codes expiring in 2 days`);
    
    for (const agent of expiringAgents) {
      if (agent.userId && agent.userId.email) {
        try {
          // Send warning email
          const emailResult = await sendPromoCodeExpirationWarning(
            agent.userId.email,
            agent.userId.name,
            agent.promoCode,
            agent.promoCodeType,
            agent.expirationDate
          );
          
          if (emailResult.success) {
            // Mark warning email as sent
            agent.expirationWarningEmailSent = true;
            await agent.save();
            
            // Create notification
            await Notification.createNotification(
              agent.userId._id,
              '⚠️ Promo Code Expiring Soon',
              `Your ${agent.promoCodeType} promo code ${agent.promoCode} expires in 2 days. Renew now to continue earning!`,
              'warning',
              {
                promoCode: agent.promoCode,
                promoType: agent.promoCodeType,
                expirationDate: agent.expirationDate,
                action: 'renew'
              },
              'high'
            );
            
            console.log(`✅ Warning email sent to ${agent.userId.email} for promo code ${agent.promoCode}`);
          } else {
            console.error(`❌ Failed to send warning email to ${agent.userId.email}:`, emailResult.error);
          }
        } catch (error) {
          console.error(`❌ Error processing warning for agent ${agent.promoCode}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in checkExpiringPromoCodes:', error);
  }
};

// Check for expired promo codes and deactivate them
const checkExpiredPromoCodes = async () => {
  try {
    console.log('🔍 Checking for expired promo codes...');
    
    const now = new Date();
    
    // Find agents whose promo codes have expired and are still active
    const expiredAgents = await Agent.find({
      expirationDate: { $lt: now },
      isActive: true
    }).populate('userId', 'name email');
    
    console.log(`🔴 Found ${expiredAgents.length} expired promo codes to deactivate`);
    
    for (const agent of expiredAgents) {
      try {
        // Deactivate the promo code
        agent.isActive = false;
        agent.expiredNotificationEmailSent = true; // Mark as processed
        await agent.save();
        
        if (agent.userId && agent.userId.email) {
          // Send expiration notification email
          const emailResult = await sendPromoCodeExpiredNotification(
            agent.userId.email,
            agent.userId.name,
            agent.promoCode,
            agent.promoCodeType
          );
          
          if (emailResult.success) {
            console.log(`✅ Expiration email sent to ${agent.userId.email} for promo code ${agent.promoCode}`);
          } else {
            console.error(`❌ Failed to send expiration email to ${agent.userId.email}:`, emailResult.error);
          }
          
          // Create notification
          await Notification.createNotification(
            agent.userId._id,
            '🔴 Promo Code Expired',
            `Your ${agent.promoCodeType} promo code ${agent.promoCode} has expired and been deactivated. Renew now to continue earning!`,
            'system',
            {
              promoCode: agent.promoCode,
              promoType: agent.promoCodeType,
              expirationDate: agent.expirationDate,
              action: 'renew'
            },
            'high'
          );
        }
        
        console.log(`🔴 Deactivated expired promo code: ${agent.promoCode}`);
      } catch (error) {
        console.error(`❌ Error processing expired agent ${agent.promoCode}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkExpiredPromoCodes:', error);
  }
};

// Initialize the scheduler
const initializePromoCodeScheduler = () => {
  console.log('🚀 Initializing promo code expiration scheduler...');
  
  // Run every day at 9:00 AM to check for expiring promo codes (2 days warning)
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ Running daily expiration warning check...');
    checkExpiringPromoCodes();
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Sri Lanka timezone
  });
  
  // Run every hour to check for expired promo codes
  cron.schedule('0 * * * *', () => {
    console.log('⏰ Running hourly expiration check...');
    checkExpiredPromoCodes();
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Sri Lanka timezone
  });
  
  // Run immediately on startup to catch any missed expirations
  setTimeout(() => {
    console.log('🔄 Running initial expiration checks...');
    checkExpiringPromoCodes();
    checkExpiredPromoCodes();
  }, 5000); // Wait 5 seconds after startup
  
  console.log('✅ Promo code expiration scheduler initialized');
};

module.exports = {
  initializePromoCodeScheduler,
  checkExpiringPromoCodes,
  checkExpiredPromoCodes
};
