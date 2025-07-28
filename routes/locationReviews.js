const express = require('express');
const LocationReview = require('../models/LocationReview');
const Location = require('../models/Location');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/location-reviews - Get reviews for a location
router.get('/', async (req, res) => {
  try {
    const { locationId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    if (!locationId) {
      return res.status(400).json({ message: 'Location ID is required' });
    }

    // Build query
    const query = { locationId, isActive: true };

    // Build sort object
    let sortObj = {};
    if (sortBy === 'rating') {
      sortObj.rating = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'helpful') {
      sortObj.helpfulCount = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const reviews = await LocationReview.find(query)
      .populate('userId', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await LocationReview.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    // Get rating distribution
    const ratingStats = await LocationReview.aggregate([
      { $match: { locationId: locationId, isActive: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }
    ratingStats.forEach(stat => {
      ratingDistribution[stat._id] = stat.count;
    });

    res.json({
      reviews,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total,
        limit: limitNum
      },
      ratingDistribution
    });
  } catch (error) {
    console.error('Error fetching location reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/location-reviews/user/:locationId - Get user's review for a location
router.get('/user/:locationId', verifyToken, async (req, res) => {
  try {
    const { locationId } = req.params;
    const userId = req.user.id;

    const review = await LocationReview.findOne({
      locationId,
      userId,
      isActive: true
    }).populate('userId', 'name email');

    res.json(review);
  } catch (error) {
    console.error('Error fetching user review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/location-reviews - Create a new review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { locationId, rating, comment, images = [] } = req.body;

    // Validate required fields
    if (!locationId || !rating || !comment) {
      return res.status(400).json({ message: 'Location, rating, and comment are required' });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if location exists
    const location = await Location.findById(locationId);
    if (!location || !location.isActive) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user already reviewed this location
    const existingReview = await LocationReview.findOne({
      locationId,
      userId: req.user.id
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this location' });
    }

    // Create review
    const review = new LocationReview({
      locationId,
      userId: req.user.id,
      rating,
      comment,
      images
    });

    await review.save();

    // Populate user data for response
    await review.populate('userId', 'name email');

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating location review:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/location-reviews/:id - Update review
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await LocationReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Update fields
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;
    if (images) review.images = images;

    await review.save();

    // Populate user data for response
    await review.populate('userId', 'name email');

    res.json(review);
  } catch (error) {
    console.error('Error updating location review:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/location-reviews/:id - Delete review
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const review = await LocationReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    // Soft delete by setting isActive to false
    review.isActive = false;
    await review.save();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting location review:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/location-reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', verifyToken, async (req, res) => {
  try {
    const review = await LocationReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Increment helpful count
    review.helpfulCount += 1;
    await review.save();

    res.json({ message: 'Review marked as helpful', helpfulCount: review.helpfulCount });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/location-reviews/:id/report - Report review
router.post('/:id/report', verifyToken, async (req, res) => {
  try {
    const review = await LocationReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Increment report count
    review.reportCount += 1;
    await review.save();

    res.json({ message: 'Review reported successfully' });
  } catch (error) {
    console.error('Error reporting review:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
