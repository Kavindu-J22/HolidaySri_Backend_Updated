const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const FoodsBeverages = require('../models/FoodsBeverages');
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

// POST /api/foods-beverages/publish - Create foods & beverages profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      description,
      category,
      type,
      province,
      city,
      contact,
      delivery,
      price,
      available,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !description || !category || !type || 
        !province || !city || !contact || images === undefined || 
        images.length === 0 || price === undefined || available === undefined) {
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

    // Validate type array
    if (!Array.isArray(type) || type.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one type must be selected'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Validate contact object
    if (!contact.phone || !contact.email) {
      return res.status(400).json({
        success: false,
        message: 'Phone and email are required in contact information'
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
      category: 'foods_beverages'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create FoodsBeverages document
    const foodsBeverages = new FoodsBeverages({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      description,
      category,
      type,
      location: {
        province,
        city
      },
      contact: {
        phone: contact.phone,
        email: contact.email,
        facebook: contact.facebook || null,
        whatsapp: contact.whatsapp || null
      },
      delivery: delivery === true || delivery === 'true',
      price: parseFloat(price),
      available: available === true || available === 'true',
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }))
    });

    await foodsBeverages.save();

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
    advertisement.publishedAdId = foodsBeverages._id;
    advertisement.publishedAdModel = 'FoodsBeverages';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Foods & Beverages published successfully!',
      data: {
        foodsBeverages: {
          _id: foodsBeverages._id,
          name: foodsBeverages.name,
          category: foodsBeverages.category,
          province: foodsBeverages.location.province,
          city: foodsBeverages.location.city,
          publishedAt: foodsBeverages.publishedAt
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
    console.error('Error publishing foods & beverages:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing foods & beverages',
      error: error.message
    });
  }
});

// GET /api/foods-beverages/provinces - Get provinces and districts
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

// GET /api/foods-beverages/browse - Get all active foods & beverages with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, province, city, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'FoodsBeverages'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    if (province) {
      filter['location.province'] = province;
    }
    if (city) {
      filter['location.city'] = city;
    }

    // Get total count
    const total = await FoodsBeverages.countDocuments(filter);

    // Fetch foods & beverages with pagination, sorted randomly
    const foodsBeverages = await FoodsBeverages.find(filter)
      .populate('userId', 'name email')
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Shuffle results randomly
    const shuffled = foodsBeverages.sort(() => Math.random() - 0.5);

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
    console.error('Error fetching foods & beverages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching foods & beverages',
      error: error.message
    });
  }
});

// GET /api/foods-beverages/:id - Get single foods & beverages detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foods & beverages ID'
      });
    }

    const foodsBeverages = await FoodsBeverages.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userId', 'name email contactNumber');

    if (!foodsBeverages) {
      return res.status(404).json({
        success: false,
        message: 'Foods & Beverages not found'
      });
    }

    res.json({
      success: true,
      data: foodsBeverages
    });
  } catch (error) {
    console.error('Error fetching foods & beverages detail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching foods & beverages detail',
      error: error.message
    });
  }
});

// PUT /api/foods-beverages/:id - Update foods & beverages
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      type,
      province,
      city,
      contact,
      delivery,
      price,
      available,
      images
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foods & beverages ID'
      });
    }

    // Find foods & beverages and verify ownership
    const foodsBeverages = await FoodsBeverages.findById(id);

    if (!foodsBeverages) {
      return res.status(404).json({
        success: false,
        message: 'Foods & Beverages not found'
      });
    }

    if (foodsBeverages.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this advertisement'
      });
    }

    // Validate province and city if provided
    if (province && city) {
      if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid province or city combination'
        });
      }
    }

    // Update fields
    if (name) foodsBeverages.name = name;
    if (description) foodsBeverages.description = description;
    if (category) foodsBeverages.category = category;
    if (type && Array.isArray(type)) foodsBeverages.type = type;
    if (province && city) {
      foodsBeverages.location.province = province;
      foodsBeverages.location.city = city;
    }
    if (contact) {
      if (contact.phone) foodsBeverages.contact.phone = contact.phone;
      if (contact.email) foodsBeverages.contact.email = contact.email;
      if (contact.facebook !== undefined) foodsBeverages.contact.facebook = contact.facebook || null;
      if (contact.whatsapp !== undefined) foodsBeverages.contact.whatsapp = contact.whatsapp || null;
    }
    if (delivery !== undefined) foodsBeverages.delivery = delivery;
    if (price !== undefined) foodsBeverages.price = parseFloat(price);
    if (available !== undefined) foodsBeverages.available = available;
    if (images && Array.isArray(images)) {
      foodsBeverages.images = images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name || foodsBeverages.name
      }));
    }

    await foodsBeverages.save();

    res.json({
      success: true,
      message: 'Foods & Beverages updated successfully!',
      data: foodsBeverages
    });
  } catch (error) {
    console.error('Error updating foods & beverages:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating foods & beverages',
      error: error.message
    });
  }
});

// POST /api/foods-beverages/:id/review - Add review and rating
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foods & beverages ID'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const foodsBeverages = await FoodsBeverages.findById(id);

    if (!foodsBeverages) {
      return res.status(404).json({
        success: false,
        message: 'Foods & Beverages not found'
      });
    }

    // Check if user already reviewed
    const existingReview = foodsBeverages.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      foodsBeverages.reviews.push({
        userId: req.user._id,
        userName: req.user.name || 'Anonymous',
        rating,
        reviewText: reviewText || ''
      });
    }

    // Recalculate average rating
    const totalRating = foodsBeverages.reviews.reduce((sum, r) => sum + r.rating, 0);
    foodsBeverages.averageRating = totalRating / foodsBeverages.reviews.length;
    foodsBeverages.totalReviews = foodsBeverages.reviews.length;

    await foodsBeverages.save();

    res.json({
      success: true,
      message: 'Review added successfully!',
      data: {
        averageRating: foodsBeverages.averageRating,
        totalReviews: foodsBeverages.totalReviews,
        reviews: foodsBeverages.reviews
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

