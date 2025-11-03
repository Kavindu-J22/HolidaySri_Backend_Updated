const express = require('express');
const router = express.Router();
const FashionBeautyClothing = require('../models/FashionBeautyClothing');
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

// POST /api/fashion-beauty-clothing/publish - Create fashion beauty clothing profile and publish advertisement
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
      deliveryAvailable,
      contact,
      facebook,
      website,
      available,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        price === undefined || !city || !province || !contact || !images || images.length === 0) {
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
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate payment methods
    const validPaymentMethods = ['cash', 'cards', 'koko', 'bank_transfer', 'online_payment'];
    if (paymentMethods && !Array.isArray(paymentMethods)) {
      return res.status(400).json({
        success: false,
        message: 'Payment methods must be an array'
      });
    }

    if (paymentMethods && paymentMethods.some(method => !validPaymentMethods.includes(method))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method selected'
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

    // Create fashion beauty clothing profile
    const fashionBeautyClothing = new FashionBeautyClothing({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      price: parseFloat(price),
      city,
      province,
      paymentMethods: paymentMethods || [],
      deliveryAvailable: deliveryAvailable !== undefined ? deliveryAvailable : false,
      contact,
      facebook: facebook || null,
      website: website || null,
      available: available !== undefined ? available : true,
      images: images || []
    });

    await fashionBeautyClothing.save();

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
    advertisement.publishedAdId = fashionBeautyClothing._id;
    advertisement.publishedAdModel = 'FashionBeautyClothing';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Fashion Beauty Clothing profile published successfully',
      data: {
        fashionBeautyClothingId: fashionBeautyClothing._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing fashion beauty clothing profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish fashion beauty clothing profile',
      error: error.message
    });
  }
});

// GET /api/fashion-beauty-clothing/browse - Get all published fashion beauty clothing items with filters
// IMPORTANT: This route MUST come before /:id route to avoid "browse" being treated as an ID
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = {};

    // Filter by search term (name, specialization, category, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by specialization
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    // Filter by category
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    // Filter by city
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Filter by province
    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    // Get all matching items first to filter by expiration
    let allItems = await FashionBeautyClothing.find(filter)
      .populate('userId', 'name email')
      .lean();

    // Filter out expired items
    const now = new Date();
    allItems = allItems.filter(item => {
      const advertisement = Advertisement.findById(item.publishedAdId);
      // This is a simplified check - in production, you'd want to do this in the query
      return true; // We'll handle expiration in the next step
    });

    // Get advertisements to check expiration
    const publishedAdIds = allItems.map(item => item.publishedAdId);
    const advertisements = await Advertisement.find({ _id: { $in: publishedAdIds } });
    const expiredAdIds = new Set(
      advertisements
        .filter(ad => ad.expiresAt && new Date(ad.expiresAt) < now)
        .map(ad => ad._id.toString())
    );

    // Filter out expired items
    allItems = allItems.filter(item => !expiredAdIds.has(item.publishedAdId.toString()));

    // Shuffle items for random display
    for (let i = allItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    // Pagination
    const totalCount = allItems.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedItems = allItems.slice(startIndex, startIndex + parseInt(limit));

    // Get unique values for filter options
    const allItemsForFilters = await FashionBeautyClothing.find({});
    const filterOptions = {
      specializations: [...new Set(allItemsForFilters.map(item => item.specialization))],
      categories: [...new Set(allItemsForFilters.map(item => item.category))],
      cities: [...new Set(allItemsForFilters.map(item => item.city))],
      provinces: [...new Set(allItemsForFilters.map(item => item.province))]
    };

    res.json({
      success: true,
      data: paginatedItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filterOptions
    });
  } catch (error) {
    console.error('Error fetching fashion beauty clothing items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items',
      error: error.message
    });
  }
});

// GET /api/fashion-beauty-clothing/:id - Get single fashion beauty clothing item details
router.get('/:id', async (req, res) => {
  try {
    const item = await FashionBeautyClothing.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name');

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
    console.error('Error fetching item details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item details',
      error: error.message
    });
  }
});

// PUT /api/fashion-beauty-clothing/:id - Update fashion beauty clothing item
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
      deliveryAvailable,
      contact,
      facebook,
      website,
      available,
      images
    } = req.body;

    // Find the item
    const item = await FashionBeautyClothing.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check authorization
    if (item.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this item'
      });
    }

    // Validate inputs
    if (price !== undefined && price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    if (province && !provincesAndDistricts[province]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province selected'
      });
    }

    if (province && city && !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for the selected province'
      });
    }

    if (images && images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Update fields
    if (name) item.name = name;
    if (specialization) item.specialization = specialization;
    if (category) item.category = category;
    if (description) item.description = description;
    if (price !== undefined) item.price = parseFloat(price);
    if (city) item.city = city;
    if (province) item.province = province;
    if (paymentMethods) item.paymentMethods = paymentMethods;
    if (deliveryAvailable !== undefined) item.deliveryAvailable = deliveryAvailable;
    if (contact) item.contact = contact;
    if (facebook !== undefined) item.facebook = facebook || null;
    if (website !== undefined) item.website = website || null;
    if (available !== undefined) item.available = available;
    if (images) item.images = images;

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
      message: 'Failed to update item',
      error: error.message
    });
  }
});

// POST /api/fashion-beauty-clothing/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    // Validate inputs
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!review || review.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review cannot be empty'
      });
    }

    // Find the item
    const item = await FashionBeautyClothing.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Add review
    item.reviews.push({
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      review: review.trim()
    });

    // Calculate average rating
    const totalRating = item.reviews.reduce((sum, r) => sum + r.rating, 0);
    item.averageRating = totalRating / item.reviews.length;
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
      message: 'Failed to add review',
      error: error.message
    });
  }
});

module.exports = router;

