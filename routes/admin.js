const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Agent = require('../models/Agent');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const { MembershipConfig, MembershipTransaction } = require('../models/Membership');
const { CommercialPartnerConfig, CommercialPartner } = require('../models/CommercialPartner');
const Advertisement = require('../models/Advertisement');
const AdvertisementSlotCharges = require('../models/AdvertisementSlotCharges');
const ClaimRequest = require('../models/ClaimRequest');
const Earning = require('../models/Earning');
const TokenDistribution = require('../models/TokenDistribution');
const Notification = require('../models/Notification');
const PaymentActivity = require('../models/PaymentActivity');
const RoomBooking = require('../models/RoomBooking');
const { verifyAdmin, verifyAdminToken } = require('../middleware/auth');
const { checkExpiredMemberships, checkExpiringMemberships } = require('../jobs/membershipExpiration');
const { sendTokenGiftEmail } = require('../utils/emailService');
const { performNodeJSBackup } = require('../utils/databaseBackupNodeJS');

const router = express.Router();

// Admin login
router.post('/login', verifyAdmin, async (req, res) => {
  try {
    // Generate admin token
    const token = jwt.sign(
      { role: 'admin', username: process.env.ADMIN_USERNAME },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        username: process.env.ADMIN_USERNAME,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard', verifyAdminToken, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isActive: true, isEmailVerified: true });
    const newUsersToday = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // Get advertisement statistics with all statuses
    const totalAds = await Advertisement.countDocuments();
    const activeAds = await Advertisement.countDocuments({ status: 'active' });
    const publishedAds = await Advertisement.countDocuments({ status: 'Published' });
    const expiredAds = await Advertisement.countDocuments({ status: 'expired' });
    const pausedAds = await Advertisement.countDocuments({ status: 'paused' });
    const draftAds = await Advertisement.countDocuments({ status: 'draft' });
    const rejectedAds = await Advertisement.countDocuments({ status: 'rejected' });

    // Get HSC statistics
    const totalHSCTransactions = await HSCTransaction.countDocuments();
    const totalHSCPurchased = await HSCTransaction.aggregate([
      { $match: { type: 'purchase' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalHSCSpent = await HSCTransaction.aggregate([
      { $match: { type: 'spend' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get current HSC configuration
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });

    // Get company profit from LKR payments
    const PaymentActivity = require('../models/PaymentActivity');
    const lkrPayments = await PaymentActivity.aggregate([
      { $match: { paymentMethod: 'LKR', status: 'completed' } },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        newToday: newUsersToday
      },
      advertisements: {
        total: totalAds,
        active: activeAds,
        published: publishedAds,
        expired: expiredAds,
        paused: pausedAds,
        draft: draftAds,
        rejected: rejectedAds
      },
      hsc: {
        currentValue: hscConfig ? hscConfig.hscValue : 100,
        currency: hscConfig ? hscConfig.currency : 'LKR',
        totalTransactions: totalHSCTransactions,
        totalPurchased: totalHSCPurchased[0]?.total || 0,
        totalSpent: totalHSCSpent[0]?.total || 0
      },
      companyProfit: {
        totalProfit: lkrPayments[0]?.totalProfit || 0,
        lkrTransactionCount: lkrPayments[0]?.count || 0
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC configuration
router.get('/hsc-config', verifyAdminToken, async (req, res) => {
  try {
    // Get all configs to debug
    const allConfigs = await HSCConfig.find().sort({ createdAt: -1 }).limit(5);
    console.log('All HSC configs (latest 5):', allConfigs.map(c => ({
      id: c._id,
      customizeTourPackageCharge: c.customizeTourPackageCharge,
      createdAt: c.createdAt
    })));

    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });

    console.log('Fetching HSC config, found:', {
      id: hscConfig?._id,
      customizeTourPackageCharge: hscConfig?.customizeTourPackageCharge,
      hscValue: hscConfig?.hscValue,
      createdAt: hscConfig?.createdAt
    });

    if (!hscConfig) {
      return res.json({
        hscValue: 100,
        hsgValue: 1,
        hsdValue: 1,
        currency: 'LKR',
        customizeTourPackageCharge: 100,
        customizeEventRequestCharge: 100,
        sellAdFee: 100,
        accessPromoCodeViewAmount: 50,
        additionalRoomCharge: 50,
        travelBuddyTripRequestCharge: 50,
        lastUpdated: null,
        updatedBy: null
      });
    }

    res.json(hscConfig);

  } catch (error) {
    console.error('Get HSC config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update token configuration
router.put('/hsc-config', verifyAdminToken, async (req, res) => {
  try {
    const { hscValue, hsgValue, hsdValue, currency, customizeTourPackageCharge, customizeEventRequestCharge, sellAdFee, accessPromoCodeViewAmount, additionalRoomCharge, travelBuddyTripRequestCharge } = req.body;

    console.log('========== UPDATE REQUEST ==========');
    console.log('Received update request:', req.body);
    console.log('travelBuddyTripRequestCharge value:', travelBuddyTripRequestCharge);
    console.log('travelBuddyTripRequestCharge type:', typeof travelBuddyTripRequestCharge);
    console.log('travelBuddyTripRequestCharge !== undefined:', travelBuddyTripRequestCharge !== undefined);

    // Get current config to preserve existing values
    const currentConfig = await HSCConfig.findOne().sort({ createdAt: -1 });

    console.log('Current config:', {
      id: currentConfig?._id,
      travelBuddyTripRequestCharge: currentConfig?.travelBuddyTripRequestCharge,
      additionalRoomCharge: currentConfig?.additionalRoomCharge,
      hscValue: currentConfig?.hscValue
    });

    const configData = {
      hscValue: hscValue !== undefined ? hscValue : (currentConfig ? currentConfig.hscValue : 100),
      hsgValue: hsgValue !== undefined ? hsgValue : (currentConfig ? currentConfig.hsgValue : 1),
      hsdValue: hsdValue !== undefined ? hsdValue : (currentConfig ? currentConfig.hsdValue : 1),
      customizeTourPackageCharge: customizeTourPackageCharge !== undefined ? customizeTourPackageCharge : (currentConfig ? currentConfig.customizeTourPackageCharge : 100),
      customizeEventRequestCharge: customizeEventRequestCharge !== undefined ? customizeEventRequestCharge : (currentConfig ? currentConfig.customizeEventRequestCharge : 100),
      sellAdFee: sellAdFee !== undefined ? sellAdFee : (currentConfig ? currentConfig.sellAdFee : 100),
      accessPromoCodeViewAmount: accessPromoCodeViewAmount !== undefined ? accessPromoCodeViewAmount : (currentConfig ? currentConfig.accessPromoCodeViewAmount : 50),
      additionalRoomCharge: additionalRoomCharge !== undefined ? additionalRoomCharge : (currentConfig ? currentConfig.additionalRoomCharge : 50),
      travelBuddyTripRequestCharge: travelBuddyTripRequestCharge !== undefined ? travelBuddyTripRequestCharge : (currentConfig ? currentConfig.travelBuddyTripRequestCharge : 50),
      currency: currency !== undefined ? currency : (currentConfig ? currentConfig.currency : 'LKR'),
      updatedBy: req.admin.username
    };

    console.log('Config data to save:', configData);

    const newConfig = new HSCConfig(configData);

    await newConfig.save();

    console.log('Config saved successfully!');
    console.log('Saved config:', {
      id: newConfig._id,
      travelBuddyTripRequestCharge: newConfig.travelBuddyTripRequestCharge,
      additionalRoomCharge: newConfig.additionalRoomCharge,
      hscValue: newConfig.hscValue,
      createdAt: newConfig.createdAt
    });
    console.log('====================================');

    res.json({
      message: 'Token configuration updated successfully',
      config: newConfig
    });

  } catch (error) {
    console.error('Update token config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
router.get('/users', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.isEmailVerified = true;
    if (status === 'unverified') query.isEmailVerified = false;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user details
router.get('/users/:userId', verifyAdminToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's HSC transactions
    const transactions = await HSCTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's advertisements
    const advertisements = await Advertisement.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      recentTransactions: transactions,
      recentAdvertisements: advertisements
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.put('/users/:userId/status', verifyAdminToken, async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user verification status
router.put('/users/:userId/verification', verifyAdminToken, async (req, res) => {
  try {
    const { verificationStatus, verificationNotes } = req.body;

    if (!verificationStatus || !['pending', 'verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ message: 'Invalid verification status' });
    }

    // Get user details before update for email notification
    const user = await User.findById(req.params.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {
      verificationStatus,
      verificationNotes: verificationNotes || ''
    };

    // Set isVerified and verificationCompletedAt based on status
    if (verificationStatus === 'verified') {
      updateData.isVerified = true;
      updateData.verificationCompletedAt = new Date();
    } else if (verificationStatus === 'rejected') {
      updateData.isVerified = false;
      updateData.verificationCompletedAt = new Date();

      // Clear verification documents when rejected
      updateData.verificationDocuments = {
        nicFront: null,
        nicBack: null,
        passport: null
      };

      // Send rejection email notification
      const { sendVerificationRejectionNotification } = require('../utils/emailService');
      try {
        await sendVerificationRejectionNotification(
          user.email,
          user.name,
          verificationNotes || 'The submitted documents do not meet our verification requirements.'
        );
        console.log(`✅ Verification rejection email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Error sending verification rejection email:', emailError);
        // Continue with update even if email fails
      }
    } else {
      // pending status
      updateData.isVerified = false;
      updateData.verificationCompletedAt = null;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      message: `User verification status updated to ${verificationStatus} successfully${verificationStatus === 'rejected' ? ' and user notified via email' : ''}`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC packages
router.get('/hsc-packages', verifyAdminToken, async (req, res) => {
  try {
    const packages = await HSCPackage.find().sort({ hscAmount: 1 });
    res.json({ packages });

  } catch (error) {
    console.error('Get HSC packages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create HSC package
router.post('/hsc-packages', verifyAdminToken, async (req, res) => {
  try {
    const { name, hscAmount, discount = 0, description, features, bonusHsgAmount = 0, bonusHsdAmount = 0 } = req.body;

    if (!name || !hscAmount) {
      return res.status(400).json({ message: 'Name and HSC amount are required' });
    }

    // Get current HSC config to calculate price
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    // Calculate price based on HSC amount and discount
    const basePrice = hscAmount * hscValue;
    const discountAmount = (basePrice * discount) / 100;
    const finalPrice = basePrice - discountAmount;

    const package = new HSCPackage({
      name,
      hscAmount,
      price: finalPrice,
      discount,
      bonusHsgAmount: bonusHsgAmount || 0,
      bonusHsdAmount: bonusHsdAmount || 0,
      description,
      features: features || []
    });

    await package.save();

    res.status(201).json({
      message: 'HSC package created successfully',
      package
    });

  } catch (error) {
    console.error('Create HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update HSC package
router.put('/hsc-packages/:packageId', verifyAdminToken, async (req, res) => {
  try {
    const { name, hscAmount, discount, description, features, isActive, bonusHsgAmount, bonusHsdAmount } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (hscAmount) {
      updateData.hscAmount = hscAmount;

      // Recalculate price based on new HSC amount and discount
      const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
      const hscValue = hscConfig ? hscConfig.hscValue : 100;
      const currentDiscount = discount !== undefined ? discount : 0;

      const basePrice = hscAmount * hscValue;
      const discountAmount = (basePrice * currentDiscount) / 100;
      updateData.price = basePrice - discountAmount;
    }
    if (discount !== undefined) {
      updateData.discount = discount;

      // Recalculate price if discount changed
      if (!hscAmount) {
        const currentPackage = await HSCPackage.findById(req.params.packageId);
        if (currentPackage) {
          const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
          const hscValue = hscConfig ? hscConfig.hscValue : 100;

          const basePrice = currentPackage.hscAmount * hscValue;
          const discountAmount = (basePrice * discount) / 100;
          updateData.price = basePrice - discountAmount;
        }
      }
    }
    if (description !== undefined) updateData.description = description;
    if (features) updateData.features = features;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (bonusHsgAmount !== undefined) updateData.bonusHsgAmount = bonusHsgAmount;
    if (bonusHsdAmount !== undefined) updateData.bonusHsdAmount = bonusHsdAmount;

    const package = await HSCPackage.findByIdAndUpdate(
      req.params.packageId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({
      message: 'HSC package updated successfully',
      package
    });

  } catch (error) {
    console.error('Update HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete HSC package
router.delete('/hsc-packages/:packageId', verifyAdminToken, async (req, res) => {
  try {
    const package = await HSCPackage.findByIdAndDelete(req.params.packageId);

    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({
      message: 'HSC package deleted successfully'
    });

  } catch (error) {
    console.error('Delete HSC package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all claiming requests
router.get('/claim-requests', verifyAdminToken, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (status !== 'all') {
      query.status = status;
    }

    // Get claim requests with user details and earnings
    const claimRequests = await ClaimRequest.find(query)
      .populate('userId', 'name email')
      .populate({
        path: 'earningIds',
        populate: {
          path: 'buyerId',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClaimRequest.countDocuments(query);

    res.json({
      success: true,
      claimRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get claim requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve claim request (update earnings to paid)
router.post('/claim-requests/:id/approve', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminUsername = req.admin.username;

    // Get the claim request
    const claimRequest = await ClaimRequest.findById(id)
      .populate('userId', 'name email')
      .populate('earningIds');

    if (!claimRequest) {
      return res.status(404).json({ message: 'Claim request not found' });
    }

    if (claimRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Claim request already processed' });
    }

    // Update earnings status to paid
    await Earning.updateMany(
      { _id: { $in: claimRequest.earningIds } },
      {
        status: 'paid',
        paidAt: new Date()
      }
    );

    // Update claim request status
    claimRequest.status = 'approved';
    claimRequest.adminNote = adminNote || '';
    claimRequest.processedBy = adminUsername;
    claimRequest.processedAt = new Date();
    await claimRequest.save();

    // Send email to user (implement email service)
    try {
      const nodemailer = require('nodemailer');

      // Create transporter (configure with your email service)
      const transporter = nodemailer.createTransport({
        service: 'gmail', // or your email service
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      // Format bank details for email
      const bankDetailsHtml = claimRequest.bankDetails.binanceId
        ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="color: #495057; margin: 0 0 10px 0;">Payment Method: Binance Transfer</h4>
            <p style="margin: 5px 0;"><strong>Binance ID:</strong> ${claimRequest.bankDetails.binanceId}</p>
          </div>
        `
        : `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="color: #495057; margin: 0 0 10px 0;">Payment Method: Bank Transfer</h4>
            <p style="margin: 5px 0;"><strong>Bank:</strong> ${claimRequest.bankDetails.bank}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${claimRequest.bankDetails.branch}</p>
            <p style="margin: 5px 0;"><strong>Account Number:</strong> ****${claimRequest.bankDetails.accountNo?.slice(-4)}</p>
            <p style="margin: 5px 0;"><strong>Account Name:</strong> ${claimRequest.bankDetails.accountName}</p>
          </div>
        `;

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Confirmation - Holidaysri</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Payment Confirmation</h1>
            <p style="color: #f8f9fa; margin: 10px 0 0 0; font-size: 16px;">Your earnings have been successfully transferred</p>
          </div>

          <div style="background: white; padding: 30px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; margin-bottom: 20px;">Dear <strong>${claimRequest.userId.name}</strong>,</p>

            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">✅ Payment Completed</h2>
              <p style="margin: 0; font-size: 18px; font-weight: bold;">${claimRequest.totalAmount.toLocaleString()} LKR</p>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">has been transferred to your account</p>
            </div>

            <h3 style="color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Transaction Details</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${claimRequest._id}</p>
              <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${claimRequest.totalAmount.toLocaleString()} LKR</p>
              <p style="margin: 5px 0;"><strong>Earnings Count:</strong> ${claimRequest.earningIds.length} referral earnings</p>
              <p style="margin: 5px 0;"><strong>Processed Date:</strong> ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            ${bankDetailsHtml}

            ${adminNote ? `
              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
                <h4 style="color: #1976d2; margin: 0 0 10px 0;">Admin Note</h4>
                <p style="margin: 0; color: #1565c0;">${adminNote}</p>
              </div>
            ` : ''}

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404;"><strong>Important:</strong> Please verify that you have received the payment in your account. If you have any questions or concerns, please contact our support team.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #6c757d; margin: 0;">Thank you for being a valued partner with</p>
              <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
              <p style="color: #6c757d; margin: 0; font-size: 14px;">Your trusted travel platform</p>
            </div>

            <div style="border-top: 1px solid #e9ecef; padding-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Holidaysri. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: claimRequest.userId.email,
        subject: `✅ Payment Confirmation - ${claimRequest.totalAmount.toLocaleString()} LKR Transferred | Holidaysri`,
        html: emailContent
      });

    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Claim request approved successfully',
      claimRequest
    });

  } catch (error) {
    console.error('Approve claim request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get claim request statistics
router.get('/claim-requests/stats', verifyAdminToken, async (req, res) => {
  try {
    const stats = await ClaimRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const formattedStats = {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      rejected: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id]) {
        formattedStats[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
      }
    });

    res.json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('Get claim request stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all earnings with search and filter
router.get('/earnings', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      usedPromoCode = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Promo code filter
    if (usedPromoCode) {
      query.usedPromoCode = usedPromoCode.toUpperCase();
    }

    // Search filter (buyerEmail or usedPromoCodeOwner)
    if (search) {
      query.$or = [
        { buyerEmail: { $regex: search, $options: 'i' } },
        { usedPromoCodeOwner: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get earnings with pagination
    const earnings = await Earning.find(query)
      .populate('buyerId', 'name email')
      .populate('usedPromoCodeOwnerId', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Earning.countDocuments(query);

    // Get statistics
    const stats = await Earning.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const formattedStats = {
      pending: { count: 0, totalAmount: 0 },
      processed: { count: 0, totalAmount: 0 },
      paid: { count: 0, totalAmount: 0 },
      total: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id]) {
        formattedStats[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
      }
      formattedStats.total.count += stat.count;
      formattedStats.total.totalAmount += stat.totalAmount;
    });

    res.json({
      success: true,
      earnings,
      stats: formattedStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all HSC transactions with search and filter
router.get('/hsc-transactions', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      tokenType = 'all',
      type = 'all',
      paymentStatus = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Token type filter
    if (tokenType !== 'all') {
      query.tokenType = tokenType;
    }

    // Transaction type filter
    if (type !== 'all') {
      query.type = type;
    }

    // Payment status filter
    if (paymentStatus !== 'all') {
      query['paymentDetails.paymentStatus'] = paymentStatus;
    }

    // Search filter (user email or transaction ID)
    if (search) {
      // First, try to find users by email
      const users = await User.find({
        email: { $regex: search, $options: 'i' }
      }).select('_id');

      const userIds = users.map(u => u._id);

      query.$or = [
        { userId: { $in: userIds } },
        { transactionId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get transactions with pagination
    const transactions = await HSCTransaction.find(query)
      .populate('userId', 'name email contactNumber')
      .populate('relatedAdvertisement', 'slotId category')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await HSCTransaction.countDocuments(query);

    // Get statistics
    const stats = await HSCTransaction.aggregate([
      {
        $group: {
          _id: {
            tokenType: '$tokenType',
            type: '$type'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const formattedStats = {
      byTokenType: {
        HSC: { count: 0, totalAmount: 0 },
        HSG: { count: 0, totalAmount: 0 },
        HSD: { count: 0, totalAmount: 0 }
      },
      byType: {
        purchase: { count: 0, totalAmount: 0 },
        spend: { count: 0, totalAmount: 0 },
        refund: { count: 0, totalAmount: 0 },
        bonus: { count: 0, totalAmount: 0 },
        gift: { count: 0, totalAmount: 0 }
      },
      total: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      const tokenType = stat._id.tokenType;
      const type = stat._id.type;

      if (formattedStats.byTokenType[tokenType]) {
        formattedStats.byTokenType[tokenType].count += stat.count;
        formattedStats.byTokenType[tokenType].totalAmount += stat.totalAmount;
      }

      if (formattedStats.byType[type]) {
        formattedStats.byType[type].count += stat.count;
        formattedStats.byType[type].totalAmount += stat.totalAmount;
      }

      formattedStats.total.count += stat.count;
      formattedStats.total.totalAmount += stat.totalAmount;
    });

    res.json({
      success: true,
      transactions,
      stats: formattedStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get HSC transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC earned claim requests
router.get('/hsc-earned-claims', verifyAdminToken, async (req, res) => {
  try {
    const HSCEarnedClaimRequest = require('../models/HSCEarnedClaimRequest');
    const { status = 'all', page = 1, limit = 10, search = '' } = req.query;

    // Build query
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { 'bankDetails.accountName': { $regex: search, $options: 'i' } }
      ];
    }

    // Get paginated results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const claimRequests = await HSCEarnedClaimRequest.find(query)
      .populate('userId', 'name email')
      .populate({
        path: 'hscEarnedIds',
        populate: {
          path: 'buyerUserId',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HSCEarnedClaimRequest.countDocuments(query);

    res.json({
      claimRequests,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get HSC earned claim requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get HSC earned claim request stats
router.get('/hsc-earned-claims/stats', verifyAdminToken, async (req, res) => {
  try {
    const HSCEarnedClaimRequest = require('../models/HSCEarnedClaimRequest');

    const stats = await HSCEarnedClaimRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHSCAmount: { $sum: '$totalHSCAmount' },
          totalLKRAmount: { $sum: '$totalLKRAmount' }
        }
      }
    ]);

    const formattedStats = {
      pending: { count: 0, totalHSCAmount: 0, totalLKRAmount: 0 },
      approved: { count: 0, totalHSCAmount: 0, totalLKRAmount: 0 },
      rejected: { count: 0, totalHSCAmount: 0, totalLKRAmount: 0 }
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id]) {
        formattedStats[stat._id] = {
          count: stat.count,
          totalHSCAmount: stat.totalHSCAmount,
          totalLKRAmount: stat.totalLKRAmount
        };
      }
    });

    res.json(formattedStats);

  } catch (error) {
    console.error('Get HSC earned claim stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve HSC earned claim request
router.post('/hsc-earned-claims/:requestId/approve', verifyAdminToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNote = '' } = req.body;
    const HSCEarnedClaimRequest = require('../models/HSCEarnedClaimRequest');
    const HSCEarned = require('../models/HSCEarned');
    const emailService = require('../utils/emailService');

    // Find the claim request
    const claimRequest = await HSCEarnedClaimRequest.findById(requestId)
      .populate('userId', 'name email')
      .populate({
        path: 'hscEarnedIds',
        populate: {
          path: 'buyerUserId',
          select: 'name email'
        }
      });

    if (!claimRequest) {
      return res.status(404).json({ message: 'Claim request not found' });
    }

    if (claimRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be approved' });
    }

    // Update claim request status
    claimRequest.status = 'approved';
    claimRequest.adminNote = adminNote;
    claimRequest.processedBy = req.admin.email;
    claimRequest.processedAt = new Date();
    await claimRequest.save();

    // Update HSC earned records status to 'paid As LKR'
    await HSCEarned.updateMany(
      { _id: { $in: claimRequest.hscEarnedIds } },
      {
        status: 'paid As LKR',
        updatedAt: new Date()
      }
    );

    // Send email notification to user
    try {
      await emailService.sendHSCEarnedClaimApprovalEmail(
        claimRequest.userEmail,
        claimRequest.userId.name,
        claimRequest.totalHSCAmount,
        claimRequest.totalLKRAmount
      );
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'HSC earned claim request approved successfully',
      claimRequest
    });

  } catch (error) {
    console.error('Approve HSC earned claim error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all HSC earned records with search and filter
router.get('/hsc-earned-records', verifyAdminToken, async (req, res) => {
  try {
    const HSCEarned = require('../models/HSCEarned');
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      category = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate = '',
      endDate = ''
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Category filter
    if (category !== 'all') {
      query.category = category;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (user email from buyerDetails or populated user)
    if (search) {
      query.$or = [
        { 'buyerDetails.buyerEmail': { $regex: search, $options: 'i' } },
        { 'buyerDetails.buyerName': { $regex: search, $options: 'i' } },
        { 'itemDetails.promoCode': { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get HSC earned records with pagination
    const hscEarnedRecords = await HSCEarned.find(query)
      .populate('userId', 'name email')
      .populate('buyerUserId', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await HSCEarned.countDocuments(query);

    // Get statistics
    const stats = await HSCEarned.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$earnedAmount' }
        }
      }
    ]);

    const formattedStats = {
      pending: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 },
      'paid As HSC': { count: 0, totalAmount: 0 },
      'paid As LKR': { count: 0, totalAmount: 0 },
      total: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id] !== undefined) {
        formattedStats[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
      }
      formattedStats.total.count += stat.count;
      formattedStats.total.totalAmount += stat.totalAmount;
    });

    res.json({
      success: true,
      hscEarnedRecords,
      stats: formattedStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get HSC earned records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Membership Management Routes

// Test endpoint for membership
router.get('/membership-test', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin membership test endpoint hit');
    console.log('Admin user:', req.admin);
    res.json({
      success: true,
      message: 'Admin membership test successful',
      admin: req.admin
    });
  } catch (error) {
    console.error('Admin membership test error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Get membership configuration
router.get('/membership-config', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin membership config request received');
    let membershipConfig = await MembershipConfig.findOne({ isActive: true });

    if (!membershipConfig) {
      console.log('No membership config found, creating default');
      // Create default configuration if none exists
      membershipConfig = new MembershipConfig({
        monthlyCharge: 2500,
        yearlyCharge: 25000,
        updatedBy: req.admin.username || 'admin'
      });
      await membershipConfig.save();
      console.log('Default membership config created');
    }

    console.log('Returning membership config:', membershipConfig);
    res.json({
      success: true,
      config: membershipConfig
    });

  } catch (error) {
    console.error('Get membership config error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update membership configuration
router.put('/membership-config', verifyAdminToken, async (req, res) => {
  try {
    const { monthlyCharge, yearlyCharge, features } = req.body;

    if (!monthlyCharge || !yearlyCharge || monthlyCharge <= 0 || yearlyCharge <= 0) {
      return res.status(400).json({ message: 'Invalid charges provided' });
    }

    let membershipConfig = await MembershipConfig.findOne({ isActive: true });

    if (!membershipConfig) {
      membershipConfig = new MembershipConfig({
        monthlyCharge,
        yearlyCharge,
        features: features || [],
        updatedBy: req.admin.username || 'admin'
      });
    } else {
      membershipConfig.monthlyCharge = monthlyCharge;
      membershipConfig.yearlyCharge = yearlyCharge;
      if (features) membershipConfig.features = features;
      membershipConfig.lastUpdated = new Date();
      membershipConfig.updatedBy = req.admin.username || 'admin';
    }

    await membershipConfig.save();

    res.json({
      success: true,
      message: 'Membership configuration updated successfully',
      config: membershipConfig
    });

  } catch (error) {
    console.error('Update membership config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get membership statistics
router.get('/membership-stats', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin membership stats request received');
    const totalMembers = await User.countDocuments({ isMember: true });
    const monthlyMembers = await User.countDocuments({
      isMember: true,
      membershipType: 'monthly'
    });
    const yearlyMembers = await User.countDocuments({
      isMember: true,
      membershipType: 'yearly'
    });
    console.log('Member counts:', { totalMembers, monthlyMembers, yearlyMembers });

    // Get membership revenue
    const revenueStats = await MembershipTransaction.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$membershipType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          totalHSC: { $sum: '$hscAmount' }
        }
      }
    ]);

    const formattedRevenue = {
      monthly: { count: 0, totalRevenue: 0, totalHSC: 0 },
      yearly: { count: 0, totalRevenue: 0, totalHSC: 0 }
    };

    revenueStats.forEach(stat => {
      if (formattedRevenue[stat._id]) {
        formattedRevenue[stat._id] = {
          count: stat.count,
          totalRevenue: stat.totalRevenue,
          totalHSC: stat.totalHSC
        };
      }
    });

    // Get recent membership transactions
    const recentTransactions = await MembershipTransaction.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalMembers,
        monthlyMembers,
        yearlyMembers,
        revenue: formattedRevenue,
        totalRevenue: formattedRevenue.monthly.totalRevenue + formattedRevenue.yearly.totalRevenue
      },
      recentTransactions
    });

  } catch (error) {
    console.error('Get membership stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all membership transactions
router.get('/membership-transactions', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', type = 'all' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status !== 'all') query.status = status;
    if (type !== 'all') query.membershipType = type;

    const transactions = await MembershipTransaction.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MembershipTransaction.countDocuments(query);

    res.json({
      success: true,
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

// Manual trigger for membership expiration check
router.post('/membership-expiration-check', verifyAdminToken, async (req, res) => {
  try {
    console.log('Manual membership expiration check triggered by admin');

    // Run both expiration checks
    await checkExpiredMemberships();
    await checkExpiringMemberships();

    res.json({
      success: true,
      message: 'Membership expiration check completed successfully'
    });

  } catch (error) {
    console.error('Manual membership expiration check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run membership expiration check',
      error: error.message
    });
  }
});

// Commercial Partner Management Routes

// Get commercial partner configuration
router.get('/commercial-partner-config', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin commercial partner config request received');
    let partnerConfig = await CommercialPartnerConfig.findOne({ isActive: true });

    if (!partnerConfig) {
      console.log('No commercial partner config found, creating default');
      // Create default configuration if none exists
      partnerConfig = new CommercialPartnerConfig({
        monthlyCharge: 5000,
        yearlyCharge: 50000,
        updatedBy: req.admin.username || 'admin'
      });
      await partnerConfig.save();
      console.log('Default commercial partner config created');
    }

    console.log('Returning commercial partner config:', partnerConfig);
    res.json({
      success: true,
      config: partnerConfig
    });

  } catch (error) {
    console.error('Get commercial partner config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update commercial partner configuration
router.put('/commercial-partner-config', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin commercial partner config update request received');
    const { monthlyCharge, yearlyCharge, features } = req.body;

    if (!monthlyCharge || !yearlyCharge) {
      return res.status(400).json({ message: 'Monthly and yearly charges are required' });
    }

    let partnerConfig = await CommercialPartnerConfig.findOne({ isActive: true });

    if (!partnerConfig) {
      partnerConfig = new CommercialPartnerConfig({
        monthlyCharge,
        yearlyCharge,
        features: features || [],
        updatedBy: req.admin.username || 'admin'
      });
    } else {
      partnerConfig.monthlyCharge = monthlyCharge;
      partnerConfig.yearlyCharge = yearlyCharge;
      if (features) partnerConfig.features = features;
      partnerConfig.lastUpdated = new Date();
      partnerConfig.updatedBy = req.admin.username || 'admin';
    }

    await partnerConfig.save();

    res.json({
      success: true,
      message: 'Commercial partner configuration updated successfully',
      config: partnerConfig
    });

  } catch (error) {
    console.error('Update commercial partner config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get commercial partner statistics
router.get('/commercial-partner-stats', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin commercial partner stats request received');
    const totalPartners = await User.countDocuments({ isPartner: true });
    const activePartners = await CommercialPartner.countDocuments({ status: 'active' });
    const expiredPartners = await CommercialPartner.countDocuments({ status: 'expired' });

    const monthlyPartners = await CommercialPartner.countDocuments({
      status: 'active',
      partnershipType: 'monthly'
    });
    const yearlyPartners = await CommercialPartner.countDocuments({
      status: 'active',
      partnershipType: 'yearly'
    });

    console.log('Partner counts:', { totalPartners, activePartners, expiredPartners, monthlyPartners, yearlyPartners });

    // Get partner revenue
    const revenueStats = await CommercialPartner.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$partnershipType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          totalHSC: { $sum: '$hscAmount' }
        }
      }
    ]);

    console.log('Partner revenue stats:', revenueStats);

    const revenue = {
      monthly: { count: 0, totalRevenue: 0 },
      yearly: { count: 0, totalRevenue: 0 }
    };

    revenueStats.forEach(stat => {
      if (stat._id === 'monthly') {
        revenue.monthly = { count: stat.count, totalRevenue: stat.totalRevenue };
      } else if (stat._id === 'yearly') {
        revenue.yearly = { count: stat.count, totalRevenue: stat.totalRevenue };
      }
    });

    const totalRevenue = revenue.monthly.totalRevenue + revenue.yearly.totalRevenue;

    res.json({
      success: true,
      stats: {
        totalPartners,
        activePartners,
        expiredPartners,
        monthlyPartners,
        yearlyPartners,
        revenue,
        totalRevenue
      }
    });

  } catch (error) {
    console.error('Get commercial partner stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get commercial partners list
router.get('/commercial-partners', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const partners = await CommercialPartner.find()
      .populate('userId', 'name email contactNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CommercialPartner.countDocuments();

    res.json({
      success: true,
      partners,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get commercial partners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Advertisement Slot Charges Management Routes

// Get advertisement slot charges configuration
router.get('/advertisement-slot-charges', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin advertisement slot charges config request received');
    let slotCharges = await AdvertisementSlotCharges.findOne({ isActive: true });

    if (!slotCharges) {
      console.log('No advertisement slot charges config found, creating default');
      // Create default configuration if none exists
      slotCharges = new AdvertisementSlotCharges({
        updatedBy: req.admin.username || 'admin'
      });
      await slotCharges.save();
      console.log('Default advertisement slot charges config created');
    }

    console.log('Returning advertisement slot charges config');
    res.json({
      success: true,
      config: slotCharges
    });

  } catch (error) {
    console.error('Get advertisement slot charges config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update advertisement slot charges configuration
router.put('/advertisement-slot-charges', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin advertisement slot charges config update request received');
    const updateData = req.body;

    if (!updateData) {
      return res.status(400).json({ message: 'Update data is required' });
    }

    let slotCharges = await AdvertisementSlotCharges.findOne({ isActive: true });

    if (!slotCharges) {
      slotCharges = new AdvertisementSlotCharges({
        ...updateData,
        updatedBy: req.admin.username || 'admin'
      });
    } else {
      // Update all provided fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
          slotCharges[key] = updateData[key];
        }
      });
      slotCharges.lastUpdated = new Date();
      slotCharges.updatedBy = req.admin.username || 'admin';
    }

    await slotCharges.save();

    res.json({
      success: true,
      message: 'Advertisement slot charges configuration updated successfully',
      config: slotCharges
    });

  } catch (error) {
    console.error('Update advertisement slot charges config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get advertisement slot charges statistics
router.get('/advertisement-slot-charges-stats', verifyAdminToken, async (req, res) => {
  try {
    console.log('Admin advertisement slot charges stats request received');

    // Get current configuration
    const slotCharges = await AdvertisementSlotCharges.findOne({ isActive: true });

    if (!slotCharges) {
      return res.status(404).json({ message: 'Advertisement slot charges configuration not found' });
    }

    // Calculate total slots and categories
    const categories = [
      'tourismTravel',
      'accommodationDining',
      'vehiclesTransport',
      'eventsManagement',
      'professionalsServices',
      'caringDonations',
      'marketplaceShopping',
      'entertainmentFitness',
      'specialOpportunities',
      'essentialServices'
    ];

    let totalSlots = 1; // Home banner
    let totalCategories = categories.length;

    // Count slots in each category
    categories.forEach(category => {
      if (slotCharges[category]) {
        totalSlots += Object.keys(slotCharges[category]).length;
      }
    });

    // Get advertisement statistics by category
    const adStats = await Advertisement.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalSlots,
        totalCategories,
        lastUpdated: slotCharges.lastUpdated,
        updatedBy: slotCharges.updatedBy,
        currency: slotCharges.currency,
        advertisementStats: adStats
      }
    });

  } catch (error) {
    console.error('Get advertisement slot charges stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get slot charges for a specific category and slot
router.get('/advertisement-slot-charges/:category/:slot?', verifyAdminToken, async (req, res) => {
  try {
    const { category, slot } = req.params;

    const slotCharges = await AdvertisementSlotCharges.findOne({ isActive: true });

    if (!slotCharges) {
      return res.status(404).json({ message: 'Advertisement slot charges configuration not found' });
    }

    let result;
    if (category === 'homeBanner') {
      result = slotCharges.homeBanner;
    } else if (slotCharges[category]) {
      if (slot) {
        result = slotCharges[category][slot];
      } else {
        result = slotCharges[category];
      }
    }

    if (!result) {
      return res.status(404).json({ message: 'Category or slot not found' });
    }

    res.json({
      success: true,
      charges: result
    });

  } catch (error) {
    console.error('Get specific slot charges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Token Distribution Management Routes

// Get users list for token distribution
router.get('/users-for-distribution', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    let query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email hscBalance hsgBalance hsdBalance isEmailVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get users for distribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Distribute tokens to selected users
router.post('/distribute-tokens', verifyAdminToken, async (req, res) => {
  try {
    const { userIds, tokenType, amount, adminMessage } = req.body;

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs are required' });
    }

    if (!tokenType || !['HSC', 'HSG', 'HSD'].includes(tokenType)) {
      return res.status(400).json({ message: 'Valid token type is required (HSC, HSG, or HSD)' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    if (!adminMessage || adminMessage.trim().length === 0) {
      return res.status(400).json({ message: 'Admin message is required' });
    }

    const recipients = [];
    const failedRecipients = [];
    const transactions = [];

    // Process each user
    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          failedRecipients.push({
            userId,
            userName: 'Unknown',
            userEmail: 'Unknown',
            error: 'User not found'
          });
          continue;
        }

        // Get balance before update
        const balanceField = `${tokenType.toLowerCase()}Balance`;
        const balanceBefore = user[balanceField] || 0;

        // Update user balance
        user[balanceField] = balanceBefore + amount;
        await user.save();

        const balanceAfter = user[balanceField];

        // Create transaction record
        const transaction = new HSCTransaction({
          userId: user._id,
          tokenType,
          type: 'gift',
          amount,
          description: `Admin gift: ${amount} ${tokenType} - ${adminMessage}`,
          paymentMethod: 'admin_credit',
          paymentDetails: {
            paymentStatus: 'completed',
            adminGift: true,
            adminMessage: adminMessage.trim()
          },
          balanceBefore,
          balanceAfter
        });

        await transaction.save();
        transactions.push(transaction);

        // Add to recipients list
        recipients.push({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          balanceBefore,
          balanceAfter,
          transactionId: transaction._id
        });

        // Create notification
        await Notification.createNotification(
          user._id,
          `🎉 You've Received ${amount} ${tokenType}!`,
          `Congratulations! You've received ${amount} ${tokenType} tokens as a gift from our admin team. ${adminMessage}`,
          'system',
          {
            tokenType,
            amount,
            adminMessage: adminMessage.trim(),
            newBalance: balanceAfter,
            isAdminGift: true
          },
          'high'
        );

        // Send email notification
        try {
          await sendTokenGiftEmail(
            user.email,
            user.name,
            tokenType,
            amount,
            adminMessage.trim(),
            balanceAfter
          );
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          // Don't fail the entire operation for email errors
        }

      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        failedRecipients.push({
          userId,
          userName: 'Unknown',
          userEmail: 'Unknown',
          error: userError.message
        });
      }
    }

    // Create distribution record
    const distributionStatus = failedRecipients.length === 0 ? 'completed' :
                              recipients.length === 0 ? 'failed' : 'partial';

    const distribution = await TokenDistribution.createDistribution({
      adminUsername: req.admin.username,
      tokenType,
      amount,
      adminMessage: adminMessage.trim(),
      recipients,
      totalRecipients: userIds.length,
      totalAmountDistributed: recipients.length * amount,
      distributionStatus,
      failedRecipients
    });

    res.json({
      success: true,
      message: `Token distribution ${distributionStatus}`,
      distribution: {
        id: distribution._id,
        successfulRecipients: recipients.length,
        failedRecipients: failedRecipients.length,
        totalAmountDistributed: recipients.length * amount,
        status: distributionStatus
      }
    });

  } catch (error) {
    console.error('Token distribution error:', error);
    res.status(500).json({ message: 'Server error during token distribution' });
  }
});

// Get token distribution history
router.get('/distribution-history', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const tokenType = req.query.tokenType || 'all';
    const status = req.query.status || 'all';
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (tokenType !== 'all') query.tokenType = tokenType;
    if (status !== 'all') query.distributionStatus = status;

    const distributions = await TokenDistribution.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recipients.userId', 'name email')
      .populate('recipients.transactionId', 'createdAt');

    const total = await TokenDistribution.countDocuments(query);

    // Get summary statistics
    const stats = await TokenDistribution.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalDistributions: { $sum: 1 },
          totalAmountDistributed: { $sum: '$totalAmountDistributed' },
          totalRecipients: { $sum: '$totalRecipients' },
          avgRecipientsPerDistribution: { $avg: '$totalRecipients' }
        }
      }
    ]);

    const summary = stats[0] || {
      totalDistributions: 0,
      totalAmountDistributed: 0,
      totalRecipients: 0,
      avgRecipientsPerDistribution: 0
    };

    res.json({
      success: true,
      distributions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      summary
    });

  } catch (error) {
    console.error('Get distribution history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get distribution details by ID
router.get('/distribution-history/:id', verifyAdminToken, async (req, res) => {
  try {
    const distribution = await TokenDistribution.findById(req.params.id)
      .populate('recipients.userId', 'name email contactNumber')
      .populate('recipients.transactionId', 'createdAt paymentDetails');

    if (!distribution) {
      return res.status(404).json({ message: 'Distribution not found' });
    }

    res.json({
      success: true,
      distribution
    });

  } catch (error) {
    console.error('Get distribution details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== AGENTS MANAGEMENT ROUTES ====================

// Get all agents with search and filters
router.get('/agents', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, promoCodeType, isActive } = req.query;

    let query = {};

    // Search by email or promoCode
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { promoCode: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by promoCodeType
    if (promoCodeType && promoCodeType !== 'all') {
      query.promoCodeType = promoCodeType;
    }

    // Filter by isActive
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }

    const agents = await Agent.find(query)
      .populate('userId', 'name email contactNumber hscBalance')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Agent.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Agent.countDocuments(),
      active: await Agent.countDocuments({ isActive: true }),
      inactive: await Agent.countDocuments({ isActive: false }),
      verified: await Agent.countDocuments({ isVerified: true }),
      byType: {
        silver: await Agent.countDocuments({ promoCodeType: 'silver' }),
        gold: await Agent.countDocuments({ promoCodeType: 'gold' }),
        diamond: await Agent.countDocuments({ promoCodeType: 'diamond' }),
        free: await Agent.countDocuments({ promoCodeType: 'free' })
      }
    };

    res.json({
      success: true,
      agents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      stats
    });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent details by ID
router.get('/agents/:agentId', verifyAdminToken, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.agentId)
      .populate('userId', 'name email contactNumber countryCode hscBalance hsgBalance hsdBalance createdAt');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Get agent's earnings using usedPromoCodeOwnerId (which references the agent's userId)
    const earnings = await Earning.find({ usedPromoCodeOwnerId: agent.userId._id })
      .populate('buyerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    // Calculate total earnings using usedPromoCodeOwnerId
    const totalEarnings = await Earning.aggregate([
      { $match: { usedPromoCodeOwnerId: new mongoose.Types.ObjectId(agent.userId._id) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    console.log('Agent details - Total Earnings:', totalEarnings[0]?.total || 0);
    console.log('Agent details - Earnings count:', earnings.length);

    res.json({
      success: true,
      agent,
      earnings,
      totalEarnings: totalEarnings[0]?.total || 0
    });

  } catch (error) {
    console.error('Get agent details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update agent status (activate/deactivate)
router.put('/agents/:agentId/status', verifyAdminToken, async (req, res) => {
  try {
    const { isActive } = req.body;

    const agent = await Agent.findByIdAndUpdate(
      req.params.agentId,
      { isActive },
      { new: true }
    ).populate('userId', 'name email');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      success: true,
      message: `Agent ${isActive ? 'activated' : 'deactivated'} successfully`,
      agent
    });

  } catch (error) {
    console.error('Update agent status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all payment activities with filters and search
router.get('/payment-activities', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = 'all',
      paymentMethod = 'all',
      status = 'all',
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = {};

    // Search by buyer email or transaction ID
    if (search) {
      query.$or = [
        { buyerEmail: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category !== 'all') {
      query.category = category;
    }

    // Filter by payment method
    if (paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const activities = await PaymentActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('promoCodeOwnerId', 'name email');

    const total = await PaymentActivity.countDocuments(query);

    // Calculate company profit (sum of all LKR payment methods)
    const companyProfitResult = await PaymentActivity.aggregate([
      {
        $match: {
          paymentMethod: 'LKR',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const companyProfit = companyProfitResult.length > 0
      ? companyProfitResult[0].totalProfit
      : 0;
    const lkrTransactionCount = companyProfitResult.length > 0
      ? companyProfitResult[0].count
      : 0;

    // Get statistics (only for HSC payment method)
    const hscQuery = { ...query, paymentMethod: 'HSC' };
    const stats = await PaymentActivity.aggregate([
      { $match: hscQuery },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalOriginalAmount: { $sum: '$originalAmount' },
          totalDiscountedAmount: { $sum: '$discountedAmount' }
        }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await PaymentActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get payment method breakdown
    const paymentMethodBreakdown = await PaymentActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get status breakdown
    const statusBreakdown = await PaymentActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      companyProfit: {
        totalProfit: companyProfit,
        lkrTransactionCount: lkrTransactionCount
      },
      stats: stats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        totalOriginalAmount: 0,
        totalDiscountedAmount: 0
      },
      categoryBreakdown,
      paymentMethodBreakdown,
      statusBreakdown
    });

  } catch (error) {
    console.error('Get payment activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment activity details by ID
router.get('/payment-activities/:id', verifyAdminToken, async (req, res) => {
  try {
    const activity = await PaymentActivity.findById(req.params.id)
      .populate('userId', 'name email contactNumber countryCode')
      .populate('promoCodeOwnerId', 'name email');

    if (!activity) {
      return res.status(404).json({ message: 'Payment activity not found' });
    }

    res.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error('Get payment activity details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all payment activities
router.delete('/payment-activities/all/records', verifyAdminToken, async (req, res) => {
  try {
    const { confirmation } = req.body;

    // Verify confirmation text
    if (confirmation !== 'Confirm') {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation. Please type "Confirm" to delete all records.'
      });
    }

    // Delete all payment activities
    const result = await PaymentActivity.deleteMany({});

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} payment activity records.`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Delete all payment activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting payment activities'
    });
  }
});

// Get all room bookings with filters and search
router.get('/room-bookings', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = {};

    // Search by booking ID, customer name, customer email, or hotel name
    if (search) {
      query.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { hotelName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const bookings = await RoomBooking.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'name email contactNumber')
      .populate('hotelOwnerId', 'name email contactNumber')
      .populate('promocodeOwnerId', 'name email');

    const total = await RoomBooking.countDocuments(query);

    // Get statistics
    const stats = await RoomBooking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalFinalAmount: { $sum: '$finalAmount' },
          totalDiscount: { $sum: '$totalDiscount' }
        }
      }
    ]);

    // Get status breakdown
    const statusBreakdown = await RoomBooking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      stats: stats[0] || {
        totalBookings: 0,
        totalAmount: 0,
        totalFinalAmount: 0,
        totalDiscount: 0
      },
      statusBreakdown
    });

  } catch (error) {
    console.error('Get room bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get room booking details by ID
router.get('/room-bookings/:id', verifyAdminToken, async (req, res) => {
  try {
    const booking = await RoomBooking.findById(req.params.id)
      .populate('customerId', 'name email contactNumber countryCode')
      .populate('hotelOwnerId', 'name email contactNumber countryCode')
      .populate('promocodeOwnerId', 'name email')
      .populate('hotelId')
      .populate('paymentActivityId');

    if (!booking) {
      return res.status(404).json({ message: 'Room booking not found' });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Get room booking details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADVERTISEMENTS MANAGEMENT ROUTES ====================

// Get all advertisements with search and filters
router.get('/advertisements', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status, isActive } = req.query;

    let query = {};

    // Search by user email or slotId
    if (search) {
      const users = await User.find({
        email: { $regex: search, $options: 'i' }
      }).select('_id');

      const userIds = users.map(u => u._id);

      query.$or = [
        { slotId: { $regex: search, $options: 'i' } },
        { userId: { $in: userIds } }
      ];
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by isActive
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }

    const advertisements = await Advertisement.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Advertisement.countDocuments(query);

    res.json({
      success: true,
      advertisements,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get advertisements error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get advertisement details
router.get('/advertisements/:adId', verifyAdminToken, async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.adId)
      .populate('userId', 'name email profileImage')
      .populate('usedPromoCodeOwnerId', 'name email');

    if (!advertisement) {
      return res.status(404).json({ message: 'Advertisement not found' });
    }

    // Get published ad details if exists
    let publishedAdDetails = null;
    if (advertisement.publishedAdId && advertisement.publishedAdModel) {
      const model = mongoose.model(advertisement.publishedAdModel);
      publishedAdDetails = await model.findById(advertisement.publishedAdId);
    }

    res.json({
      success: true,
      advertisement,
      publishedAdDetails
    });

  } catch (error) {
    console.error('Get advertisement details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle advertisement isActive status
router.put('/advertisements/:adId/toggle-active', verifyAdminToken, async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.adId);

    if (!advertisement) {
      return res.status(404).json({ message: 'Advertisement not found' });
    }

    advertisement.isActive = !advertisement.isActive;
    await advertisement.save();

    res.json({
      success: true,
      message: `Advertisement ${advertisement.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: advertisement.isActive
    });

  } catch (error) {
    console.error('Toggle advertisement status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete advertisement with slot
router.delete('/advertisements/:adId', verifyAdminToken, async (req, res) => {
  try {
    const { slotId, adminNote } = req.body;

    const advertisement = await Advertisement.findById(req.params.adId)
      .populate('userId', 'name email');

    if (!advertisement) {
      return res.status(404).json({ message: 'Advertisement not found' });
    }

    // Verify slotId matches
    if (advertisement.slotId !== slotId) {
      return res.status(400).json({
        success: false,
        message: 'Slot ID does not match. Please enter the correct Slot ID.'
      });
    }

    // Delete published ad if exists
    if (advertisement.publishedAdId && advertisement.publishedAdModel) {
      try {
        const model = mongoose.model(advertisement.publishedAdModel);
        await model.findByIdAndDelete(advertisement.publishedAdId);
      } catch (modelError) {
        console.error('Error deleting published ad:', modelError);
        // Continue with advertisement deletion even if published ad deletion fails
      }
    }

    // Get category name for email
    const categoryNames = {
      'travel_buddys': 'Travel Buddies',
      'tour_guiders': 'Tour Guiders',
      'local_tour_packages': 'Local Tour Packages',
      'travelsafe_help_professionals': 'Travel Safe Help Professionals',
      'rent_land_camping_parking': 'Rent Land Camping Parking',
      'hotels_accommodations': 'Hotels & Accommodations',
      'cafes_restaurants': 'Cafes & Restaurants',
      'foods_beverages': 'Foods & Beverages',
      'vehicle_rentals_hire': 'Vehicle Rentals & Hire',
      'professional_drivers': 'Professional Drivers',
      'vehicle_repairs_mechanics': 'Vehicle Repairs & Mechanics',
      'event_planners_coordinators': 'Event Planners & Coordinators',
      'creative_photographers': 'Creative Photographers',
      'decorators_florists': 'Decorators & Florists',
      'salon_makeup_artists': 'Salon & Makeup Artists',
      'fashion_designers': 'Fashion Designers',
      'fashion_beauty_clothing': 'Fashion Beauty & Clothing',
      'expert_doctors': 'Expert Doctors',
      'professional_lawyers': 'Professional Lawyers',
      'advisors_counselors': 'Advisors & Counselors',
      'expert_architects': 'Expert Architects',
      'trusted_astrologists': 'Trusted Astrologists',
      'delivery_partners': 'Delivery Partners',
      'graphics_it_tech_repair': 'Graphics IT & Tech Repair',
      'educational_tutoring': 'Educational Tutoring',
      'babysitters_childcare': 'Babysitters & Childcare',
      'pet_care_animal_services': 'Pet Care & Animal Services',
      'rent_property_buying_selling': 'Rent Property Buying Selling',
      'books_magazines_educational': 'Books Magazines & Educational',
      'other_items': 'Other Items',
      'events_updates': 'Events & Updates',
      'donations_raise_fund': 'Donations & Raise Fund',
      'home_banner_slot': 'Home Banner Slot',
      'live_rides_carpooling': 'Live Rides & Carpooling',
      'crypto_consulting_signals': 'Crypto Consulting & Signals'
    };

    const categoryName = categoryNames[advertisement.category] || advertisement.category;

    // Send email notification to user
    const { sendAdvertisementDeletionNotification } = require('../utils/emailService');
    try {
      await sendAdvertisementDeletionNotification(
        advertisement.userId.email,
        advertisement.userId.name,
        advertisement.slotId,
        categoryName,
        adminNote || ''
      );
    } catch (emailError) {
      console.error('Error sending deletion notification email:', emailError);
      // Continue with deletion even if email fails
    }

    // Delete the advertisement
    await Advertisement.findByIdAndDelete(req.params.adId);

    res.json({
      success: true,
      message: 'Advertisement and associated content deleted successfully'
    });

  } catch (error) {
    console.error('Delete advertisement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== HOLIDAY MEMORIES (PHOTOS FROM TRAVELERS) MANAGEMENT ====================

// Get all holiday memories with search and filters
router.get('/holiday-memories', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, province, isActive } = req.query;
    const HolidayMemory = require('../models/HolidayMemory');

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { 'location.name': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Province filter
    if (province && province !== 'all') {
      query['location.province'] = province;
    }

    // isActive filter
    if (isActive && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    // Fetch photos and add reports count for sorting
    const photosWithReportsCount = await HolidayMemory.aggregate([
      { $match: query },
      {
        $addFields: {
          reportsCount: { $size: { $ifNull: ['$reports', []] } }
        }
      },
      { $sort: { reportsCount: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalPhotos = await HolidayMemory.countDocuments(query);

    const photos = photosWithReportsCount;

    res.json({
      photos,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPhotos / limit),
      totalPhotos
    });

  } catch (error) {
    console.error('Get holiday memories error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get holiday memory details
router.get('/holiday-memories/:photoId', verifyAdminToken, async (req, res) => {
  try {
    const HolidayMemory = require('../models/HolidayMemory');
    const photo = await HolidayMemory.findById(req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json({ photo });

  } catch (error) {
    console.error('Get holiday memory details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update holiday memory
router.put('/holiday-memories/:photoId', verifyAdminToken, async (req, res) => {
  try {
    const HolidayMemory = require('../models/HolidayMemory');
    const { image, caption, location, mapLink, tags, isActive } = req.body;

    const photo = await HolidayMemory.findById(req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Update fields
    if (image !== undefined) photo.image = image;
    if (caption !== undefined) photo.caption = caption;
    if (location !== undefined) photo.location = location;
    if (mapLink !== undefined) photo.mapLink = mapLink;
    if (tags !== undefined) photo.tags = tags;
    if (isActive !== undefined) photo.isActive = isActive;

    await photo.save();

    res.json({
      message: 'Photo updated successfully',
      photo
    });

  } catch (error) {
    console.error('Update holiday memory error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete holiday memory with email notification
router.delete('/holiday-memories/:photoId', verifyAdminToken, async (req, res) => {
  try {
    const HolidayMemory = require('../models/HolidayMemory');
    const { sendPhotoPostDeletionNotification } = require('../utils/emailService');
    const { adminNote, deleteComments } = req.body;

    if (!adminNote || !adminNote.trim()) {
      return res.status(400).json({ message: 'Admin note is required' });
    }

    const photo = await HolidayMemory.findById(req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Store photo details for email
    const photoDetails = {
      caption: photo.caption,
      location: photo.location,
      userName: photo.userName,
      userEmail: photo.userEmail,
      image: photo.image,
      createdAt: photo.createdAt
    };

    // Delete the photo
    await HolidayMemory.findByIdAndDelete(req.params.photoId);

    // Send email notification to user
    try {
      await sendPhotoPostDeletionNotification(
        photoDetails.userEmail,
        photoDetails.userName,
        photoDetails.caption,
        photoDetails.location?.name || 'Unknown location',
        adminNote.trim()
      );
    } catch (emailError) {
      console.error('Error sending deletion notification email:', emailError);
      // Continue even if email fails
    }

    res.json({
      message: 'Photo deleted successfully and user notified',
      deletedPhoto: photoDetails
    });

  } catch (error) {
    console.error('Delete holiday memory error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete comment from holiday memory
router.delete('/holiday-memories/:photoId/comments/:commentId', verifyAdminToken, async (req, res) => {
  try {
    const HolidayMemory = require('../models/HolidayMemory');
    const { photoId, commentId } = req.params;

    const photo = await HolidayMemory.findById(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Remove comment
    photo.comments = photo.comments.filter(
      comment => comment._id.toString() !== commentId
    );

    await photo.save();

    res.json({
      message: 'Comment deleted successfully',
      photo
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all photo earnings with search and filter
router.get('/photo-earnings', verifyAdminToken, async (req, res) => {
  try {
    const PhotoEarned = require('../models/PhotoEarned');
    const { HSCConfig } = require('../models/HSC');
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      sortBy = 'downloadedAt',
      sortOrder = 'desc',
      startDate = '',
      endDate = ''
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.downloadedAt = {};
      if (startDate) {
        query.downloadedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.downloadedAt.$lte = new Date(endDate);
      }
    }

    // Search filter (userEmail, userName, buyerEmail, buyerName, transactionId)
    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { buyerEmail: { $regex: search, $options: 'i' } },
        { buyerName: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get photo earnings with pagination
    const photoEarnings = await PhotoEarned.find(query)
      .populate('postId', 'image caption location')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await PhotoEarned.countDocuments(query);

    // Get statistics - calculate totals
    const stats = await PhotoEarned.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPaidByBuyer: { $sum: '$hscPaidByBuyer' },
          totalEarnAmount: { $sum: '$hscEarnAmount' }
        }
      }
    ]);

    // Calculate overall totals
    const overallStats = await PhotoEarned.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPaidByBuyer: { $sum: '$hscPaidByBuyer' },
          totalEarnAmount: { $sum: '$hscEarnAmount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      pending: { count: 0, totalPaidByBuyer: 0, totalEarnAmount: 0 },
      completed: { count: 0, totalPaidByBuyer: 0, totalEarnAmount: 0 },
      cancelled: { count: 0, totalPaidByBuyer: 0, totalEarnAmount: 0 },
      total: {
        count: 0,
        totalPaidByBuyer: 0,
        totalEarnAmount: 0,
        companyProfit: 0,
        companyProfitLKR: 0
      }
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id]) {
        formattedStats[stat._id] = {
          count: stat.count,
          totalPaidByBuyer: stat.totalPaidByBuyer,
          totalEarnAmount: stat.totalEarnAmount
        };
      }
    });

    if (overallStats.length > 0) {
      const overall = overallStats[0];
      formattedStats.total = {
        count: overall.totalCount,
        totalPaidByBuyer: overall.totalPaidByBuyer,
        totalEarnAmount: overall.totalEarnAmount,
        companyProfit: overall.totalPaidByBuyer - overall.totalEarnAmount
      };

      // Get current HSC value for LKR conversion
      const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
      const hscValue = hscConfig ? hscConfig.hscValue : 100;
      formattedStats.total.companyProfitLKR = formattedStats.total.companyProfit * hscValue;
      formattedStats.total.hscValue = hscValue;
      formattedStats.total.currency = hscConfig ? hscConfig.currency : 'LKR';
    }

    res.json({
      success: true,
      photoEarnings,
      stats: formattedStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get photo earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// DATABASE BACKUP MANAGEMENT
// ============================================

/**
 * Get last backup status and details
 */
router.get('/database-backup/status', verifyAdminToken, async (req, res) => {
  try {
    const BACKUP_DIR = path.join(__dirname, '../backups');

    // Check if backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({
        success: true,
        hasBackup: false,
        message: 'No backups found. Backups will be created automatically at 2:00 AM daily.'
      });
    }

    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json.gz'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime,
        size: fs.statSync(path.join(BACKUP_DIR, file)).size
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      return res.json({
        success: true,
        hasBackup: false,
        message: 'No backups found. Backups will be created automatically at 2:00 AM daily.'
      });
    }

    // Get the most recent backup
    const lastBackup = files[0];

    // Parse backup filename to extract details
    // Format: backup_holidaysri_2025-11-23_17-00-10.json.gz
    const filenameParts = lastBackup.name.replace('.json.gz', '').split('_');
    const database = filenameParts[1];
    const date = filenameParts[2];
    const time = filenameParts[3];

    // Calculate file sizes
    const compressedSize = (lastBackup.size / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      hasBackup: true,
      backup: {
        fileName: lastBackup.name,
        database: database,
        timestamp: lastBackup.time,
        date: date,
        time: time.replace(/-/g, ':'),
        compressedSize: `${compressedSize} MB`,
        compressedSizeBytes: lastBackup.size,
        totalBackups: files.length,
        backupLocation: 'backend/backups/',
        backupMethod: 'Node.js (Render-compatible)',
        schedule: 'Daily at 2:00 AM (Asia/Colombo)',
        retention: 'Last 30 backups'
      },
      allBackups: files.map(file => ({
        fileName: file.name,
        timestamp: file.time,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      }))
    });

  } catch (error) {
    console.error('Get backup status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving backup status',
      error: error.message
    });
  }
});

/**
 * Get all backups with details
 */
router.get('/database-backup/all', verifyAdminToken, async (req, res) => {
  try {
    const BACKUP_DIR = path.join(__dirname, '../backups');

    // Check if backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({
        success: true,
        backups: []
      });
    }

    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json.gz'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);

        // Extract database name from filename
        // Format: backup_dbname_YYYY-MM-DD_HH-MM-SS.json.gz
        const match = file.match(/backup_(.+?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.json\.gz/);
        const database = match ? match[1] : 'unknown';

        // Use file modification time as timestamp (same as backup status endpoint)
        // This ensures consistent timezone handling
        const timestamp = stats.mtime;

        return {
          fileName: file,
          path: filePath,
          database: database,
          timestamp: timestamp,
          size: stats.size,
          compressedSize: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

    res.json({
      success: true,
      backups: files,
      total: files.length
    });

  } catch (error) {
    console.error('[ADMIN] Error fetching all backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backups',
      error: error.message
    });
  }
});

/**
 * Trigger manual backup
 */
router.post('/database-backup/trigger', verifyAdminToken, async (req, res) => {
  try {
    console.log('[ADMIN] Manual backup triggered by:', req.admin.username);

    const result = await performNodeJSBackup();

    if (result.success) {
      res.json({
        success: true,
        message: 'Backup completed successfully',
        backup: {
          fileName: result.fileName,
          originalSize: `${result.originalSize} MB`,
          compressedSize: `${result.fileSize} MB`,
          compressionRatio: `${result.compressionRatio}%`,
          collections: result.collections,
          documents: result.documents,
          duration: `${result.duration}ms`
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Backup failed',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Manual backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering backup',
      error: error.message
    });
  }
});

/**
 * Restore from last backup
 * WARNING: This will delete all existing data and restore from backup
 */
router.post('/database-backup/restore', verifyAdminToken, async (req, res) => {
  try {
    const { confirmRestore } = req.body;

    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Restore confirmation required'
      });
    }

    console.log('[ADMIN] Database restore triggered by:', req.admin.username);
    console.log('[ADMIN] ⚠️  WARNING: This will delete all existing data!');

    const BACKUP_DIR = path.join(__dirname, '../backups');

    // Get the most recent backup
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json.gz'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No backup files found'
      });
    }

    const lastBackup = files[0];
    const backupPath = lastBackup.path;

    console.log('[ADMIN] Restoring from:', lastBackup.name);

    // Read and decompress backup
    const zlib = require('zlib');
    const { promisify } = require('util');
    const gunzip = promisify(zlib.gunzip);

    const compressedData = fs.readFileSync(backupPath);
    const jsonData = await gunzip(compressedData);

    // Parse backup data
    const backup = JSON.parse(jsonData.toString());

    // Convert string IDs to ObjectIds
    const { ObjectId } = require('mongodb');
    const convertStringIdsToObjectIds = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(item => convertStringIdsToObjectIds(item));
      if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if ((key === '_id' || key.endsWith('Id')) && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
            result[key] = new ObjectId(value);
          } else {
            result[key] = convertStringIdsToObjectIds(value);
          }
        }
        return result;
      }
      return obj;
    };

    const backupWithObjectIds = convertStringIdsToObjectIds(backup);

    // Debug: Verify ObjectId conversion
    if (backupWithObjectIds.data.users && backupWithObjectIds.data.users[0]) {
      const firstUser = backupWithObjectIds.data.users[0];
      console.log('[ADMIN] DEBUG - First user _id type:', typeof firstUser._id);
      console.log('[ADMIN] DEBUG - First user _id instanceof ObjectId:', firstUser._id instanceof ObjectId);
      console.log('[ADMIN] DEBUG - First user _id value:', firstUser._id);
    }

    console.log('[ADMIN] Backup metadata:', backupWithObjectIds.metadata);

    let restoredCollections = 0;
    let restoredDocuments = 0;
    const startTime = Date.now();

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backupWithObjectIds.data)) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);

        if (documents.length > 0) {
          // Delete existing documents
          await collection.deleteMany({});

          // Insert backup documents with proper ObjectIds
          await collection.insertMany(documents);

          restoredCollections++;
          restoredDocuments += documents.length;

          console.log(`[ADMIN] ✓ Restored ${documents.length} documents to ${collectionName}`);
        }
      } catch (error) {
        console.error(`[ADMIN] ✗ Error restoring ${collectionName}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;

    console.log('[ADMIN] ✅ Restore completed successfully!');
    console.log(`[ADMIN] Collections: ${restoredCollections}, Documents: ${restoredDocuments}`);

    res.json({
      success: true,
      message: 'Database restored successfully',
      restore: {
        fileName: lastBackup.name,
        backupDate: backup.metadata.timestamp,
        collections: restoredCollections,
        documents: restoredDocuments,
        duration: `${duration}ms`,
        restoredBy: req.admin.username,
        restoredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ADMIN] Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring database',
      error: error.message
    });
  }
});

/**
 * Restore from a specific backup file
 * WARNING: This will delete all existing data and restore from the specified backup
 */
router.post('/database-backup/restore-specific', verifyAdminToken, async (req, res) => {
  try {
    const { confirmRestore, fileName } = req.body;

    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Restore confirmation required'
      });
    }

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Backup file name is required'
      });
    }

    console.log('[ADMIN] Database restore triggered by:', req.admin.username);
    console.log('[ADMIN] Restoring from specific backup:', fileName);
    console.log('[ADMIN] ⚠️  WARNING: This will delete all existing data!');

    const BACKUP_DIR = path.join(__dirname, '../backups');
    const backupPath = path.join(BACKUP_DIR, fileName);

    // Verify file exists
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }

    // Read and decompress backup
    const zlib = require('zlib');
    const { promisify } = require('util');
    const gunzip = promisify(zlib.gunzip);

    const compressedData = fs.readFileSync(backupPath);
    const jsonData = await gunzip(compressedData);

    // Parse backup data
    const backup = JSON.parse(jsonData.toString());

    // Convert string IDs to ObjectIds
    const { ObjectId } = require('mongodb');
    const convertStringIdsToObjectIds = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(item => convertStringIdsToObjectIds(item));
      if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if ((key === '_id' || key.endsWith('Id')) && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
            result[key] = new ObjectId(value);
          } else {
            result[key] = convertStringIdsToObjectIds(value);
          }
        }
        return result;
      }
      return obj;
    };

    const backupWithObjectIds = convertStringIdsToObjectIds(backup);

    // Debug: Verify ObjectId conversion
    if (backupWithObjectIds.data.users && backupWithObjectIds.data.users[0]) {
      const firstUser = backupWithObjectIds.data.users[0];
      console.log('[ADMIN] DEBUG - First user _id type:', typeof firstUser._id);
      console.log('[ADMIN] DEBUG - First user _id instanceof ObjectId:', firstUser._id instanceof ObjectId);
      console.log('[ADMIN] DEBUG - First user _id value:', firstUser._id);
    }

    console.log('[ADMIN] Backup metadata:', backupWithObjectIds.metadata);

    let restoredCollections = 0;
    let restoredDocuments = 0;
    const startTime = Date.now();

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backupWithObjectIds.data)) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);

        if (documents.length > 0) {
          // Delete existing documents
          await collection.deleteMany({});

          // Insert backup documents with proper ObjectIds
          await collection.insertMany(documents);

          restoredCollections++;
          restoredDocuments += documents.length;

          console.log(`[ADMIN] ✓ Restored ${documents.length} documents to ${collectionName}`);
        }
      } catch (error) {
        console.error(`[ADMIN] ✗ Error restoring ${collectionName}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;

    console.log('[ADMIN] ✅ Restore completed successfully!');
    console.log(`[ADMIN] Collections: ${restoredCollections}, Documents: ${restoredDocuments}`);

    res.json({
      success: true,
      message: 'Database restored successfully',
      restore: {
        fileName: fileName,
        backupDate: backup.metadata.timestamp,
        collections: restoredCollections,
        documents: restoredDocuments,
        duration: `${duration}ms`,
        restoredBy: req.admin.username,
        restoredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ADMIN] Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring database',
      error: error.message
    });
  }
});

module.exports = router;
