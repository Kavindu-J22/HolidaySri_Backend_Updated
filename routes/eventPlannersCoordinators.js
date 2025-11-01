const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const EventPlannersCoordinators = require('../models/EventPlannersCoordinators');
const Advertisement = require('../models/Advertisement');
const moment = require('moment-timezone');

// Provinces and districts mapping for Sri Lanka
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

// POST /api/event-planners-coordinators/publish - Create event planner profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      email,
      facebook,
      website,
      available,
      weekdayAvailability,
      weekendAvailability,
      avatar,
      packages
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !Array.isArray(specialization) || 
        specialization.length === 0 || !category || !description || experience === undefined || 
        !city || !province || !contact || !email || !avatar || !avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate contact number
    const contactRegex = /^[\d\s\-\+\(\)]{7,}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid contact number'
      });
    }

    // Fetch advertisement to get plan details
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Create event planner profile
    const eventPlanner = new EventPlannersCoordinators({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      email,
      facebook: facebook || null,
      website: website || null,
      available: available !== undefined ? available : true,
      weekdayAvailability: weekdayAvailability || '',
      weekendAvailability: weekendAvailability || '',
      avatar: {
        url: avatar.url,
        publicId: avatar.publicId
      },
      packages: packages ? {
        url: packages.url,
        publicId: packages.publicId,
        fileName: packages.fileName
      } : null
    });

    await eventPlanner.save();

    // Calculate expiration date based on Sri Lankan timezone
    const now = moment().tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = now.clone().add(advertisement.planDuration.hours || 1, 'hours');
        break;
      case 'daily':
        expirationTime = now.clone().add(advertisement.planDuration.days || 1, 'days');
        break;
      case 'monthly':
        expirationTime = now.clone().add(30, 'days');
        break;
      case 'yearly':
        expirationTime = now.clone().add(365, 'days');
        break;
      default:
        expirationTime = now.clone().add(1, 'day');
    }

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAdId = eventPlanner._id;
    advertisement.publishedAdModel = 'EventPlannersCoordinators';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Event planner profile published successfully!',
      data: {
        eventPlanner: {
          _id: eventPlanner._id,
          name: eventPlanner.name,
          province: eventPlanner.province,
          city: eventPlanner.city,
          publishedAt: eventPlanner.publishedAt
        },
        advertisement: {
          _id: advertisement._id,
          slotId: advertisement.slotId,
          status: advertisement.status,
          publishedAt: advertisement.publishedAt,
          expiresAt: advertisement.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('Error publishing event planner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/event-planners-coordinators/provinces - Get provinces and districts
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

module.exports = router;

