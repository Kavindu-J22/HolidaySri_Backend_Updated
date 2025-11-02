const express = require('express');
const router = express.Router();
const PetCareAnimalServicesReview = require('../models/PetCareAnimalServicesReview');
const PetCareAnimalServices = require('../models/PetCareAnimalServices');
const { verifyToken } = require('../middleware/auth');

// POST /api/pet-care-animal-services-reviews/add - Add a review
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { petCareProfileId, rating, review } = req.body;

    // Validate required fields
    if (!petCareProfileId || !rating || !review) {
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

    // Check if pet care profile exists
    const petCareProfile = await PetCareAnimalServices.findById(petCareProfileId);
    if (!petCareProfile) {
      return res.status(404).json({
        success: false,
        message: 'Pet care profile not found'
      });
    }

    // Check if user already reviewed this profile
    const existingReview = await PetCareAnimalServicesReview.findOne({
      petCareProfileId,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Create review
    const newReview = new PetCareAnimalServicesReview({
      petCareProfileId,
      userId: req.user._id,
      rating: parseInt(rating),
      review: review.trim(),
      userName: req.user.name || 'Anonymous',
      userAvatar: req.user.avatar || ''
    });

    await newReview.save();

    // Update pet care profile ratings
    const allReviews = await PetCareAnimalServicesReview.find({
      petCareProfileId,
      isActive: true
    });

    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;

    petCareProfile.averageRating = parseFloat(averageRating.toFixed(1));
    petCareProfile.totalReviews = allReviews.length;
    await petCareProfile.save();

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

// GET /api/pet-care-animal-services-reviews/:petCareProfileId - Get all reviews for a profile
router.get('/:petCareProfileId', async (req, res) => {
  try {
    const { petCareProfileId } = req.params;

    const reviews = await PetCareAnimalServicesReview.find({
      petCareProfileId,
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

// GET /api/pet-care-animal-services-reviews/stats/:petCareProfileId - Get review statistics
router.get('/stats/:petCareProfileId', async (req, res) => {
  try {
    const { petCareProfileId } = req.params;

    const reviews = await PetCareAnimalServicesReview.find({
      petCareProfileId,
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

