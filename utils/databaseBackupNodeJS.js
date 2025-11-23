const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

/**
 * Node.js Database Backup Utility
 * Pure Node.js implementation - works on Render without mongodump
 * Exports all collections as compressed JSON
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
 * Clean up old backups (keep only MAX_BACKUPS most recent)
 */
const cleanupOldBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && (file.endsWith('.json.gz') || file.endsWith('.json')))
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
 * Get database name from connection
 */
const getDatabaseName = () => {
  try {
    return mongoose.connection.db.databaseName;
  } catch (error) {
    return 'holidaysri';
  }
};

/**
 * Perform database backup using Node.js MongoDB driver
 */
const performNodeJSBackup = async () => {
  const startTime = Date.now();
  console.log('[BACKUP] Starting Node.js database backup...');

  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB is not connected');
    }

    // Ensure backup directory exists
    ensureBackupDirectory();

    // Get database name
    const dbName = getDatabaseName();
    console.log(`[BACKUP] Database: ${dbName}`);

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFileName = `backup_${dbName}_${timestamp}.json.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    console.log(`[BACKUP] Backup file: ${backupFileName}`);

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`[BACKUP] Found ${collections.length} collections`);

    // Export all collections
    const backup = {
      metadata: {
        database: dbName,
        timestamp: new Date().toISOString(),
        collections: collections.length,
        backupType: 'nodejs',
        version: '1.0'
      },
      data: {}
    };

    let totalDocuments = 0;

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        backup.data[collectionName] = documents;
        totalDocuments += documents.length;
        console.log(`[BACKUP] ✓ Exported ${documents.length} documents from ${collectionName}`);
      } catch (error) {
        console.error(`[BACKUP] ✗ Error exporting ${collectionName}:`, error.message);
        backup.data[collectionName] = [];
      }
    }

    console.log(`[BACKUP] Total documents exported: ${totalDocuments}`);

    // Convert to JSON
    console.log('[BACKUP] Converting to JSON format...');
    const jsonData = JSON.stringify(backup, null, 2);

    // Compress with gzip
    console.log('[BACKUP] Compressing backup...');
    const compressedData = await gzip(jsonData);

    // Write to file
    fs.writeFileSync(backupPath, compressedData);

    // Get file stats
    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const originalSizeMB = (Buffer.byteLength(jsonData) / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - stats.size / Buffer.byteLength(jsonData)) * 100).toFixed(1);
    
    const duration = Date.now() - startTime;
    
    console.log(`[BACKUP] ✅ Backup completed successfully!`);
    console.log(`[BACKUP] File: ${backupFileName}`);
    console.log(`[BACKUP] Original size: ${originalSizeMB} MB`);
    console.log(`[BACKUP] Compressed size: ${fileSizeMB} MB`);
    console.log(`[BACKUP] Compression: ${compressionRatio}% reduction`);
    console.log(`[BACKUP] Collections: ${collections.length}`);
    console.log(`[BACKUP] Documents: ${totalDocuments}`);
    console.log(`[BACKUP] Duration: ${duration}ms`);

    // Clean up old backups
    cleanupOldBackups();

    return {
      success: true,
      fileName: backupFileName,
      filePath: backupPath,
      fileSize: fileSizeMB,
      originalSize: originalSizeMB,
      compressionRatio: compressionRatio,
      collections: collections.length,
      documents: totalDocuments,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[BACKUP] ❌ Backup failed:', error.message);
    console.error('[BACKUP] Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message,
      duration
    };
  }
};

module.exports = {
  performNodeJSBackup,
  ensureBackupDirectory,
  cleanupOldBackups
};

