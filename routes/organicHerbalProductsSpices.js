const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const OrganicHerbalProductsSpices = require('../models/OrganicHerbalProductsSpices');
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

// POST /api/organic-herbal-products-spices/publish
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      price,
      province,
      city,
      paymentMethods,
      deliveryAvailable,
      contact,
      website,
      available,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        !province || !city || !contact || images === undefined || 
        images.length === 0 || price === undefined || available === undefined ||
        !paymentMethods || paymentMethods.length === 0) {
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

    // Validate paymentMethods array
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one payment method must be selected'
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
      category: 'organic_herbal_products_spices'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create OrganicHerbalProductsSpices document
    const product = new OrganicHerbalProductsSpices({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      price: parseFloat(price),
      location: {
        province,
        city
      },
      paymentMethods,
      deliveryAvailable: deliveryAvailable === true || deliveryAvailable === 'true',
      contact: {
        phone: contact.phone,
        email: contact.email,
        facebook: contact.facebook || null,
        whatsapp: contact.whatsapp || null
      },
      website: website || null,
      available: available === true || available === 'true',
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }))
    });

    await product.save();

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
    advertisement.publishedAdId = product._id;
    advertisement.publishedAdModel = 'OrganicHerbalProductsSpices';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Organic Herbal Products & Spices published successfully!',
      data: {
        product: {
          _id: product._id,
          name: product.name,
          category: product.category,
          province: product.location.province,
          city: product.location.city,
          publishedAt: product.publishedAt
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
    console.error('Error publishing organic herbal products & spices:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing organic herbal products & spices',
      error: error.message
    });
  }
});

// GET /api/organic-herbal-products-spices/provinces
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

// GET /api/organic-herbal-products-spices/browse
router.get('/browse', async (req, res) => {
  try {
    const { category, specialization, province, city, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'OrganicHerbalProductsSpices'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (category) {
      filter.category = category;
    }
    if (specialization) {
      filter.specialization = specialization;
    }
    if (province) {
      filter['location.province'] = province;
    }
    if (city) {
      filter['location.city'] = city;
    }

    const total = await OrganicHerbalProductsSpices.countDocuments(filter);

    const products = await OrganicHerbalProductsSpices.find(filter)
      .populate('userId', 'name email')
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const shuffled = products.sort(() => Math.random() - 0.5);

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
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// GET /api/organic-herbal-products-spices/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await OrganicHerbalProductsSpices.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userId', 'name email contactNumber');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// PUT /api/organic-herbal-products-spices/:id - Update product
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      specialization,
      category,
      description,
      price,
      province,
      city,
      paymentMethods,
      deliveryAvailable,
      contact,
      website,
      available,
      images
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Validate required fields
    if (!name || !specialization || !category || !description ||
        !province || !city || !contact || !paymentMethods || paymentMethods.length === 0) {
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

    // Find product and verify ownership
    const product = await OrganicHerbalProductsSpices.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this product'
      });
    }

    // Update product
    product.name = name;
    product.specialization = specialization;
    product.category = category;
    product.description = description;
    product.price = parseFloat(price);
    product.location = { province, city };
    product.paymentMethods = paymentMethods;
    product.deliveryAvailable = deliveryAvailable === true || deliveryAvailable === 'true';
    product.contact = {
      phone: contact.phone,
      email: contact.email,
      facebook: contact.facebook || null,
      whatsapp: contact.whatsapp || null
    };
    product.website = website || null;
    product.available = available === true || available === 'true';

    if (images && images.length > 0) {
      product.images = images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }));
    }

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// POST /api/organic-herbal-products-spices/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const product = await OrganicHerbalProductsSpices.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      product.reviews.push({
        userId: req.user._id,
        userName: req.user.name || 'Anonymous',
        rating,
        reviewText: reviewText || ''
      });
    }

    // Calculate average rating
    const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.averageRating = totalRating / product.reviews.length;
    product.totalReviews = product.reviews.length;

    await product.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        averageRating: product.averageRating,
        totalReviews: product.totalReviews,
        reviews: product.reviews
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

