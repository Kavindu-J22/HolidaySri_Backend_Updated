const cron = require('node-cron');
const axios = require('axios');

// Function to check and process HSD Leader Board period end rewards
const checkHSDPeriodEnd = async () => {
  try {
    console.log('[HSD-CRON] Checking for HSD Leader Board period end...');
    
    // Call the API endpoint to process period end rewards
    const response = await axios.post(`${process.env.SERVER_URL || 'https://holidaysri-backend-9xm4.onrender.com'}/api/hsd-leaderboard/process-period-end`);
    
    if (response.data.results && response.data.results.length > 0) {
      console.log(`[HSD-CRON] Period end processed for ${response.data.period}:`);
      response.data.results.forEach(result => {
        console.log(`[HSD-CRON] - ${result.name} (Rank #${result.rank}): ${result.status}`);
      });
    } else {
      console.log('[HSD-CRON] No period end processing needed at this time');
    }
    
  } catch (error) {
    console.error('[HSD-CRON] Error checking HSD period end:', error.message);
  }
};

// Function to start HSD Leader Board reward jobs
const startHSDLeaderBoardJobs = () => {
  console.log('[CRON] Starting HSD Leader Board reward jobs...');
  
  // Check every hour for period end (more frequent near period end)
  cron.schedule('0 * * * *', async () => {
    console.log('[HSD-CRON] Running hourly HSD period end check...');
    await checkHSDPeriodEnd();
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });
  
  // Additional check at the end of each month (last day at 23:00)
  cron.schedule('0 23 28-31 * *', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Check if tomorrow is the first day of next month
    if (tomorrow.getDate() === 1) {
      console.log('[HSD-CRON] Running end-of-month HSD period check...');
      await checkHSDPeriodEnd();
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });
  
  console.log('[CRON] HSD Leader Board reward jobs scheduled successfully');
  console.log('[CRON] - Hourly check: Every hour at :00');
  console.log('[CRON] - End of month check: 23:00 on last day of month');

  // Run startup checks after a short delay to ensure database is ready
  setTimeout(runHSDStartupChecks, 3000);
};

// Function to run startup checks
const runHSDStartupChecks = async () => {
  console.log('[STARTUP] Running HSD Leader Board startup checks...');
  
  try {
    await checkHSDPeriodEnd();
    console.log('[STARTUP] HSD Leader Board startup checks completed');
  } catch (error) {
    console.error('[STARTUP] HSD Leader Board startup checks failed:', error.message);
  }
};

module.exports = {
  startHSDLeaderBoardJobs,
  runHSDStartupChecks,
  checkHSDPeriodEnd
};
