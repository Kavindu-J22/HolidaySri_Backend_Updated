const mongoose = require('mongoose');
const { performBackup } = require('../utils/databaseBackup');
require('dotenv').config();

/**
 * Test Database Backup Script
 * Run this script to test the database backup functionality
 */

const testBackup = async () => {
  try {
    console.log('========================================');
    console.log('DATABASE BACKUP TEST');
    console.log('========================================\n');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Perform backup
    console.log('Starting backup test...\n');
    const result = await performBackup();

    console.log('\n========================================');
    console.log('TEST RESULTS');
    console.log('========================================');
    
    if (result.success) {
      console.log('✅ Backup Status: SUCCESS');
      console.log(`📁 File Name: ${result.fileName}`);
      console.log(`📊 File Size: ${result.fileSize} MB`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📂 Location: backend/backups/${result.fileName}`);
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

