const express = require('express');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const Notification = require('../models/Notification');
const ClaimRequest = require('../models/ClaimRequest');
const PaymentActivity = require('../models/PaymentActivity');
const { PromoCodeConfig } = require('../models/HSC');
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
    const { name, contactNumber, countryCode, profileImage, bankDetails } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (countryCode) updateData.countryCode = countryCode;
    if (profileImage) updateData.profileImage = profileImage;

    // Handle bank details with validation
    if (bankDetails) {
      const { bank, branch, accountNo, accountName, postalCode, binanceId } = bankDetails;

      // Get current user's bank details to preserve existing data
      const currentUser = await User.findById(req.user._id);
      const currentBankDetails = currentUser.bankDetails || {};

      // If any bank field is provided (except binanceId), validate that all required bank fields are present
      const bankFieldsProvided = [bank, branch, accountNo, accountName, postalCode].some(field => field && field.trim());

      if (bankFieldsProvided) {
        // Validate that all required bank fields are provided
        if (!bank || !bank.trim()) {
          return res.status(400).json({ message: 'Bank name is required when providing bank details' });
        }
        if (!branch || !branch.trim()) {
          return res.status(400).json({ message: 'Branch name is required when providing bank details' });
        }
        if (!accountNo || !accountNo.trim()) {
          return res.status(400).json({ message: 'Account number is required when providing bank details' });
        }
        if (!accountName || !accountName.trim()) {
          return res.status(400).json({ message: 'Account name is required when providing bank details' });
        }
        if (!postalCode || !postalCode.trim()) {
          return res.status(400).json({ message: 'Postal code is required when providing bank details' });
        }
      }

      // Update bank details - preserve existing values if not provided
      updateData.bankDetails = {
        bank: bank !== undefined ? (bank ? bank.trim() : '') : (currentBankDetails.bank || ''),
        branch: branch !== undefined ? (branch ? branch.trim() : '') : (currentBankDetails.branch || ''),
        accountNo: accountNo !== undefined ? (accountNo ? accountNo.trim() : '') : (currentBankDetails.accountNo || ''),
        accountName: accountName !== undefined ? (accountName ? accountName.trim() : '') : (currentBankDetails.accountName || ''),
        postalCode: postalCode !== undefined ? (postalCode ? postalCode.trim() : '') : (currentBankDetails.postalCode || ''),
        binanceId: binanceId !== undefined ? (binanceId ? binanceId.trim() : '') : (currentBankDetails.binanceId || '')
      };
    }

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
    // Check if user is an agent (regardless of active status)
    const agent = await Agent.findOne({ userId: req.user._id });

    if (!agent) {
      return res.json({ isAgent: false });
    }

    // Get agent statistics
    const totalEarnings = await Earning.aggregate([
      { $match: { usedPromoCodeOwnerId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Count unique buyers (people referred) instead of total earnings
    const uniqueBuyers = await Earning.distinct('buyerId', {
      usedPromoCodeOwnerId: req.user._id
    });
    const totalReferrals = uniqueBuyers.length;

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
        verificationStatus: agent.verificationStatus || 'pending',
        usedPromoCode: agent.usedPromoCode || null,
        usedPromoCodeOwner: agent.usedPromoCodeOwner || null,
        isSelling: agent.isSelling || false,
        sellingPrice: agent.sellingPrice || 0,
        sellingDescription: agent.sellingDescription || '',
        sellingListedAt: agent.sellingListedAt || null
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
    // Check if user is an agent (regardless of active status)
    const agent = await Agent.findOne({ userId: req.user._id });

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
    // Check if user is an agent (regardless of active status)
    const agent = await Agent.findOne({ userId: req.user._id });

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

// Renew or upgrade promo code
router.post('/agent-renew-promo-code', verifyToken, async (req, res) => {
  try {
    const {
      renewalType, // 'renew' or 'upgrade'
      newTier, // Required if renewalType is 'upgrade'
      finalAmount,
      appliedPromoCode,
      discountAmount
    } = req.body;

    // Check if user is an agent
    const agent = await Agent.findOne({ userId: req.user._id });
    if (!agent) {
      return res.status(403).json({ message: 'Access denied. User is not an agent.' });
    }

    // Check if promo code is expired (required for renewal)
    const now = new Date();
    if (agent.expirationDate > now) {
      return res.status(400).json({ message: 'Promo code is not expired yet. You can only renew expired promo codes.' });
    }

    // Get user and check HSC balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < finalAmount) {
      return res.status(400).json({ message: 'Insufficient HSC balance' });
    }

    // Validate renewal type and tier
    if (renewalType === 'upgrade') {
      if (!newTier) {
        return res.status(400).json({ message: 'New tier is required for upgrade' });
      }

      const validTiers = ['silver', 'gold', 'diamond'];
      if (!validTiers.includes(newTier)) {
        return res.status(400).json({ message: 'Invalid tier specified' });
      }

      // Check if it's a valid upgrade path
      const currentTier = agent.promoCodeType;
      const tierHierarchy = { free: 0, silver: 1, gold: 2, diamond: 3 };

      if (tierHierarchy[newTier] <= tierHierarchy[currentTier]) {
        return res.status(400).json({ message: 'You can only upgrade to a higher tier' });
      }
    }

    // Process promo code discount if applied
    let promoCodeOwnerAgent = null;
    if (appliedPromoCode && discountAmount > 0) {
      promoCodeOwnerAgent = await Agent.findOne({
        promoCode: appliedPromoCode,
        isActive: true,
        expirationDate: { $gt: now }
      });

      if (!promoCodeOwnerAgent) {
        return res.status(400).json({ message: 'Applied promo code is invalid or expired' });
      }
    }

    // Get promo config to calculate correct earning amount (same as /promo-codes-travel-agents page)
    const { PromoCodeConfig, HSCConfig } = require('../models/HSC');
    const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Helper function to calculate discounted price (same as /promocodes/config route)
    const calculateDiscountedPrice = (originalPrice, discountRate) => {
      const discountAmount = (originalPrice * discountRate) / 100;
      return originalPrice - discountAmount;
    };

    // Build promoTypes structure exactly like /promocodes/config route
    const promoTypes = {
      silver: {
        earningForPurchase: promoConfig.silver.earningForPurchase,
        earningForMonthlyAd: promoConfig.silver.earningForMonthlyAd,
        earningForDailyAd: promoConfig.silver.earningForDailyAd
      },
      gold: {
        earningForPurchase: promoConfig.gold.earningForPurchase,
        earningForMonthlyAd: promoConfig.gold.earningForMonthlyAd,
        earningForDailyAd: promoConfig.gold.earningForDailyAd
      },
      diamond: {
        earningForPurchase: promoConfig.diamond.earningForPurchase,
        earningForMonthlyAd: promoConfig.diamond.earningForMonthlyAd,
        earningForDailyAd: promoConfig.diamond.earningForDailyAd
      },
      free: {
        earningForPurchase: promoConfig.free.earningForPurchase,
        earningForMonthlyAd: promoConfig.free.earningForMonthlyAd,
        earningForDailyAd: promoConfig.free.earningForDailyAd
      }
    };

    // Helper function to calculate original price
    const calculatePrice = () => {
      // This should match the frontend calculation logic
      // For now, we'll use the finalAmount as the base price
      return finalAmount + (discountAmount || 0);
    };

    // Calculate correct earning amount based on promo config (same as /promo-codes-travel-agents page)
    // The earning should be based on the promo code being renewed/upgraded, not the referrer's tier
    const getEarningAmount = () => {
      if (!promoConfig || !appliedPromoCode || !discountAmount) return 0;

      // Get the tier of the promo code being renewed/upgraded
      const renewedTier = renewalType === 'upgrade' ? newTier : agent.promoCodeType;
      const promoData = promoTypes[renewedTier];

      // Return the earningForPurchase for that tier (same as promoData?.earningForPurchase in frontend)
      return promoData ? promoData.earningForPurchase : 0;
    };

    // Start transaction-like operations
    try {
      // 1. Update agent promo code
      const updateData = {
        isActive: true,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 year
        expirationWarningEmailSent: false, // Reset email flags
        expiredNotificationEmailSent: false
      };

      if (renewalType === 'upgrade') {
        updateData.promoCodeType = newTier;
      }

      await Agent.findByIdAndUpdate(agent._id, updateData);

      // 2. Create earning record if promo code was used for discount
      if (appliedPromoCode && promoCodeOwnerAgent && discountAmount > 0) {
        const earningAmount = getEarningAmount();

        const earning = new Earning({
          buyerEmail: user.email,
          buyerId: user._id,
          category: 'Promo Code Renewal',
          amount: earningAmount, // Use correct earning amount from promo config
          usedPromoCode: appliedPromoCode,
          usedPromoCodeOwner: promoCodeOwnerAgent.email,
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          item: `${renewalType === 'upgrade' ? 'Upgrade & Renew' : 'Renew'} - ${agent.promoCode}`,
          itemType: renewalType === 'upgrade' ? newTier : agent.promoCodeType,
          status: 'pending'
        });
        await earning.save();

        // Update the promo code owner's earnings and stats
        promoCodeOwnerAgent.totalEarnings += earningAmount;

        // Check if this is a new unique buyer (referral)
        const existingEarning = await Earning.findOne({
          usedPromoCodeOwnerId: promoCodeOwnerAgent.userId,
          buyerId: user._id
        });

        // Only increment totalReferrals if this is the first time this buyer used the promo code
        if (!existingEarning) {
          promoCodeOwnerAgent.totalReferrals += 1;
        }

        promoCodeOwnerAgent.usedCount += 1; // Always increment used count (total times code was used)
        await promoCodeOwnerAgent.save();
      }

      // 3. Create payment activity record
      const PaymentActivity = require('../models/PaymentActivity');
      const earningAmount = getEarningAmount();

      const paymentActivity = new PaymentActivity({
        userId: user._id,
        buyerEmail: user.email,
        item: `${renewalType === 'upgrade' ? 'Upgrade & Renew' : 'Renew'} - ${agent.promoCode}`,
        quantity: 1,
        category: 'Promo Code Renewal',
        originalAmount: calculatePrice(),
        amount: finalAmount,
        discountedAmount: discountAmount || 0,
        promoCode: appliedPromoCode || null,
        promoCodeOwner: promoCodeOwnerAgent?.email || null,
        promoCodeOwnerId: promoCodeOwnerAgent?.userId || null,
        forEarns: earningAmount, // Use correct earning amount from promo config
        purchasedPromoCode: agent.promoCode,
        purchasedPromoCodeType: renewalType === 'upgrade' ? newTier : agent.promoCodeType,
        paymentMethod: 'HSC Wallet',
        status: 'completed',
        transactionId: `RNW${Date.now()}${Math.floor(Math.random() * 1000)}`
      });
      await paymentActivity.save();

      // 4. Update user HSC balance
      user.hscBalance -= finalAmount;
      await user.save();

      // 5. Send success email
      try {
        const { sendPromoCodeRenewalSuccess } = require('../utils/emailService');
        await sendPromoCodeRenewalSuccess(
          user.email,
          user.name,
          agent.promoCode,
          renewalType === 'upgrade' ? newTier : agent.promoCodeType,
          renewalType,
          updateData.expirationDate
        );
      } catch (emailError) {
        console.error('Error sending renewal success email:', emailError);
        // Don't fail the renewal if email fails
      }

      // 6. Create notification
      await Notification.createNotification(
        user._id,
        `🎉 Promo Code ${renewalType === 'upgrade' ? 'Upgraded & Renewed' : 'Renewed'} Successfully!`,
        `Your promo code ${agent.promoCode} has been ${renewalType === 'upgrade' ? `upgraded to ${newTier} and` : ''} renewed for another year. Continue earning commissions!`,
        'purchase',
        {
          promoCode: agent.promoCode,
          renewalType: renewalType,
          newTier: renewalType === 'upgrade' ? newTier : agent.promoCodeType,
          expirationDate: updateData.expirationDate,
          transactionId: paymentActivity.transactionId
        },
        'high'
      );

      res.json({
        success: true,
        message: `Promo code ${renewalType === 'upgrade' ? 'upgraded and renewed' : 'renewed'} successfully`,
        newBalance: user.hscBalance,
        transactionId: paymentActivity.transactionId,
        expirationDate: updateData.expirationDate,
        newTier: renewalType === 'upgrade' ? newTier : agent.promoCodeType
      });

    } catch (error) {
      console.error('Error during renewal process:', error);
      throw error;
    }

  } catch (error) {
    console.error('Renew promo code error:', error);
    res.status(500).json({ message: 'Server error during renewal process' });
  }
});

// Get user's promocode earnings
router.get('/promocode-earnings', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get all earnings where user is the promo code owner
    const earnings = await Earning.find({
      usedPromoCodeOwner: userEmail
    }).populate('buyerId', 'name email').sort({ createdAt: -1 });

    // Calculate totals by status
    const totals = {
      pending: 0,
      processed: 0,
      paid: 0,
      total: 0
    };

    earnings.forEach(earning => {
      totals[earning.status] += earning.amount;
      totals.total += earning.amount;
    });

    // Get pending earnings for claim validation
    const pendingEarnings = earnings.filter(earning => earning.status === 'pending');

    res.json({
      success: true,
      earnings,
      totals,
      pendingEarnings,
      canClaim: totals.pending >= 5000 // Minimum claim amount
    });

  } catch (error) {
    console.error('Get promocode earnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user has complete bank details for claiming
router.get('/bank-details-status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const bankDetails = user.bankDetails || {};

    // Check if user has complete bank details OR binance ID
    const hasCompleteBankDetails = bankDetails.bank &&
                                  bankDetails.branch &&
                                  bankDetails.accountNo &&
                                  bankDetails.accountName &&
                                  bankDetails.postalCode;

    const hasBinanceId = bankDetails.binanceId && bankDetails.binanceId.trim();

    const canClaim = hasCompleteBankDetails || hasBinanceId;

    res.json({
      success: true,
      canClaim,
      hasCompleteBankDetails,
      hasBinanceId,
      bankDetails: canClaim ? {
        bank: bankDetails.bank || '',
        branch: bankDetails.branch || '',
        accountNo: bankDetails.accountNo || '',
        accountName: bankDetails.accountName || '',
        postalCode: bankDetails.postalCode || '',
        binanceId: bankDetails.binanceId || ''
      } : null
    });

  } catch (error) {
    console.error('Check bank details status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Claim selected earnings
router.post('/claim-earnings', verifyToken, async (req, res) => {
  try {
    const { earningIds } = req.body;
    const userEmail = req.user.email;

    if (!earningIds || !Array.isArray(earningIds) || earningIds.length === 0) {
      return res.status(400).json({ message: 'Please select earnings to claim' });
    }

    // Verify user has complete bank details or Binance ID
    const user = await User.findById(req.user._id);
    const bankDetails = user.bankDetails || {};

    const hasCompleteBankDetails = bankDetails.bank &&
                                  bankDetails.branch &&
                                  bankDetails.accountNo &&
                                  bankDetails.accountName &&
                                  bankDetails.postalCode;
    const hasBinanceId = bankDetails.binanceId && bankDetails.binanceId.trim();

    if (!hasCompleteBankDetails && !hasBinanceId) {
      return res.status(400).json({
        message: 'Please complete your bank details or add Binance ID before claiming earnings'
      });
    }

    // Get the selected earnings and verify they belong to the user and are pending
    const earnings = await Earning.find({
      _id: { $in: earningIds },
      usedPromoCodeOwner: userEmail,
      status: 'pending'
    });

    if (earnings.length !== earningIds.length) {
      return res.status(400).json({
        message: 'Some selected earnings are invalid or already processed'
      });
    }

    // Calculate total amount
    const totalAmount = earnings.reduce((sum, earning) => sum + earning.amount, 0);

    // Check minimum claim amount
    if (totalAmount < 5000) {
      return res.status(400).json({
        message: 'Minimum claim amount is 5,000 LKR'
      });
    }

    // Update earnings status to processed
    await Earning.updateMany(
      { _id: { $in: earningIds } },
      {
        status: 'processed',
        processedAt: new Date()
      }
    );

    // Create a claim request record (for admin tracking)
    const ClaimRequest = require('../models/ClaimRequest');
    const claimRequest = new ClaimRequest({
      userId: req.user._id,
      userEmail: userEmail,
      earningIds: earningIds,
      totalAmount: totalAmount,
      bankDetails: {
        bank: bankDetails.bank || '',
        branch: bankDetails.branch || '',
        accountNo: bankDetails.accountNo || '',
        accountName: bankDetails.accountName || '',
        postalCode: bankDetails.postalCode || '',
        binanceId: bankDetails.binanceId || ''
      },
      status: 'pending'
    });

    await claimRequest.save();

    res.json({
      success: true,
      message: 'Claim request submitted successfully! Your earnings are now being processed.',
      claimRequest: {
        id: claimRequest._id,
        totalAmount: totalAmount,
        earningsCount: earnings.length
      }
    });

  } catch (error) {
    console.error('Claim earnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sell promocode
router.post('/sell-promocode', verifyToken, async (req, res) => {
  try {
    const { sellingPrice, sellingDescription } = req.body;
    const userEmail = req.user.email;

    if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
      return res.status(400).json({ message: 'Please enter a valid selling price' });
    }

    // Get user's agent data
    const agent = await Agent.findOne({ email: userEmail });
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Check if agent is already selling
    if (agent.isSelling) {
      return res.status(400).json({ message: 'Your promocode is already listed for sale' });
    }

    // Get selling advertisement fee from config
    const promoConfig = await PromoCodeConfig.findOne().sort({ createdAt: -1 });
    const sellAdFee = promoConfig?.sellAdFee || 100;

    // Check user's HSC balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < sellAdFee) {
      return res.status(400).json({
        message: `Insufficient HSC balance. You need ${sellAdFee} HSC to list your promocode for sale.`,
        required: sellAdFee,
        current: user.hscBalance
      });
    }

    // Deduct HSC from user's balance
    user.hscBalance -= sellAdFee;
    await user.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: userEmail, // User is paying the fee
      item: `Advertisement Fee - Selling Promocode ${agent.promoCode}`,
      quantity: 1,
      category: 'Advertisement Fee - Selling Promocode',
      originalAmount: sellAdFee,
      amount: sellAdFee,
      discountedAmount: 0,
      promoCode: agent.promoCode,
      promoCodeOwner: userEmail,
      promoCodeOwnerId: req.user._id,
      forEarns: 0,
      purchasedPromoCode: agent.promoCode,
      purchasedPromoCodeType: agent.promoCodeType,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Update agent selling status
    agent.isSelling = true;
    agent.sellingPrice = parseFloat(sellingPrice);
    agent.sellingDescription = sellingDescription || '';
    agent.sellingListedAt = new Date();
    await agent.save();

    res.json({
      success: true,
      message: 'Your promocode has been listed for sale successfully!',
      data: {
        promoCode: agent.promoCode,
        sellingPrice: agent.sellingPrice,
        adFeePaid: sellAdFee,
        newHscBalance: user.hscBalance
      }
    });

  } catch (error) {
    console.error('Sell promocode error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle selling status
router.post('/toggle-selling', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get user's agent data
    const agent = await Agent.findOne({ email: userEmail });
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Toggle selling status
    agent.isSelling = !agent.isSelling;
    if (!agent.isSelling) {
      agent.sellingPrice = 0;
      agent.sellingDescription = '';
      agent.sellingListedAt = null;
    }
    await agent.save();

    res.json({
      success: true,
      message: agent.isSelling ? 'Promocode is now listed for sale' : 'Promocode removed from sale',
      isSelling: agent.isSelling,
      sellingPrice: agent.sellingPrice
    });

  } catch (error) {
    console.error('Toggle selling error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit selling details
router.post('/edit-selling', verifyToken, async (req, res) => {
  try {
    const { sellingPrice, sellingDescription } = req.body;
    const userEmail = req.user.email;

    if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
      return res.status(400).json({ message: 'Please enter a valid selling price' });
    }

    // Get user's agent data
    const agent = await Agent.findOne({ email: userEmail });
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Check if agent is currently selling
    if (!agent.isSelling) {
      return res.status(400).json({ message: 'Your promocode is not currently listed for sale' });
    }

    // Update selling details
    agent.sellingPrice = parseFloat(sellingPrice);
    agent.sellingDescription = sellingDescription || '';
    await agent.save();

    res.json({
      success: true,
      message: 'Selling details updated successfully!',
      data: {
        promoCode: agent.promoCode,
        sellingPrice: agent.sellingPrice,
        sellingDescription: agent.sellingDescription
      }
    });

  } catch (error) {
    console.error('Edit selling error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
