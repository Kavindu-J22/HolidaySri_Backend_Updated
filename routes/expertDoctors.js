const express = require('express');
const mongoose = require('mongoose');
const ExpertDoctors = require('../models/ExpertDoctors');
const Advertisement = require('../models/Advertisement');
const { verifyToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const moment = require('moment-timezone');

const router = express.Router();

// Sri Lankan provinces and districts
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

// POST /api/expert-doctors/publish - Create expert doctor profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      experienceYears,
      province,
      city,
      contact,
      avatar,
      available,
      weekdays,
      weekends,
      times,
      facebook,
      website
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experienceYears === undefined || !province || !city || !contact || !avatar) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience years
    if (experienceYears < 0 || experienceYears > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience years must be between 0 and 70'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Validate avatar
    if (!avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Avatar image is required'
      });
    }

    // Verify advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'expert_doctors'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create expert doctor profile
    const expertDoctor = new ExpertDoctors({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experienceYears,
      location: {
        province,
        city
      },
      contact,
      avatar,
      available: available !== undefined ? available : true,
      availability: {
        weekdays: weekdays || [],
        weekends: weekends || [],
        times: times || []
      },
      socialLinks: {
        facebook: facebook || null,
        website: website || null
      }
    });

    await expertDoctor.save();

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
        expirationTime = now.clone().add(1, 'day');
    }

    // Update advertisement status and expiration
    await Advertisement.findByIdAndUpdate(
      advertisementId,
      {
        status: 'Published',
        publishedAt: now.toDate(),
        expiresAt: expirationTime.toDate(),
        publishedAdId: expertDoctor._id,
        publishedAdModel: 'ExpertDoctors'
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Expert doctor profile published successfully',
      data: expertDoctor
    });
  } catch (error) {
    console.error('Error publishing expert doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish expert doctor profile',
      error: error.message
    });
  }
});

// GET /api/expert-doctors/browse - Get all active expert doctors with filters
router.get('/browse', async (req, res) => {
  try {
    const { specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter query
    const filter = {};

    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    if (city) {
      filter['location.city'] = city;
    }
    if (province) {
      filter['location.province'] = province;
    }

    // Get all expert doctors matching filter
    let expertDoctors = await ExpertDoctors.find(filter)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'status expiresAt')
      .lean();

    // Filter out expired advertisements
    expertDoctors = expertDoctors.filter(doctor => {
      const ad = doctor.publishedAdId;
      if (!ad || ad.status !== 'Published') return false;
      if (ad.expiresAt && new Date(ad.expiresAt) < new Date()) return false;
      return true;
    });

    // Shuffle array for random sorting
    expertDoctors = expertDoctors.sort(() => Math.random() - 0.5);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDoctors = expertDoctors.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedDoctors,
      pagination: {
        total: expertDoctors.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(expertDoctors.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expert doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expert doctors',
      error: error.message
    });
  }
});

// GET /api/expert-doctors/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  try {
    res.status(200).json({
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

// GET /api/expert-doctors/:id - Get single expert doctor with reviews
router.get('/:id', async (req, res) => {
  try {
    const expertDoctor = await ExpertDoctors.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'status expiresAt');

    if (!expertDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Expert doctor not found'
      });
    }

    // Check if advertisement is expired
    const ad = expertDoctor.publishedAdId;
    if (ad && ad.status !== 'Published') {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }
    if (ad && ad.expiresAt && new Date(ad.expiresAt) < new Date()) {
      return res.status(404).json({
        success: false,
        message: 'This profile has expired'
      });
    }

    // Increment view count
    expertDoctor.viewCount = (expertDoctor.viewCount || 0) + 1;
    await expertDoctor.save();

    res.status(200).json({
      success: true,
      data: expertDoctor
    });
  } catch (error) {
    console.error('Error fetching expert doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expert doctor',
      error: error.message
    });
  }
});

// POST /api/expert-doctors/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!reviewText || reviewText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    const expertDoctor = await ExpertDoctors.findById(req.params.id);

    if (!expertDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Expert doctor not found'
      });
    }

    // Create review object
    const review = {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      rating: parseInt(rating),
      reviewText: reviewText.trim(),
      createdAt: new Date()
    };

    // Add review to array
    expertDoctor.reviews.push(review);

    // Calculate average rating
    const totalRating = expertDoctor.reviews.reduce((sum, r) => sum + r.rating, 0);
    expertDoctor.engagement.averageRating = (totalRating / expertDoctor.reviews.length).toFixed(1);
    expertDoctor.engagement.totalReviews = expertDoctor.reviews.length;

    await expertDoctor.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: expertDoctor
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
});

// PUT /api/expert-doctors/:id - Update expert doctor profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      description,
      experienceYears,
      province,
      city,
      contact,
      avatar,
      available,
      weekdays,
      weekends,
      times,
      facebook,
      website
    } = req.body;

    // Find expert doctor
    const expertDoctor = await ExpertDoctors.findById(req.params.id);

    if (!expertDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Expert doctor not found'
      });
    }

    // Verify ownership
    if (expertDoctor.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this profile'
      });
    }

    // Validate required fields
    if (!name || !specialization || !category || !description ||
        experienceYears === undefined || !province || !city || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience years
    if (experienceYears < 0 || experienceYears > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience years must be between 0 and 70'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Update fields
    expertDoctor.name = name;
    expertDoctor.specialization = specialization;
    expertDoctor.category = category;
    expertDoctor.description = description;
    expertDoctor.experienceYears = experienceYears;
    expertDoctor.location = { province, city };
    expertDoctor.contact = contact;
    expertDoctor.available = available !== undefined ? available : true;
    expertDoctor.availability = {
      weekdays: weekdays || [],
      weekends: weekends || [],
      times: times || []
    };
    expertDoctor.socialLinks = {
      facebook: facebook || null,
      website: website || null
    };

    // Update avatar if provided
    if (avatar && avatar.url && avatar.publicId) {
      expertDoctor.avatar = avatar;
    }

    await expertDoctor.save();

    res.status(200).json({
      success: true,
      message: 'Expert doctor profile updated successfully',
      data: expertDoctor
    });
  } catch (error) {
    console.error('Error updating expert doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expert doctor profile',
      error: error.message
    });
  }
});

module.exports = router;

