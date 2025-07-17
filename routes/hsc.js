const express = require('express');
const User = require('../models/User');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');

const router = express.Router();

// Get current HSC value and packages
router.get('/info', async (req, res) => {
  try {
    // Get current HSC configuration
    let hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    if (!hscConfig) {
      // Create default configuration if none exists
      hscConfig = new HSCConfig({
        hscValue: process.env.DEFAULT_HSC_VALUE || 100,
        updatedBy: 'system'
      });
      await hscConfig.save();
    }

    // Get active packages
    const packages = await HSCPackage.find({ isActive: true }).sort({ hscAmount: 1 });

    res.json({
      hscValue: hscConfig.hscValue,
      hsgValue: hscConfig.hsgValue || 1,
      hsdValue: hscConfig.hsdValue || 1,
      currency: hscConfig.currency,
      packages
    });

  } catch (error) {
    console.error('Get HSC info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase HSC (custom amount)
router.post('/purchase', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid HSC amount' });
    }

    if (!paymentMethod || !['card', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Get current HSC value
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Calculate total price
    const totalPrice = amount * hscValue;

    // In a real application, you would integrate with a payment gateway here
    // For now, we'll simulate a successful payment
    const simulatedPaymentResult = {
      success: true,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      status: 'completed'
    };

    if (!simulatedPaymentResult.success) {
      return res.status(400).json({ message: 'Payment failed' });
    }

    // Update user's HSC balance
    const user = await User.findById(req.user._id);
    const balanceBefore = user.hscBalance;
    user.hscBalance += amount;
    await user.save();

    // Create transaction record
    const transaction = new HSCTransaction({
      userId: req.user._id,
      type: 'purchase',
      amount,
      description: `Purchased ${amount} HSC tokens`,
      paymentMethod,
      paymentDetails: {
        transactionId: simulatedPaymentResult.transactionId,
        paymentStatus: 'completed',
        ...paymentDetails
      },
      balanceBefore,
      balanceAfter: user.hscBalance
    });

    await transaction.save();

    res.json({
      message: 'HSC purchase successful',
      transaction: {
        id: transaction._id,
        amount,
        totalPrice,
        newBalance: user.hscBalance,
        transactionId: simulatedPaymentResult.transactionId
      }
    });

  } catch (error) {
    console.error('HSC purchase error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase HSC package
router.post('/purchase-package', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { packageId, paymentMethod, paymentDetails } = req.body;

    if (!packageId) {
      return res.status(400).json({ message: 'Package ID is required' });
    }

    if (!paymentMethod || !['card', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Get package details
    const package = await HSCPackage.findById(packageId);
    if (!package || !package.isActive) {
      return res.status(404).json({ message: 'Package not found or inactive' });
    }

    // In a real application, you would integrate with a payment gateway here
    const simulatedPaymentResult = {
      success: true,
      transactionId: `PKG_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      status: 'completed'
    };

    if (!simulatedPaymentResult.success) {
      return res.status(400).json({ message: 'Payment failed' });
    }

    // Update user's HSC balance
    const user = await User.findById(req.user._id);
    const balanceBefore = user.hscBalance;
    user.hscBalance += package.hscAmount;
    await user.save();

    // Create transaction record
    const transaction = new HSCTransaction({
      userId: req.user._id,
      type: 'purchase',
      amount: package.hscAmount,
      description: `Purchased ${package.name} package (${package.hscAmount} HSC)`,
      paymentMethod,
      paymentDetails: {
        transactionId: simulatedPaymentResult.transactionId,
        paymentStatus: 'completed',
        packageId: package._id,
        ...paymentDetails
      },
      balanceBefore,
      balanceAfter: user.hscBalance
    });

    await transaction.save();

    res.json({
      message: 'Package purchase successful',
      transaction: {
        id: transaction._id,
        package: package.name,
        hscAmount: package.hscAmount,
        price: package.price,
        newBalance: user.hscBalance,
        transactionId: simulatedPaymentResult.transactionId
      }
    });

  } catch (error) {
    console.error('Package purchase error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction history
router.get('/transactions', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    
    const query = { userId: req.user._id };
    if (type) query.type = type;

    const transactions = await HSCTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('relatedAdvertisement', 'title category');

    const total = await HSCTransaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Spend HSC (for advertisements)
router.post('/spend', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { amount, description, advertisementId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid HSC amount' });
    }

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    // Check user's balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < amount) {
      return res.status(400).json({ message: 'Insufficient HSC balance' });
    }

    // Deduct HSC from user's balance
    const balanceBefore = user.hscBalance;
    user.hscBalance -= amount;
    await user.save();

    // Create transaction record
    const transaction = new HSCTransaction({
      userId: req.user._id,
      type: 'spend',
      amount,
      description,
      balanceBefore,
      balanceAfter: user.hscBalance,
      relatedAdvertisement: advertisementId || null
    });

    await transaction.save();

    res.json({
      message: 'HSC spent successfully',
      transaction: {
        id: transaction._id,
        amount,
        newBalance: user.hscBalance,
        description
      }
    });

  } catch (error) {
    console.error('HSC spend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
