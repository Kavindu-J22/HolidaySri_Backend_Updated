const express = require('express');
const router = express.Router();
const CustomizeTourPackage = require('../models/CustomizeTourPackage');
const PaymentActivity = require('../models/PaymentActivity');
const User = require('../models/User');
const { HSCConfig } = require('../models/HSC');
const { CommercialPartner } = require('../models/CommercialPartner');
const { verifyToken, verifyEmailVerified, verifyAdminToken } = require('../middleware/auth');
const { sendCustomizeTourPartnerNotification } = require('../utils/emailService');

// Submit customize tour package request
router.post('/submit', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      fullName,
      email,
      contactNumber,
      startDate,
      numberOfTravelers,
      duration,
      accommodation,
      accommodationOther,
      activities,
      specialRequests
    } = req.body;

    // Validation
    if (!fullName || !email || !contactNumber || !startDate || !numberOfTravelers || !duration || !accommodation) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (accommodation === 'other' && !accommodationOther) {
      return res.status(400).json({ message: 'Please specify accommodation type when selecting "Other"' });
    }

    // Get HSC configuration for charge
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const customizeTourPackageCharge = hscConfig?.customizeTourPackageCharge || 100;

    // Check user's HSC balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < customizeTourPackageCharge) {
      return res.status(400).json({ 
        message: `Insufficient HSC balance. Required: ${customizeTourPackageCharge} HSC, Available: ${user.hscBalance} HSC`,
        required: customizeTourPackageCharge,
        available: user.hscBalance
      });
    }

    // Deduct HSC from user's balance
    const balanceBefore = user.hscBalance;
    user.hscBalance -= customizeTourPackageCharge;
    await user.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: 'Customize Tour Package Request',
      quantity: 1,
      category: 'Customize Tour Package',
      originalAmount: customizeTourPackageCharge,
      amount: customizeTourPackageCharge,
      discountedAmount: 0,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create customize tour package request
    const customizeRequest = new CustomizeTourPackage({
      userId: req.user._id,
      fullName,
      email,
      contactNumber,
      startDate,
      numberOfTravelers,
      duration,
      accommodation,
      accommodationOther: accommodation === 'other' ? accommodationOther : undefined,
      activities: activities || [],
      specialRequests,
      hscCharge: customizeTourPackageCharge,
      paymentStatus: 'completed',
      paymentActivityId: paymentActivity._id
    });

    await customizeRequest.save();

    res.status(201).json({
      success: true,
      message: 'Customize tour package request submitted successfully',
      data: customizeRequest,
      newBalance: user.hscBalance
    });

  } catch (error) {
    console.error('Submit customize tour package error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's customize tour package requests
router.get('/my-requests', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = { userId: req.user._id };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await CustomizeTourPackage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomizeTourPackage.countDocuments(filter);

    // Get counts by status
    const statusCounts = await CustomizeTourPackage.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      all: total,
      pending: 0,
      'under-review': 0,
      approved: 0,
      rejected: 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      counts
    });

  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single request details
router.get('/request/:id', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const request = await CustomizeTourPackage.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get request details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current HSC charge for customize tour package
router.get('/charge', async (req, res) => {
  try {
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const charge = hscConfig?.customizeTourPackageCharge || 100;

    res.json({
      success: true,
      charge
    });

  } catch (error) {
    console.error('Get charge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ ADMIN ROUTES ============

// Get all customize tour package requests (Admin)
router.get('/admin/requests', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const requests = await CustomizeTourPackage.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomizeTourPackage.countDocuments(filter);

    // Get counts by status
    const statusCounts = await CustomizeTourPackage.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      all: total,
      pending: 0,
      'under-review': 0,
      approved: 0,
      rejected: 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      counts
    });

  } catch (error) {
    console.error('Admin get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get request statistics (Admin)
router.get('/admin/stats', verifyAdminToken, async (req, res) => {
  try {
    const totalRequests = await CustomizeTourPackage.countDocuments();
    const pendingRequests = await CustomizeTourPackage.countDocuments({ status: 'pending' });
    const underReviewRequests = await CustomizeTourPackage.countDocuments({ status: 'under-review' });
    const approvedRequests = await CustomizeTourPackage.countDocuments({ status: 'approved' });
    const rejectedRequests = await CustomizeTourPackage.countDocuments({ status: 'rejected' });

    // Calculate total HSC collected
    const totalHSCCollected = await CustomizeTourPackage.aggregate([
      { $group: { _id: null, total: { $sum: '$hscCharge' } } }
    ]);

    res.json({
      success: true,
      stats: {
        total: totalRequests,
        pending: pendingRequests,
        underReview: underReviewRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        totalHSCCollected: totalHSCCollected[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status (Admin)
router.put('/admin/request/:id/status', verifyAdminToken, async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['pending', 'under-review', 'approved', 'rejected', 'show-partners'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await CustomizeTourPackage.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = status;
    if (adminNote) {
      request.adminNote = adminNote;
    }
    request.processedBy = req.admin.username;
    request.processedAt = new Date();

    await request.save();

    // If status is changed to 'show-partners', send email to all commercial partners
    if (status === 'show-partners') {
      try {
        // Get all active commercial partners
        const activePartners = await CommercialPartner.find({
          status: 'active',
          isActive: true
        }).populate('userId', 'email name');

        // Send email to each partner
        const emailPromises = activePartners.map(partner => {
          if (partner.userId && partner.userId.email) {
            return sendCustomizeTourPartnerNotification(
              partner.userId.email,
              partner.userId.name
            );
          }
          return Promise.resolve();
        });

        await Promise.all(emailPromises);
        console.log(`Sent notification emails to ${activePartners.length} commercial partners`);
      } catch (emailError) {
        console.error('Error sending partner notification emails:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    res.json({
      success: true,
      message: `Request ${status} successfully`,
      data: request
    });

  } catch (error) {
    console.error('Admin update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single request details (Admin)
router.get('/admin/request/:id', verifyAdminToken, async (req, res) => {
  try {
    const request = await CustomizeTourPackage.findById(req.params.id)
      .populate('userId', 'name email contactNumber');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Admin get request details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ PARTNER ROUTES ============

// Get partner requests (requests with status 'show-partners')
router.get('/partner/requests', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    // Check if user is a partner
    const user = await User.findById(req.user._id);
    if (!user.isPartner || !user.partnerExpirationDate || new Date(user.partnerExpirationDate) < new Date()) {
      return res.status(403).json({ message: 'Access denied. Active commercial partnership required.' });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get requests with status 'show-partners'
    const requests = await CustomizeTourPackage.find({ status: 'show-partners' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomizeTourPackage.countDocuments({ status: 'show-partners' });

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get partner requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get partner request count
router.get('/partner/requests/count', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    // Check if user is a partner
    const user = await User.findById(req.user._id);
    if (!user.isPartner || !user.partnerExpirationDate || new Date(user.partnerExpirationDate) < new Date()) {
      return res.status(403).json({ message: 'Access denied. Active commercial partnership required.' });
    }

    const count = await CustomizeTourPackage.countDocuments({ status: 'show-partners' });

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('Get partner request count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve partner request
router.put('/partner/request/:id/approve', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    // Check if user is a partner
    const user = await User.findById(req.user._id);
    if (!user.isPartner || !user.partnerExpirationDate || new Date(user.partnerExpirationDate) < new Date()) {
      return res.status(403).json({ message: 'Access denied. Active commercial partnership required.' });
    }

    const request = await CustomizeTourPackage.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'show-partners') {
      return res.status(400).json({ message: 'This request is not available for partner approval' });
    }

    // Update request with partner approval
    request.partnerApprovedBy = req.user._id;
    request.partnerApprovedAt = new Date();
    request.partnerEmail = user.email;
    request.status = 'partner-approved'; // Change status to partner-approved

    // Update admin note to include partner information
    const partnerNote = `\n\n[Partner Approved]\nPartner: ${user.name}\nEmail: ${user.email}\nApproved At: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;
    request.adminNote = (request.adminNote || '') + partnerNote;

    await request.save();

    res.json({
      success: true,
      message: 'Request approved successfully',
      data: request
    });

  } catch (error) {
    console.error('Partner approve request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

