const express = require('express');
const mongoose = require('mongoose');
const TourGuider = require('../models/TourGuider');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

const router = express.Router();

// Province and District mapping for Sri Lanka
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

// POST /api/tour-guider/publish - Create tour guider profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      gender,
      age,
      city,
      province,
      description,
      experience,
      email,
      facilitiesProvided,
      certificate,
      contact,
      isAvailable,
      availableFrom,
      avatar,
      facebook,
      website
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !gender || !age || !city || !province || 
        !description || experience === undefined || !email || !certificate || 
        !contact || isAvailable === undefined || !availableFrom || !avatar) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'tour_guiders',
      status: 'active'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or not eligible for publishing'
      });
    }

    // Validate age
    if (age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100'
      });
    }

    // Validate gender
    const validGenders = ['Male', 'Female', 'Other'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender selected'
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

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate contact number format - accept all types of contact numbers
    // Allow digits, spaces, hyphens, parentheses, and + symbol
    const contactRegex = /^[\d\s\-\+\(\)]{7,}$/;
    if (!contactRegex.test(contact.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact number format. Please enter a valid contact number.'
      });
    }

    // Validate images and certificate
    if (!avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Avatar image is required with valid URL and public ID'
      });
    }

    if (!certificate.url || !certificate.publicId || !certificate.name) {
      return res.status(400).json({
        success: false,
        message: 'Certificate is required with valid URL, public ID, and name'
      });
    }

    // Create tour guider profile
    const tourGuider = new TourGuider({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      gender,
      age,
      city,
      province,
      description,
      experience,
      email,
      facilitiesProvided: facilitiesProvided || [],
      certificate,
      contact,
      isAvailable,
      availableFrom: new Date(availableFrom),
      avatar,
      facebook: facebook || null,
      website: website || null
    });

    await tourGuider.save();

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
    advertisement.publishedAdId = tourGuider._id;
    advertisement.publishedAdModel = 'TourGuider';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Tour guider profile published successfully!',
      data: {
        tourGuider: {
          _id: tourGuider._id,
          name: tourGuider.name,
          province: tourGuider.province,
          city: tourGuider.city,
          publishedAt: tourGuider.publishedAt
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
    console.error('Error publishing tour guider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish tour guider profile. Please try again.'
    });
  }
});

// GET /api/tour-guider/provinces - Get provinces and districts
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

