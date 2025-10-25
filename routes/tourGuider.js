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

// GET /api/tour-guider/:id - Get tour guider profile by ID
router.get('/:id', async (req, res) => {
  try {
    const tourGuider = await TourGuider.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!tourGuider) {
      return res.status(404).json({
        success: false,
        message: 'Tour guider profile not found'
      });
    }

    res.json({
      success: true,
      data: tourGuider
    });
  } catch (error) {
    console.error('Error fetching tour guider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tour guider profile'
    });
  }
});

// GET /api/tour-guider/list/all - Get all published tour guiders with filters
router.get('/list/all', async (req, res) => {
  try {
    const { experience, gender, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (experience) {
      const expValue = parseInt(experience);
      filter.experience = { $gte: expValue };
    }

    if (gender) {
      filter.gender = gender;
    }

    if (city) {
      filter.city = city;
    }

    if (province) {
      filter.province = province;
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch tour guiders
    const tourGuiders = await TourGuider.find(filter)
      .populate('userId', 'name email avatar')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await TourGuider.countDocuments(filter);

    res.json({
      success: true,
      data: tourGuiders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching tour guiders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tour guiders'
    });
  }
});

// GET /api/tour-guider/user/:userId - Get tour guider profile by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const tourGuider = await TourGuider.findOne({ userId: req.params.userId })
      .populate('userId', 'name email avatar');

    if (!tourGuider) {
      return res.status(404).json({
        success: false,
        message: 'Tour guider profile not found for this user'
      });
    }

    res.json({
      success: true,
      data: tourGuider
    });
  } catch (error) {
    console.error('Error fetching tour guider by user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tour guider profile'
    });
  }
});

// PUT /api/tour-guider/:id - Update tour guider profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const tourGuider = await TourGuider.findById(req.params.id);

    if (!tourGuider) {
      return res.status(404).json({
        success: false,
        message: 'Tour guider profile not found'
      });
    }

    // Check if user is the owner
    if (tourGuider.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this profile'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'gender', 'age', 'city', 'province', 'description',
      'experience', 'email', 'contact', 'facilitiesProvided',
      'isAvailable', 'availableFrom', 'facebook', 'website', 'avatar', 'certificate'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        tourGuider[field] = req.body[field];
      }
    });

    await tourGuider.save();

    res.json({
      success: true,
      message: 'Tour guider profile updated successfully',
      data: tourGuider
    });
  } catch (error) {
    console.error('Error updating tour guider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tour guider profile'
    });
  }
});

module.exports = router;

