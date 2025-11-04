const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const EmergencyServicesInsurance = require('../models/EmergencyServicesInsurance');
const EmergencyServicesInsuranceReview = require('../models/EmergencyServicesInsuranceReview');
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

// POST /api/emergency-services-insurance/publish - Create emergency services insurance profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      category,
      contact,
      city,
      province,
      website,
      facebook,
      description,
      includes,
      logo,
      specialOffers
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !category || !contact || !city || !province || 
        !description || !includes || !logo || !logo.url || !logo.publicId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
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

    // Verify advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'emergency_services_insurance'
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
        message: 'This advertisement slot has already been published'
      });
    }

    // Create emergency services insurance profile
    const emergencyServicesInsurance = new EmergencyServicesInsurance({
      userId: req.user._id,
      publishedAdId: advertisement._id,
      name,
      category,
      contact,
      city,
      province,
      website: website || '',
      facebook: facebook || '',
      description,
      includes,
      logo: {
        url: logo.url,
        publicId: logo.publicId
      },
      specialOffers: specialOffers || '',
      isActive: true,
      publishedAt: new Date()
    });

    await emergencyServicesInsurance.save();

    // Calculate expiration time based on plan
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
    advertisement.publishedAdId = emergencyServicesInsurance._id;
    advertisement.publishedAdModel = 'EmergencyServicesInsurance';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Emergency Services & Insurance profile published successfully',
      data: {
        profile: emergencyServicesInsurance,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing emergency services insurance profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/emergency-services-insurance/provinces - Get provinces and districts
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
      message: 'Error fetching provinces',
      error: error.message
    });
  }
});

// GET /api/emergency-services-insurance/browse - Browse all active profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, category, province, city, page = 1, limit = 12 } = req.query;

    // Build filter query
    let filter = { isActive: true };

    // Filter by search (name or description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by province
    if (province) {
      filter.province = province;
    }

    // Filter by city
    if (city) {
      filter.city = city;
    }

    // Get all matching profiles
    let profiles = await EmergencyServicesInsurance.find(filter)
      .populate('userId', 'name email')
      .lean();

    // Filter out expired advertisements
    const profilesWithAds = await Promise.all(
      profiles.map(async (profile) => {
        const ad = await Advertisement.findById(profile.publishedAdId);
        if (ad && ad.status === 'Published' && new Date(ad.expiresAt) > new Date()) {
          return profile;
        }
        return null;
      })
    );

    // Remove null entries (expired ads)
    profiles = profilesWithAds.filter(p => p !== null);

    // Shuffle profiles randomly
    profiles = profiles.sort(() => Math.random() - 0.5);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProfiles = profiles.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        profiles: paginatedProfiles,
        total: profiles.length,
        page: parseInt(page),
        totalPages: Math.ceil(profiles.length / limit)
      }
    });
  } catch (error) {
    console.error('Error browsing emergency services insurance profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles. Please try again.'
    });
  }
});

// GET /api/emergency-services-insurance/:id - Get profile details
router.get('/:id', async (req, res) => {
  try {
    const profile = await EmergencyServicesInsurance.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    await profile.incrementViewCount();

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile details. Please try again.'
    });
  }
});

// PUT /api/emergency-services-insurance/:id - Update profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      category,
      contact,
      city,
      province,
      website,
      facebook,
      description,
      includes,
      logo,
      specialOffers
    } = req.body;

    // Find profile
    const profile = await EmergencyServicesInsurance.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Verify ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this profile'
      });
    }

    // Validate province and city if provided
    if (province && !provincesAndDistricts[province]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province selected'
      });
    }

    if (province && city && !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for the selected province'
      });
    }

    // Update fields
    if (name) profile.name = name;
    if (category) profile.category = category;
    if (contact) profile.contact = contact;
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (website !== undefined) profile.website = website;
    if (facebook !== undefined) profile.facebook = facebook;
    if (description) profile.description = description;
    if (includes) profile.includes = includes;
    if (logo && logo.url && logo.publicId) profile.logo = logo;
    if (specialOffers !== undefined) profile.specialOffers = specialOffers;

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
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/emergency-services-insurance/:id/reviews - Add a review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    // Validate required fields
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if profile exists
    const profile = await EmergencyServicesInsurance.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed this profile
    const existingReview = await EmergencyServicesInsuranceReview.findOne({
      emergencyServicesInsuranceId: req.params.id,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Create review
    const review = new EmergencyServicesInsuranceReview({
      emergencyServicesInsuranceId: req.params.id,
      userId: req.user._id,
      userName: req.user.name,
      userAvatar: req.user.avatar || '',
      rating,
      comment,
      isActive: true
    });

    await review.save();

    // Update profile's average rating and total reviews
    const stats = await EmergencyServicesInsuranceReview.calculateAverageRating(req.params.id);
    profile.averageRating = stats.averageRating;
    profile.totalReviews = stats.totalReviews;
    await profile.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: review
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
});

// GET /api/emergency-services-insurance/:id/reviews - Get all reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;

    // Build sort query
    let sortQuery = { createdAt: -1 }; // Default: most recent first
    if (sort === 'highest') {
      sortQuery = { rating: -1, createdAt: -1 };
    } else if (sort === 'lowest') {
      sortQuery = { rating: 1, createdAt: -1 };
    } else if (sort === 'helpful') {
      sortQuery = { helpfulCount: -1, createdAt: -1 };
    }

    // Get reviews with pagination
    const reviews = await EmergencyServicesInsuranceReview.find({
      emergencyServicesInsuranceId: req.params.id,
      isActive: true
    })
      .sort(sortQuery)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const count = await EmergencyServicesInsuranceReview.countDocuments({
      emergencyServicesInsuranceId: req.params.id,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        reviews,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews. Please try again.'
    });
  }
});

module.exports = router;

