const express = require('express');
const router = express.Router();
const BabysittersChildcareReview = require('../models/BabysittersChildcareReview');
const BabysittersChildcare = require('../models/BabysittersChildcare');
const { verifyToken } = require('../middleware/auth');

// POST /api/babysitters-childcare-reviews/add - Add a review
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { babysitterProfileId, rating, review } = req.body;

    // Validate required fields
    if (!babysitterProfileId || !rating || !review) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Validate review length
    if (review.trim().length < 10 || review.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review must be between 10 and 1000 characters'
      });
    }

    // Check if babysitter profile exists
    const babysitterProfile = await BabysittersChildcare.findById(babysitterProfileId);
    if (!babysitterProfile) {
      return res.status(404).json({
        success: false,
        message: 'Babysitter profile not found'
      });
    }

    // Check if user already reviewed this profile
    const existingReview = await BabysittersChildcareReview.findOne({
      babysitterProfileId,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Create review
    const newReview = new BabysittersChildcareReview({
      babysitterProfileId,
      userId: req.user._id,
      rating: parseInt(rating),
      review: review.trim(),
      userName: req.user.name || 'Anonymous',
      userAvatar: req.user.avatar || ''
    });

    await newReview.save();

    // Update babysitter profile ratings
    const allReviews = await BabysittersChildcareReview.find({
      babysitterProfileId,
      isActive: true
    });

    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;

    babysitterProfile.averageRating = parseFloat(averageRating.toFixed(1));
    babysitterProfile.totalReviews = allReviews.length;
    await babysitterProfile.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
});

// GET /api/babysitters-childcare-reviews/:babysitterProfileId - Get all reviews for a profile
router.get('/:babysitterProfileId', async (req, res) => {
  try {
    const { babysitterProfileId } = req.params;

    const reviews = await BabysittersChildcareReview.find({
      babysitterProfileId,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'name avatar');

    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// GET /api/babysitters-childcare-reviews/stats/:babysitterProfileId - Get review statistics
router.get('/stats/:babysitterProfileId', async (req, res) => {
  try {
    const { babysitterProfileId } = req.params;

    const reviews = await BabysittersChildcareReview.find({
      babysitterProfileId,
      isActive: true
    });

    if (reviews.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
          }
        }
      });
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / reviews.length;

    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.status(200).json({
      success: true,
      data: {
        totalReviews: reviews.length,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review statistics'
    });
  }
});

module.exports = router;

