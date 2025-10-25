const express = require('express');
const mongoose = require('mongoose');
const LocalTourPackage = require('../models/LocalTourPackage');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

const router = express.Router();

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

// POST /api/local-tour-package/publish - Publish local tour package
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      categoryType,
      adventureType,
      location,
      description,
      images,
      pax,
      availableDates,
      includes,
      price,
      provider,
      facebook,
      website
    } = req.body;

    // Validate advertisement ID
    if (!mongoose.isValidObjectId(advertisementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID'
      });
    }

    // Find and verify advertisement ownership
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'local_tour_packages'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or you do not have permission to publish it'
      });
    }

    // Validate required fields
    if (!title || !adventureType || !location || !description || !images || !pax || !availableDates || !price || !provider) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate location
    if (!location.province || !location.city) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data'
      });
    }

    if (!provincesAndDistricts[location.province]?.includes(location.city)) {
      return res.status(400).json({
        success: false,
        message: 'City must be valid for the selected province'
      });
    }

    // Validate images (must have at least 1, max 4)
    if (!Array.isArray(images) || images.length === 0 || images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 4 images'
      });
    }

    // Validate pax
    if (!pax.min || !pax.max || pax.min < 1 || pax.max < pax.min) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pax range'
      });
    }

    // Validate price
    if (!price.amount || price.amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price'
      });
    }

    // Validate provider
    if (!provider.name || !provider.email || !provider.phone) {
      return res.status(400).json({
        success: false,
        message: 'Provider information is incomplete'
      });
    }

    // Create LocalTourPackage document
    const localTourPackage = new LocalTourPackage({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      categoryType: 'local_tour_packages',
      adventureType,
      location,
      description,
      images,
      pax,
      availableDates: availableDates.map(date => new Date(date)),
      includes: includes || [],
      price,
      provider,
      facebook: facebook || null,
      website: website || null
    });

    await localTourPackage.save();

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
    advertisement.publishedAdId = localTourPackage._id;
    advertisement.publishedAdModel = 'LocalTourPackage';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Local tour package published successfully!',
      data: {
        localTourPackage: {
          _id: localTourPackage._id,
          title: localTourPackage.title,
          adventureType: localTourPackage.adventureType,
          location: localTourPackage.location,
          publishedAt: localTourPackage.publishedAt
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
    console.error('Error publishing local tour package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish local tour package',
      error: error.message
    });
  }
});

// GET /api/local-tour-package/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

module.exports = router;

