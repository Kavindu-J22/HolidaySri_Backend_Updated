const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const CreativePhotographers = require('../models/CreativePhotographers');
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

// GET /api/creative-photographers/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/creative-photographers/browse - Get all published creative photographers
router.get('/browse', async (req, res) => {
  try {
    const photographers = await CreativePhotographers.find({ isActive: true })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    // Filter out expired advertisements
    const validPhotographers = [];
    for (const photographer of photographers) {
      const advertisement = await Advertisement.findById(photographer.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        validPhotographers.push(photographer);
      }
    }

    res.json({
      success: true,
      data: validPhotographers
    });
  } catch (error) {
    console.error('Error fetching photographers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photographers'
    });
  }
});

// POST /api/creative-photographers/publish - Create creative photographer profile and publish advertisement
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
      includes,
      city,
      province,
      contact,
      available,
      social,
      website,
      packages
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !avatar || !avatar.url || !avatar.publicId ||
        !specialization || !category || !description || experience === undefined ||
        !includes || !Array.isArray(includes) || includes.length === 0 ||
        !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Validate contact format
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid contact number'
      });
    }

    // Fetch advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Create creative photographer profile
    const creativePhotographer = new CreativePhotographers({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      includes,
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      social: social || {},
      website: website || null,
      packages: packages || {}
    });

    await creativePhotographer.save();

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
    advertisement.publishedAdId = creativePhotographer._id;
    advertisement.publishedAdModel = 'CreativePhotographers';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Creative photographer profile published successfully!',
      data: {
        creativePhotographer: {
          _id: creativePhotographer._id,
          name: creativePhotographer.name,
          province: creativePhotographer.province,
          city: creativePhotographer.city,
          publishedAt: creativePhotographer.publishedAt
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
    console.error('Error publishing creative photographer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/creative-photographers/:id - Get single photographer
router.get('/:id', async (req, res) => {
  try {
    const photographer = await CreativePhotographers.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!photographer) {
      return res.status(404).json({
        success: false,
        message: 'Photographer not found'
      });
    }

    res.json({
      success: true,
      data: photographer
    });
  } catch (error) {
    console.error('Error fetching photographer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photographer'
    });
  }
});

// PUT /api/creative-photographers/:id - Update photographer profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      includes,
      city,
      province,
      contact,
      available,
      social,
      website,
      packages
    } = req.body;

    // Validate required fields
    if (!name || !avatar || !avatar.url || !avatar.publicId ||
        !specialization || !category || !description || experience === undefined ||
        !includes || !Array.isArray(includes) || includes.length === 0 ||
        !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Validate contact format
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid contact number'
      });
    }

    // Find and update photographer
    const photographer = await CreativePhotographers.findByIdAndUpdate(
      req.params.id,
      {
        name,
        avatar,
        specialization,
        category,
        description,
        experience,
        includes,
        city,
        province,
        contact,
        available: available !== undefined ? available : true,
        social: social || {},
        website: website || null,
        packages: packages || {}
      },
      { new: true }
    );

    if (!photographer) {
      return res.status(404).json({
        success: false,
        message: 'Photographer not found'
      });
    }

    res.json({
      success: true,
      message: 'Photographer profile updated successfully',
      data: photographer
    });
  } catch (error) {
    console.error('Error updating photographer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.'
    });
  }
});

module.exports = router;

