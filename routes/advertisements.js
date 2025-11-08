const express = require('express');
const router = express.Router();
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const PaymentActivity = require('../models/PaymentActivity');
const Notification = require('../models/Notification');
const { PromoCodeConfig, HSCConfig } = require('../models/HSC');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');
const { sendAdvertisementPurchaseEmail, sendAdvertisementRenewalEmail } = require('../utils/emailService');

// Helper function to format category names
const formatCategoryName = (category) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to generate unique slot ID
const generateSlotId = async () => {
  const prefix = 'AD';
  let isUnique = false;
  let slotId = '';

  while (!isUnique) {
    // Generate random 8-character alphanumeric string
    const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
    slotId = `${prefix}${randomString}`;

    // Check if this ID already exists
    const existingAd = await Advertisement.findOne({ slotId });
    if (!existingAd) {
      isUnique = true;
    }
  }

  return slotId;
};

// Get user advertisements with search and filter
router.get('/my-advertisements', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { search, status, plan, category, page = 1, limit = 10 } = req.query;

    // Build query
    let query = { userId: req.user._id };

    // Add search by slot ID
    if (search) {
      query.slotId = { $regex: search.toUpperCase(), $options: 'i' };
    }

    // Add status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add plan filter
    if (plan && plan !== 'all') {
      query.selectedPlan = plan;
    }

    // Add category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get advertisements with pagination
    const advertisements = await Advertisement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Advertisement.countDocuments(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get unique categories for filter options
    const categories = await Advertisement.distinct('category', { userId: req.user._id });

    res.json({
      advertisements,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      filterOptions: {
        categories: categories.map(cat => ({
          value: cat,
          label: formatCategoryName(cat)
        })),
        statuses: [
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
          { value: 'expired', label: 'Expired' },
          { value: 'draft', label: 'Draft' }
        ],
        plans: [
          { value: 'hourly', label: 'Hourly' },
          { value: 'daily', label: 'Daily' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' }
        ]
      }
    });

  } catch (error) {
    console.error('Get user advertisements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pause advertisement expiration (clear expiresAt field)
router.put('/pause-expiration/:adId', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { adId } = req.params;

    // Find the advertisement and verify ownership
    const advertisement = await Advertisement.findOne({
      _id: adId,
      userId: req.user._id
    });

    if (!advertisement) {
      return res.status(404).json({ message: 'Advertisement not found or access denied' });
    }

    // Check if advertisement is active
    if (advertisement.status !== 'active') {
      return res.status(400).json({ message: 'Only active advertisements can have their expiration paused' });
    }

    // Clear the expiresAt field to pause expiration
    advertisement.expiresAt = null;
    await advertisement.save();

    res.json({
      success: true,
      message: 'Advertisement expiration paused successfully',
      advertisement
    });

  } catch (error) {
    console.error('Pause advertisement expiration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
    const restrictedSlots = ['travel_buddys', 'tour_guiders', 'caregivers_time_currency'];

    if (restrictedSlots.includes(category)) {
      const existingAd = await Advertisement.findOne({
        userId: req.user._id,
        category: category,
        status: { $in: ['draft', 'active', 'paused', 'expired', 'rejected', 'Published'] }
      });

      if (existingAd) {
        // Custom message for caregivers_time_currency
        let message;
        if (category === 'caregivers_time_currency') {
          message = "You can't publish Compassionate Caregivers & Earn Time Currency advertisement twice. Use your pre-purchased slot.";
        } else {
          message = `You can't publish ${category.replace('_', ' ')} advertisement twice. Use your pre-purchased slot.`;
        }

        return res.status(400).json({
          message: message,
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
    const restrictedSlots = ['travel_buddys', 'tour_guiders', 'caregivers_time_currency'];
    if (restrictedSlots.includes(slot.category)) {
      const existingAd = await Advertisement.findOne({
        userId: req.user._id,
        category: slot.category,
        status: { $in: ['draft', 'active', 'paused', 'expired', 'rejected', 'Published'] }
      });

      if (existingAd) {
        // Custom message for caregivers_time_currency
        let message;
        if (slot.category === 'caregivers_time_currency') {
          message = "You can't publish Compassionate Caregivers & Earn Time Currency advertisement twice. Use your pre-purchased slot.";
        } else {
          message = `You can't publish ${slot.category.replace('_', ' ')} advertisement twice. Use your pre-purchased slot.`;
        }

        return res.status(400).json({
          message: message
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

    // Generate unique slot ID
    const uniqueSlotId = await generateSlotId();

    // Create advertisement record
    const advertisement = new Advertisement({
      userId: req.user._id,
      category: slot.category,
      slotId: uniqueSlotId,
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
    if (appliedPromoCode && promoCodeOwnerAgent && discountAmount > 0) {
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

      // Only create earning record if earning amount is greater than 0
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

        // Update the promo code owner's total earnings, referrals, and used count
        promoCodeOwnerAgent.totalEarnings += earningAmount;

        // Check if this is a new unique buyer (referral) - exclude the current earning we just saved
        const existingEarningCount = await Earning.countDocuments({
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          buyerId: req.user._id
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

    // Send professional email notification
    try {
      await sendAdvertisementPurchaseEmail(user, {
        category: slot.category,
        categoryName: slot.mainCategory || formatCategoryName(slot.category),
        selectedPlan: plan.id,
        planDuration: planDuration,
        paymentMethod: paymentMethod.type,
        originalAmount,
        discountAmount: discountAmount || 0,
        finalAmount,
        usedPromoCode: appliedPromoCode,
        transactionId: paymentActivity.transactionId,
        expiresAt: advertisement.expiresAt
      });
    } catch (emailError) {
      console.error('Error sending advertisement purchase email:', emailError);
      // Don't fail the payment if email fails
    }

    // Create notification for user
    await Notification.createNotification(
      req.user._id,
      '🎉 Advertisement Purchase Successful!',
      `Your ${formatCategoryName(slot.category)} advertisement has been activated successfully and will run until ${new Date(advertisement.expiresAt).toLocaleDateString()}.`,
      'advertisement',
      {
        advertisementId: advertisement._id,
        category: slot.category,
        plan: plan.id,
        transactionId: paymentActivity.transactionId,
        expiresAt: advertisement.expiresAt
      },
      'high'
    );

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

// Process advertisement renewal payment
router.post('/process-renewal-payment', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      advertisementId,
      renewalType,
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
    if (!advertisementId || !renewalType || !slot || !plan || !paymentMethod || !originalAmount || finalAmount === undefined) {
      return res.status(400).json({ message: 'Missing required renewal payment information' });
    }

    // Find the advertisement to renew
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id
    });

    if (!advertisement) {
      return res.status(404).json({ message: 'Advertisement not found or access denied' });
    }

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check user balance
    let currentBalance;
    switch (paymentMethod.type) {
      case 'HSC':
        currentBalance = user.hscBalance;
        break;
      case 'HSD':
        currentBalance = user.hsdBalance;
        break;
      case 'HSG':
        currentBalance = user.hsgBalance;
        break;
      default:
        return res.status(400).json({ message: 'Invalid payment method' });
    }

    if (currentBalance < finalAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
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

    // Calculate new expiration date
    let newExpiresAt;
    const now = new Date();

    if (renewalType === 'expired' || advertisement.status === 'expired') {
      // For expired advertisements, start from current date/time
      let expirationTime;
      switch (plan.id) {
        case 'hourly':
          expirationTime = (planDuration.hours || 1) * 60 * 60 * 1000;
          break;
        case 'daily':
          expirationTime = (planDuration.days || 1) * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          expirationTime = 30 * 24 * 60 * 60 * 1000;
          break;
        case 'yearly':
          expirationTime = 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          expirationTime = 24 * 60 * 60 * 1000;
      }
      newExpiresAt = new Date(now.getTime() + expirationTime);
    } else {
      // For active advertisements, extend from current expiration date
      const currentExpiresAt = advertisement.expiresAt ? new Date(advertisement.expiresAt) : now;
      let expirationTime;
      switch (plan.id) {
        case 'hourly':
          expirationTime = (planDuration.hours || 1) * 60 * 60 * 1000;
          break;
        case 'daily':
          expirationTime = (planDuration.days || 1) * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          expirationTime = 30 * 24 * 60 * 60 * 1000;
          break;
        case 'yearly':
          expirationTime = 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          expirationTime = 24 * 60 * 60 * 1000;
      }
      newExpiresAt = new Date(currentExpiresAt.getTime() + expirationTime);
    }

    // Update advertisement with renewal information
    advertisement.selectedPlan = plan.id;
    advertisement.planDuration = planDuration;
    advertisement.paymentMethod = paymentMethod.type;
    advertisement.originalAmount = originalAmount;
    advertisement.discountAmount = discountAmount || 0;
    advertisement.finalAmount = finalAmount;
    advertisement.usedPromoCode = appliedPromoCode || null;
    advertisement.usedPromoCodeOwner = promoCodeOwnerAgent ? promoCodeOwnerAgent.email : null;
    advertisement.usedPromoCodeOwnerId = promoCodeOwnerAgent ? promoCodeOwnerAgent.userId : null;
    advertisement.expiresAt = newExpiresAt;

    // Update status based on whether advertisement has published content
    if (advertisement.publishedAdId && advertisement.publishedAdModel) {
      advertisement.status = 'Published';
    } else {
      advertisement.status = 'active';
    }

    await advertisement.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: `Advertisement Renewal - ${slot.name || slot.categoryName}`,
      quantity: 1,
      category: 'Advertisement Renewal',
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

    // If promo code was used, create earning record (same logic as original advertisement payment)
    if (appliedPromoCode && promoCodeOwnerAgent && discountAmount > 0) {
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

      // Only create earning record if earning amount is greater than 0
      if (earningAmount > 0) {
        const earning = new Earning({
          buyerEmail: user.email,
          buyerId: req.user._id,
          category: 'Advertisement Renewal',
          amount: earningAmount,
          usedPromoCode: appliedPromoCode,
          usedPromoCodeOwner: promoCodeOwnerAgent.email,
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          item: `Advertisement Renewal - ${slot.name || slot.categoryName}`,
          itemType: 'Advertisement Slot Renewal',
          status: 'pending'
        });

        await earning.save();

        // Update payment activity with earning amount
        paymentActivity.forEarns = earningAmount;
        await paymentActivity.save();

        // Update the promo code owner's total earnings, referrals, and used count
        promoCodeOwnerAgent.totalEarnings += earningAmount;

        // Check if this is a new unique buyer (referral) - exclude the current earning we just saved
        const existingEarningCount = await Earning.countDocuments({
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          buyerId: req.user._id
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

    // Send professional renewal email notification
    try {
      await sendAdvertisementRenewalEmail(user, {
        category: advertisement.category,
        categoryName: slot.name || slot.categoryName || formatCategoryName(advertisement.category),
        selectedPlan: plan.id,
        planDuration: planDuration,
        paymentMethod: paymentMethod.type,
        originalAmount,
        discountAmount: discountAmount || 0,
        finalAmount,
        usedPromoCode: appliedPromoCode,
        transactionId: paymentActivity.transactionId,
        expiresAt: advertisement.expiresAt,
        renewalType: renewalType
      });
    } catch (emailError) {
      console.error('Error sending advertisement renewal email:', emailError);
      // Don't fail the renewal if email fails
    }

    // Create notification for user
    const renewalTypeText = renewalType === 'expired' ? 'Expired Slot Renewal' : 'Advertisement Renewal';
    const notificationMessage = renewalType === 'expired'
      ? `Your ${formatCategoryName(advertisement.category)} advertisement slot has been successfully reactivated and will run until ${new Date(advertisement.expiresAt).toLocaleDateString()}.`
      : `Your ${formatCategoryName(advertisement.category)} advertisement has been successfully renewed and will run until ${new Date(advertisement.expiresAt).toLocaleDateString()}.`;

    await Notification.createNotification(
      req.user._id,
      `🔄 ${renewalTypeText} Successful!`,
      notificationMessage,
      'advertisement',
      {
        advertisementId: advertisement._id,
        category: advertisement.category,
        plan: plan.id,
        transactionId: paymentActivity.transactionId,
        expiresAt: advertisement.expiresAt,
        renewalType: renewalType
      },
      'high'
    );

    res.json({
      success: true,
      message: 'Advertisement renewed successfully',
      advertisement: {
        id: advertisement._id,
        category: advertisement.category,
        plan: advertisement.selectedPlan,
        expiresAt: advertisement.expiresAt,
        status: advertisement.status
      },
      newBalance: currentBalance - finalAmount,
      transactionId: paymentActivity.transactionId
    });

  } catch (error) {
    console.error('Process advertisement renewal payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
