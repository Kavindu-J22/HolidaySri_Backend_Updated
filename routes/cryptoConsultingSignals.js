const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const CryptoConsultingSignals = require('../models/CryptoConsultingSignals');
const Advertisement = require('../models/Advertisement');

// POST /api/crypto-consulting-signals/publish - Create crypto consulting/signals profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      type,
      specialist,
      category,
      description,
      charges,
      city,
      province,
      online,
      physical,
      includes,
      image,
      contactNumber,
      facebook,
      website,
      coursesPDF
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !type || !specialist || specialist.length === 0 ||
        !category || !description || charges === undefined || !city || !province ||
        !image || !image.url || !image.publicId || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate type
    if (!['Courses', 'Consultants'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Courses" or "Consultants"'
      });
    }

    // Validate charges
    if (charges < 0) {
      return res.status(400).json({
        success: false,
        message: 'Charges must be a positive number'
      });
    }

    // Validate at least one service type is selected
    if (!online && !physical) {
      return res.status(400).json({
        success: false,
        message: 'At least one service type (online or physical) must be selected'
      });
    }

    // Validate advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'crypto_consulting_signals',
      status: 'active'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or not eligible for publishing'
      });
    }

    // Check if already published
    if (advertisement.publishedAdId) {
      return res.status(400).json({
        success: false,
        message: 'This advertisement slot has already been published'
      });
    }

    // Create crypto consulting signals profile
    const profileData = {
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      type,
      specialist,
      category,
      description,
      charges,
      city,
      province,
      online,
      physical,
      includes: includes || [],
      image: {
        url: image.url,
        publicId: image.publicId
      },
      contactNumber,
      publishedAt: new Date()
    };

    // Add optional fields
    if (facebook) {
      profileData.facebook = facebook;
    }
    if (website) {
      profileData.website = website;
    }
    if (coursesPDF && coursesPDF.url && coursesPDF.publicId) {
      profileData.coursesPDF = {
        url: coursesPDF.url,
        publicId: coursesPDF.publicId
      };
    }

    const profile = new CryptoConsultingSignals(profileData);
    await profile.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    let expirationTime;
    const sriLankanNow = moment.tz('Asia/Colombo');

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
    advertisement.publishedAdId = profile._id;
    advertisement.publishedAdModel = 'CryptoConsultingSignals';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Crypto Consulting/Signals profile published successfully',
      data: {
        profile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing crypto consulting signals profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/crypto-consulting-signals/active - Get all active profiles
router.get('/active', async (req, res) => {
  try {
    const { type, province, city, category, page = 1, limit = 12 } = req.query;
    
    const query = { isActive: true };
    
    if (type) query.type = type;
    if (province) query.province = province;
    if (city) query.city = city;
    if (category) query.category = { $regex: category, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const profiles = await CryptoConsultingSignals.find(query)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'status expiresAt')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CryptoConsultingSignals.countDocuments(query);

    res.json({
      success: true,
      data: profiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching crypto consulting signals profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/crypto-consulting-signals/:id - Get single profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await CryptoConsultingSignals.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

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
    console.error('Error fetching crypto consulting signals profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/crypto-consulting-signals/:id/contact - Increment contact count
router.put('/:id/contact', async (req, res) => {
  try {
    const profile = await CryptoConsultingSignals.findByIdAndUpdate(
      req.params.id,
      { $inc: { contactCount: 1 } },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error updating contact count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact count'
    });
  }
});

// PUT /api/crypto-consulting-signals/:id - Update crypto consulting/signals profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      specialist,
      category,
      description,
      charges,
      city,
      province,
      online,
      physical,
      includes,
      image,
      contactNumber,
      facebook,
      website,
      coursesPDF
    } = req.body;

    // Find the profile
    const profile = await CryptoConsultingSignals.findById(id);

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
        message: 'You are not authorized to edit this profile'
      });
    }

    // Validate type if provided
    if (type && !['Courses', 'Consultants'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Courses" or "Consultants"'
      });
    }

    // Validate charges if provided
    if (charges !== undefined && charges < 0) {
      return res.status(400).json({
        success: false,
        message: 'Charges must be a positive number'
      });
    }

    // Validate service type if provided
    if (online !== undefined && physical !== undefined && !online && !physical) {
      return res.status(400).json({
        success: false,
        message: 'At least one service type (online or physical) must be selected'
      });
    }

    // Update fields
    if (name) profile.name = name;
    if (type) profile.type = type;
    if (specialist) profile.specialist = specialist;
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (charges !== undefined) profile.charges = charges;
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (online !== undefined) profile.online = online;
    if (physical !== undefined) profile.physical = physical;
    if (includes) profile.includes = includes;
    if (image) profile.image = image;
    if (contactNumber) profile.contactNumber = contactNumber;
    if (facebook !== undefined) profile.facebook = facebook;
    if (website !== undefined) profile.website = website;
    if (coursesPDF !== undefined) profile.coursesPDF = coursesPDF;

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

// POST /api/crypto-consulting-signals/:id/review - Add review and rating
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate input
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find the profile
    const profile = await CryptoConsultingSignals.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = profile.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Add review
    profile.reviews.push({
      user: req.user._id,
      userName: req.user.name,
      rating,
      comment,
      createdAt: new Date()
    });

    // Update average rating and total reviews
    const totalRating = profile.reviews.reduce((sum, review) => sum + review.rating, 0);
    profile.averageRating = totalRating / profile.reviews.length;
    profile.totalReviews = profile.reviews.length;

    await profile.save();

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

// GET /api/crypto-consulting-signals/:id/reviews - Get all reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await CryptoConsultingSignals.findById(id)
      .select('reviews averageRating totalReviews')
      .populate('reviews.user', 'name');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: profile.reviews,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews
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

