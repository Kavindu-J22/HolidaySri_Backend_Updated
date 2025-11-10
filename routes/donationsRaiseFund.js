const express = require('express');
const router = express.Router();
const DonationsRaiseFund = require('../models/DonationsRaiseFund');
const Advertisement = require('../models/Advertisement');
const { verifyToken, verifyEmailVerified, verifyAdmin, verifyAdminToken } = require('../middleware/auth');
const moment = require('moment-timezone');
const { HSCConfig } = require('../models/HSC');

// Sri Lankan provinces and districts
const provincesAndDistricts = {
  "Western Province": ["Colombo", "Gampaha", "Kalutara"],
  "Central Province": ["Kandy", "Matale", "Nuwara Eliya"],
  "Southern Province": ["Galle", "Matara", "Hambantota"],
  "Northern Province": ["Jaffna", "Mannar", "Vavuniya", "Kilinochchi", "Mullaitivu"],
  "Eastern Province": ["Batticaloa", "Ampara", "Trincomalee"],
  "North Western Province": ["Kurunegala", "Puttalam"],
  "North Central Province": ["Anuradhapura", "Polonnaruwa"],
  "Uva Province": ["Badulla", "Monaragala"],
  "Sabaragamuwa Province": ["Kegalle", "Ratnapura"]
};

// GET /api/donations-raise-fund/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  try {
    res.json({
      success: true,
      data: provincesAndDistricts
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces'
    });
  }
});

// GET /api/donations-raise-fund/current-hsc-value - Get current HSC value
router.get('/current-hsc-value', async (req, res) => {
  try {
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;

    res.json({
      success: true,
      data: {
        hscValue,
        currency: hscConfig ? hscConfig.currency : 'LKR'
      }
    });
  } catch (error) {
    console.error('Error fetching HSC value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HSC value'
    });
  }
});

// POST /api/donations-raise-fund/publish - Publish donation/fundraising campaign
router.post('/publish', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      organizer,
      images,
      category,
      province,
      city,
      address,
      description,
      email,
      contact,
      requestedAmountLKR,
      requestedAmountHSC
    } = req.body;

    // Validate required fields
    if (!advertisementId || !title || !organizer || !images || images.length === 0 ||
        !category || !province || !city || !address || !description || 
        !email || !contact || !requestedAmountLKR || !requestedAmountHSC) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count (max 4)
    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province and city combination'
      });
    }

    // Find the advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify ownership
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this advertisement'
      });
    }

    // Verify category
    if (advertisement.category !== 'donations_raise_fund') {
      return res.status(400).json({
        success: false,
        message: 'This advertisement is not for donations/fundraising'
      });
    }

    // Check if already published
    if (advertisement.status === 'Published' && advertisement.publishedAdId) {
      return res.status(400).json({
        success: false,
        message: 'This advertisement has already been published'
      });
    }

    // Create donation/fundraising campaign
    const donationCampaign = new DonationsRaiseFund({
      userId: req.user._id,
      publishedAdId: advertisement._id,
      title,
      organizer,
      images,
      category,
      province,
      city,
      address,
      description,
      email,
      contact,
      requestedAmountLKR,
      requestedAmountHSC
    });

    await donationCampaign.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const sriLankanNow = moment.tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = (advertisement.planDuration.hours || 1) * 60 * 60 * 1000;
        break;
      case 'daily':
        expirationTime = (advertisement.planDuration.days || 1) * 24 * 60 * 60 * 1000;
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

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = donationCampaign._id;
    advertisement.publishedAdModel = 'DonationsRaiseFund';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Donation/Fundraising campaign published successfully',
      data: {
        donationCampaign,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing donation campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish donation campaign. Please try again.'
    });
  }
});

// GET /api/donations-raise-fund - Browse all active donation campaigns
router.get('/', async (req, res) => {
  try {
    const { category, province, city, page = 1, limit = 12 } = req.query;

    let query = { isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (province && province !== 'all') {
      query.province = province;
    }

    if (city && city !== 'all') {
      query.city = city;
    }

    const campaigns = await DonationsRaiseFund.find(query)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'userId status expiresAt')
      .sort({ publishedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DonationsRaiseFund.countDocuments(query);

    res.json({
      success: true,
      data: campaigns,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching donation campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation campaigns'
    });
  }
});

// GET /api/donations-raise-fund/:id - Get single donation campaign
router.get('/:id', async (req, res) => {
  try {
    const campaign = await DonationsRaiseFund.findById(req.params.id)
      .populate('userId', 'name email profileImage')
      .populate('publishedAdId', 'userId status expiresAt');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Donation campaign not found'
      });
    }

    // Increment view count
    await campaign.incrementViewCount();

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error fetching donation campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation campaign'
    });
  }
});

// PUT /api/donations-raise-fund/:id - Update donation campaign
router.put('/:id', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      title,
      organizer,
      images,
      category,
      province,
      city,
      address,
      description,
      email,
      contact,
      requestedAmountLKR,
      requestedAmountHSC
    } = req.body;

    // Find the campaign
    const campaign = await DonationsRaiseFund.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Donation campaign not found'
      });
    }

    // Verify ownership
    if (campaign.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this campaign'
      });
    }

    // Validate images count (max 4)
    if (images && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Validate province and city combination
    if (province && city) {
      if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid province and city combination'
        });
      }
    }

    // Update fields
    if (title) campaign.title = title;
    if (organizer) campaign.organizer = organizer;
    if (images) campaign.images = images;
    if (category) campaign.category = category;
    if (province) campaign.province = province;
    if (city) campaign.city = city;
    if (address) campaign.address = address;
    if (description) campaign.description = description;
    if (email) campaign.email = email;
    if (contact) campaign.contact = contact;
    if (requestedAmountLKR) campaign.requestedAmountLKR = requestedAmountLKR;
    if (requestedAmountHSC) campaign.requestedAmountHSC = requestedAmountHSC;

    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: campaign
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campaign'
    });
  }
});

// POST /api/donations-raise-fund/:id/rating - Add rating and review
router.post('/:id/rating', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { rating, review } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!review || review.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Review is required'
      });
    }

    // Find the campaign
    const campaign = await DonationsRaiseFund.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Donation campaign not found'
      });
    }

    // Check if user already rated
    const existingRating = campaign.ratings.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this campaign'
      });
    }

    // Add new rating
    campaign.ratings.push({
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      rating,
      review
    });

    // Calculate new average rating
    const totalRatings = campaign.ratings.length;
    const sumRatings = campaign.ratings.reduce((sum, r) => sum + r.rating, 0);
    campaign.averageRating = sumRatings / totalRatings;
    campaign.totalRatings = totalRatings;

    await campaign.save();

    res.json({
      success: true,
      message: 'Rating added successfully',
      data: {
        averageRating: campaign.averageRating,
        totalRatings: campaign.totalRatings
      }
    });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add rating'
    });
  }
});

// POST /api/donations-raise-fund/:id/transfer-fund - Transfer HSC funds to campaign
router.post('/:id/transfer-fund', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { amountHSC, comment } = req.body;
    const User = require('../models/User');
    const PaymentActivity = require('../models/PaymentActivity');

    // Validate input
    if (!amountHSC || amountHSC <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transfer amount'
      });
    }

    // Get campaign
    const campaign = await DonationsRaiseFund.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has sufficient balance
    if (user.hscBalance < amountHSC) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient HSC balance',
        currentBalance: user.hscBalance,
        requiredAmount: amountHSC
      });
    }

    // Get current HSC value for LKR conversion
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const hscValue = hscConfig ? hscConfig.hscValue : 100;
    const amountLKR = amountHSC * hscValue;

    // Deduct HSC from user balance
    user.hscBalance -= amountHSC;
    await user.save();

    // Create payment activity record
    const paymentActivity = new PaymentActivity({
      userId: user._id,
      buyerEmail: user.email,
      item: `Donation to: ${campaign.title}`,
      quantity: 1,
      category: 'Donation Transfer',
      originalAmount: amountHSC,
      amount: amountHSC,
      discountedAmount: 0,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Add fund transfer to campaign
    campaign.fundTransfers.push({
      userId: user._id,
      userName: user.name,
      amountHSC,
      amountLKR,
      comment: comment || '',
      createdAt: new Date()
    });

    // Update campaign totals
    campaign.donationCount += 1;
    campaign.totalDonatedHSC += amountHSC;
    campaign.totalDonatedLKR += amountLKR;

    await campaign.save();

    res.json({
      success: true,
      message: 'Fund transfer successful',
      data: {
        transactionId: paymentActivity.transactionId,
        amountHSC,
        amountLKR,
        newBalance: user.hscBalance,
        campaignTotalRaised: campaign.totalDonatedHSC
      }
    });

  } catch (error) {
    console.error('Error transferring funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer funds'
    });
  }
});

// POST /api/donations-raise-fund/:id/request-withdrawal - Request withdrawal (campaign owner only)
router.post('/:id/request-withdrawal', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const campaign = await DonationsRaiseFund.findById(req.params.id)
      .populate('publishedAdId');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check if user is the campaign owner
    if (!campaign.publishedAdId || campaign.publishedAdId.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only campaign owner can request withdrawal'
      });
    }

    // Check if goal is reached
    if (campaign.totalDonatedHSC < campaign.requestedAmountHSC) {
      return res.status(400).json({
        success: false,
        message: 'Goal not reached yet',
        raised: campaign.totalDonatedHSC,
        goal: campaign.requestedAmountHSC
      });
    }

    // Check if already requested
    if (campaign.withdrawalRequest.status !== 'none') {
      return res.status(400).json({
        success: false,
        message: `Withdrawal request already ${campaign.withdrawalRequest.status}`
      });
    }

    // Create withdrawal request
    campaign.withdrawalRequest = {
      status: 'pending',
      requestedAt: new Date(),
      adminNote: '',
      processedAt: null,
      processedBy: null
    };

    await campaign.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        status: 'pending',
        requestedAt: campaign.withdrawalRequest.requestedAt
      }
    });

  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request withdrawal'
    });
  }
});

// ADMIN ROUTES

// GET /api/donations-raise-fund/admin/withdrawal-requests - Get all withdrawal requests (admin only)
router.get('/admin/withdrawal-requests', verifyAdminToken, async (req, res) => {
  try {
    const campaigns = await DonationsRaiseFund.find({
      'withdrawalRequest.status': { $in: ['pending', 'approved', 'rejected'] }
    })
      .populate('publishedAdId')
      .populate('withdrawalRequest.processedBy', 'name email')
      .sort({ 'withdrawalRequest.requestedAt': -1 });

    res.json({
      success: true,
      data: campaigns
    });

  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal requests'
    });
  }
});

// PUT /api/donations-raise-fund/admin/withdrawal-requests/:id - Approve/Reject withdrawal request (admin only)
router.put('/admin/withdrawal-requests/:id', verifyAdminToken, async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    const campaign = await DonationsRaiseFund.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.withdrawalRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This withdrawal request has already been processed'
      });
    }

    // Update withdrawal request
    campaign.withdrawalRequest.status = status;
    campaign.withdrawalRequest.adminNote = adminNote || '';
    campaign.withdrawalRequest.processedAt = new Date();
    // Note: Admin token doesn't have user._id, so we'll store admin username instead
    campaign.withdrawalRequest.processedBy = null; // Admin doesn't have a user ID

    await campaign.save();

    res.json({
      success: true,
      message: `Withdrawal request ${status}`,
      data: campaign
    });

  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request'
    });
  }
});

module.exports = router;

