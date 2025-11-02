const express = require('express');
const router = express.Router();
const LanguageTranslators = require('../models/LanguageTranslators');
const Advertisement = require('../models/Advertisement');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');
const moment = require('moment-timezone');

// Provinces and Districts mapping for Sri Lanka
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

// Get provinces and districts
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

// Publish Language Translator profile
router.post('/publish', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      avatar,
      languages,
      category,
      description,
      experienceYears,
      city,
      province,
      contact,
      available,
      facebook,
      website
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !avatar?.url || !languages?.length || !category || !description || !experienceYears || !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify user owns this advertisement
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Create Language Translator profile
    const languageTranslator = new LanguageTranslators({
      userId: req.user._id,
      name,
      avatar: {
        url: avatar.url,
        publicId: avatar.publicId
      },
      languages,
      category,
      description,
      experienceYears: parseInt(experienceYears),
      city,
      province,
      contact,
      available: available !== false,
      facebook: facebook || '',
      website: website || ''
    });

    await languageTranslator.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const sriLankanNow = moment.tz('Asia/Colombo');
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

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = languageTranslator._id;
    advertisement.publishedAdModel = 'LanguageTranslators';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Language translator profile published successfully',
      data: {
        profile: languageTranslator,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing language translator profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// Get Language Translator profile by ID
router.get('/:id', async (req, res) => {
  try {
    const languageTranslator = await LanguageTranslators.findById(req.params.id);

    if (!languageTranslator) {
      return res.status(404).json({
        success: false,
        message: 'Language translator profile not found'
      });
    }

    // Check if advertisement is expired
    const advertisement = await Advertisement.findOne({
      publishedAdId: req.params.id,
      publishedAdModel: 'LanguageTranslators'
    });

    if (advertisement && advertisement.status === 'expired') {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }

    res.json({
      success: true,
      data: languageTranslator
    });
  } catch (error) {
    console.error('Error fetching language translator profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Browse Language Translators (with filters)
router.get('/', async (req, res) => {
  try {
    const { languages, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter query
    let filter = {};

    if (languages) {
      const languageArray = Array.isArray(languages) ? languages : [languages];
      filter.languages = { $in: languageArray };
    }

    if (category) {
      filter.category = category;
    }

    if (city) {
      filter.city = city;
    }

    if (province) {
      filter.province = province;
    }

    // Get all non-expired language translators
    const allTranslators = await LanguageTranslators.find(filter);

    // Filter out expired advertisements
    const activeTranslators = [];
    for (const translator of allTranslators) {
      const advertisement = await Advertisement.findOne({
        publishedAdId: translator._id,
        publishedAdModel: 'LanguageTranslators'
      });

      if (!advertisement || advertisement.status !== 'expired') {
        activeTranslators.push(translator);
      }
    }

    // Shuffle array randomly
    const shuffled = activeTranslators.sort(() => Math.random() - 0.5);

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTranslators = shuffled.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedTranslators,
      pagination: {
        total: shuffled.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(shuffled.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching language translators:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch language translators'
    });
  }
});

// Update Language Translator profile
router.put('/:id', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const languageTranslator = await LanguageTranslators.findById(req.params.id);

    if (!languageTranslator) {
      return res.status(404).json({
        success: false,
        message: 'Language translator profile not found'
      });
    }

    // Verify user owns this profile
    if (languageTranslator.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const {
      name,
      avatar,
      languages,
      category,
      description,
      experienceYears,
      city,
      province,
      contact,
      available,
      facebook,
      website
    } = req.body;

    // Update fields
    if (name) languageTranslator.name = name;
    if (avatar) languageTranslator.avatar = avatar;
    if (languages) languageTranslator.languages = languages;
    if (category) languageTranslator.category = category;
    if (description) languageTranslator.description = description;
    if (experienceYears) languageTranslator.experienceYears = parseInt(experienceYears);
    if (city) languageTranslator.city = city;
    if (province) languageTranslator.province = province;
    if (contact) languageTranslator.contact = contact;
    if (available !== undefined) languageTranslator.available = available;
    if (facebook !== undefined) languageTranslator.facebook = facebook;
    if (website !== undefined) languageTranslator.website = website;

    await languageTranslator.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: languageTranslator
    });
  } catch (error) {
    console.error('Error updating language translator profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const languageTranslator = await LanguageTranslators.findById(req.params.id);

    if (!languageTranslator) {
      return res.status(404).json({
        success: false,
        message: 'Language translator profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = languageTranslator.reviews?.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.review = review || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      if (!languageTranslator.reviews) {
        languageTranslator.reviews = [];
      }

      languageTranslator.reviews.push({
        userId: req.user._id,
        userName: req.user.name,
        rating,
        review: review || '',
        createdAt: new Date()
      });
    }

    // Calculate average rating
    const totalRating = languageTranslator.reviews.reduce((sum, r) => sum + r.rating, 0);
    languageTranslator.rating = totalRating / languageTranslator.reviews.length;
    languageTranslator.reviewCount = languageTranslator.reviews.length;

    await languageTranslator.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: languageTranslator
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// Get reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const languageTranslator = await LanguageTranslators.findById(req.params.id);

    if (!languageTranslator) {
      return res.status(404).json({
        success: false,
        message: 'Language translator profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: languageTranslator.reviews || [],
        rating: languageTranslator.rating || 0,
        reviewCount: languageTranslator.reviewCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

module.exports = router;

