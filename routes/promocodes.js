const express = require('express');
const { PromoCodeConfig, PromoCodeTransaction, HSCConfig } = require('../models/HSC');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const PaymentActivity = require('../models/PaymentActivity');
const Notification = require('../models/Notification');
const HSCEarned = require('../models/HSCEarned');
const PromoCodeAccess = require('../models/PromoCodeAccess');
const { verifyToken, verifyAdminToken } = require('../middleware/auth');
const { sendPromoCodeSoldNotification, sendPromoCodePurchaseSuccess } = require('../utils/emailService');
const nodemailer = require('nodemailer');

const router = express.Router();

// Validate promocode for booking (public endpoint)
router.get('/validate-promocode/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.json({
        success: false,
        isValid: false,
        message: 'Promocode is required'
      });
    }

    // Find agent with this promocode
    const agent = await Agent.findOne({
      promoCode: code.toUpperCase()
    });

    if (!agent) {
      return res.json({
        success: false,
        isValid: false,
        message: 'Invalid promocode'
      });
    }

    // Check if active
    if (!agent.isActive) {
      return res.json({
        success: false,
        isValid: false,
        message: 'This promocode is inactive'
      });
    }

    // Check if expired
    if (agent.expirationDate && new Date(agent.expirationDate) < new Date()) {
      return res.json({
        success: false,
        isValid: false,
        message: 'This promocode has expired'
      });
    }

    // Valid promocode
    res.json({
      success: true,
      isValid: true,
      message: 'Valid promocode',
      agent: {
        _id: agent._id,
        userId: agent.userId,
        userName: agent.userName,
        email: agent.email,
        promoCode: agent.promoCode,
        promoCodeType: agent.promoCodeType
      }
    });

  } catch (error) {
    console.error('Error validating promocode:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Server error while validating promocode'
    });
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  // Configure your email service here
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Email template for promo code purchase
const createPromoCodePurchaseEmail = (user, paymentData) => {
  return {
    from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
    to: user.email,
    subject: '🎉 Welcome to Our Agent Network - Your Promo Code is Ready!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You are now an agent with us!</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #374151; margin-top: 0;">Order Summary</h2>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #10b981; margin: 0 0 15px 0; font-size: 24px; text-align: center;">Your Promo Code</h3>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #10b981;">
              <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 3px;">${paymentData.purchasedPromoCode}</span>
            </div>
            <p style="text-align: center; margin: 10px 0 0 0; color: #6b7280; text-transform: capitalize;">${paymentData.purchasedPromoCodeType} Agent Status</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Transaction ID:</td>
              <td style="padding: 10px 0; font-family: monospace; color: #374151;">${paymentData.transactionId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Item:</td>
              <td style="padding: 10px 0; color: #374151;">${paymentData.item}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Amount Paid:</td>
              <td style="padding: 10px 0; color: #374151; font-weight: bold;">${paymentData.amount} HSC</td>
            </tr>
            ${paymentData.discountedAmount > 0 ? `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Discount Applied:</td>
              <td style="padding: 10px 0; color: #10b981; font-weight: bold;">-${paymentData.discountedAmount} HSC</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Purchase Date:</td>
              <td style="padding: 10px 0; color: #374151;">${new Date().toLocaleDateString()}</td>
            </tr>
          </table>

          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1d4ed8; margin: 0 0 15px 0;">🚀 Start Earning Today!</h3>
            <ul style="color: #374151; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Share your promo code with friends and family</li>
              <li>Earn money for every successful referral</li>
              <li>Get discounts on advertisements</li>
              <li>Build your network and grow your business</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'https://www.holidaysri.com'}/profile"
               style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              View My Profile & Start Earning
            </a>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>Thank you for joining our agent network!</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    `
  };
};

// Get current promo code configuration (for clients)
router.get('/config', async (req, res) => {
  try {
    // Get current promo code configuration
    let promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    
    if (!promoConfig) {
      // Create default configuration if none exists
      promoConfig = new PromoCodeConfig({
        updatedBy: 'system'
      });
      await promoConfig.save();
    }

    // Get current HSC value for price conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Helper function to calculate discounted price
    const calculateDiscountedPrice = (originalPrice, discountRate) => {
      const discountAmount = (originalPrice * discountRate) / 100;
      return originalPrice - discountAmount;
    };

    // Convert prices to HSC equivalent for client display
    const promoTypes = {
      silver: {
        originalPriceInLKR: promoConfig.silver.price,
        originalPriceInHSC: Math.round(promoConfig.silver.price / hscValue * 100) / 100,
        discountRate: promoConfig.silver.discountRate,
        discountedPriceInLKR: calculateDiscountedPrice(promoConfig.silver.price, promoConfig.silver.discountRate),
        discountedPriceInHSC: Math.round(calculateDiscountedPrice(promoConfig.silver.price, promoConfig.silver.discountRate) / hscValue * 100) / 100,
        priceInHSC: Math.round(calculateDiscountedPrice(promoConfig.silver.price, promoConfig.silver.discountRate) / hscValue * 100) / 100,
        priceInLKR: calculateDiscountedPrice(promoConfig.silver.price, promoConfig.silver.discountRate),
        earningForPurchase: promoConfig.silver.earningForPurchase,
        earningForMonthlyAd: promoConfig.silver.earningForMonthlyAd,
        earningForDailyAd: promoConfig.silver.earningForDailyAd,
        earningForHourlyAd: promoConfig.silver.earningForHourlyAd,
        earningForYearlyAd: promoConfig.silver.earningForYearlyAd
      },
      gold: {
        originalPriceInLKR: promoConfig.gold.price,
        originalPriceInHSC: Math.round(promoConfig.gold.price / hscValue * 100) / 100,
        discountRate: promoConfig.gold.discountRate,
        discountedPriceInLKR: calculateDiscountedPrice(promoConfig.gold.price, promoConfig.gold.discountRate),
        discountedPriceInHSC: Math.round(calculateDiscountedPrice(promoConfig.gold.price, promoConfig.gold.discountRate) / hscValue * 100) / 100,
        priceInHSC: Math.round(calculateDiscountedPrice(promoConfig.gold.price, promoConfig.gold.discountRate) / hscValue * 100) / 100,
        priceInLKR: calculateDiscountedPrice(promoConfig.gold.price, promoConfig.gold.discountRate),
        earningForPurchase: promoConfig.gold.earningForPurchase,
        earningForMonthlyAd: promoConfig.gold.earningForMonthlyAd,
        earningForDailyAd: promoConfig.gold.earningForDailyAd,
        earningForHourlyAd: promoConfig.gold.earningForHourlyAd,
        earningForYearlyAd: promoConfig.gold.earningForYearlyAd
      },
      diamond: {
        originalPriceInLKR: promoConfig.diamond.price,
        originalPriceInHSC: Math.round(promoConfig.diamond.price / hscValue * 100) / 100,
        discountRate: promoConfig.diamond.discountRate,
        discountedPriceInLKR: calculateDiscountedPrice(promoConfig.diamond.price, promoConfig.diamond.discountRate),
        discountedPriceInHSC: Math.round(calculateDiscountedPrice(promoConfig.diamond.price, promoConfig.diamond.discountRate) / hscValue * 100) / 100,
        priceInHSC: Math.round(calculateDiscountedPrice(promoConfig.diamond.price, promoConfig.diamond.discountRate) / hscValue * 100) / 100,
        priceInLKR: calculateDiscountedPrice(promoConfig.diamond.price, promoConfig.diamond.discountRate),
        earningForPurchase: promoConfig.diamond.earningForPurchase,
        earningForMonthlyAd: promoConfig.diamond.earningForMonthlyAd,
        earningForDailyAd: promoConfig.diamond.earningForDailyAd,
        earningForHourlyAd: promoConfig.diamond.earningForHourlyAd,
        earningForYearlyAd: promoConfig.diamond.earningForYearlyAd
      },
      free: {
        originalPriceInLKR: 0,
        originalPriceInHSC: 0,
        discountRate: promoConfig.free.discountRate,
        discountedPriceInLKR: 0,
        discountedPriceInHSC: 0,
        priceInHSC: 0,
        priceInLKR: 0,
        earningForPurchase: promoConfig.free.earningForPurchase,
        earningForMonthlyAd: promoConfig.free.earningForMonthlyAd,
        earningForDailyAd: promoConfig.free.earningForDailyAd,
        earningForHourlyAd: promoConfig.free.earningForHourlyAd,
        earningForYearlyAd: promoConfig.free.earningForYearlyAd
      }
    };

    res.json({
      promoTypes,
      hscValue,
      currency: hscConfig ? hscConfig.currency : 'LKR',
      lastUpdated: promoConfig.lastUpdated,
      sellAdFee: promoConfig.sellAdFee || 100,
      accessPromoCodeViewAmount: promoConfig.accessPromoCodeViewAmount || 50,
      discounts: {
        monthlyAdDiscount: promoConfig.discounts.monthlyAdDiscount,
        dailyAdDiscount: promoConfig.discounts.dailyAdDiscount,
        hourlyAdDiscount: promoConfig.discounts.hourlyAdDiscount,
        yearlyAdDiscount: promoConfig.discounts.yearlyAdDiscount,
        purchaseDiscount: promoConfig.discounts.purchaseDiscount,
        purchaseDiscountInHSC: Math.round(promoConfig.discounts.purchaseDiscount / hscValue * 100) / 100
      }
    });

  } catch (error) {
    console.error('Get promo code config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get promo code configuration
router.get('/admin/config', verifyAdminToken, async (req, res) => {
  try {
    let promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    
    if (!promoConfig) {
      // Create default configuration if none exists
      promoConfig = new PromoCodeConfig({
        updatedBy: req.admin.username
      });
      await promoConfig.save();
    }

    res.json(promoConfig);

  } catch (error) {
    console.error('Admin get promo code config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update promo code configuration
router.put('/admin/config', verifyAdminToken, async (req, res) => {
  try {
    const { silver, gold, diamond, free, discounts, sellAdFee, accessPromoCodeViewAmount } = req.body;

    // Validate that free promo code price is always 0
    if (free && free.price && free.price !== 0) {
      return res.status(400).json({ message: 'Free promo code price must always be 0 LKR' });
    }

    const updateData = {
      updatedBy: req.admin.username,
      lastUpdated: new Date()
    };

    if (silver) updateData.silver = silver;
    if (gold) updateData.gold = gold;
    if (diamond) updateData.diamond = diamond;
    if (free) {
      updateData.free = { ...free, price: 0 }; // Ensure free price is always 0
    }
    if (discounts) updateData.discounts = discounts;
    if (sellAdFee !== undefined) updateData.sellAdFee = sellAdFee;
    if (accessPromoCodeViewAmount !== undefined) updateData.accessPromoCodeViewAmount = accessPromoCodeViewAmount;

    const promoConfig = new PromoCodeConfig(updateData);
    await promoConfig.save();

    res.json({
      message: 'Promo code configuration updated successfully',
      config: promoConfig
    });

  } catch (error) {
    console.error('Admin update promo code config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's promo code transactions
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (type) {
      query.transactionType = type;
    }

    const transactions = await PromoCodeTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedAdvertisement', 'title category');

    const total = await PromoCodeTransaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get promo code transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all promo code transactions
router.get('/admin/transactions', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, promoCodeType, transactionType } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (userId) query.userId = userId;
    if (promoCodeType) query.promoCodeType = promoCodeType;
    if (transactionType) query.transactionType = transactionType;

    const transactions = await PromoCodeTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('relatedAdvertisement', 'title category');

    const total = await PromoCodeTransaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Admin get promo code transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user already has a promo code
router.get('/user-has-promocode', verifyToken, async (req, res) => {
  try {
    // Check for ANY promo code (active, inactive, or expired)
    const agent = await Agent.findOne({
      userId: req.user._id
    });

    if (agent) {
      const isActive = agent.isActive && new Date() <= new Date(agent.expirationDate);
      const isExpired = new Date() > new Date(agent.expirationDate);

      res.json({
        hasPromoCode: true,
        promoCode: agent.promoCode,
        promoCodeType: agent.promoCodeType,
        isActive: agent.isActive,
        isExpired: isExpired,
        isCurrentlyActive: isActive,
        expirationDate: agent.expirationDate,
        totalEarnings: agent.totalEarnings || 0,
        totalReferrals: agent.totalReferrals || 0,
        usedCount: agent.usedCount || 0
      });
    } else {
      res.json({
        hasPromoCode: false,
        promoCode: null,
        promoCodeType: null
      });
    }

  } catch (error) {
    console.error('Check user promo code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if promo code is unique
router.post('/check-unique', verifyToken, async (req, res) => {
  try {
    const { promoCode } = req.body;

    if (!promoCode) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const existingAgent = await Agent.findOne({
      promoCode: promoCode.toUpperCase()
    });

    res.json({
      isUnique: !existingAgent,
      exists: !!existingAgent
    });

  } catch (error) {
    console.error('Check promo code uniqueness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate promo code for discount
router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { promoCode } = req.body;

    if (!promoCode) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    // Check if promo code exists in agents collection and is active
    const agent = await Agent.findOne({
      promoCode: promoCode.toUpperCase(),
      isActive: true,
      expirationDate: { $gt: new Date() }
    }).populate('userId', 'name email');

    if (!agent) {
      return res.json({ isValid: false, message: 'Promo code not found or expired' });
    }

    res.json({
      isValid: true,
      isActive: true,
      agent: {
        username: agent.userName,
        email: agent.email
      }
    });

  } catch (error) {
    console.error('Validate promo code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get selling promo codes marketplace
router.get('/marketplace', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      promoCodeType,
      isActive,
      sortBy = 'sellingListedAt',
      sortOrder = 'desc',
      search
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query for selling promo codes
    const query = {
      isSelling: true,
      sellingPrice: { $gt: 0 }
    };

    if (promoCodeType && promoCodeType !== 'all') {
      query.promoCodeType = promoCodeType;
    }

    if (isActive === 'true') {
      query.isActive = true;
      query.expirationDate = { $gt: new Date() };
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { userName: searchRegex },
        { promoCode: searchRegex }
      ];
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'price_low_high') {
      sortObj.sellingPrice = 1;
    } else if (sortBy === 'price_high_low') {
      sortObj.sellingPrice = -1;
    } else {
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Get current HSC value for conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    const sellingPromoCodes = await Agent.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .select('promoCode promoCodeType isActive totalEarnings totalReferrals usedCount userName createdAt updatedAt expirationDate isVerified sellingListedAt sellingDescription sellingPrice isSelling');

    const total = await Agent.countDocuments(query);

    // Transform data to include LKR conversion
    const transformedData = sellingPromoCodes.map(agent => ({
      _id: agent._id,
      promoCode: agent.promoCode,
      promoCodeType: agent.promoCodeType,
      isActive: agent.isActive,
      totalEarnings: agent.totalEarnings || 0,
      totalReferrals: agent.totalReferrals || 0,
      usedCount: agent.usedCount || 0,
      userName: agent.userName,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      expirationDate: agent.expirationDate,
      isVerified: agent.isVerified || false,
      sellingListedAt: agent.sellingListedAt,
      sellingDescription: agent.sellingDescription || '',
      sellingPriceHSC: agent.sellingPrice,
      sellingPriceLKR: Math.round(agent.sellingPrice * hscValue),
      isExpired: new Date() > new Date(agent.expirationDate),
      user: agent.userId
    }));

    res.json({
      promoCodes: transformedData,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      hscValue
    });

  } catch (error) {
    console.error('Get marketplace promo codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get marketplace statistics
router.get('/marketplace/stats', async (req, res) => {
  try {
    const totalCount = await Agent.countDocuments({
      isSelling: true,
      sellingPrice: { $gt: 0 }
    });

    const activeCount = await Agent.countDocuments({
      isSelling: true,
      sellingPrice: { $gt: 0 },
      isActive: true,
      expirationDate: { $gt: new Date() }
    });

    const typeStats = await Agent.aggregate([
      {
        $match: {
          isSelling: true,
          sellingPrice: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$promoCodeType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalCount,
      activeCount,
      typeStats: typeStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('Get marketplace stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process promo code payment
router.post('/process-payment', verifyToken, async (req, res) => {
  try {
    const {
      itemName,
      itemPrice,
      itemCategory,
      quantity,
      finalAmount,
      discountAmount,
      appliedPromoCode,
      promoCodeAgent,
      earnRate,
      promoCode,
      promoType
    } = req.body;

    // Check user's HSC balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < finalAmount) {
      return res.status(400).json({ message: 'Insufficient HSC balance' });
    }

    // Start transaction-like operations
    let promoCodeOwnerAgent = null;

    // If a promo code was applied for discount, get the owner details
    if (appliedPromoCode && promoCodeAgent) {
      promoCodeOwnerAgent = await Agent.findOne({
        promoCode: appliedPromoCode,
        isActive: true
      });
    }

    // 1. Save new agent details in agents schema
    const newAgent = new Agent({
      userId: user._id,
      userName: user.name,
      email: user.email,
      promoCode: promoCode,
      promoCodeType: promoType,
      usedPromoCode: appliedPromoCode || null,
      usedPromoCodeOwner: promoCodeAgent?.email || null
    });
    await newAgent.save();

    // 2. Save earning record if promo code was used for discount
    if (appliedPromoCode && promoCodeAgent && earnRate > 0) {
      const earning = new Earning({
        buyerEmail: user.email,
        buyerId: user._id,
        category: 'Promo Codes',
        amount: earnRate,
        usedPromoCode: appliedPromoCode,
        usedPromoCodeOwner: promoCodeAgent.email,
        usedPromoCodeOwnerId: promoCodeOwnerAgent?.userId,
        item: itemName,
        itemType: promoType,
        status: 'pending'
      });
      await earning.save();

      // Update the promo code owner's total earnings, referrals, and used count
      if (promoCodeOwnerAgent) {
        promoCodeOwnerAgent.totalEarnings += earnRate;

        // Check if this is a new unique buyer (referral) - exclude the current earning we just saved
        const existingEarningCount = await Earning.countDocuments({
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          buyerId: user._id
        });

        // Only increment totalReferrals if this is the first time this buyer used the promo code
        // Since we just saved one earning, if count is 1, this is the first time
        if (existingEarningCount === 1) {
          promoCodeOwnerAgent.totalReferrals += 1;
        }

        promoCodeOwnerAgent.usedCount += 1; // Always increment used count (total times code was used)
        await promoCodeOwnerAgent.save();
      }
    }

    // 3. Save payment activity
    const paymentActivity = new PaymentActivity({
      userId: user._id,
      buyerEmail: user.email,
      item: itemName,
      quantity: quantity,
      category: itemCategory,
      originalAmount: itemPrice,
      amount: finalAmount,
      discountedAmount: discountAmount,
      promoCode: appliedPromoCode || null,
      promoCodeOwner: promoCodeAgent?.email || null,
      promoCodeOwnerId: promoCodeOwnerAgent?.userId || null,
      forEarns: (appliedPromoCode && promoCodeAgent && earnRate > 0) ? earnRate : 0, // Only store earn value if promo code was used for discount
      purchasedPromoCode: promoCode,
      purchasedPromoCodeType: promoType,
      status: 'completed'
    });
    await paymentActivity.save();

    // 4. Update user HSC balance
    user.hscBalance -= finalAmount;
    await user.save();

    // 5. Send professional email with order summary
    try {
      const emailData = createPromoCodePurchaseEmail(user, {
        purchasedPromoCode: promoCode,
        purchasedPromoCodeType: promoType,
        transactionId: paymentActivity.transactionId,
        item: itemName,
        amount: finalAmount,
        discountedAmount: discountAmount
      });

      await transporter.sendMail(emailData);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the payment if email fails
    }

    // 6. Create notification for user
    await Notification.createNotification(
      user._id,
      '🎉 Welcome to Our Agent Network!',
      `Congratulations! You are now a ${promoType} agent with promo code ${promoCode}. Start sharing your code and earning money today!`,
      'purchase',
      {
        promoCode: promoCode,
        promoType: promoType,
        transactionId: paymentActivity.transactionId,
        amount: finalAmount
      },
      'high'
    );

    res.json({
      success: true,
      message: 'Payment processed successfully',
      newBalance: user.hscBalance,
      transactionId: paymentActivity.transactionId,
      promoCode: promoCode
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Buy pre-used promo code
router.post('/buy-preused', verifyToken, async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: 'Agent ID is required' });
    }

    // Get the selling agent
    const sellingAgent = await Agent.findById(agentId);
    if (!sellingAgent) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    // Check if it's actually for sale
    if (!sellingAgent.isSelling || sellingAgent.sellingPrice <= 0) {
      return res.status(400).json({ message: 'This promo code is not for sale' });
    }

    // Check if buyer already has ANY promo code (active, inactive, or expired)
    const buyerAgent = await Agent.findOne({
      userId: req.user._id
    });

    if (buyerAgent) {
      return res.status(400).json({ message: 'You already have a promo code. You cannot purchase another one.' });
    }

    // Check buyer's HSC balance
    const buyer = await User.findById(req.user._id);
    if (buyer.hscBalance < sellingAgent.sellingPrice) {
      return res.status(400).json({ message: 'Insufficient HSC balance' });
    }

    // Get current HSC value for conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Store original values before modifying sellingAgent
    const originalSellingPrice = sellingAgent.sellingPrice;
    const originalPromoCode = sellingAgent.promoCode;
    const originalPromoCodeType = sellingAgent.promoCodeType;

    // Start transaction-like operations
    try {
      // 1. Deduct HSC from buyer
      buyer.hscBalance -= originalSellingPrice;
      await buyer.save();

      // 2. Record HSC earnings for seller (don't add to balance directly)
      const seller = await User.findById(sellingAgent.userId);
      if (!seller) {
        throw new Error('Seller not found');
      }

      // Create HSCEarned record
      const hscEarned = new HSCEarned({
        userId: seller._id,
        buyerUserId: req.user._id,
        earnedAmount: originalSellingPrice,
        category: 'Promocode Sold',
        itemDetails: {
          promoCode: originalPromoCode,
          promoCodeType: originalPromoCodeType,
          sellingPrice: originalSellingPrice,
          sellingPriceLKR: Math.round(originalSellingPrice * hscValue)
        },
        buyerDetails: {
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          purchaseDate: new Date()
        },
        transactionId: `PREUSED_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        description: `Promo code ${originalPromoCode} sold to ${buyer.name}`
      });

      await hscEarned.save();

      // 3. Transfer ownership of the promo code
      sellingAgent.userId = req.user._id;
      sellingAgent.userName = buyer.name;
      sellingAgent.email = buyer.email;
      sellingAgent.isSelling = false;
      sellingAgent.sellingPrice = 0;
      sellingAgent.sellingDescription = '';
      sellingAgent.sellingListedAt = null;
      await sellingAgent.save();

      // 4. Create transaction records
      // PaymentActivity is already imported at the top

      // Payment activity for the purchase
      const paymentActivity = new PaymentActivity({
        userId: req.user._id,
        buyerEmail: buyer.email,
        item: `Pre-Used Promo Code - ${originalPromoCode}`,
        quantity: 1,
        category: 'Pre-Used Promocode',
        originalAmount: originalSellingPrice,
        amount: originalSellingPrice,
        discountedAmount: 0,
        promoCode: originalPromoCode,
        promoCodeOwner: seller.email,
        promoCodeOwnerId: seller._id,
        forEarns: Math.round(originalSellingPrice * hscValue),
        paymentMethod: 'HSC',
        status: 'completed',
        transactionId: hscEarned.transactionId
      });

      await paymentActivity.save();

      // 5. Create promo code transaction
      const promoTransaction = new PromoCodeTransaction({
        userId: req.user._id,
        promoCodeType: 'pre-used',
        transactionType: 'purchase',
        amount: Math.round(originalSellingPrice * hscValue),
        hscEquivalent: originalSellingPrice,
        description: `Purchased pre-used promo code: ${originalPromoCode}`,
        paymentMethod: 'hsc', // Using HSC balance for payment
        paymentDetails: {
          transactionId: hscEarned.transactionId,
          paymentStatus: 'completed'
        }
      });

      await promoTransaction.save();

      // Send email notifications
      try {
        // Send notification to seller
        await sendPromoCodeSoldNotification(
          seller.email,
          seller.name,
          {
            promoCode: originalPromoCode,
            promoCodeType: originalPromoCodeType,
            sellingPrice: originalSellingPrice,
            sellingPriceLKR: Math.round(originalSellingPrice * hscValue)
          },
          {
            buyerName: buyer.name,
            buyerEmail: buyer.email
          },
          originalSellingPrice, // HSC amount earned
          Math.round(originalSellingPrice * hscValue) // LKR equivalent earned
        );

        // Send notification to buyer
        await sendPromoCodePurchaseSuccess(
          buyer.email,
          buyer.name,
          {
            promoCode: originalPromoCode,
            promoCodeType: originalPromoCodeType
          },
          originalSellingPrice, // HSC amount paid
          Math.round(originalSellingPrice * hscValue) // LKR equivalent paid
        );
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't fail the transaction if email fails
      }

      // Create in-app notifications
      try {
        // Create notification for seller
        await Notification.createNotification(
          seller._id,
          '💰 Promo Code Sold Successfully!',
          `Great news! Your ${originalPromoCodeType} promo code "${originalPromoCode}" has been sold to ${buyer.name} for ${originalSellingPrice} HSC (≈ ${Math.round(originalSellingPrice * hscValue).toLocaleString()} LKR). You've earned ${originalSellingPrice} HSC!`,
          'earning',
          {
            promoCode: originalPromoCode,
            promoCodeType: originalPromoCodeType,
            sellingPrice: originalSellingPrice,
            sellingPriceLKR: Math.round(originalSellingPrice * hscValue),
            buyerName: buyer.name,
            buyerEmail: buyer.email,
            transactionId: hscEarned.transactionId,
            earnedAmount: originalSellingPrice,
            earnedAmountLKR: Math.round(originalSellingPrice * hscValue)
          },
          'high'
        );

        // Create notification for buyer
        await Notification.createNotification(
          buyer._id,
          '🎉 Welcome to Our Agent Network!',
          `Congratulations! You've successfully purchased the ${originalPromoCodeType} promo code "${originalPromoCode}" for ${originalSellingPrice} HSC and are now an official agent with Holidaysri.com. Start sharing your code and earning commissions today!`,
          'purchase',
          {
            promoCode: originalPromoCode,
            promoCodeType: originalPromoCodeType,
            paidAmount: originalSellingPrice,
            paidAmountLKR: Math.round(originalSellingPrice * hscValue),
            transactionId: hscEarned.transactionId,
            isNewAgent: true,
            agentStatus: 'active'
          },
          'high'
        );
      } catch (notificationError) {
        console.error('In-app notification error:', notificationError);
        // Don't fail the transaction if notification creation fails
      }

      res.json({
        success: true,
        message: 'Pre-used promo code purchased successfully! You are now an agent with us.',
        promoCode: originalPromoCode,
        promoCodeType: originalPromoCodeType,
        paidAmount: originalSellingPrice,
        paidAmountLKR: Math.round(originalSellingPrice * hscValue),
        newBalance: buyer.hscBalance,
        transactionId: paymentActivity.transactionId,
        redirectTo: '/profile' // Redirect to agent dashboard
      });

    } catch (transactionError) {
      console.error('Transaction error:', transactionError);

      // Rollback: restore buyer's balance
      try {
        buyer.hscBalance += sellingAgent.sellingPrice;
        await buyer.save();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }

      throw transactionError;
    }

  } catch (error) {
    console.error('Buy pre-used promo code error:', error);
    res.status(500).json({ message: 'Server error during purchase' });
  }
});

// Check user access to promo code view page
router.get('/check-access', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    // Check if user is an agent (agents get free access)
    const agent = await Agent.findOne({ userId });
    if (agent) {
      // Ensure access record exists for agent
      let accessRecord = await PromoCodeAccess.findOne({ userId });
      if (!accessRecord) {
        accessRecord = new PromoCodeAccess({
          userId,
          userEmail,
          hasAccess: true,
          accessType: 'agent'
        });
        await accessRecord.save();
      } else if (!accessRecord.hasAccess) {
        accessRecord.hasAccess = true;
        accessRecord.accessType = 'agent';
        await accessRecord.save();
      }

      return res.json({
        hasAccess: true,
        accessType: 'agent',
        isAgent: true,
        message: 'Free access as travel agent'
      });
    }

    // Check if user has paid for access
    const accessRecord = await PromoCodeAccess.findOne({ userId });
    if (accessRecord && accessRecord.hasAccess) {
      return res.json({
        hasAccess: true,
        accessType: accessRecord.accessType,
        isAgent: false,
        paidAmount: accessRecord.paidAmount,
        paymentDate: accessRecord.paymentDate
      });
    }

    // User needs to pay for access
    const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    const accessAmount = promoConfig?.accessPromoCodeViewAmount || 50;

    res.json({
      hasAccess: false,
      isAgent: false,
      accessAmount,
      message: 'Payment required to access promo code view page'
    });

  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process payment for promo code view access
router.post('/pay-access', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    // Check if user already has access
    const existingAccess = await PromoCodeAccess.findOne({ userId });
    if (existingAccess && existingAccess.hasAccess) {
      return res.status(400).json({ message: 'You already have access to the promo code view page' });
    }

    // Check if user is an agent (shouldn't need to pay)
    const agent = await Agent.findOne({ userId });
    if (agent) {
      return res.status(400).json({ message: 'Agents get free access to promo codes' });
    }

    // Get access amount from config
    const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    const accessAmount = promoConfig?.accessPromoCodeViewAmount || 50;

    // Check user's HSC balance
    const user = await User.findById(userId);
    if (user.hscBalance < accessAmount) {
      return res.status(400).json({
        message: 'Insufficient HSC balance',
        required: accessAmount,
        current: user.hscBalance,
        shortfall: accessAmount - user.hscBalance
      });
    }

    // Deduct HSC from user's balance
    const balanceBefore = user.hscBalance;
    user.hscBalance -= accessAmount;
    await user.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId,
      buyerEmail: userEmail,
      item: 'Promo Code View Page Access',
      quantity: 1,
      category: 'Access Fee',
      originalAmount: accessAmount,
      amount: accessAmount,
      discountedAmount: 0,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create or update access record
    let accessRecord = await PromoCodeAccess.findOne({ userId });
    if (accessRecord) {
      accessRecord.hasAccess = true;
      accessRecord.accessType = 'paid';
      accessRecord.paidAmount = accessAmount;
      accessRecord.paymentDate = new Date();
      accessRecord.paymentTransactionId = paymentActivity.transactionId;
    } else {
      accessRecord = new PromoCodeAccess({
        userId,
        userEmail,
        hasAccess: true,
        accessType: 'paid',
        paidAmount: accessAmount,
        paymentDate: new Date(),
        paymentTransactionId: paymentActivity.transactionId
      });
    }
    await accessRecord.save();

    res.json({
      success: true,
      message: 'Payment successful! You now have access to the promo code view page.',
      paidAmount: accessAmount,
      newBalance: user.hscBalance,
      transactionId: paymentActivity.transactionId
    });

  } catch (error) {
    console.error('Pay access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active promo codes for explore page (requires access)
router.get('/explore', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 12,
      search,
      promoCodeType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const skip = (page - 1) * limit;

    // Check if user has access
    const agent = await Agent.findOne({ userId });
    const accessRecord = await PromoCodeAccess.findOne({ userId });

    const hasAccess = agent || (accessRecord && accessRecord.hasAccess);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied. Please pay for access or become an agent.' });
    }

    // Update last accessed time
    if (accessRecord) {
      accessRecord.lastAccessedAt = new Date();
      await accessRecord.save();
    }

    // Build query for active promo codes with promoteStatus 'on'
    const query = {
      isActive: true,
      promoteStatus: 'on',
      expirationDate: { $gt: new Date() }
    };

    // Add promo code type filter
    if (promoCodeType && promoCodeType !== 'all') {
      query.promoCodeType = promoCodeType;
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { userName: searchRegex },
        { promoCode: searchRegex }
      ];
    }

    // Get total count for pagination
    const total = await Agent.countDocuments(query);

    // Build sort object
    const sortObj = {};
    if (sortBy === 'random') {
      // Use aggregation for random sampling
      const promoCodes = await Agent.aggregate([
        { $match: query },
        { $sample: { size: parseInt(limit) } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $project: {
            promoCode: 1,
            userName: 1,
            promoCodeType: 1,
            totalEarnings: 1,
            totalReferrals: 1,
            usedCount: 1,
            createdAt: 1,
            expirationDate: 1,
            isVerified: 1,
            'user.name': 1
          }
        }
      ]);

      // Get user's favorites if they have access record
      let favoritePromoCodeIds = [];
      if (accessRecord) {
        favoritePromoCodeIds = accessRecord.favoritePromoCodes.map(fav => fav.agentId.toString());
      }

      // Add isFavorite flag to each promo code
      const promoCodesWithFavorites = promoCodes.map(promo => ({
        ...promo,
        isFavorite: favoritePromoCodeIds.includes(promo._id.toString())
      }));

      return res.json({
        promoCodes: promoCodesWithFavorites,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        userAccess: {
          isAgent: !!agent,
          accessType: agent ? 'agent' : accessRecord?.accessType
        }
      });
    } else {
      // Use regular find with sorting
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Get promo codes with sorting and pagination
    const promoCodes = await Agent.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .select('promoCode promoCodeType isActive totalEarnings totalReferrals usedCount userName createdAt updatedAt expirationDate isVerified promoteStatus');

    // Get user's favorites if they have access record
    let favoritePromoCodeIds = [];
    if (accessRecord) {
      favoritePromoCodeIds = accessRecord.favoritePromoCodes.map(fav => fav.agentId.toString());
    }

    // Add isFavorite flag to each promo code
    const promoCodesWithFavorites = promoCodes.map(promo => ({
      ...promo.toObject(),
      isFavorite: favoritePromoCodeIds.includes(promo._id.toString())
    }));

    res.json({
      promoCodes: promoCodesWithFavorites,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      userAccess: {
        isAgent: !!agent,
        accessType: agent ? 'agent' : accessRecord?.accessType
      }
    });

  } catch (error) {
    console.error('Get explore promo codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add promo code to favorites
router.post('/favorites/add', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { agentId, promoCode } = req.body;

    if (!agentId || !promoCode) {
      return res.status(400).json({ message: 'Agent ID and promo code are required' });
    }

    // Check if user has access
    const agent = await Agent.findOne({ userId });
    let accessRecord = await PromoCodeAccess.findOne({ userId });

    const hasAccess = agent || (accessRecord && accessRecord.hasAccess);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create access record if user is agent but doesn't have one
    if (agent && !accessRecord) {
      accessRecord = new PromoCodeAccess({
        userId,
        userEmail: req.user.email,
        hasAccess: true,
        accessType: 'agent'
      });
      await accessRecord.save();
    }

    // Verify the promo code exists and is active
    const targetAgent = await Agent.findById(agentId);
    if (!targetAgent || !targetAgent.isActive || targetAgent.promoteStatus !== 'on') {
      return res.status(404).json({ message: 'Promo code not found or not active' });
    }

    // Add to favorites
    await accessRecord.addFavorite(agentId, promoCode);

    res.json({
      success: true,
      message: 'Promo code added to favorites',
      promoCode: promoCode.toUpperCase()
    });

  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove promo code from favorites
router.post('/favorites/remove', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: 'Agent ID is required' });
    }

    const accessRecord = await PromoCodeAccess.findOne({ userId });
    if (!accessRecord) {
      return res.status(404).json({ message: 'Access record not found' });
    }

    // Remove from favorites
    await accessRecord.removeFavorite(agentId);

    res.json({
      success: true,
      message: 'Promo code removed from favorites'
    });

  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's favorite promo codes
router.get('/favorites', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const accessRecord = await PromoCodeAccess.findOne({ userId })
      .populate({
        path: 'favoritePromoCodes.agentId',
        select: 'promoCode userName promoCodeType totalEarnings totalReferrals usedCount isActive promoteStatus expirationDate isVerified',
        match: { isActive: true, promoteStatus: 'on' }
      });

    if (!accessRecord) {
      return res.json({ favorites: [] });
    }

    // Filter out inactive promo codes and format response
    const activeFavorites = accessRecord.favoritePromoCodes
      .filter(fav => fav.agentId) // Remove null entries from populate
      .map(fav => ({
        _id: fav.agentId._id,
        promoCode: fav.agentId.promoCode,
        userName: fav.agentId.userName,
        promoCodeType: fav.agentId.promoCodeType,
        totalEarnings: fav.agentId.totalEarnings,
        totalReferrals: fav.agentId.totalReferrals,
        usedCount: fav.agentId.usedCount,
        isVerified: fav.agentId.isVerified,
        addedAt: fav.addedAt,
        isFavorite: true
      }));

    res.json({ favorites: activeFavorites });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
