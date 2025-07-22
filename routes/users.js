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
        isActive: agent.isActive,
        isVerified: agent.isVerified || false,
        verificationStatus: agent.verificationStatus || 'pending'
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

// Submit agent verification documents
router.post('/agent-verification', verifyToken, async (req, res) => {
  try {
    const { documentType, documentUrl } = req.body;

    if (!documentType || !documentUrl) {
      return res.status(400).json({ message: 'Document type and URL are required' });
    }

    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id, isActive: true });

    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    // Update verification documents
    const updateData = {
      verificationSubmittedAt: new Date(),
      verificationStatus: 'pending'
    };

    // Add document based on type
    if (documentType === 'NIC_FRONT') {
      updateData['verificationDocuments.nicFront'] = documentUrl;
    } else if (documentType === 'NIC_BACK') {
      updateData['verificationDocuments.nicBack'] = documentUrl;
    } else if (documentType === 'PASSPORT') {
      updateData['verificationDocuments.passport'] = documentUrl;
    } else {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      agent._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Check if agent has submitted enough documents for verification
    const hasNIC = updatedAgent.verificationDocuments.nicFront && updatedAgent.verificationDocuments.nicBack;
    const hasPassport = updatedAgent.verificationDocuments.passport;

    if (hasNIC || hasPassport) {
      // Auto-verify for demo purposes (in production, this would be manual admin review)
      await Agent.findByIdAndUpdate(agent._id, {
        isVerified: true,
        verificationStatus: 'verified',
        verificationCompletedAt: new Date(),
        verificationNotes: 'Auto-verified for demo purposes'
      });
    }

    res.json({
      message: 'Verification document uploaded successfully',
      verificationStatus: hasNIC || hasPassport ? 'verified' : 'pending'
    });

  } catch (error) {
    console.error('Agent verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent verification status
router.get('/agent-verification-status', verifyToken, async (req, res) => {
  try {
    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id, isActive: true });

    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    res.json({
      isVerified: agent.isVerified,
      verificationStatus: agent.verificationStatus,
      verificationDocuments: agent.verificationDocuments,
      verificationSubmittedAt: agent.verificationSubmittedAt,
      verificationCompletedAt: agent.verificationCompletedAt
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle agent promo code active status
router.put('/agent-toggle-status', verifyToken, async (req, res) => {
  try {
    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id });

    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    // Toggle the isActive status
    const updatedAgent = await Agent.findByIdAndUpdate(
      agent._id,
      { isActive: !agent.isActive },
      { new: true, runValidators: true }
    );

    res.json({
      message: `Promo code ${updatedAgent.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: updatedAgent.isActive
    });

  } catch (error) {
    console.error('Toggle agent status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upgrade agent promo code tier
router.put('/agent-upgrade-tier', verifyToken, async (req, res) => {
  try {
    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id, isActive: true });

    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    let newTier = '';
    let requiredUsage = 0;

    // Determine upgrade path
    switch (agent.promoCodeType) {
      case 'free':
        newTier = 'silver';
        requiredUsage = 700;
        break;
      case 'silver':
        newTier = 'gold';
        requiredUsage = 1500;
        break;
      case 'gold':
        newTier = 'diamond';
        requiredUsage = 2500;
        break;
      default:
        return res.status(400).json({ message: 'No upgrade available for this tier' });
    }

    // Check if agent meets usage requirements
    if (agent.usedCount < requiredUsage) {
      return res.status(400).json({
        message: `Insufficient usage. Need ${requiredUsage} uses, currently have ${agent.usedCount}`
      });
    }

    // Upgrade the tier
    const updatedAgent = await Agent.findByIdAndUpdate(
      agent._id,
      { promoCodeType: newTier },
      { new: true, runValidators: true }
    );

    res.json({
      message: `Congratulations! Your promo code has been upgraded to ${newTier.toUpperCase()}!`,
      newTier: newTier,
      previousTier: agent.promoCodeType
    });

  } catch (error) {
    console.error('Upgrade tier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
