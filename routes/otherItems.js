const express = require('express');
const router = express.Router();
const OtherItems = require('../models/OtherItems');
const Advertisement = require('../models/Advertisement');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

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

// POST /api/other-items/publish - Create other items profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      price,
      city,
      province,
      paymentMethods,
      delivery,
      contact,
      website,
      facebook,
      images,
      available
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        price === undefined || !city || !province || !paymentMethods || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    // Validate payment methods
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one payment method must be selected'
      });
    }

    const validPaymentMethods = ['cash', 'cards', 'COD'];
    if (!paymentMethods.every(method => validPaymentMethods.includes(method))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method selected'
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

    // Validate images (max 3)
    if (images && images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Find the advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Check if advertisement belongs to the user
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this advertisement'
      });
    }

    // Create other items profile
    const otherItem = new OtherItems({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      price: parseFloat(price),
      city,
      province,
      paymentMethods,
      delivery: delivery !== undefined ? delivery : false,
      contact,
      website: website || '',
      facebook: facebook || '',
      images: images || [],
      available: available !== undefined ? available : true
    });

    await otherItem.save();

    // Calculate expiration time based on plan
    const sriLankanNow = moment().tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = (advertisement.planDuration.hours || 1) * 60 * 60 * 1000;
        break;
      case 'daily':
        expirationTime = (advertisement.planDuration.days || 1) * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        expirationTime = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'yearly':
        expirationTime = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        expirationTime = 24 * 60 * 60 * 1000;
    }

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = otherItem._id;
    advertisement.publishedAdModel = 'OtherItems';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Other items advertisement published successfully',
      data: {
        otherItem,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing other items:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing advertisement',
      error: error.message
    });
  }
});

// GET /api/other-items/browse - Get all active other items with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, province, city, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'OtherItems'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    const total = await OtherItems.countDocuments(filter);
    const items = await OtherItems.find(filter)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching other items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
});

// GET /api/other-items/:id - Get single other item detail
router.get('/:id', async (req, res) => {
  try {
    const item = await OtherItems.findById(req.params.id)
      .populate('userId', 'name email phone');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Increment view count
    item.viewCount = (item.viewCount || 0) + 1;
    await item.save();

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item detail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching item details',
      error: error.message
    });
  }
});

// PUT /api/other-items/:id - Edit other items advertisement
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      description,
      price,
      city,
      province,
      paymentMethods,
      delivery,
      contact,
      website,
      facebook,
      images,
      available
    } = req.body;

    // Find the item
    const item = await OtherItems.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check if item belongs to the user
    if (item.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this item'
      });
    }

    // Validate required fields if provided
    if (name !== undefined && !name) {
      return res.status(400).json({
        success: false,
        message: 'Item name cannot be empty'
      });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    if (paymentMethods !== undefined) {
      if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one payment method must be selected'
        });
      }

      const validPaymentMethods = ['cash', 'cards', 'COD'];
      if (!paymentMethods.every(method => validPaymentMethods.includes(method))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method selected'
        });
      }
    }

    if (province !== undefined && city !== undefined) {
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
    }

    if (images !== undefined && images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Update fields
    if (name !== undefined) item.name = name;
    if (specialization !== undefined) item.specialization = specialization;
    if (category !== undefined) item.category = category;
    if (description !== undefined) item.description = description;
    if (price !== undefined) item.price = parseFloat(price);
    if (city !== undefined) item.city = city;
    if (province !== undefined) item.province = province;
    if (paymentMethods !== undefined) item.paymentMethods = paymentMethods;
    if (delivery !== undefined) item.delivery = delivery;
    if (contact !== undefined) item.contact = contact;
    if (website !== undefined) item.website = website || '';
    if (facebook !== undefined) item.facebook = facebook || '';
    if (images !== undefined) item.images = images;
    if (available !== undefined) item.available = available;

    await item.save();

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating item',
      error: error.message
    });
  }
});

// POST /api/other-items/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find the item
    const item = await OtherItems.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Create review object
    const review = {
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };

    // Add review to item
    if (!item.reviews) {
      item.reviews = [];
    }
    item.reviews.push(review);

    // Calculate average rating
    const totalRating = item.reviews.reduce((sum, r) => sum + r.rating, 0);
    item.averageRating = (totalRating / item.reviews.length).toFixed(1);
    item.totalReviews = item.reviews.length;

    await item.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: item
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

