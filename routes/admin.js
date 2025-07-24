const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HSCConfig, HSCTransaction, HSCPackage } = require('../models/HSC');
const Advertisement = require('../models/Advertisement');
const ClaimRequest = require('../models/ClaimRequest');
const Earning = require('../models/Earning');
const { verifyAdmin, verifyAdminToken } = require('../middleware/auth');

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

    console.log('Admin fetching HSC earned claims with params:', { status, page, limit, search });

    // Test if model exists and can query
    const allClaims = await HSCEarnedClaimRequest.find({});
    console.log(`Total HSC earned claims in database: ${allClaims.length}`);

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

    console.log('HSC earned claims query:', query);

    // Get paginated results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const claimRequests = await HSCEarnedClaimRequest.find(query)
      .populate('userId', 'name email')
      .populate('hscEarnedIds')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HSCEarnedClaimRequest.countDocuments(query);

    console.log(`Found ${claimRequests.length} HSC earned claim requests out of ${total} total`);

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

// Test endpoint for HSC earned claims
router.get('/hsc-earned-claims/test', verifyAdminToken, async (req, res) => {
  try {
    const HSCEarnedClaimRequest = require('../models/HSCEarnedClaimRequest');

    console.log('Testing HSC earned claims model...');

    // Test basic query
    const allClaims = await HSCEarnedClaimRequest.find({});
    console.log(`Found ${allClaims.length} HSC earned claims in database`);

    // Test with populate
    const claimsWithPopulate = await HSCEarnedClaimRequest.find({})
      .populate('userId', 'name email')
      .populate('hscEarnedIds');
    console.log(`Found ${claimsWithPopulate.length} HSC earned claims with populate`);

    res.json({
      success: true,
      totalClaims: allClaims.length,
      claimsWithPopulate: claimsWithPopulate.length,
      sampleClaims: allClaims.slice(0, 2) // Return first 2 claims for inspection
    });

  } catch (error) {
    console.error('HSC earned claims test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
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
      .populate('hscEarnedIds');

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

module.exports = router;
