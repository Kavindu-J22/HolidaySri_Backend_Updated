const express = require('express');
const mongoose = require('mongoose');
const LocalTourPackage = require('../models/LocalTourPackage');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

const router = express.Router();

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

// POST /api/local-tour-package/publish - Publish local tour package
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      categoryType,
      adventureType,
      location,
      description,
      images,
      pax,
      availableDates,
      includes,
      price,
      provider,
      facebook,
      website
    } = req.body;

    // Validate advertisement ID
    if (!mongoose.isValidObjectId(advertisementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID'
      });
    }

    // Find and verify advertisement ownership
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'local_tour_packages'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or you do not have permission to publish it'
      });
    }

    // Validate required fields
    if (!title || !adventureType || !location || !description || !images || !pax || !availableDates || !price || !provider) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate location
    if (!location.province || !location.city) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data'
      });
    }

    if (!provincesAndDistricts[location.province]?.includes(location.city)) {
      return res.status(400).json({
        success: false,
        message: 'City must be valid for the selected province'
      });
    }

    // Validate images (must have at least 1, max 4)
    if (!Array.isArray(images) || images.length === 0 || images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 4 images'
      });
    }

    // Validate pax
    if (!pax.min || !pax.max || pax.min < 1 || pax.max < pax.min) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pax range'
      });
    }

    // Validate price
    if (!price.amount || price.amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price'
      });
    }

    // Validate provider
    if (!provider.name || !provider.email || !provider.phone) {
      return res.status(400).json({
        success: false,
        message: 'Provider information is incomplete'
      });
    }

    // Create LocalTourPackage document
    const localTourPackage = new LocalTourPackage({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      categoryType: 'local_tour_packages',
      adventureType,
      location,
      description,
      images,
      pax,
      availableDates: availableDates.map(date => new Date(date)),
      includes: includes || [],
      price,
      provider,
      facebook: facebook || null,
      website: website || null
    });

    await localTourPackage.save();

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
    advertisement.publishedAdId = localTourPackage._id;
    advertisement.publishedAdModel = 'LocalTourPackage';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Local tour package published successfully!',
      data: {
        localTourPackage: {
          _id: localTourPackage._id,
          title: localTourPackage.title,
          adventureType: localTourPackage.adventureType,
          location: localTourPackage.location,
          publishedAt: localTourPackage.publishedAt
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
    console.error('Error publishing local tour package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish local tour package',
      error: error.message
    });
  }
});

// GET /api/local-tour-package/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/local-tour-package/:id - Get single local tour package
router.get('/:id', async (req, res) => {
  try {
    const localTourPackage = await LocalTourPackage.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name');

    if (!localTourPackage) {
      return res.status(404).json({
        success: false,
        message: 'Local tour package not found'
      });
    }

    // Increment view count
    await localTourPackage.incrementViewCount();

    res.json({
      success: true,
      data: localTourPackage
    });
  } catch (error) {
    console.error('Error fetching local tour package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch local tour package',
      error: error.message
    });
  }
});

// GET /api/local-tour-package/browse/all - Get all local tour packages with filters
router.get('/browse/all', async (req, res) => {
  try {
    const { province, city, adventureType, categoryType, page = 1, limit = 12 } = req.query;

    // Build filter query
    const filter = { isActive: true };

    if (province) filter['location.province'] = province;
    if (city) filter['location.city'] = city;
    if (adventureType) filter.adventureType = adventureType;
    if (categoryType) filter.categoryType = categoryType;

    // Get total count
    const total = await LocalTourPackage.countDocuments(filter);

    // Fetch packages with pagination and random sort
    const packages = await LocalTourPackage.find(filter)
      .populate('userId', 'name')
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Shuffle the results randomly
    const shuffled = packages.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: shuffled,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching local tour packages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch local tour packages',
      error: error.message
    });
  }
});

// PUT /api/local-tour-package/:id - Update local tour package
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { title, adventureType, location, description, images, pax, availableDates, includes, price, provider, facebook, website } = req.body;

    // Find package and verify ownership
    const localTourPackage = await LocalTourPackage.findById(req.params.id);

    if (!localTourPackage) {
      return res.status(404).json({
        success: false,
        message: 'Local tour package not found'
      });
    }

    if (localTourPackage.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this package'
      });
    }

    // Update fields
    if (title) localTourPackage.title = title;
    if (adventureType) localTourPackage.adventureType = adventureType;
    if (location) localTourPackage.location = location;
    if (description) localTourPackage.description = description;
    if (images && images.length > 0 && images.length <= 4) localTourPackage.images = images;
    if (pax) localTourPackage.pax = pax;
    if (availableDates) localTourPackage.availableDates = availableDates.map(date => new Date(date));
    if (includes) localTourPackage.includes = includes;
    if (price) localTourPackage.price = price;
    if (provider) localTourPackage.provider = provider;
    if (facebook !== undefined) localTourPackage.facebook = facebook || null;
    if (website !== undefined) localTourPackage.website = website || null;

    await localTourPackage.save();

    res.json({
      success: true,
      message: 'Local tour package updated successfully!',
      data: localTourPackage
    });
  } catch (error) {
    console.error('Error updating local tour package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update local tour package',
      error: error.message
    });
  }
});

// POST /api/local-tour-package/:id/review - Add review
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const localTourPackage = await LocalTourPackage.findById(req.params.id);

    if (!localTourPackage) {
      return res.status(404).json({
        success: false,
        message: 'Local tour package not found'
      });
    }

    // Check if user already reviewed
    const existingReview = localTourPackage.reviews.find(r => r.userId.toString() === req.user._id.toString());

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      localTourPackage.reviews.push({
        userId: req.user._id,
        userName: req.user.name,
        rating,
        reviewText: reviewText || ''
      });
    }

    // Recalculate average rating
    const totalRating = localTourPackage.reviews.reduce((sum, review) => sum + review.rating, 0);
    localTourPackage.averageRating = totalRating / localTourPackage.reviews.length;
    localTourPackage.totalReviews = localTourPackage.reviews.length;

    await localTourPackage.save();

    res.json({
      success: true,
      message: 'Review added successfully!',
      data: {
        averageRating: localTourPackage.averageRating,
        totalReviews: localTourPackage.totalReviews,
        reviews: localTourPackage.reviews
      }
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

// GET /api/local-tour-package/:id/reviews - Get reviews for a package
router.get('/:id/reviews', async (req, res) => {
  try {
    const localTourPackage = await LocalTourPackage.findById(req.params.id)
      .select('reviews averageRating totalReviews')
      .populate('reviews.userId', 'name');

    if (!localTourPackage) {
      return res.status(404).json({
        success: false,
        message: 'Local tour package not found'
      });
    }

    res.json({
      success: true,
      data: {
        averageRating: localTourPackage.averageRating,
        totalReviews: localTourPackage.totalReviews,
        reviews: localTourPackage.reviews
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

module.exports = router;

