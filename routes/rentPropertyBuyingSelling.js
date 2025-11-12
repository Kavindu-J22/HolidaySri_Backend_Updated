const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const RentPropertyBuyingSelling = require('../models/RentPropertyBuyingSelling');
const Advertisement = require('../models/Advertisement');

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

// POST /api/rent-property-buying-selling/publish
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      type,
      category,
      condition,
      price,
      urgent,
      description,
      specialFeatures,
      city,
      province,
      contact,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !title || !type || !category || !condition || 
        !price || !description || !city || !province || !contact || 
        !images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 4)
    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Validate province/city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province/city combination'
      });
    }

    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be greater than 0'
      });
    }

    // Get advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify ownership
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this advertisement'
      });
    }

    // Create property document
    const property = new RentPropertyBuyingSelling({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      type,
      category,
      condition,
      price,
      urgent: urgent || false,
      description,
      specialFeatures: specialFeatures || [],
      location: {
        province,
        city
      },
      contact,
      images
    });

    await property.save();

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
    advertisement.publishedAdId = property._id;
    advertisement.publishedAdModel = 'RentPropertyBuyingSelling';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Property published successfully!',
      data: {
        property: {
          _id: property._id,
          title: property.title,
          type: property.type,
          category: property.category,
          province: property.location.province,
          city: property.location.city,
          publishedAt: property.publishedAt
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
    console.error('Error publishing property:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing property',
      error: error.message
    });
  }
});

// GET /api/rent-property-buying-selling/browse
router.get('/browse', async (req, res) => {
  try {
    const { category, city, province, type, condition, search } = req.query;

    // Build filter query
    let filter = { isActive: true };

    // Filter by active advertisements only (not expired)
    const activeAds = await Advertisement.find({
      status: 'Published',
      publishedAdModel: 'RentPropertyBuyingSelling',
      expiresAt: { $gt: new Date() }
    }).select('publishedAdId');

    const activeAdIds = activeAds.map(ad => ad.publishedAdId);
    filter._id = { $in: activeAdIds };

    if (category) filter.category = category;
    if (city) filter['location.city'] = city;
    if (province) filter['location.province'] = province;
    if (type) filter.type = type;
    if (condition) filter.condition = condition;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get properties and shuffle randomly
    let properties = await RentPropertyBuyingSelling.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Shuffle array randomly
    properties = properties.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties'
    });
  }
});

// GET /api/rent-property-buying-selling/provinces
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

// GET /api/rent-property-buying-selling/:id
router.get('/:id', async (req, res) => {
  try {
    const property = await RentPropertyBuyingSelling.findById(req.params.id)
      .populate('userId', 'name email contactNumber')
      .populate('reviews.userId', 'name');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Increment view count
    property.viewCount = (property.viewCount || 0) + 1;
    await property.save();

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property'
    });
  }
});

// PUT /api/rent-property-buying-selling/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      title,
      type,
      category,
      condition,
      price,
      urgent,
      description,
      specialFeatures,
      city,
      province,
      contact,
      images
    } = req.body;

    // Validate required fields
    if (!title || !type || !category || !condition ||
        !price || !description || !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 4)
    if (images && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Validate province/city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province/city combination'
      });
    }

    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be greater than 0'
      });
    }

    // Get property
    const property = await RentPropertyBuyingSelling.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Verify ownership
    if (property.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this property'
      });
    }

    // Update property
    property.title = title;
    property.type = type;
    property.category = category;
    property.condition = condition;
    property.price = price;
    property.urgent = urgent || false;
    property.description = description;
    property.specialFeatures = specialFeatures || [];
    property.location = { province, city };
    property.contact = contact;
    if (images && images.length > 0) {
      property.images = images;
    }

    await property.save();

    res.json({
      success: true,
      message: 'Property updated successfully!',
      data: property
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
});

// POST /api/rent-property-buying-selling/:id/reviews
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Validate review
    if (!review || review.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review cannot be empty'
      });
    }

    // Get property
    const property = await RentPropertyBuyingSelling.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user already reviewed
    const existingReview = property.reviews.find(r => r.userId.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this property'
      });
    }

    // Add review
    property.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      review: review.trim(),
      createdAt: new Date()
    });

    // Calculate average rating
    const totalRating = property.reviews.reduce((sum, r) => sum + r.rating, 0);
    property.averageRating = (totalRating / property.reviews.length).toFixed(1);
    property.totalReviews = property.reviews.length;

    await property.save();

    res.json({
      success: true,
      message: 'Review added successfully!',
      data: property
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

