const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');
const FitnessHealthSpasGymReview = require('../models/FitnessHealthSpasGymReview');
const FitnessHealthSpasGym = require('../models/FitnessHealthSpasGym');

// Add a review
router.post('/:fitnessProfileId/add-review', verifyToken, async (req, res) => {
  try {
    const { fitnessProfileId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!rating || !review) {
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

    if (review.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Review must be at least 10 characters long'
      });
    }

    // Check if fitness profile exists
    const fitnessProfile = await FitnessHealthSpasGym.findById(fitnessProfileId);
    if (!fitnessProfile) {
      return res.status(404).json({
        success: false,
        message: 'Fitness profile not found'
      });
    }

    // Check if user already reviewed this profile
    const existingReview = await FitnessHealthSpasGymReview.findOne({
      fitnessProfileId,
      userId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Create new review
    const newReview = new FitnessHealthSpasGymReview({
      fitnessProfileId,
      userId,
      rating,
      review
    });

    await newReview.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: newReview
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

// Get all reviews for a fitness profile
router.get('/:fitnessProfileId/reviews', async (req, res) => {
  try {
    const { fitnessProfileId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const reviews = await FitnessHealthSpasGymReview.find({ fitnessProfileId })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalReviews = await FitnessHealthSpasGymReview.countDocuments({ fitnessProfileId });

    // Calculate average rating
    const ratingData = await FitnessHealthSpasGymReview.aggregate([
      { $match: { fitnessProfileId: new mongoose.Types.ObjectId(fitnessProfileId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;
    const ratingDistribution = ratingData.length > 0 ? ratingData[0].ratingDistribution : [];

    // Count ratings by star
    const starCounts = {
      5: ratingDistribution.filter(r => r === 5).length,
      4: ratingDistribution.filter(r => r === 4).length,
      3: ratingDistribution.filter(r => r === 3).length,
      2: ratingDistribution.filter(r => r === 2).length,
      1: ratingDistribution.filter(r => r === 1).length
    };

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews
        },
        rating: {
          average: parseFloat(averageRating.toFixed(1)),
          total: totalReviews,
          distribution: starCounts
        }
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
});

// Get average rating for a fitness profile
router.get('/:fitnessProfileId/rating', async (req, res) => {
  try {
    const { fitnessProfileId } = req.params;

    const ratingData = await FitnessHealthSpasGymReview.aggregate([
      { $match: { fitnessProfileId: new mongoose.Types.ObjectId(fitnessProfileId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;
    const totalReviews = ratingData.length > 0 ? ratingData[0].totalReviews : 0;

    res.status(200).json({
      success: true,
      data: {
        averageRating: parseFloat(averageRating.toFixed(1)),
        totalReviews
      }
    });
  } catch (error) {
    console.error('Error fetching rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rating',
      error: error.message
    });
  }
});

// Delete a review (only by review owner or admin)
router.delete('/:reviewId', verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const review = await FitnessHealthSpasGymReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the review owner
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    await FitnessHealthSpasGymReview.findByIdAndDelete(reviewId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
});

module.exports = router;

