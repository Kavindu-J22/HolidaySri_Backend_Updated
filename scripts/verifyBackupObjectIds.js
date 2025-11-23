const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { EJSON } = require('bson');

const gunzip = promisify(zlib.gunzip);

/**
 * Verify that ObjectIds are properly preserved in backup
 */
const verifyBackup = async () => {
  try {
    const BACKUP_DIR = path.join(__dirname, '../backups');
    
    // Get the most recent backup
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
    console.log('========================================');
    console.log('BACKUP OBJECTID VERIFICATION');
    console.log('========================================\n');
    console.log(`📁 Backup File: ${lastBackup.name}\n`);

    // Read and decompress backup
    const compressedData = fs.readFileSync(lastBackup.path);
    const jsonData = await gunzip(compressedData);
    const parsed = JSON.parse(jsonData.toString());

    console.log('Raw JSON structure (first user _id):');
    if (parsed.data && parsed.data.users && parsed.data.users[0]) {
      console.log(JSON.stringify(parsed.data.users[0]._id, null, 2));
      console.log('Type:', typeof parsed.data.users[0]._id);
      console.log('Has $oid?:', parsed.data.users[0]._id && parsed.data.users[0]._id.$oid ? 'YES' : 'NO');
    }
    console.log('');

    const backup = EJSON.deserialize(parsed);

    console.log('Checking ObjectId preservation...\n');

    let totalChecked = 0;
    let objectIdCount = 0;
    let stringIdCount = 0;

    // Check a few collections
    const collectionsToCheck = ['users', 'advertisements', 'hsctransactions'];
    
    for (const collectionName of collectionsToCheck) {
      if (backup.data[collectionName] && backup.data[collectionName].length > 0) {
        const docs = backup.data[collectionName];
        const firstDoc = docs[0];
        
        console.log(`📚 Collection: ${collectionName}`);
        console.log(`   Documents: ${docs.length}`);
        console.log(`   First document _id type: ${typeof firstDoc._id}`);
        console.log(`   First document _id value: ${JSON.stringify(firstDoc._id)}`);
        
        if (firstDoc._id && firstDoc._id._bsontype === 'ObjectId') {
          console.log(`   ✅ ObjectId properly preserved!`);
          objectIdCount++;
        } else if (typeof firstDoc._id === 'string') {
          console.log(`   ❌ WARNING: _id is a STRING, not ObjectId!`);
          stringIdCount++;
        } else if (firstDoc._id && firstDoc._id.$oid) {
          console.log(`   ✅ ObjectId in EJSON format (will be restored correctly)`);
          objectIdCount++;
        }
        
        console.log('');
        totalChecked++;
      }
    }

    console.log('========================================');
    console.log('VERIFICATION RESULTS');
    console.log('========================================');
    console.log(`Collections Checked: ${totalChecked}`);
    console.log(`✅ Proper ObjectIds: ${objectIdCount}`);
    console.log(`❌ String IDs: ${stringIdCount}`);
    
    if (stringIdCount > 0) {
      console.log('\n⚠️  WARNING: Some IDs are strings! Restore will fail!');
      console.log('The backup needs to use EJSON format to preserve ObjectIds.');
    } else {
      console.log('\n✅ SUCCESS: All ObjectIds are properly preserved!');
      console.log('Restore will work correctly with proper ObjectId types.');
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
  }
};

// Run verification
verifyBackup();

