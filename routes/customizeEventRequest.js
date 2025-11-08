const express = require('express');
const router = express.Router();
const CustomizeEventRequest = require('../models/CustomizeEventRequest');
const PaymentActivity = require('../models/PaymentActivity');
const User = require('../models/User');
const { HSCConfig, HSCTransaction } = require('../models/HSC');
const { verifyToken, verifyEmailVerified, verifyAdminToken } = require('../middleware/auth');
const { sendCustomizeEventPartnerNotification } = require('../utils/emailService');

// Submit customize event request
router.post('/submit', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      fullName,
      email,
      contactNumber,
      eventType,
      eventTypeOther,
      numberOfGuests,
      estimatedBudget,
      activities,
      specialRequests
    } = req.body;

    // Validation
    if (!fullName || !email || !contactNumber || !eventType || !numberOfGuests || !estimatedBudget) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (eventType === 'other' && !eventTypeOther) {
      return res.status(400).json({ message: 'Please specify event type when selecting "Other"' });
    }

    // Get HSC configuration for charge
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const customizeEventRequestCharge = hscConfig?.customizeEventRequestCharge || 100;

    // Check user's HSC balance
    const user = await User.findById(req.user._id);
    if (user.hscBalance < customizeEventRequestCharge) {
      return res.status(400).json({ 
        message: `Insufficient HSC balance. Required: ${customizeEventRequestCharge} HSC, Available: ${user.hscBalance} HSC`,
        required: customizeEventRequestCharge,
        available: user.hscBalance
      });
    }

    // Deduct HSC from user's balance
    const balanceBefore = user.hscBalance;
    user.hscBalance -= customizeEventRequestCharge;
    await user.save();

    // Create HSC transaction record
    const hscTransaction = new HSCTransaction({
      userId: req.user._id,
      tokenType: 'HSC',
      type: 'spend',
      amount: customizeEventRequestCharge,
      description: 'Customize Event Request Submission',
      balanceBefore,
      balanceAfter: user.hscBalance,
      paymentDetails: {
        paymentStatus: 'completed'
      }
    });
    await hscTransaction.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: req.user._id,
      buyerEmail: user.email,
      item: 'Customize Event Request',
      quantity: 1,
      category: 'Customize Event Request',
      originalAmount: customizeEventRequestCharge,
      amount: customizeEventRequestCharge,
      discountedAmount: 0,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create customize event request
    const eventRequest = new CustomizeEventRequest({
      userId: req.user._id,
      fullName,
      email,
      contactNumber,
      eventType,
      eventTypeOther: eventType === 'other' ? eventTypeOther : undefined,
      numberOfGuests,
      estimatedBudget,
      activities: activities || [],
      specialRequests,
      hscCharge: customizeEventRequestCharge,
      paymentStatus: 'completed',
      paymentActivityId: paymentActivity._id
    });

    await eventRequest.save();

    res.status(201).json({
      success: true,
      message: 'Customize event request submitted successfully',
      data: eventRequest,
      newBalance: user.hscBalance
    });

  } catch (error) {
    console.error('Submit customize event request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSC charge for customize event request
router.get('/charge', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const customizeEventRequestCharge = hscConfig?.customizeEventRequestCharge || 100;

    res.json({
      success: true,
      charge: customizeEventRequestCharge
    });

  } catch (error) {
    console.error('Get customize event request charge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's customize event requests
router.get('/my-requests', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = { userId: req.user._id };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await CustomizeEventRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomizeEventRequest.countDocuments(filter);

    // Get counts by status
    const statusCounts = await CustomizeEventRequest.aggregate([
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
    const request = await CustomizeEventRequest.findOne({
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

// ============ ADMIN ROUTES ============

// Get all customize event requests (Admin)
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

    const requests = await CustomizeEventRequest.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomizeEventRequest.countDocuments(filter);

    // Get counts by status
    const statusCounts = await CustomizeEventRequest.aggregate([
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
    const totalRequests = await CustomizeEventRequest.countDocuments();
    const pendingRequests = await CustomizeEventRequest.countDocuments({ status: 'pending' });
    const underReviewRequests = await CustomizeEventRequest.countDocuments({ status: 'under-review' });
    const approvedRequests = await CustomizeEventRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await CustomizeEventRequest.countDocuments({ status: 'rejected' });

    // Calculate total HSC collected
    const totalHSCCollected = await CustomizeEventRequest.aggregate([
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
        totalHSCCollected: totalHSCCollected.length > 0 ? totalHSCCollected[0].total : 0
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

    if (!['pending', 'under-review', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await CustomizeEventRequest.findById(req.params.id);
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

    res.json({
      success: true,
      message: 'Request status updated successfully',
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
    const request = await CustomizeEventRequest.findById(req.params.id)
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

// Get open requests for partners & members (status: show-partners-members)
router.get('/open-requests', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if user is a partner or member with valid expiration
    const isValidPartner = user.isPartner &&
      user.partnerExpirationDate &&
      new Date(user.partnerExpirationDate) > new Date();

    const isValidMember = user.isMember &&
      user.membershipExpirationDate &&
      new Date(user.membershipExpirationDate) > new Date();

    if (!isValidPartner && !isValidMember) {
      return res.status(403).json({
        message: 'Access denied. Only active partners and members can view open requests.'
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get requests with status 'show-partners-members'
    const requests = await CustomizeEventRequest.find({
      status: 'show-partners-members'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    const total = await CustomizeEventRequest.countDocuments({
      status: 'show-partners-members'
    });

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get open requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Partner/Member approve request
router.post('/approve-request/:id', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if user is a partner or member with valid expiration
    const isValidPartner = user.isPartner &&
      user.partnerExpirationDate &&
      new Date(user.partnerExpirationDate) > new Date();

    const isValidMember = user.isMember &&
      user.membershipExpirationDate &&
      new Date(user.membershipExpirationDate) > new Date();

    if (!isValidPartner && !isValidMember) {
      return res.status(403).json({
        message: 'Access denied. Only active partners and members can approve requests.'
      });
    }

    const request = await CustomizeEventRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'show-partners-members') {
      return res.status(400).json({
        message: 'This request is not available for partner/member approval'
      });
    }

    // Update request with partner/member approval
    request.status = 'open-acceptance';
    request.partnerApprovedBy = user._id;
    request.partnerApprovedEmail = user.email;
    request.partnerApprovedAt = new Date();

    // Update admin note with approver info
    const approverType = isValidPartner ? 'Partner' : 'Member';
    const existingNote = request.adminNote || '';
    request.adminNote = existingNote
      ? `${existingNote}\n\nApproved by ${approverType}: ${user.email} (Status: Open Acceptance)`
      : `Approved by ${approverType}: ${user.email} (Status: Open Acceptance)`;

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

// Admin route to update status to show-partners-members and notify all partners & members
router.put('/admin/request/:id/show-partners', verifyAdminToken, async (req, res) => {
  try {
    const request = await CustomizeEventRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Update status
    request.status = 'show-partners-members';
    request.processedBy = req.admin.email;
    request.processedAt = new Date();

    if (req.body.adminNote) {
      request.adminNote = req.body.adminNote;
    }

    await request.save();

    // Get all active partners and members
    const now = new Date();
    const partnersAndMembers = await User.find({
      $or: [
        {
          isPartner: true,
          partnerExpirationDate: { $gt: now }
        },
        {
          isMember: true,
          membershipExpirationDate: { $gt: now }
        }
      ],
      isActive: true
    }).select('email name');

    // Send email notifications to all partners & members
    const emailPromises = partnersAndMembers.map(user =>
      sendCustomizeEventPartnerNotification(user.email, user.name)
    );

    await Promise.allSettled(emailPromises);

    res.json({
      success: true,
      message: `Request status updated and ${partnersAndMembers.length} notifications sent`,
      data: request,
      notificationsSent: partnersAndMembers.length
    });

  } catch (error) {
    console.error('Admin show partners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

