const express = require('express');
const mongoose = require('mongoose');
const TravelSafeHelpProfessional = require('../models/TravelSafeHelpProfessional');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

const router = express.Router();

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

// POST /api/travel-safe-help-professional/publish - Create profile and publish advertisement
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
      website,
      facebook,
      isAvailable,
      avatar
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !avatar) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'travelsafe_help_professionals',
      status: 'active'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or not eligible for publishing'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
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

    // Validate avatar
    if (!avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Avatar image is required'
      });
    }

    // Create TravelSafeHelpProfessional profile
    const travelSafeHelpProfessional = new TravelSafeHelpProfessional({
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
      website: website || null,
      facebook: facebook || null,
      isAvailable: isAvailable === true || isAvailable === 'true',
      avatar: {
        url: avatar.url,
        publicId: avatar.publicId
      }
    });

    await travelSafeHelpProfessional.save();

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
        expirationTime = now.clone().add(1, 'days');
    }

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAdId = travelSafeHelpProfessional._id;
    advertisement.publishedAdModel = 'TravelSafeHelpProfessional';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Travel Safe Help Professional profile published successfully!',
      data: {
        travelSafeHelpProfessional: {
          _id: travelSafeHelpProfessional._id,
          name: travelSafeHelpProfessional.name,
          specialization: travelSafeHelpProfessional.specialization,
          province: travelSafeHelpProfessional.province,
          city: travelSafeHelpProfessional.city,
          publishedAt: travelSafeHelpProfessional.publishedAt
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
    console.error('Error publishing travel safe help professional:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/travel-safe-help-professional/provinces - Get provinces and districts
// MUST be before /:id route to avoid being caught by the :id matcher
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

// GET /api/travel-safe-help-professional/browse - Browse all professionals with filters
// MUST be before /:id route to avoid being caught by the :id matcher
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (province) filter.province = province;
    if (city) filter.city = city;
    if (specialization) filter.specialization = specialization;
    if (category) filter.category = category;

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch professionals
    const professionals = await TravelSafeHelpProfessional.find(filter)
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    // Filter out expired advertisements
    const validProfessionals = [];
    for (const professional of professionals) {
      const advertisement = await Advertisement.findById(professional.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        validProfessionals.push(professional);
      }
    }

    res.json({
      success: true,
      data: validProfessionals
    });
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professionals'
    });
  }
});

// GET /api/travel-safe-help-professional/:id - Get single profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await TravelSafeHelpProfessional.findById(req.params.id)
      .populate('userId', 'name email avatar')
      .populate('reviews.userId', 'name avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    profile.viewCount += 1;
    await profile.save();

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/travel-safe-help-professional/:id - Update profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      website,
      facebook,
      isAvailable,
      avatar
    } = req.body;

    // Find profile and verify ownership
    const profile = await TravelSafeHelpProfessional.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update fields
    if (name) profile.name = name;
    if (specialization) profile.specialization = specialization;
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (experience !== undefined) profile.experience = experience;
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (contact) profile.contact = contact;
    if (website !== undefined) profile.website = website;
    if (facebook !== undefined) profile.facebook = facebook;
    if (isAvailable !== undefined) profile.isAvailable = isAvailable;
    if (avatar) profile.avatar = avatar;

    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// POST /api/travel-safe-help-professional/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, title, comment } = req.body;

    // Validate review data
    if (!rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating, title, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find profile
    const profile = await TravelSafeHelpProfessional.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = profile.reviews.find(r => r.userId.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this professional'
      });
    }

    // Get user info
    const user = await User.findById(req.user._id);

    // Add review
    const review = {
      userId: req.user._id,
      userName: user.name,
      userAvatar: user.avatar?.url || null,
      rating,
      title,
      comment,
      createdAt: new Date()
    };

    profile.reviews.push(review);
    await profile.updateAverageRating();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

module.exports = router;

