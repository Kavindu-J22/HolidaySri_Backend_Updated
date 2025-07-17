const express = require('express');
const { PromoCodeConfig, PromoCodeTransaction, HSCConfig } = require('../models/HSC');
const { verifyToken, verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

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
        earningForDailyAd: promoConfig.silver.earningForDailyAd
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
        earningForDailyAd: promoConfig.gold.earningForDailyAd
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
        earningForDailyAd: promoConfig.diamond.earningForDailyAd
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
        earningForDailyAd: promoConfig.free.earningForDailyAd
      }
    };

    res.json({
      promoTypes,
      hscValue,
      currency: hscConfig ? hscConfig.currency : 'LKR',
      lastUpdated: promoConfig.lastUpdated,
      discounts: {
        monthlyAdDiscount: promoConfig.discounts.monthlyAdDiscount,
        dailyAdDiscount: promoConfig.discounts.dailyAdDiscount,
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
    const { silver, gold, diamond, free, discounts } = req.body;

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

module.exports = router;
