const express = require('express');
const { MembershipConfig, MembershipTransaction } = require('../models/Membership');
const User = require('../models/User');
const PaymentActivity = require('../models/PaymentActivity');
const Notification = require('../models/Notification');
const { HSCConfig, HSCTransaction } = require('../models/HSC');
const { verifyToken, verifyAdminToken } = require('../middleware/auth');
const { sendMembershipPurchaseEmail, sendMembershipExpirationWarning, sendMembershipExpiredEmail } = require('../utils/emailService');

const router = express.Router();

// Get membership configuration
router.get('/config', async (req, res) => {
  try {
    let membershipConfig = await MembershipConfig.findOne({ isActive: true });
    
    if (!membershipConfig) {
      // Create default configuration if none exists
      membershipConfig = new MembershipConfig({
        monthlyCharge: 2500,
        yearlyCharge: 25000,
        updatedBy: 'system'
      });
      await membershipConfig.save();
    }

    // Get current HSC value for conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    res.json({
      ...membershipConfig.toObject(),
      hscValue,
      monthlyHSC: Math.ceil(membershipConfig.monthlyCharge / hscValue),
      yearlyHSC: Math.ceil(membershipConfig.yearlyCharge / hscValue)
    });

  } catch (error) {
    console.error('Get membership config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check user membership status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if membership is expired
    if (user.isMember && user.membershipExpirationDate && new Date() > user.membershipExpirationDate) {
      // Auto-expire membership
      user.isMember = false;
      user.membershipType = null;
      user.membershipStartDate = null;
      user.membershipExpirationDate = null;
      await user.save();

      // Send expiration notification
      await Notification.createNotification(
        user._id,
        '⚠️ Membership Expired',
        'Your Holidaysri membership has expired. Renew now to continue enjoying premium benefits!',
        'warning',
        { membershipExpired: true },
        'high'
      );

      // Send expiration email
      await sendMembershipExpiredEmail(user.email, user.name);
    }

    res.json({
      isMember: user.isMember,
      membershipType: user.membershipType,
      membershipStartDate: user.membershipStartDate,
      membershipExpirationDate: user.membershipExpirationDate,
      hscBalance: user.hscBalance
    });

  } catch (error) {
    console.error('Get membership status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase membership
router.post('/purchase', verifyToken, async (req, res) => {
  try {
    const { membershipType } = req.body;

    if (!membershipType || !['monthly', 'yearly'].includes(membershipType)) {
      return res.status(400).json({ message: 'Invalid membership type' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member with active membership
    if (user.isMember && user.membershipExpirationDate && new Date() < user.membershipExpirationDate) {
      return res.status(400).json({ message: 'You already have an active membership' });
    }

    // If user had expired membership, reset the fields
    if (user.membershipExpirationDate && new Date() >= user.membershipExpirationDate) {
      user.isMember = false;
      user.membershipType = null;
      user.membershipStartDate = null;
      user.membershipExpirationDate = null;
    }

    // Get membership configuration
    const membershipConfig = await MembershipConfig.findOne({ isActive: true });
    if (!membershipConfig) {
      return res.status(500).json({ message: 'Membership configuration not found' });
    }

    // Get current HSC value
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Calculate costs
    const lkrAmount = membershipType === 'monthly' ? membershipConfig.monthlyCharge : membershipConfig.yearlyCharge;
    const hscAmount = Math.ceil(lkrAmount / hscValue);

    // Check HSC balance
    if (user.hscBalance < hscAmount) {
      return res.status(400).json({ 
        message: 'Insufficient HSC balance',
        required: hscAmount,
        available: user.hscBalance
      });
    }

    // Calculate dates
    const startDate = new Date();
    const expirationDate = new Date();
    if (membershipType === 'monthly') {
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    } else {
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }

    // Start transaction
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Deduct HSC from user
      user.hscBalance -= hscAmount;
      user.isMember = true;
      user.membershipType = membershipType;
      user.membershipStartDate = startDate;
      user.membershipExpirationDate = expirationDate;
      await user.save({ session });

      // Create HSC transaction record
      const hscTransaction = new HSCTransaction({
        userId: user._id,
        type: 'spend',
        amount: hscAmount,
        description: `Membership purchase - ${membershipType}`,
        balanceBefore: user.hscBalance + hscAmount,
        balanceAfter: user.hscBalance
      });
      await hscTransaction.save({ session });

      // Create membership transaction record
      const membershipTransaction = new MembershipTransaction({
        userId: user._id,
        membershipType,
        amount: lkrAmount,
        hscAmount,
        hscValue,
        startDate,
        expirationDate
      });
      await membershipTransaction.save({ session });

      // Create payment activity record
      const paymentActivity = new PaymentActivity({
        userId: user._id,
        buyerEmail: user.email,
        item: `Holidaysri Membership - ${membershipType}`,
        quantity: 1,
        category: 'Membership',
        originalAmount: hscAmount,
        amount: hscAmount,
        membershipType,
        membershipStartDate: startDate,
        membershipExpirationDate: expirationDate,
        paymentMethod: 'HSC',
        status: 'completed'
      });
      await paymentActivity.save({ session });

      await session.commitTransaction();

      // Send success notification
      await Notification.createNotification(
        user._id,
        '🎉 Welcome to Holidaysri Membership!',
        `Congratulations! You are now a Holidaysri ${membershipType} member. Enjoy premium benefits until ${expirationDate.toLocaleDateString()}.`,
        'purchase',
        {
          membershipType,
          startDate,
          expirationDate,
          hscAmount,
          lkrAmount
        },
        'high'
      );

      // Send welcome email
      await sendMembershipPurchaseEmail(user.email, user.name, membershipType, startDate, expirationDate, membershipConfig.features);

      res.json({
        message: 'Membership purchased successfully',
        membership: {
          type: membershipType,
          startDate,
          expirationDate,
          features: membershipConfig.features
        },
        transaction: {
          id: membershipTransaction.transactionId,
          hscAmount,
          lkrAmount
        },
        newHscBalance: user.hscBalance
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Purchase membership error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get membership transactions (for user)
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await MembershipTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MembershipTransaction.countDocuments({ userId: req.user._id });

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get membership transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
