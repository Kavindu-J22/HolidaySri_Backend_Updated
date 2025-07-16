const mongoose = require('mongoose');
const { HSCPackage } = require('../models/HSC');
require('dotenv').config();

const defaultPackages = [
  {
    name: 'Starter Pack',
    hscAmount: 50,
    price: 5000,
    currency: 'LKR',
    discount: 0,
    description: 'Perfect for small businesses starting their advertising journey',
    features: [
      '50 HSC Tokens',
      'Basic advertisement posting',
      'Standard visibility',
      '30-day validity'
    ]
  },
  {
    name: 'Business Pack',
    hscAmount: 100,
    price: 9500,
    currency: 'LKR',
    discount: 5,
    description: 'Ideal for growing businesses with regular advertising needs',
    features: [
      '100 HSC Tokens',
      'Enhanced advertisement posting',
      'Priority visibility',
      '60-day validity',
      '5% discount'
    ]
  },
  {
    name: 'Professional Pack',
    hscAmount: 250,
    price: 22500,
    currency: 'LKR',
    discount: 10,
    description: 'For established businesses requiring extensive advertising',
    features: [
      '250 HSC Tokens',
      'Premium advertisement posting',
      'High priority visibility',
      '90-day validity',
      '10% discount',
      'Featured listings'
    ]
  },
  {
    name: 'Enterprise Pack',
    hscAmount: 500,
    price: 42500,
    currency: 'LKR',
    discount: 15,
    description: 'Maximum value for large-scale tourism operations',
    features: [
      '500 HSC Tokens',
      'Unlimited advertisement posting',
      'Maximum visibility',
      '120-day validity',
      '15% discount',
      'Featured listings',
      'Priority support'
    ]
  },
  {
    name: 'Mega Pack',
    hscAmount: 1000,
    price: 80000,
    currency: 'LKR',
    discount: 20,
    description: 'Ultimate package for major tourism enterprises',
    features: [
      '1000 HSC Tokens',
      'Unlimited premium features',
      'Top-tier visibility',
      '180-day validity',
      '20% discount',
      'Featured listings',
      'Priority support',
      'Custom branding options'
    ]
  }
];

async function initializeHSCPackages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://holidaysrinotificcation:N6CyuahgAcEzjvfR@cluster0.futoerj.mongodb.net/holidaysri');
    console.log('Connected to MongoDB');

    // Check if packages already exist
    const existingPackages = await HSCPackage.find();
    if (existingPackages.length > 0) {
      console.log('HSC packages already exist. Skipping initialization.');
      return;
    }

    // Create default packages
    for (const packageData of defaultPackages) {
      const hscPackage = new HSCPackage(packageData);
      await hscPackage.save();
      console.log(`Created package: ${packageData.name}`);
    }

    console.log('HSC packages initialized successfully!');
  } catch (error) {
    console.error('Error initializing HSC packages:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the initialization
initializeHSCPackages();
