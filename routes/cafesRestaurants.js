const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const CafesRestaurants = require('../models/CafesRestaurants');
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

// POST /api/cafes-restaurants/publish - Create cafe/restaurant profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      categoryType,
      province,
      city,
      openTime,
      closeTime,
      diningOptions,
      description,
      contact,
      website,
      facebook,
      images,
      menuPDF,
      mapLink
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !categoryType || !province || !city ||
        !openTime || !closeTime || !diningOptions || diningOptions.length === 0 ||
        !description || !contact || !images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images (max 3)
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

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
      category: 'cafes_restaurants'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create CafesRestaurants document
    const cafesRestaurants = new CafesRestaurants({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      categoryType,
      location: {
        province,
        city
      },
      operatingHours: {
        openTime,
        closeTime
      },
      diningOptions,
      description,
      contact,
      website: website || null,
      facebook: facebook || null,
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      })),
      menuPDF: menuPDF ? {
        url: menuPDF.url,
        publicId: menuPDF.publicId,
        fileName: menuPDF.fileName
      } : null,
      mapLink: mapLink || null
    });

    await cafesRestaurants.save();

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

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAdId = cafesRestaurants._id;
    advertisement.publishedAdModel = 'CafesRestaurants';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Cafe/Restaurant published successfully!',
      data: {
        cafesRestaurants: {
          _id: cafesRestaurants._id,
          name: cafesRestaurants.name,
          categoryType: cafesRestaurants.categoryType,
          province: cafesRestaurants.location.province,
          city: cafesRestaurants.location.city,
          publishedAt: cafesRestaurants.publishedAt
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
    console.error('Error publishing cafe/restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing cafe/restaurant',
      error: error.message
    });
  }
});

// GET /api/cafes-restaurants/provinces - Get provinces and districts
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

// GET /api/cafes-restaurants/browse - Get all published cafes/restaurants with filters
router.get('/browse', async (req, res) => {
  try {
    const { categoryType, province, city, search, page = 1, limit = 12 } = req.query;
    const diningOptions = req.query.diningOptions; // Can be array or single value
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { isActive: true };

    // Get all active advertisements with status Published
    const activeAds = await Advertisement.find({
      category: 'cafes_restaurants',
      status: 'Published',
      publishedAdModel: 'CafesRestaurants'
    }).select('_id');

    const activeAdIds = activeAds.map(ad => ad._id);
    filter.publishedAdId = { $in: activeAdIds };

    if (categoryType) {
      filter.categoryType = { $regex: categoryType, $options: 'i' };
    }
    if (province) {
      filter['location.province'] = province;
    }
    if (city) {
      filter['location.city'] = city;
    }

    // Search by name or description
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by dining options
    if (diningOptions) {
      const optionsArray = Array.isArray(diningOptions) ? diningOptions : [diningOptions];
      if (optionsArray.length > 0) {
        filter.diningOptions = { $all: optionsArray };
      }
    }

    // Get total count
    const total = await CafesRestaurants.countDocuments(filter);

    // Get cafes/restaurants with random ordering
    const cafesRestaurants = await CafesRestaurants.find(filter)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Shuffle results randomly
    const shuffled = cafesRestaurants.sort(() => Math.random() - 0.5);

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
    console.error('Error fetching cafes/restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cafes/restaurants',
      error: error.message
    });
  }
});

// GET /api/cafes-restaurants/:id - Get single cafe/restaurant details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cafe/restaurant ID'
      });
    }

    const cafesRestaurant = await CafesRestaurants.findById(id)
      .populate('userId', 'firstName lastName email contactNumber profileImage');

    if (!cafesRestaurant) {
      return res.status(404).json({
        success: false,
        message: 'Cafe/Restaurant not found'
      });
    }

    // Check if advertisement is still active
    const advertisement = await Advertisement.findOne({
      _id: cafesRestaurant.publishedAdId,
      status: 'Published'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'This listing has expired'
      });
    }

    // Increment view count
    cafesRestaurant.viewCount = (cafesRestaurant.viewCount || 0) + 1;
    await cafesRestaurant.save();

    res.json({
      success: true,
      data: cafesRestaurant
    });
  } catch (error) {
    console.error('Error fetching cafe/restaurant details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cafe/restaurant details',
      error: error.message
    });
  }
});

// GET /api/cafes-restaurants/user/:userId - Get user's cafes/restaurants
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Verify user owns these listings
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const cafesRestaurants = await CafesRestaurants.find({ userId });

    res.json({
      success: true,
      data: cafesRestaurants
    });
  } catch (error) {
    console.error('Error fetching user cafes/restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user cafes/restaurants',
      error: error.message
    });
  }
});

// PUT /api/cafes-restaurants/:id - Update cafe/restaurant
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      categoryType,
      province,
      city,
      openTime,
      closeTime,
      diningOptions,
      description,
      contact,
      website,
      facebook,
      images,
      menuPDF,
      mapLink
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cafe/restaurant ID'
      });
    }

    // Find cafe/restaurant
    const cafesRestaurant = await CafesRestaurants.findById(id);

    if (!cafesRestaurant) {
      return res.status(404).json({
        success: false,
        message: 'Cafe/Restaurant not found'
      });
    }

    // Verify ownership
    if (cafesRestaurant.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Validate required fields
    if (!name || !categoryType || !province || !city || !openTime || !closeTime ||
        !diningOptions || diningOptions.length === 0 || !description || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images
    if (images && images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Update fields
    cafesRestaurant.name = name;
    cafesRestaurant.categoryType = categoryType;
    cafesRestaurant.location = { province, city };
    cafesRestaurant.operatingHours = { openTime, closeTime };
    cafesRestaurant.diningOptions = diningOptions;
    cafesRestaurant.description = description;
    cafesRestaurant.contact = contact;
    cafesRestaurant.website = website || null;
    cafesRestaurant.facebook = facebook || null;
    cafesRestaurant.mapLink = mapLink || null;

    if (images && images.length > 0) {
      cafesRestaurant.images = images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }));
    }

    if (menuPDF) {
      cafesRestaurant.menuPDF = {
        url: menuPDF.url,
        publicId: menuPDF.publicId,
        fileName: menuPDF.fileName
      };
    }

    await cafesRestaurant.save();

    res.json({
      success: true,
      message: 'Cafe/Restaurant updated successfully',
      data: cafesRestaurant
    });
  } catch (error) {
    console.error('Error updating cafe/restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cafe/restaurant',
      error: error.message
    });
  }
});

// POST /api/cafes-restaurants/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cafe/restaurant ID'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const cafesRestaurant = await CafesRestaurants.findById(id);

    if (!cafesRestaurant) {
      return res.status(404).json({
        success: false,
        message: 'Cafe/Restaurant not found'
      });
    }

    // Check if user already reviewed
    const existingReview = cafesRestaurant.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this cafe/restaurant'
      });
    }

    // Add review
    const review = {
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };

    cafesRestaurant.reviews.push(review);

    // Calculate average rating
    const totalRating = cafesRestaurant.reviews.reduce((sum, r) => sum + r.rating, 0);
    cafesRestaurant.averageRating = (totalRating / cafesRestaurant.reviews.length).toFixed(1);
    cafesRestaurant.totalReviews = cafesRestaurant.reviews.length;

    await cafesRestaurant.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        review,
        averageRating: cafesRestaurant.averageRating,
        totalReviews: cafesRestaurant.totalReviews
      }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding review',
      error: error.message
    });
  }
});

module.exports = router;

