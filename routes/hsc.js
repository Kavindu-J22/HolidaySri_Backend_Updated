const express = require('express');
const User = require('../models/User');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const PaymentActivity = require('../models/PaymentActivity');
const MoneyTransaction = require('../models/MoneyTransaction');
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
      additionalRoomCharge: hscConfig.additionalRoomCharge || 50,
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
    const { amount, paymentMethod, paymentDetails, customerDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid HSC amount' });
    }

    if (!paymentMethod || !['card', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Get current HSC value
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;
    const currency = hscConfig ? hscConfig.currency : 'LKR';

    // Calculate total price in LKR
    const totalPrice = amount * hscValue;

    // Get user details
    const user = await User.findById(req.user._id);
    const balanceBefore = user.hscBalance;
    const hsgBalanceBefore = user.hsgBalance || 0;
    const hsdBalanceBefore = user.hsdBalance || 0;

    // Update user's HSC balance
    user.hscBalance += amount;
    await user.save();

    // Create HSC transaction record
    const transaction = new HSCTransaction({
      userId: req.user._id,
      type: 'purchase',
      amount,
      description: `Purchased ${amount} HSC tokens (Custom Amount)`,
      paymentMethod,
      paymentDetails: {
        transactionId: paymentDetails?.transactionId || `TXN_${Date.now()}`,
        paymentStatus: 'completed',
        ...paymentDetails
      },
      balanceBefore,
      balanceAfter: user.hscBalance
    });
    await transaction.save();

    // Create Payment Activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: `Custom HSC Purchase - ${amount} HSC`,
      quantity: amount,
      category: 'HSC Purchase',
      originalAmount: totalPrice,
      amount: totalPrice,
      discountedAmount: 0,
      paymentMethod: 'LKR',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create Money Transaction record
    const moneyTransaction = new MoneyTransaction({
      userId: req.user._id,
      userEmail: user.email,
      userName: user.name || 'User',
      transactionType: 'HSC_PURCHASE',
      paymentGateway: 'PayHere',
      paymentMethod: 'LKR',
      amountLKR: totalPrice,
      hscAmount: amount,
      hscValue: hscValue,
      description: `Custom HSC Purchase - ${amount} HSC tokens`,
      category: 'HSC Purchase',
      gatewayTransactionId: paymentDetails?.transactionId || `TXN_${Date.now()}`,
      gatewayStatus: 'completed',
      customerDetails: customerDetails || {},
      itemDetails: {
        itemName: `Custom HSC Purchase - ${amount} HSC`,
        quantity: amount,
        packageType: 'Custom'
      },
      balanceBefore: {
        hsc: balanceBefore,
        hsg: hsgBalanceBefore,
        hsd: hsdBalanceBefore
      },
      balanceAfter: {
        hsc: user.hscBalance,
        hsg: user.hsgBalance || 0,
        hsd: user.hsdBalance || 0
      },
      status: 'completed',
      relatedPaymentActivity: paymentActivity._id,
      relatedHSCTransaction: transaction._id
    });
    await moneyTransaction.save();

    res.json({
      message: 'HSC purchase successful',
      transaction: {
        id: transaction._id,
        amount,
        totalPrice,
        newBalance: user.hscBalance,
        transactionId: paymentDetails?.transactionId || transaction.transactionId,
        paymentActivityId: paymentActivity._id,
        moneyTransactionId: moneyTransaction._id
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
    const { packageId, paymentMethod, paymentDetails, customerDetails } = req.body;

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

    // Get current HSC value for conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Get user details
    const user = await User.findById(req.user._id);
    const balanceBefore = user.hscBalance;
    const hsgBalanceBefore = user.hsgBalance || 0;
    const hsdBalanceBefore = user.hsdBalance || 0;

    // Update user's HSC balance
    user.hscBalance += package.hscAmount;

    // Add bonus HSG and HSD if available in the package
    const bonusHsgAmount = package.bonusHsgAmount || 0;
    const bonusHsdAmount = package.bonusHsdAmount || 0;

    if (bonusHsgAmount > 0) {
      user.hsgBalance = (user.hsgBalance || 0) + bonusHsgAmount;
    }
    if (bonusHsdAmount > 0) {
      user.hsdBalance = (user.hsdBalance || 0) + bonusHsdAmount;
    }

    await user.save();

    // Build description including bonus tokens
    let description = `Purchased ${package.name} package (${package.hscAmount} HSC)`;
    if (bonusHsgAmount > 0 || bonusHsdAmount > 0) {
      const bonusParts = [];
      if (bonusHsgAmount > 0) bonusParts.push(`${bonusHsgAmount} HSG`);
      if (bonusHsdAmount > 0) bonusParts.push(`${bonusHsdAmount} HSD`);
      description += ` + Bonus: ${bonusParts.join(', ')}`;
    }

    // Create HSC transaction record
    const transaction = new HSCTransaction({
      userId: req.user._id,
      type: 'purchase',
      amount: package.hscAmount,
      description: description,
      paymentMethod,
      paymentDetails: {
        transactionId: paymentDetails?.transactionId || `PKG_${Date.now()}`,
        paymentStatus: 'completed',
        packageId: package._id,
        bonusHsgAmount: bonusHsgAmount,
        bonusHsdAmount: bonusHsdAmount,
        ...paymentDetails
      },
      balanceBefore,
      balanceAfter: user.hscBalance
    });
    await transaction.save();

    // Create Payment Activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: `HSC Package - ${package.name}`,
      quantity: package.hscAmount,
      category: 'HSC Purchase',
      originalAmount: package.price,
      amount: package.price,
      discountedAmount: package.discount || 0,
      paymentMethod: 'LKR',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create Money Transaction record
    const moneyTransaction = new MoneyTransaction({
      userId: req.user._id,
      userEmail: user.email,
      userName: user.name || 'User',
      transactionType: 'HSC_PURCHASE',
      paymentGateway: 'PayHere',
      paymentMethod: 'LKR',
      amountLKR: package.price,
      hscAmount: package.hscAmount,
      hscValue: hscValue,
      description: description,
      category: 'Package Purchase',
      gatewayTransactionId: paymentDetails?.transactionId || `PKG_${Date.now()}`,
      gatewayStatus: 'completed',
      customerDetails: customerDetails || {},
      itemDetails: {
        itemName: package.name,
        itemId: package._id,
        quantity: package.hscAmount,
        packageType: package.name,
        bonusHsgAmount: bonusHsgAmount,
        bonusHsdAmount: bonusHsdAmount
      },
      balanceBefore: {
        hsc: balanceBefore,
        hsg: hsgBalanceBefore,
        hsd: hsdBalanceBefore
      },
      balanceAfter: {
        hsc: user.hscBalance,
        hsg: user.hsgBalance || 0,
        hsd: user.hsdBalance || 0
      },
      status: 'completed',
      relatedPaymentActivity: paymentActivity._id,
      relatedHSCTransaction: transaction._id
    });
    await moneyTransaction.save();

    res.json({
      message: 'Package purchase successful',
      transaction: {
        id: transaction._id,
        package: package.name,
        hscAmount: package.hscAmount,
        bonusHsgAmount: bonusHsgAmount,
        bonusHsdAmount: bonusHsdAmount,
        price: package.price,
        newBalance: {
          hsc: user.hscBalance,
          hsg: user.hsgBalance || 0,
          hsd: user.hsdBalance || 0
        },
        transactionId: paymentDetails?.transactionId || transaction.transactionId,
        paymentActivityId: paymentActivity._id,
        moneyTransactionId: moneyTransaction._id
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
