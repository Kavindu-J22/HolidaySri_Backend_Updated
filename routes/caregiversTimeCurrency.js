const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const CaregiversTimeCurrency = require('../models/CaregiversTimeCurrency');
const Advertisement = require('../models/Advertisement');

// Sri Lankan provinces and districts mapping for validation
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

// Generate unique careID (CHS + 4 digits)
const generateCareID = async () => {
  let careID;
  let isUnique = false;

  while (!isUnique) {
    // Generate 4-digit random number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    careID = `CHS${randomNum}`;

    // Check if this ID already exists
    const existing = await CaregiversTimeCurrency.findOne({ careID });
    if (!existing) {
      isUnique = true;
    }
  }

  return careID;
};

// Calculate expiration date based on plan and duration (Sri Lankan timezone)
const calculateExpirationDate = (selectedPlan, planDuration) => {
  const sriLankanNow = moment.tz('Asia/Colombo');
  let expirationTime;

  switch (selectedPlan) {
    case 'hourly':
      expirationTime = (planDuration.hours || 1) * 60 * 60 * 1000;
      break;
    case 'daily':
      expirationTime = (planDuration.days || 1) * 24 * 60 * 60 * 1000;
      break;
    case 'monthly':
      expirationTime = 30 * 24 * 60 * 60 * 1000;
      break;
    case 'yearly':
      expirationTime = 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      expirationTime = 24 * 60 * 60 * 1000; // fallback to 1 day
  }

  return new Date(sriLankanNow.valueOf() + expirationTime);
};

// POST /api/caregivers-time-currency/publish - Create caregiver/care needer profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      gender,
      age,
      description,
      city,
      province,
      contact,
      available,
      occupied,
      facebook,
      website,
      avatar,
      speakingLanguages,
      type,
      experience,
      services,
      reason,
      specialNeeds
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !gender || !age || !description || 
        !city || !province || !contact || !avatar || !avatar.url || 
        !avatar.publicId || !speakingLanguages || speakingLanguages.length === 0 || !type) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate age
    if (age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100'
      });
    }

    // Validate province and city combination
    const validCities = provincesAndDistricts[province];
    if (!validCities || !validCities.includes(city)) {
      return res.status(400).json({
        success: false,
        message: `Invalid city "${city}" for province "${province}"`
      });
    }

    // Validate type-specific fields
    if (type === 'Care Giver') {
      if (experience === undefined || experience === null) {
        return res.status(400).json({
          success: false,
          message: 'Experience is required for Care Giver'
        });
      }
      if (!services || services.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one service is required for Care Giver'
        });
      }
      if (experience < 0 || experience > 70) {
        return res.status(400).json({
          success: false,
          message: 'Experience must be between 0 and 70 years'
        });
      }
    } else if (type === 'Care Needer') {
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for Care Needer'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Care Giver" or "Care Needer"'
      });
    }

    // Verify advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'caregivers_time_currency'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Check if advertisement is already published
    if (advertisement.status === 'Published') {
      return res.status(400).json({
        success: false,
        message: 'This advertisement has already been published'
      });
    }

    // Generate unique careID
    const careID = await generateCareID();

    // Prepare profile data
    const profileData = {
      userId: req.user._id,
      publishedAdId: advertisementId,
      careID,
      type,
      name,
      gender,
      age,
      description,
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      occupied: occupied !== undefined ? occupied : false,
      facebook: facebook || '',
      website: website || '',
      avatar,
      speakingLanguages
    };

    // Add type-specific fields
    if (type === 'Care Giver') {
      profileData.careGiverDetails = {
        experience,
        services
      };
      profileData.HSTC = 36;
    } else if (type === 'Care Needer') {
      profileData.careNeederDetails = {
        reason,
        specialNeeds: specialNeeds || []
      };
      profileData.HSTC = 720;
    }

    // Create caregiver/care needer profile
    const profile = new CaregiversTimeCurrency(profileData);
    await profile.save();

    // Calculate expiration date
    const sriLankanNow = moment.tz('Asia/Colombo');
    const expiresAt = calculateExpirationDate(advertisement.selectedPlan, advertisement.planDuration);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = profile._id;
    advertisement.publishedAdModel = 'CaregiversTimeCurrency';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Caregiver/Care Needer profile published successfully',
      data: {
        profile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing caregiver/care needer profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/caregivers-time-currency/provinces - Get all provinces and cities
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
      message: 'Failed to fetch provinces'
    });
  }
});

module.exports = router;

