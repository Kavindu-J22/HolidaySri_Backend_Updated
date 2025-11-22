const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Database Backup Utility
 * Performs MongoDB database backups using mongodump
 */

// Configuration
const BACKUP_DIR = path.join(__dirname, '../backups');
const MAX_BACKUPS = 30; // Keep last 30 backups (1 month)

/**
 * Ensure backup directory exists
 */
const ensureBackupDirectory = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[BACKUP] Created backup directory: ${BACKUP_DIR}`);
  }
};

/**
 * Get MongoDB connection details from URI
 */
const parseMongoURI = (uri) => {
  try {
    // Parse MongoDB URI
    const url = new URL(uri);
    const username = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port || '27017';
    const database = url.pathname.substring(1).split('?')[0];
    
    return {
      username,
      password,
      host,
      port,
      database,
      isAtlas: uri.includes('mongodb+srv') || uri.includes('mongodb.net')
    };
  } catch (error) {
    console.error('[BACKUP] Error parsing MongoDB URI:', error.message);
    return null;
  }
};

/**
 * Clean up old backups (keep only MAX_BACKUPS most recent)
 */
const cleanupOldBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.gz') || file.endsWith('.archive'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by newest first

    // Remove old backups
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`[BACKUP] Deleted old backup: ${file.name}`);
      });
      console.log(`[BACKUP] Cleaned up ${filesToDelete.length} old backup(s)`);
    }
  } catch (error) {
    console.error('[BACKUP] Error cleaning up old backups:', error.message);
  }
};

/**
 * Perform database backup
 */
const performBackup = async () => {
  const startTime = Date.now();
  console.log('[BACKUP] Starting database backup...');

  try {
    // Ensure backup directory exists
    ensureBackupDirectory();

    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    // Parse MongoDB URI
    const dbConfig = parseMongoURI(mongoURI);
    if (!dbConfig) {
      throw new Error('Failed to parse MongoDB URI');
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFileName = `backup_${dbConfig.database}_${timestamp}.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    console.log(`[BACKUP] Database: ${dbConfig.database}`);
    console.log(`[BACKUP] Backup file: ${backupFileName}`);

    // Build mongodump command
    let command;
    
    if (dbConfig.isAtlas) {
      // For MongoDB Atlas (cloud)
      command = `mongodump --uri="${mongoURI}" --archive="${backupPath}" --gzip`;
    } else {
      // For local MongoDB
      command = `mongodump --host ${dbConfig.host} --port ${dbConfig.port} ` +
                `--db ${dbConfig.database} --archive="${backupPath}" --gzip`;
      
      if (dbConfig.username && dbConfig.password) {
        command += ` --username ${dbConfig.username} --password ${dbConfig.password}`;
      }
    }

    // Execute backup
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('done dumping')) {
      console.warn('[BACKUP] Warning:', stderr);
    }

    // Check if backup file was created
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      const duration = Date.now() - startTime;
      console.log(`[BACKUP] ✅ Backup completed successfully!`);
      console.log(`[BACKUP] File: ${backupFileName}`);
      console.log(`[BACKUP] Size: ${fileSizeMB} MB`);
      console.log(`[BACKUP] Duration: ${duration}ms`);

      // Clean up old backups
      cleanupOldBackups();

      return {
        success: true,
        fileName: backupFileName,
        filePath: backupPath,
        fileSize: fileSizeMB,
        duration
      };
    } else {
      throw new Error('Backup file was not created');
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[BACKUP] ❌ Backup failed:', error.message);
    
    return {
      success: false,
      error: error.message,
      duration
    };
  }
};

module.exports = {
  performBackup,
  ensureBackupDirectory,
  cleanupOldBackups
};

