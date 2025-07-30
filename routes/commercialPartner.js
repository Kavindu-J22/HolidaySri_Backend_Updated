const express = require('express');
const { CommercialPartnerConfig, CommercialPartner } = require('../models/CommercialPartner');
const User = require('../models/User');
const PaymentActivity = require('../models/PaymentActivity');
const Notification = require('../models/Notification');
const { HSCConfig, HSCTransaction } = require('../models/HSC');
const { verifyToken } = require('../middleware/auth');
const { sendCommercialPartnerWelcomeEmail, sendCommercialPartnerExpirationWarning, sendCommercialPartnerExpiredEmail } = require('../utils/emailService');

const router = express.Router();

// Get commercial partner configuration (public)
router.get('/config', async (req, res) => {
  try {
    const partnerConfig = await CommercialPartnerConfig.findOne({ isActive: true });
    
    if (!partnerConfig) {
      return res.status(404).json({ message: 'Commercial partner configuration not found' });
    }

    // Get current HSC value for conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    res.json({
      success: true,
      config: {
        ...partnerConfig.toObject(),
        hscValue,
        currency: hscConfig ? hscConfig.currency : 'LKR'
      }
    });

  } catch (error) {
    console.error('Get commercial partner config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's commercial partner status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get partner details if user is a partner
    let partnerDetails = null;
    if (user.isPartner) {
      partnerDetails = await CommercialPartner.findOne({ userId: req.user._id, status: 'active' });
    }

    res.json({
      success: true,
      isPartner: user.isPartner,
      partnerExpirationDate: user.partnerExpirationDate,
      hscBalance: user.hscBalance,
      partnerDetails
    });

  } catch (error) {
    console.error('Get commercial partner status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase commercial partnership
router.post('/purchase', verifyToken, async (req, res) => {
  try {
    const { 
      partnershipType, 
      companyName, 
      businessType, 
      businessLogo, 
      documents 
    } = req.body;

    // Validate required fields
    if (!partnershipType || !companyName || !businessType || !businessLogo) {
      return res.status(400).json({ 
        message: 'Partnership type, company name, business type, and business logo are required' 
      });
    }

    // Validate documents (must have either NIC front/back or passport)
    if (!documents || (!documents.passport && (!documents.nicFront || !documents.nicBack))) {
      return res.status(400).json({ 
        message: 'Must provide either passport or both NIC front and back images' 
      });
    }

    // Check if user exists
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a partner
    if (user.isPartner && user.partnerExpirationDate && new Date(user.partnerExpirationDate) > new Date()) {
      return res.status(400).json({ message: 'You are already an active commercial partner' });
    }

    // Get partner configuration
    const partnerConfig = await CommercialPartnerConfig.findOne({ isActive: true });
    if (!partnerConfig) {
      return res.status(404).json({ message: 'Commercial partner configuration not found' });
    }

    // Get current HSC value
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Calculate amount and HSC required
    const amount = partnershipType === 'yearly' ? partnerConfig.yearlyCharge : partnerConfig.monthlyCharge;
    const hscRequired = Math.ceil(amount / hscValue);

    // Check user's HSC balance
    if (user.hscBalance < hscRequired) {
      return res.status(400).json({ 
        message: `Insufficient HSC balance. Required: ${hscRequired} HSC, Available: ${user.hscBalance} HSC` 
      });
    }

    // Start transaction
    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
      // Store original balance before deduction
      const originalBalance = user.hscBalance;

      // Deduct HSC from user
      user.hscBalance -= hscRequired;
      user.isPartner = true;

      // Set expiration date
      const startDate = new Date();
      let expirationDate;
      if (partnershipType === 'yearly') {
        expirationDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
      } else {
        expirationDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
      }
      user.partnerExpirationDate = expirationDate;

      await user.save({ session });

      // Create or update commercial partner record
      let commercialPartner = await CommercialPartner.findOne({ userId: req.user._id });
      
      if (commercialPartner) {
        // Update existing partner (renewal)
        commercialPartner.partnershipType = partnershipType;
        commercialPartner.amount = amount;
        commercialPartner.hscAmount = hscRequired;
        commercialPartner.hscValue = hscValue;
        commercialPartner.startDate = startDate;
        commercialPartner.expirationDate = expirationDate;
        commercialPartner.status = 'active';
        commercialPartner.renewalCount += 1;
        commercialPartner.lastRenewalDate = startDate;
        commercialPartner.expirationWarningEmailSent = false;
        commercialPartner.expiredNotificationEmailSent = false;
        
        // Update company details if provided
        if (companyName) commercialPartner.companyName = companyName;
        if (businessType) commercialPartner.businessType = businessType;
        if (businessLogo) commercialPartner.businessLogo = businessLogo;
        if (documents) commercialPartner.documents = documents;
      } else {
        // Create new partner record
        commercialPartner = new CommercialPartner({
          userId: req.user._id,
          companyName,
          businessType,
          businessLogo,
          documents,
          partnershipType,
          amount,
          hscAmount: hscRequired,
          hscValue,
          startDate,
          expirationDate
        });
      }

      await commercialPartner.save({ session });

      // Record payment activity
      const paymentActivity = new PaymentActivity({
        userId: req.user._id,
        buyerEmail: user.email,
        item: `Commercial Partnership - ${partnershipType}`,
        quantity: 1,
        category: 'Commercial Partnership',
        originalAmount: hscRequired,
        amount: hscRequired,
        discountedAmount: 0,
        status: 'completed',
        paymentMethod: 'HSC',
        description: `Commercial partnership purchase - ${companyName}`,
        metadata: {
          partnershipType,
          companyName,
          businessType,
          partnerId: commercialPartner._id
        }
      });

      await paymentActivity.save({ session });

      // Record HSC transaction
      const hscTransaction = new HSCTransaction({
        userId: req.user._id,
        type: 'spend',
        amount: hscRequired,
        description: `Commercial Partnership - ${partnershipType}`,
        balanceBefore: originalBalance,
        balanceAfter: user.hscBalance,
        relatedTransaction: paymentActivity._id
      });

      await hscTransaction.save({ session });

      // Create notification
      const notification = new Notification({
        userId: req.user._id,
        title: 'Welcome to Commercial Partnership!',
        message: `Congratulations! You are now a Holidaysri Commercial Partner. Your ${partnershipType} partnership is active until ${expirationDate.toLocaleDateString()}.`,
        type: 'purchase',
        data: {
          partnershipType,
          expirationDate,
          partnerId: commercialPartner._id
        }
      });

      await notification.save({ session });

      await session.commitTransaction();

      // Send welcome email (don't wait for it)
      sendCommercialPartnerWelcomeEmail(user.email, user.name, {
        partnershipType,
        companyName,
        expirationDate,
        features: partnerConfig.features
      }).catch(error => {
        console.error('Failed to send commercial partner welcome email:', error);
      });

      res.json({
        success: true,
        message: 'Commercial partnership purchased successfully!',
        partnership: {
          partnershipType,
          companyName,
          expirationDate,
          amount,
          hscAmount: hscRequired,
          transactionId: commercialPartner.transactionId
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Commercial partner purchase error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to purchase commercial partnership' 
    });
  }
});

// Get current commercial partners list (public)
router.get('/partners', async (req, res) => {
  try {
    const partners = await CommercialPartner.find({ 
      status: 'active',
      isActive: true 
    })
    .populate('userId', 'name')
    .select('companyName businessType businessLogo createdAt')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({
      success: true,
      partners
    });

  } catch (error) {
    console.error('Get commercial partners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update partner logo
router.put('/update-logo', verifyToken, async (req, res) => {
  try {
    const { businessLogo } = req.body;

    if (!businessLogo) {
      return res.status(400).json({ message: 'Business logo is required' });
    }

    const partner = await CommercialPartner.findOne({
      userId: req.user._id,
      status: 'active'
    });

    if (!partner) {
      return res.status(404).json({ message: 'Active commercial partnership not found' });
    }

    partner.businessLogo = businessLogo;
    await partner.save();

    // Create notification
    const notification = new Notification({
      userId: req.user._id,
      title: 'Business Logo Updated',
      message: `Your business logo for ${partner.companyName} has been updated successfully.`,
      type: 'system',
      data: {
        partnerId: partner._id,
        companyName: partner.companyName
      }
    });

    await notification.save();

    res.json({
      success: true,
      message: 'Business logo updated successfully',
      businessLogo
    });

  } catch (error) {
    console.error('Update partner logo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
