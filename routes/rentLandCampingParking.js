const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const RentLandCampingParking = require('../models/RentLandCampingParking');
const Advertisement = require('../models/Advertisement');

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

// POST /api/rent-land-camping-parking/publish - Create rent land camping parking profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      description,
      category,
      images,
      province,
      city,
      nearby,
      activities,
      includes,
      contact,
      website,
      facebook,
      available,
      price,
      weekendPrice,
      availability,
      mapLink
    } = req.body;

    // Validate required fields
    if (!advertisementId || !title || !description || !category || !province || !city || 
        !contact || !images || images.length === 0 || price === undefined || 
        weekendPrice === undefined || !availability) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count
    if (images.length < 1 || images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 4 images'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province selected'
      });
    }

    if (!provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for the selected province'
      });
    }

    // Validate contact number format
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact number format'
      });
    }

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
      category: 'rent_land_camping_parking'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    // Create RentLandCampingParking document
    const rentLandCampingParking = new RentLandCampingParking({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      description,
      category,
      images,
      location: {
        province,
        city
      },
      nearby: nearby || [],
      activities: activities || [],
      includes: includes || [],
      contact,
      website: website || null,
      facebook: facebook || null,
      available: available !== undefined ? available : true,
      price,
      weekendPrice,
      availability,
      mapLink: mapLink || null
    });

    await rentLandCampingParking.save();

    // Calculate expiration date based on advertisement plan
    const now = moment.tz('Asia/Colombo');
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

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = new Date(now.toDate().getTime() + expirationTime);
    advertisement.publishedAdId = rentLandCampingParking._id;
    advertisement.publishedAdModel = 'RentLandCampingParking';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Rent Land Camping Parking published successfully!',
      data: {
        rentLandCampingParking: {
          _id: rentLandCampingParking._id,
          title: rentLandCampingParking.title,
          province: rentLandCampingParking.location.province,
          city: rentLandCampingParking.location.city,
          publishedAt: rentLandCampingParking.publishedAt
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
    console.error('Error publishing rent land camping parking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish rent land camping parking',
      error: error.message
    });
  }
});

// GET /api/rent-land-camping-parking/provinces - Get provinces and districts
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
      message: 'Failed to fetch provinces',
      error: error.message
    });
  }
});

module.exports = router;

