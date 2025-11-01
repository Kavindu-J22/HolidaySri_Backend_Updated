const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const VehicleRepairsMechanics = require('../models/VehicleRepairsMechanics');
const Advertisement = require('../models/Advertisement');

// Sri Lankan provinces and districts mapping
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

// POST /api/vehicle-repairs-mechanics/publish - Create vehicle repairs mechanics profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      facebook,
      website,
      availability,
      services,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !avatar || !avatar.url || !avatar.publicId ||
        !specialization || !category || !description || experience === undefined ||
        !city || !province || !contact || !images || images.length === 0 ||
        !availability || !services || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate province/city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province/city combination'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate services array
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service must be provided'
      });
    }

    // Validate images array
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image must be provided'
      });
    }

    // Get advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Create vehicle repairs mechanics profile
    const vehicleRepairsMechanic = new VehicleRepairsMechanics({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      location: {
        city,
        province
      },
      contact,
      available,
      facebook: facebook || null,
      website: website || null,
      availability,
      services,
      images
    });

    await vehicleRepairsMechanic.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const now = moment.tz('Asia/Colombo');
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
    advertisement.publishedAdId = vehicleRepairsMechanic._id;
    advertisement.publishedAdModel = 'VehicleRepairsMechanics';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Vehicle repairs mechanic profile published successfully!',
      data: {
        vehicleRepairsMechanic: {
          _id: vehicleRepairsMechanic._id,
          name: vehicleRepairsMechanic.name,
          specialization: vehicleRepairsMechanic.specialization,
          category: vehicleRepairsMechanic.category,
          location: vehicleRepairsMechanic.location,
          publishedAt: vehicleRepairsMechanic.publishedAt
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
    console.error('Error publishing vehicle repairs mechanic:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing vehicle repairs mechanic profile',
      error: error.message
    });
  }
});

// GET /api/vehicle-repairs-mechanics/provinces - Get provinces and districts
router.get('/provinces', async (req, res) => {
  try {
    res.json({
      success: true,
      data: provincesAndDistricts
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching provinces',
      error: error.message
    });
  }
});

module.exports = router;

