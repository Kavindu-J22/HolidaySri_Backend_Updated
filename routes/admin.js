const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const Advertisement = require('../models/Advertisement');
const { verifyAdmin, verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Admin login
router.post('/login', verifyAdmin, async (req, res) => {
  try {
    // Generate admin token
    const token = jwt.sign(
      { role: 'admin', username: process.env.ADMIN_USERNAME },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        username: process.env.ADMIN_USERNAME,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard', verifyAdminToken, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isActive: true, isEmailVerified: true });
    const newUsersToday = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // Get advertisement statistics
    const totalAds = await Advertisement.countDocuments();
    const activeAds = await Advertisement.countDocuments({ status: 'active' });
    const pendingAds = await Advertisement.countDocuments({ status: 'draft' });

    // Get HSC statistics
    const totalHSCTransactions = await HSCTransaction.countDocuments();
    const totalHSCPurchased = await HSCTransaction.aggregate([
      { $match: { type: 'purchase' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalHSCSpent = await HSCTransaction.aggregate([
      { $match: { type: 'spend' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get current HSC configuration
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        newToday: newUsersToday
      },
      advertisements: {
        total: totalAds,
        active: activeAds,
        pending: pendingAds
      },
      hsc: {
        currentValue: hscConfig ? hscConfig.hscValue : 100,
        currency: hscConfig ? hscConfig.currency : 'LKR',
        totalTransactions: totalHSCTransactions,
        totalPurchased: totalHSCPurchased[0]?.total || 0,
        totalSpent: totalHSCSpent[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC configuration
router.get('/hsc-config', verifyAdminToken, async (req, res) => {
  try {
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    
    if (!hscConfig) {
      return res.json({
        hscValue: 100,
        currency: 'LKR',
        lastUpdated: null,
        updatedBy: null
      });
    }

    res.json(hscConfig);

  } catch (error) {
    console.error('Get HSC config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update HSC value
router.put('/hsc-config', verifyAdminToken, async (req, res) => {
  try {
    const { hscValue, currency = 'LKR' } = req.body;

    if (!hscValue || hscValue <= 0) {
      return res.status(400).json({ message: 'Invalid HSC value' });
    }

    // Create new HSC configuration
    const newConfig = new HSCConfig({
      hscValue,
      currency,
      updatedBy: req.admin.username
    });

    await newConfig.save();

    res.json({
      message: 'HSC value updated successfully',
      config: newConfig
    });

  } catch (error) {
    console.error('Update HSC config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
router.get('/users', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.isEmailVerified = true;
    if (status === 'unverified') query.isEmailVerified = false;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user details
router.get('/users/:userId', verifyAdminToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's HSC transactions
    const transactions = await HSCTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's advertisements
    const advertisements = await Advertisement.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      recentTransactions: transactions,
      recentAdvertisements: advertisements
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.put('/users/:userId/status', verifyAdminToken, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC packages
router.get('/hsc-packages', verifyAdminToken, async (req, res) => {
  try {
    const packages = await HSCPackage.find().sort({ hscAmount: 1 });
    res.json({ packages });

  } catch (error) {
    console.error('Get HSC packages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create HSC package
router.post('/hsc-packages', verifyAdminToken, async (req, res) => {
  try {
    const { name, hscAmount, discount = 0, description, features } = req.body;

    if (!name || !hscAmount) {
      return res.status(400).json({ message: 'Name and HSC amount are required' });
    }

    // Get current HSC config to calculate price
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Calculate price based on HSC amount and discount
    const basePrice = hscAmount * hscValue;
    const discountAmount = (basePrice * discount) / 100;
    const finalPrice = basePrice - discountAmount;

    const package = new HSCPackage({
      name,
      hscAmount,
      price: finalPrice,
      discount,
      description,
      features: features || []
    });

    await package.save();

    res.status(201).json({
      message: 'HSC package created successfully',
      package
    });

  } catch (error) {
    console.error('Create HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update HSC package
router.put('/hsc-packages/:packageId', verifyAdminToken, async (req, res) => {
  try {
    const { name, hscAmount, discount, description, features, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (hscAmount) {
      updateData.hscAmount = hscAmount;

      // Recalculate price based on new HSC amount and discount
      const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
      const hscValue = hscConfig ? hscConfig.hscValue : 100;
      const currentDiscount = discount !== undefined ? discount : 0;

      const basePrice = hscAmount * hscValue;
      const discountAmount = (basePrice * currentDiscount) / 100;
      updateData.price = basePrice - discountAmount;
    }
    if (discount !== undefined) {
      updateData.discount = discount;

      // Recalculate price if discount changed
      if (!hscAmount) {
        const currentPackage = await HSCPackage.findById(req.params.packageId);
        if (currentPackage) {
          const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
          const hscValue = hscConfig ? hscConfig.hscValue : 100;

          const basePrice = currentPackage.hscAmount * hscValue;
          const discountAmount = (basePrice * discount) / 100;
          updateData.price = basePrice - discountAmount;
        }
      }
    }
    if (description !== undefined) updateData.description = description;
    if (features) updateData.features = features;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const package = await HSCPackage.findByIdAndUpdate(
      req.params.packageId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({
      message: 'HSC package updated successfully',
      package
    });

  } catch (error) {
    console.error('Update HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete HSC package
router.delete('/hsc-packages/:packageId', verifyAdminToken, async (req, res) => {
  try {
    const package = await HSCPackage.findByIdAndDelete(req.params.packageId);

    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({
      message: 'HSC package deleted successfully'
    });

  } catch (error) {
    console.error('Delete HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
