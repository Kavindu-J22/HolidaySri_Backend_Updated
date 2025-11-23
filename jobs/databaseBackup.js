const cron = require('node-cron');
// Use Node.js backup (works on Render without mongodump)
const { performNodeJSBackup } = require('../utils/databaseBackupNodeJS');

/**
 * Database Backup Scheduler
 * Runs daily at 2:00 AM (Asia/Colombo timezone)
 * Uses pure Node.js implementation (no mongodump required)
 */

/**
 * Execute database backup
 */
const executeDatabaseBackup = async () => {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('[DB-BACKUP-CRON] Starting scheduled database backup...');
  console.log('[DB-BACKUP-CRON] Method: Node.js (Render-compatible)');
  console.log(`[DB-BACKUP-CRON] Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`);
  console.log('========================================\n');

  try {
    const result = await performNodeJSBackup();

    if (result.success) {
      console.log('\n========================================');
      console.log('[DB-BACKUP-CRON] ✅ Backup completed successfully!');
      console.log(`[DB-BACKUP-CRON] File: ${result.fileName}`);
      console.log(`[DB-BACKUP-CRON] Size: ${result.fileSize} MB (compressed)`);
      console.log(`[DB-BACKUP-CRON] Collections: ${result.collections}`);
      console.log(`[DB-BACKUP-CRON] Documents: ${result.documents}`);
      console.log(`[DB-BACKUP-CRON] Compression: ${result.compressionRatio}% reduction`);
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
  console.log('[CRON] 🔧 Method: Node.js (Render-compatible, no mongodump required)');

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
  console.log('[CRON] 📦 Format: Compressed JSON (.json.gz)');
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

