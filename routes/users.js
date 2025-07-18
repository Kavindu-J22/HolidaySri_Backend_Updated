const express = require('express');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, contactNumber, countryCode, profileImage } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (countryCode) updateData.countryCode = countryCode;
    if (profileImage) updateData.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);
    
    // Check if user has a password (not Google user)
    if (!user.password) {
      return res.status(400).json({ message: 'Cannot change password for Google authenticated accounts' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get token balances and transaction history
router.get('/hsc', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { HSCTransaction } = require('../models/HSC');

    const user = await User.findById(req.user._id).select('hscBalance hsgBalance hsdBalance');
    const transactions = await HSCTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      balance: user.hscBalance,
      hsgBalance: user.hsgBalance,
      hsdBalance: user.hsdBalance,
      transactions
    });

  } catch (error) {
    console.error('Get token balances error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's advertisements
router.get('/advertisements', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const Advertisement = require('../models/Advertisement');
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const advertisements = await Advertisement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Advertisement.countDocuments(query);

    res.json({
      advertisements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get advertisements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user._id);
    
    // Verify password for non-Google users
    if (user.password) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required to delete account' });
      }
      
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
      }
    }

    // Deactivate instead of delete to maintain data integrity
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({ message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent dashboard data
router.get('/agent-dashboard', verifyToken, async (req, res) => {
  try {
    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id, isActive: true });

    if (!agent) {
      return res.json({ isAgent: false });
    }

    // Get agent statistics
    const totalEarnings = await Earning.aggregate([
      { $match: { usedPromoCodeOwnerId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalReferrals = await Earning.countDocuments({
      usedPromoCodeOwnerId: req.user._id
    });

    res.json({
      isAgent: true,
      agentData: {
        promoCode: agent.promoCode,
        promoCodeType: agent.promoCodeType,
        expirationDate: agent.expirationDate,
        totalEarnings: totalEarnings[0]?.total || 0,
        totalReferrals: agent.totalReferrals || totalReferrals,
        usedCount: agent.usedCount || 0,
        isActive: agent.isActive
      }
    });

  } catch (error) {
    console.error('Get agent dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent earnings records
router.get('/agent-earnings', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id, isActive: true });

    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    const query = { usedPromoCodeOwnerId: req.user._id };
    if (status) query.status = status;

    const earnings = await Earning.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('buyerId', 'name email');

    const total = await Earning.countDocuments(query);

    res.json({
      earnings,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get agent earnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
