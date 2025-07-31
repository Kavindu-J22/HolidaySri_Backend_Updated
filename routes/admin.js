const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const { MembershipConfig, MembershipTransaction } = require('../models/Membership');
const { CommercialPartnerConfig, CommercialPartner } = require('../models/CommercialPartner');
const Advertisement = require('../models/Advertisement');
const AdvertisementSlotCharges = require('../models/AdvertisementSlotCharges');
const ClaimRequest = require('../models/ClaimRequest');
const Earning = require('../models/Earning');
const { verifyAdmin, verifyAdminToken } = require('../middleware/auth');
const { checkExpiredMemberships, checkExpiringMemberships } = require('../jobs/membershipExpiration');

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

    // Get advertisement statistics
    const totalAds = await Advertisement.countDocuments();
    const activeAds = await Advertisement.countDocuments({ status: 'active' });
    const pendingAds = await Advertisement.countDocuments({ status: 'draft' });

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

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        newToday: newUsersToday
      },
      advertisements: {
        total: totalAds,
        active: activeAds,
        pending: pendingAds
      },
      hsc: {
        currentValue: hscConfig ? hscConfig.hscValue : 100,
        currency: hscConfig ? hscConfig.currency : 'LKR',
        totalTransactions: totalHSCTransactions,
        totalPurchased: totalHSCPurchased[0]?.total || 0,
        totalSpent: totalHSCSpent[0]?.total || 0
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
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    
    if (!hscConfig) {
      return res.json({
        hscValue: 100,
        hsgValue: 1,
        hsdValue: 1,
        currency: 'LKR',
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
    const { hscValue, hsgValue, hsdValue, currency = 'LKR' } = req.body;

    // Get current config to preserve existing values
    const currentConfig = await HSCConfig.findOne().sort({ createdAt: -1 });

    const newConfig = new HSCConfig({
      hscValue: hscValue || (currentConfig ? currentConfig.hscValue : 100),
      hsgValue: hsgValue || (currentConfig ? currentConfig.hsgValue : 1),
      hsdValue: hsdValue || (currentConfig ? currentConfig.hsdValue : 1),
      currency,
      updatedBy: req.admin.username
    });

    await newConfig.save();

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
    const { name, hscAmount, discount = 0, description, features } = req.body;

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
    const { name, hscAmount, discount, description, features, isActive } = req.body;

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

module.exports = router;
