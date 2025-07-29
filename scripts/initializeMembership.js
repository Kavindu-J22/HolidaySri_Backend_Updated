const mongoose = require('mongoose');
const { MembershipConfig } = require('../models/Membership');
require('dotenv').config();

const initializeMembershipConfig = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if membership config exists
    let membershipConfig = await MembershipConfig.findOne({ isActive: true });
    
    if (!membershipConfig) {
      console.log('No membership configuration found. Creating default configuration...');
      
      membershipConfig = new MembershipConfig({
        monthlyCharge: 2500,
        yearlyCharge: 25000,
        currency: 'LKR',
        features: [
          'Member badge for advertisements',
          'All published ads show in Featured Ads',
          'HSD (Diamond) given Random chance increase',
          'Your advertisements suggest for more customers',
          'Priority customer support',
          'Enhanced visibility for all listings'
        ],
        isActive: true,
        updatedBy: 'system'
      });

      await membershipConfig.save();
      console.log('Default membership configuration created successfully!');
      console.log('Configuration:', membershipConfig);
    } else {
      console.log('Membership configuration already exists:');
      console.log('Configuration:', membershipConfig);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error initializing membership configuration:', error);
    process.exit(1);
  }
};

initializeMembershipConfig();
