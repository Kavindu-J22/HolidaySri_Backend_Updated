const express = require('express');
const Review = require('../models/Review');
const Destination = require('../models/Destination');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/destination/:destinationId - Get reviews for a destination
router.get('/destination/:destinationId', async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build sort object
    let sort = {};
    if (sortBy === 'rating') {
      sort.rating = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'helpful') {
      sort.helpfulCount = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reviews with user information
    const reviews = await Review.find({ 
      destinationId: req.params.destinationId,
      isActive: true 
    })
      .populate('userId', 'name profileImage')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count for pagination
    const total = await Review.countDocuments({ 
      destinationId: req.params.destinationId,
      isActive: true 
    });

    // Get rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { destinationId: req.params.destinationId, isActive: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      reviews,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      ratingStats
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reviews/user - Get user's reviews
router.get('/user', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({ 
      userId: req.user._id,
      isActive: true 
    })
      .populate('destinationId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Review.countDocuments({ 
      userId: req.user._id,
      isActive: true 
    });

    res.json({
      reviews,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/reviews - Create a new review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { destinationId, rating, comment, images = [] } = req.body;

    // Validate required fields
    if (!destinationId || !rating || !comment) {
      return res.status(400).json({ message: 'Destination, rating, and comment are required' });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if destination exists
    const destination = await Destination.findById(destinationId);
    if (!destination || !destination.isActive) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Check if user already has an active review for this destination
    const existingReview = await Review.findOne({
      destinationId,
      userId: req.user._id,
      isActive: true
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this destination' });
    }

    // Create review
    const review = new Review({
      destinationId,
      userId: req.user._id,
      rating: parseInt(rating),
      comment,
      images
    });

    await review.save();

    // Populate user information for response
    await review.populate('userId', 'name profileImage');

    res.status(201).json({
      message: 'Review created successfully',
      review
    });

  } catch (error) {
    console.error('Create review error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/reviews/:id - Update a review
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    // Update fields
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      review.rating = parseInt(rating);
    }
    if (comment) review.comment = comment;
    if (images !== undefined) review.images = images;

    await review.save();

    // Populate user information for response
    await review.populate('userId', 'name profileImage');

    res.json({
      message: 'Review updated successfully',
      review
    });

  } catch (error) {
    console.error('Update review error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/reviews/:id - Delete a review
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    // Soft delete by setting isActive to false
    review.isActive = false;
    await review.save();

    res.json({ message: 'Review deleted successfully' });

  } catch (error) {
    console.error('Delete review error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
