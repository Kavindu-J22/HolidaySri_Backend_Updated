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

      const emailContent = `
        <h2>Claim Request Approved</h2>
        <p>Dear ${claimRequest.userId.name},</p>
        <p>Your earning claim request has been approved and processed.</p>
        <p><strong>Total Amount:</strong> ${claimRequest.totalAmount.toLocaleString()} LKR</p>
        <p><strong>Earnings Count:</strong> ${claimRequest.earningIds.length}</p>
        ${adminNote ? `<p><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
        <p>The payment will be processed to your registered bank account or Binance ID within 3-5 business days.</p>
        <p>Thank you for using Holidaysri!</p>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: claimRequest.userId.email,
        subject: 'Claim Request Approved - Holidaysri',
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

module.exports = router;
