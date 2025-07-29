const mongoose = require('mongoose');
const { checkExpiredMemberships, checkExpiringMemberships } = require('../jobs/membershipExpiration');
require('dotenv').config();

const testMembershipExpiration = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Testing membership expiration jobs...');
    
    // Test expired memberships check
    console.log('\n=== Testing Expired Memberships ===');
    await checkExpiredMemberships();
    
    // Test expiring memberships check
    console.log('\n=== Testing Expiring Memberships ===');
    await checkExpiringMemberships();
    
    console.log('\nMembership expiration test completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error testing membership expiration:', error);
    process.exit(1);
  }
};

testMembershipExpiration();
