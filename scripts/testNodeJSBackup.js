const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { performNodeJSBackup } = require('../utils/databaseBackupNodeJS');

// Load environment variables
dotenv.config();

/**
 * Test Node.js Database Backup
 * This script tests the pure Node.js backup implementation
 * Works on Render without mongodump
 */

const testBackup = async () => {
  try {
    console.log('========================================');
    console.log('NODE.JS DATABASE BACKUP TEST');
    console.log('========================================\n');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`Database: ${mongoose.connection.db.databaseName}\n`);

    // Perform backup
    console.log('Starting Node.js backup test...\n');
    const result = await performNodeJSBackup();

    console.log('\n========================================');
    console.log('TEST RESULTS');
    console.log('========================================');
    
    if (result.success) {
      console.log('✅ Backup Status: SUCCESS');
      console.log(`📁 File Name: ${result.fileName}`);
      console.log(`📊 Original Size: ${result.originalSize} MB`);
      console.log(`📦 Compressed Size: ${result.fileSize} MB`);
      console.log(`🗜️  Compression Ratio: ${result.compressionRatio}% reduction`);
      console.log(`📚 Collections: ${result.collections}`);
      console.log(`📄 Documents: ${result.documents}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📂 Location: backend/backups/${result.fileName}`);
      console.log('\n💡 This backup works on Render without mongodump!');
    } else {
      console.log('❌ Backup Status: FAILED');
      console.log(`Error: ${result.error}`);
    }
    
    console.log('========================================\n');

    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
testBackup();

