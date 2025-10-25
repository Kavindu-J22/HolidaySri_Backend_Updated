const express = require('express');
const mongoose = require('mongoose');
const TourGuider = require('../models/TourGuider');
const TourGuiderReview = require('../models/TourGuiderReview');
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

    // Get rating distribution
    const ratingStats = await TourGuiderReview.aggregate([
      { $match: { tourGuiderId: tourGuider._id, isActive: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Build rating distribution object
    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }
    ratingStats.forEach(stat => {
      ratingDistribution[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: tourGuider,
      ratingDistribution: ratingDistribution
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

    // Get all tour guiders matching the filter
    const allTourGuiders = await TourGuider.find(filter)
      .populate('userId', 'name email avatar')
      .populate('publishedAdId', 'status');

    // Filter out tour guiders with expired advertisements
    const activeTourGuiders = allTourGuiders.filter(tg => {
      return tg.publishedAdId && tg.publishedAdId.status !== 'expired';
    });

    // Randomize the results
    const shuffled = activeTourGuiders.sort(() => Math.random() - 0.5);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Apply pagination to shuffled results
    const paginatedTourGuiders = shuffled.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: paginatedTourGuiders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(shuffled.length / limitNum),
        totalItems: shuffled.length,
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

// POST /api/tour-guider/:id/review - Submit a review for tour guider
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const tourGuiderId = req.params.id;
    const userId = req.user.id;

    // Validate input
    if (!rating || !review || !review.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rating and review are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if tour guider exists
    const tourGuider = await TourGuider.findById(tourGuiderId);
    if (!tourGuider) {
      return res.status(404).json({
        success: false,
        message: 'Tour guider not found'
      });
    }

    // Check if user already has an active review
    const existingReview = await TourGuiderReview.findOne({
      tourGuiderId,
      userId,
      isActive: true
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this tour guide. You can update your review instead.'
      });
    }

    // Create new review
    const newReview = new TourGuiderReview({
      tourGuiderId,
      userId,
      rating,
      review: review.trim()
    });

    await newReview.save();

    // Populate user details
    await newReview.populate('userId', 'name email avatar');

    // Update tour guider's average rating and total reviews
    const allReviews = await TourGuiderReview.find({
      tourGuiderId,
      isActive: true
    });

    const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
    const averageRating = totalRating / allReviews.length;

    await TourGuider.findByIdAndUpdate(tourGuiderId, {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: allReviews.length
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
});

// GET /api/tour-guider/:id/reviews - Get all reviews for a tour guider
router.get('/:id/reviews', async (req, res) => {
  try {
    const tourGuiderId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const reviews = await TourGuiderReview.find({
      tourGuiderId,
      isActive: true
    })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await TourGuiderReview.countDocuments({
      tourGuiderId,
      isActive: true
    });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
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

// PUT /api/tour-guider/reviews/:reviewId - Update a review
router.put('/reviews/:reviewId', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const reviewId = req.params.reviewId;
    const userId = req.user.id;

    // Validate input
    if (!rating || !review || !review.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rating and review are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find review
    const existingReview = await TourGuiderReview.findById(reviewId);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check authorization
    if (existingReview.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this review'
      });
    }

    // Update review
    existingReview.rating = rating;
    existingReview.review = review.trim();
    await existingReview.save();

    await existingReview.populate('userId', 'name email avatar');

    // Update tour guider's average rating
    const tourGuiderId = existingReview.tourGuiderId;
    const allReviews = await TourGuiderReview.find({
      tourGuiderId,
      isActive: true
    });

    const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
    const averageRating = totalRating / allReviews.length;

    await TourGuider.findByIdAndUpdate(tourGuiderId, {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: allReviews.length
    });

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: existingReview
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
});

module.exports = router;

