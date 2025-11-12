const express = require('express');
const mongoose = require('mongoose');
const TripRequest = require('../models/TripRequest');
const TravelBuddy = require('../models/TravelBuddy');
const User = require('../models/User');
const { HSCConfig, HSCTransaction } = require('../models/HSC');
const PaymentActivity = require('../models/PaymentActivity');
const { verifyToken } = require('../middleware/auth');
const { sendNewTripRequestNotification } = require('../utils/emailService');

const router = express.Router();

// POST /api/trip-requests - Create a new trip request
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      destinations,
      startLocation,
      endLocation,
      description,
      days,
      requiredBuddies,
      budgetPerPerson,
      wishToExplore,
      activities,
      startDate,
      endDate,
      accommodation,
      transport,
      whatsappGroupLink,
      organizerWhatsapp
    } = req.body;

    // Validate required fields
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one destination is required'
      });
    }

    if (!startLocation || !startLocation.name || !startLocation.mapLink) {
      return res.status(400).json({
        success: false,
        message: 'Start location with name and map link is required'
      });
    }

    if (!endLocation || !endLocation.name || !endLocation.mapLink) {
      return res.status(400).json({
        success: false,
        message: 'End location with name and map link is required'
      });
    }

    if (!description || !days || !requiredBuddies || !budgetPerPerson || 
        !activities || !Array.isArray(activities) || activities.length === 0 ||
        !startDate || !endDate || !accommodation || !transport || !organizerWhatsapp) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's active TravelBuddy advertisement
    const travelBuddy = await TravelBuddy.findOne({
      userId: req.user._id,
      isActive: true
    });

    if (!travelBuddy) {
      return res.status(400).json({
        success: false,
        message: 'You must have an active Travel Buddy profile to create trip requests'
      });
    }

    // Get HSC config for trip request charge
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const tripRequestCharge = hscConfig?.travelBuddyTripRequestCharge || 50;

    // Check user's HSC balance
    if (user.hscBalance < tripRequestCharge) {
      return res.status(400).json({
        success: false,
        message: `Insufficient HSC balance. Required: ${tripRequestCharge} HSC, Available: ${user.hscBalance} HSC`
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct HSC from user balance
      const balanceBefore = user.hscBalance;
      user.hscBalance -= tripRequestCharge;
      await user.save({ session });

      // Create HSC transaction record
      const hscTransaction = new HSCTransaction({
        userId: user._id,
        tokenType: 'HSC',
        type: 'spend',
        amount: tripRequestCharge,
        description: 'Travel Buddy Trip Request Submission',
        balanceBefore,
        balanceAfter: user.hscBalance,
        paymentDetails: {
          paymentStatus: 'completed'
        }
      });
      await hscTransaction.save({ session });

      // Create payment activity record
      const paymentActivity = new PaymentActivity({
        userId: user._id,
        buyerEmail: user.email,
        item: 'Travel Buddy Trip Request',
        quantity: 1,
        category: 'Access Fee',
        originalAmount: tripRequestCharge,
        amount: tripRequestCharge,
        discountedAmount: 0,
        paymentMethod: 'HSC',
        status: 'completed'
      });
      await paymentActivity.save({ session });

      // Create trip request
      const tripRequest = new TripRequest({
        organizerId: user._id,
        organizerTravelBuddyId: travelBuddy._id,
        organizerName: travelBuddy.userName,
        organizerEmail: user.email,
        organizerWhatsapp,
        organizerAvatar: travelBuddy.avatarImage?.url || user.profileImage || '',
        destinations,
        startLocation,
        endLocation,
        description,
        days,
        requiredBuddies,
        budgetPerPerson,
        wishToExplore: wishToExplore || [],
        activities,
        startDate: start,
        endDate: end,
        accommodation,
        transport,
        whatsappGroupLink: whatsappGroupLink || '',
        hscCharge: tripRequestCharge,
        paymentTransactionId: hscTransaction.transactionId
      });

      await tripRequest.save({ session });

      await session.commitTransaction();

      // Send email notifications to all active Travel Buddies (async, don't wait)
      setImmediate(async () => {
        try {
          // Get all active Travel Buddies except the organizer
          const allTravelBuddies = await TravelBuddy.find({
            isActive: true,
            userId: { $ne: user._id } // Exclude the organizer
          }).populate('userId', 'email name');

          console.log(`📧 Sending trip request notifications to ${allTravelBuddies.length} Travel Buddies...`);

          // Prepare trip request details for email
          const tripRequestDetails = {
            organizerName: tripRequest.organizerName,
            destinations: tripRequest.destinations,
            startDate: tripRequest.startDate,
            endDate: tripRequest.endDate,
            days: tripRequest.days,
            requiredBuddies: tripRequest.requiredBuddies,
            budgetPerPerson: tripRequest.budgetPerPerson,
            description: tripRequest.description
          };

          // Send emails to all Travel Buddies
          let successCount = 0;
          let failCount = 0;

          for (const buddy of allTravelBuddies) {
            if (buddy.userId && buddy.userId.email) {
              const emailResult = await sendNewTripRequestNotification(
                buddy.userId.email,
                buddy.userId.name || buddy.userName,
                tripRequestDetails
              );

              if (emailResult.success) {
                successCount++;
              } else {
                failCount++;
              }
            }
          }

          console.log(`✅ Trip request notifications sent: ${successCount} successful, ${failCount} failed`);
        } catch (emailError) {
          console.error('Error sending trip request notification emails:', emailError);
        }
      });

      res.status(201).json({
        success: true,
        message: 'Trip request created successfully',
        data: tripRequest
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Error creating trip request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create trip request'
    });
  }
});

// GET /api/trip-requests - Get all active trip requests (for Trip Requests tab)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { isActive: true };

    // Add search filter if provided
    if (search) {
      query.$or = [
        { destinations: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { activities: { $regex: search, $options: 'i' } }
      ];
    }

    // Get trip requests
    const tripRequests = await TripRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await TripRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        tripRequests,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error fetching trip requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trip requests'
    });
  }
});

// GET /api/trip-requests/my - Get user's own trip requests (for My Trip Requests tab)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const tripRequests = await TripRequest.find({
      organizerId: req.user._id,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await TripRequest.countDocuments({
      organizerId: req.user._id,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        tripRequests,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user trip requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your trip requests'
    });
  }
});

// DELETE /api/trip-requests/:id - Delete a trip request
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trip request ID'
      });
    }

    // Find and verify ownership
    const tripRequest = await TripRequest.findOne({
      _id: id,
      organizerId: req.user._id,
      isActive: true
    });

    if (!tripRequest) {
      return res.status(404).json({
        success: false,
        message: 'Trip request not found or you do not have permission to delete it'
      });
    }

    // Soft delete by setting isActive to false
    tripRequest.isActive = false;
    await tripRequest.save();

    res.json({
      success: true,
      message: 'Trip request deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting trip request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trip request'
    });
  }
});

// GET /api/trip-requests/charge - Get current trip request charge
router.get('/charge', async (req, res) => {
  try {
    const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
    const tripRequestCharge = hscConfig?.travelBuddyTripRequestCharge || 50;

    res.json({
      success: true,
      data: {
        charge: tripRequestCharge
      }
    });

  } catch (error) {
    console.error('Error fetching trip request charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trip request charge'
    });
  }
});

module.exports = router;

