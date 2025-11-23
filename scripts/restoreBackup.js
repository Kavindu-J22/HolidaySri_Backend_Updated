const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

// Load environment variables
dotenv.config();

/**
 * Restore Database from Node.js Backup
 * This script restores a database from a compressed JSON backup
 */

const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * List available backups
 */
const listBackups = () => {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup_') && file.endsWith('.json.gz'))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_DIR, file),
      time: fs.statSync(path.join(BACKUP_DIR, file)).mtime,
      size: (fs.statSync(path.join(BACKUP_DIR, file)).size / (1024 * 1024)).toFixed(2)
    }))
    .sort((a, b) => b.time - a.time);

  return files;
};

/**
 * Restore from backup
 */
const restoreBackup = async (backupFileName) => {
  const startTime = Date.now();
  
  try {
    console.log('========================================');
    console.log('DATABASE RESTORE');
    console.log('========================================\n');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`Database: ${mongoose.connection.db.databaseName}\n`);

    // Read backup file
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFileName}`);
    }

    console.log(`Reading backup file: ${backupFileName}`);
    const compressedData = fs.readFileSync(backupPath);
    
    console.log('Decompressing backup...');
    const jsonData = await gunzip(compressedData);
    
    console.log('Parsing backup data...');
    const backup = JSON.parse(jsonData.toString());

    console.log('\n========================================');
    console.log('BACKUP INFORMATION');
    console.log('========================================');
    console.log(`Database: ${backup.metadata.database}`);
    console.log(`Backup Date: ${backup.metadata.timestamp}`);
    console.log(`Collections: ${backup.metadata.collections}`);
    console.log(`Backup Type: ${backup.metadata.backupType}`);
    console.log('========================================\n');

    // Confirm restore
    console.log('⚠️  WARNING: This will DELETE all existing data and restore from backup!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Starting restore...\n');

    let restoredCollections = 0;
    let restoredDocuments = 0;

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backup.data)) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        
        if (documents.length > 0) {
          // Delete existing documents
          await collection.deleteMany({});
          
          // Insert backup documents
          await collection.insertMany(documents);
          
          restoredCollections++;
          restoredDocuments += documents.length;
          
          console.log(`✓ Restored ${documents.length} documents to ${collectionName}`);
        } else {
          console.log(`- Skipped ${collectionName} (empty)`);
        }
      } catch (error) {
        console.error(`✗ Error restoring ${collectionName}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('RESTORE COMPLETE');
    console.log('========================================');
    console.log(`✅ Collections Restored: ${restoredCollections}`);
    console.log(`✅ Documents Restored: ${restoredDocuments}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('========================================\n');

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

/**
 * Main function
 */
const main = async () => {
  try {
    // Get backup file from command line argument
    const backupFileName = process.argv[2];

    if (!backupFileName) {
      console.log('========================================');
      console.log('AVAILABLE BACKUPS');
      console.log('========================================\n');

      const backups = listBackups();

      if (backups.length === 0) {
        console.log('No backups found in backend/backups/\n');
        process.exit(1);
      }

      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.name}`);
        console.log(`   Date: ${backup.time.toLocaleString()}`);
        console.log(`   Size: ${backup.size} MB\n`);
      });

      console.log('========================================');
      console.log('USAGE:');
      console.log('node scripts/restoreBackup.js <backup-filename>');
      console.log('\nExample:');
      console.log(`node scripts/restoreBackup.js ${backups[0].name}`);
      console.log('========================================\n');
      
      process.exit(0);
    }

    await restoreBackup(backupFileName);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Run the script
main();

