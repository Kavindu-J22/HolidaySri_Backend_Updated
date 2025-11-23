const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { ObjectId } = require('mongodb');

const gunzip = promisify(zlib.gunzip);

// Load environment variables
dotenv.config();

/**
 * Convert string IDs back to ObjectIds recursively
 */
const convertStringIdsToObjectIds = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => convertStringIdsToObjectIds(item));
  }
  
  // Handle Object
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert _id fields and fields ending with 'Id' that are valid ObjectId strings
      if ((key === '_id' || key.endsWith('Id')) && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
        result[key] = new ObjectId(value);
      } else {
        result[key] = convertStringIdsToObjectIds(value);
      }
    }
    return result;
  }
  
  // Primitive types
  return obj;
};

const testRestore = async () => {
  try {
    console.log('========================================');
    console.log('RESTORE OBJECTID CONVERSION TEST');
    console.log('========================================\n');

    // Get the most recent backup
    const BACKUP_DIR = path.join(__dirname, '../backups');
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json.gz'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.log('❌ No backup files found');
      return;
    }

    const lastBackup = files[0];
    console.log(`📁 Testing with backup: ${lastBackup.name}\n`);

    // Read and decompress backup
    const compressedData = fs.readFileSync(lastBackup.path);
    const jsonData = await gunzip(compressedData);
    const backup = JSON.parse(jsonData.toString());

    console.log('BEFORE CONVERSION:');
    if (backup.data.users && backup.data.users[0]) {
      const user = backup.data.users[0];
      console.log(`  User _id type: ${typeof user._id}`);
      console.log(`  User _id value: ${user._id}`);
      console.log(`  User _id instanceof ObjectId: ${user._id instanceof ObjectId}`);
    }
    console.log('');

    // Convert string IDs to ObjectIds
    console.log('Converting string IDs to ObjectIds...\n');
    const backupWithObjectIds = convertStringIdsToObjectIds(backup);

    console.log('AFTER CONVERSION:');
    if (backupWithObjectIds.data.users && backupWithObjectIds.data.users[0]) {
      const user = backupWithObjectIds.data.users[0];
      console.log(`  User _id type: ${typeof user._id}`);
      console.log(`  User _id value: ${user._id}`);
      console.log(`  User _id instanceof ObjectId: ${user._id instanceof ObjectId}`);
      console.log(`  User _id._bsontype: ${user._id._bsontype}`);
    }
    console.log('');

    // Test with advertisements (has userId reference)
    if (backupWithObjectIds.data.advertisements && backupWithObjectIds.data.advertisements[0]) {
      const ad = backupWithObjectIds.data.advertisements[0];
      console.log('Advertisement userId field:');
      console.log(`  userId type: ${typeof ad.userId}`);
      console.log(`  userId instanceof ObjectId: ${ad.userId instanceof ObjectId}`);
      console.log(`  userId._bsontype: ${ad.userId && ad.userId._bsontype}`);
    }
    console.log('');

    console.log('========================================');
    console.log('TEST RESULTS');
    console.log('========================================');
    
    const user = backupWithObjectIds.data.users[0];
    if (user._id instanceof ObjectId && user._id._bsontype === 'ObjectId') {
      console.log('✅ SUCCESS: ObjectIds are properly converted!');
      console.log('✅ Restore will work correctly with proper ObjectId types.');
    } else {
      console.log('❌ FAILED: ObjectIds are NOT properly converted!');
      console.log('❌ Restore will fail with string IDs.');
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
};

// Run test
testRestore();

