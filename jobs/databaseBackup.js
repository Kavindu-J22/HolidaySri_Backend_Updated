const cron = require('node-cron');
const { performBackup } = require('../utils/databaseBackup');

/**
 * Database Backup Scheduler
 * Runs daily at 2:00 AM (Asia/Colombo timezone)
 */

/**
 * Execute database backup
 */
const executeDatabaseBackup = async () => {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('[DB-BACKUP-CRON] Starting scheduled database backup...');
  console.log(`[DB-BACKUP-CRON] Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`);
  console.log('========================================\n');

  try {
    const result = await performBackup();

    if (result.success) {
      console.log('\n========================================');
      console.log('[DB-BACKUP-CRON] ✅ Backup completed successfully!');
      console.log(`[DB-BACKUP-CRON] File: ${result.fileName}`);
      console.log(`[DB-BACKUP-CRON] Size: ${result.fileSize} MB`);
      console.log(`[DB-BACKUP-CRON] Duration: ${result.duration}ms`);
      console.log('========================================\n');
    } else {
      console.error('\n========================================');
      console.error('[DB-BACKUP-CRON] ❌ Backup failed!');
      console.error(`[DB-BACKUP-CRON] Error: ${result.error}`);
      console.error(`[DB-BACKUP-CRON] Duration: ${result.duration}ms`);
      console.error('========================================\n');
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n========================================');
    console.error('[DB-BACKUP-CRON] ❌ Unexpected error during backup!');
    console.error(`[DB-BACKUP-CRON] Error: ${error.message}`);
    console.error(`[DB-BACKUP-CRON] Duration: ${duration}ms`);
    console.error('========================================\n');
    
    return {
      success: false,
      error: error.message,
      duration
    };
  }
};

/**
 * Start database backup scheduler
 */
const startDatabaseBackupJob = () => {
  console.log('[CRON] Starting database backup scheduler...');

  // Schedule daily backup at 2:00 AM (Asia/Colombo timezone)
  cron.schedule('0 2 * * *', async () => {
    await executeDatabaseBackup();
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Sri Lanka timezone
  });

  console.log('[CRON] ✅ Database backup job scheduled successfully');
  console.log('[CRON] 📅 Schedule: Daily at 2:00 AM (Asia/Colombo)');
  console.log('[CRON] 💾 Backup location: backend/backups/');
  console.log('[CRON] 🗂️  Retention: Last 30 backups');
};

/**
 * Run manual backup (for testing)
 */
const runManualBackup = async () => {
  console.log('[MANUAL-BACKUP] Running manual database backup...');
  return await executeDatabaseBackup();
};

module.exports = {
  startDatabaseBackupJob,
  executeDatabaseBackup,
  runManualBackup
};

