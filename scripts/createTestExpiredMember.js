const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createTestExpiredMember = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a user to make an expired member (or create one)
    let testUser = await User.findOne({ email: 'test@example.com' });
    
    if (!testUser) {
      console.log('Creating test user...');
      testUser = new User({
        email: 'test@example.com',
        name: 'Test User',
        contactNumber: '1234567890',
        countryCode: '+94',
        password: 'password123',
        isEmailVerified: true,
        hscBalance: 1000
      });
      await testUser.save();
      console.log('Test user created');
    }

    // Set expired membership
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    testUser.isMember = true;
    testUser.membershipType = 'monthly';
    testUser.membershipStartDate = lastWeek;
    testUser.membershipExpirationDate = yesterday;
    
    await testUser.save();
    
    console.log('Test user updated with expired membership:');
    console.log('Email:', testUser.email);
    console.log('Membership Type:', testUser.membershipType);
    console.log('Start Date:', testUser.membershipStartDate);
    console.log('Expiration Date:', testUser.membershipExpirationDate);
    console.log('Is Member:', testUser.isMember);
    
    console.log('\nYou can now test the renewal flow with this user!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating test expired member:', error);
    process.exit(1);
  }
};

createTestExpiredMember();
