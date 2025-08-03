const express = require('express');
const router = express.Router();
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const PaymentActivity = require('../models/PaymentActivity');
const { PromoCodeConfig, HSCConfig } = require('../models/HSC');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');

// Get promo code discount for advertisement
router.post('/calculate-discount', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { promoCode, plan, originalAmount, paymentMethod } = req.body;

    if (!promoCode || !plan || !originalAmount || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find the agent with this promo code
    const agent = await Agent.findOne({
      promoCode: promoCode.toUpperCase(),
      isActive: true
    });

    if (!agent) {
      return res.status(404).json({ message: 'Invalid or inactive promo code' });
    }

    // Get promo code configuration
    const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    if (!promoConfig) {
      return res.status(404).json({ message: 'Promo code configuration not found' });
    }

    // Get HSC configuration for token conversion values
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    if (!hscConfig) {
      return res.status(404).json({ message: 'Token configuration not found' });
    }

    // Get discount amount based on plan type from the discounts configuration
    let discountLKR = 0;
    const { discounts } = promoConfig;

    switch (plan) {
      case 'hourly':
        discountLKR = discounts.hourlyAdDiscount || 0;
        break;
      case 'daily':
        discountLKR = discounts.dailyAdDiscount || 0;
        break;
      case 'monthly':
        discountLKR = discounts.monthlyAdDiscount || 0;
        break;
      case 'yearly':
        discountLKR = discounts.yearlyAdDiscount || 0;
        break;
      default:
        discountLKR = 0;
    }

    // For hourly plans, multiply by the number of hours
    if (plan === 'hourly' && req.body.hours) {
      discountLKR = discountLKR * req.body.hours;
    }

    // Convert discount to the selected payment method using HSC config values
    let discountAmount = 0;
    if (discountLKR > 0) {
      switch (paymentMethod.type) {
        case 'HSC':
          // Convert LKR to HSC using HSC config value
          discountAmount = parseFloat((discountLKR / hscConfig.hscValue).toFixed(2));
          break;
        case 'HSD':
          // Convert LKR to HSD using HSD config value
          discountAmount = parseFloat((discountLKR / hscConfig.hsdValue).toFixed(2));
          break;
        case 'HSG':
          // Convert LKR to HSG using HSG config value
          discountAmount = parseFloat((discountLKR / hscConfig.hsgValue).toFixed(2));
          break;
        default:
          discountAmount = 0;
      }
    }

    // Ensure discount doesn't exceed original amount
    discountAmount = Math.min(discountAmount, originalAmount);
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    res.json({
      isValid: true,
      agent: {
        email: agent.email,
        promoCodeType: agent.promoCodeType
      },
      discount: {
        discountLKR,
        discountAmount,
        finalAmount,
        originalAmount
      },
      debug: {
        plan,
        hours: req.body.hours,
        paymentMethodType: paymentMethod.type,
        hscValue: hscConfig.hscValue,
        hsdValue: hscConfig.hsdValue,
        hsgValue: hscConfig.hsgValue,
        discountConfig: discounts
      }
    });

  } catch (error) {
    console.error('Calculate discount error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user already has a specific advertisement slot
router.post('/check-duplicate-slot', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { category } = req.body;
    
    // Check for specific slots that can't be purchased twice
    const restrictedSlots = ['travel_buddys', 'tour_guiders'];
    
    if (restrictedSlots.includes(category)) {
      const existingAd = await Advertisement.findOne({
        userId: req.user._id,
        category: category,
        status: { $in: ['active', 'draft'] }
      });
      
      if (existingAd) {
        return res.status(400).json({ 
          message: `You can't publish ${category.replace('_', ' ')} advertisement twice. Use your pre-purchased slot.`,
          hasExisting: true,
          existingAd: existingAd
        });
      }
    }
    
    res.json({ canPurchase: true });
  } catch (error) {
    console.error('Check duplicate slot error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process advertisement payment
router.post('/process-payment', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      slot,
      plan,
      hours,
      paymentMethod,
      originalAmount,
      discountAmount,
      finalAmount,
      appliedPromoCode,
      promoCodeAgent
    } = req.body;

    // Validate required fields
    if (!slot || !plan || !paymentMethod || !originalAmount || finalAmount === undefined) {
      return res.status(400).json({ message: 'Missing required payment information' });
    }

    // Check for duplicate slots
    const restrictedSlots = ['travel_buddys', 'tour_guiders'];
    if (restrictedSlots.includes(slot.category)) {
      const existingAd = await Advertisement.findOne({
        userId: req.user._id,
        category: slot.category,
        status: { $in: ['active', 'draft'] }
      });
      
      if (existingAd) {
        return res.status(400).json({ 
          message: `You can't publish ${slot.category.replace('_', ' ')} advertisement twice. Use your pre-purchased slot.`
        });
      }
    }

    // Get user and check balance
    const user = await User.findById(req.user._id);
    let currentBalance;
    
    switch (paymentMethod.type) {
      case 'HSC':
        currentBalance = user.hscBalance || 0;
        break;
      case 'HSD':
        currentBalance = user.hsdBalance || 0;
        break;
      case 'HSG':
        currentBalance = user.hsgBalance || 0;
        break;
      default:
        return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Check if user has sufficient balance
    if (currentBalance < finalAmount) {
      return res.status(400).json({ 
        message: 'Insufficient balance. Please choose another payment method or recharge.',
        currentBalance,
        requiredAmount: finalAmount
      });
    }

    // Get promo code owner details if promo code was used
    let promoCodeOwnerAgent = null;
    if (appliedPromoCode && promoCodeAgent) {
      promoCodeOwnerAgent = await Agent.findOne({
        promoCode: appliedPromoCode,
        isActive: true
      });
    }

    // Deduct amount from user's balance
    switch (paymentMethod.type) {
      case 'HSC':
        user.hscBalance -= finalAmount;
        break;
      case 'HSD':
        user.hsdBalance -= finalAmount;
        break;
      case 'HSG':
        user.hsgBalance -= finalAmount;
        break;
    }
    await user.save();

    // Calculate plan duration
    let planDuration = {};

    switch (plan.id) {
      case 'hourly':
        planDuration.hours = hours || 1;
        break;
      case 'daily':
        planDuration.days = 1;
        break;
      case 'monthly':
        planDuration.days = 30;
        break;
      case 'yearly':
        planDuration.days = 365;
        break;
    }

    // Create advertisement record
    const advertisement = new Advertisement({
      userId: req.user._id,
      category: slot.category,
      selectedPlan: plan.id,
      planDuration,
      paymentMethod: paymentMethod.type,
      originalAmount,
      discountAmount: discountAmount || 0,
      finalAmount,
      usedPromoCode: appliedPromoCode || null,
      usedPromoCodeOwner: promoCodeOwnerAgent ? promoCodeOwnerAgent.email : null,
      usedPromoCodeOwnerId: promoCodeOwnerAgent ? promoCodeOwnerAgent.userId : null,
      status: 'active',
      isActive: true
    });

    await advertisement.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: `Advertisement - ${slot.name}`,
      quantity: 1,
      category: 'Advertisement',
      originalAmount,
      amount: finalAmount,
      discountedAmount: discountAmount || 0,
      promoCode: appliedPromoCode || null,
      promoCodeOwner: promoCodeOwnerAgent ? promoCodeOwnerAgent.email : null,
      promoCodeOwnerId: promoCodeOwnerAgent ? promoCodeOwnerAgent.userId : null,
      forEarns: 0, // Will be calculated if promo code was used
      paymentMethod: paymentMethod.type,
      status: 'completed'
    });

    await paymentActivity.save();

    // If promo code was used, create earning record
    if (appliedPromoCode && promoCodeOwnerAgent) {
      // Get promo code configuration to determine earning amount
      const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
      let earningAmount = 0;
      
      if (promoConfig && promoCodeOwnerAgent.promoCodeType) {
        const promoType = promoCodeOwnerAgent.promoCodeType.toLowerCase();
        const configType = promoConfig[promoType];
        
        if (configType) {
          switch (plan.id) {
            case 'hourly':
              earningAmount = configType.earningForHourlyAd * (hours || 1);
              break;
            case 'daily':
              earningAmount = configType.earningForDailyAd;
              break;
            case 'monthly':
              earningAmount = configType.earningForMonthlyAd;
              break;
            case 'yearly':
              earningAmount = configType.earningForYearlyAd;
              break;
          }
        }
      }

      if (earningAmount > 0) {
        const earning = new Earning({
          buyerEmail: user.email,
          buyerId: req.user._id,
          category: 'Advertisement',
          amount: earningAmount,
          usedPromoCode: appliedPromoCode,
          usedPromoCodeOwner: promoCodeOwnerAgent.email,
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          item: `Advertisement - ${slot.name}`,
          itemType: 'Advertisement Slot',
          status: 'pending'
        });

        await earning.save();

        // Update payment activity with earning amount
        paymentActivity.forEarns = earningAmount;
        await paymentActivity.save();
      }
    }

    res.json({
      success: true,
      message: 'Advertisement purchased successfully',
      advertisement: {
        id: advertisement._id,
        category: advertisement.category,
        plan: advertisement.selectedPlan,
        expiresAt: advertisement.expiresAt
      },
      newBalance: currentBalance - finalAmount,
      transactionId: paymentActivity.transactionId
    });

  } catch (error) {
    console.error('Process advertisement payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
