const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const SouvenirsCollectibles = require('../models/SouvenirsCollectibles');
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

// POST /api/souvenirs-collectibles/publish - Create souvenirs & collectibles profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      province,
      city,
      contact,
      price,
      available,
      includes,
      website,
      facebook,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        !province || !city || !contact || images === undefined || 
        images.length === 0 || price === undefined || available === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images (max 4)
    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
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
      category: 'souvenirs_collectibles'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create SouvenirsCollectibles document
    const souvenirsCollectibles = new SouvenirsCollectibles({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      location: {
        province,
        city
      },
      contact: {
        phone: contact.phone,
        email: contact.email
      },
      price: parseFloat(price),
      available: available === true || available === 'true',
      includes: Array.isArray(includes) ? includes.filter(i => i.trim()) : [],
      website: website || null,
      facebook: facebook || null,
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }))
    });

    await souvenirsCollectibles.save();

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
    advertisement.publishedAdId = souvenirsCollectibles._id;
    advertisement.publishedAdModel = 'SouvenirsCollectibles';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Souvenirs & Collectibles published successfully!',
      data: {
        souvenirsCollectibles: {
          _id: souvenirsCollectibles._id,
          name: souvenirsCollectibles.name,
          category: souvenirsCollectibles.category,
          province: souvenirsCollectibles.location.province,
          city: souvenirsCollectibles.location.city,
          publishedAt: souvenirsCollectibles.publishedAt
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
    console.error('Error publishing souvenirs & collectibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing souvenirs & collectibles',
      error: error.message
    });
  }
});

// GET /api/souvenirs-collectibles/provinces - Get provinces and districts
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

// GET /api/souvenirs-collectibles/browse - Get all active souvenirs & collectibles with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, specialization, province, city, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'SouvenirsCollectibles'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }
    if (province) {
      filter['location.province'] = province;
    }
    if (city) {
      filter['location.city'] = city;
    }

    // Get total count
    const total = await SouvenirsCollectibles.countDocuments(filter);

    // Fetch souvenirs & collectibles with pagination, sorted randomly
    const souvenirsCollectibles = await SouvenirsCollectibles.find(filter)
      .populate('userId', 'name email')
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Shuffle results randomly
    const shuffled = souvenirsCollectibles.sort(() => Math.random() - 0.5);

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
    console.error('Error fetching souvenirs & collectibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching souvenirs & collectibles',
      error: error.message
    });
  }
});

// GET /api/souvenirs-collectibles/:id - Get single souvenirs & collectibles detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid souvenirs & collectibles ID'
      });
    }

    const souvenirsCollectibles = await SouvenirsCollectibles.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userId', 'name email contactNumber');

    if (!souvenirsCollectibles) {
      return res.status(404).json({
        success: false,
        message: 'Souvenirs & Collectibles not found'
      });
    }

    res.json({
      success: true,
      data: souvenirsCollectibles
    });
  } catch (error) {
    console.error('Error fetching souvenirs & collectibles detail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching souvenirs & collectibles detail',
      error: error.message
    });
  }
});

// PUT /api/souvenirs-collectibles/:id - Update souvenirs & collectibles
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      specialization,
      category,
      description,
      province,
      city,
      contact,
      price,
      available,
      includes,
      website,
      facebook,
      images
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid souvenirs & collectibles ID'
      });
    }

    // Find souvenirs & collectibles and verify ownership
    const souvenirsCollectibles = await SouvenirsCollectibles.findById(id);

    if (!souvenirsCollectibles) {
      return res.status(404).json({
        success: false,
        message: 'Souvenirs & Collectibles not found'
      });
    }

    if (souvenirsCollectibles.userId.toString() !== req.user._id.toString()) {
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
    if (name) souvenirsCollectibles.name = name;
    if (specialization) souvenirsCollectibles.specialization = specialization;
    if (category) souvenirsCollectibles.category = category;
    if (description) souvenirsCollectibles.description = description;
    if (province && city) {
      souvenirsCollectibles.location.province = province;
      souvenirsCollectibles.location.city = city;
    }
    if (contact) {
      if (contact.phone) souvenirsCollectibles.contact.phone = contact.phone;
      if (contact.email) souvenirsCollectibles.contact.email = contact.email;
    }
    if (price !== undefined) souvenirsCollectibles.price = parseFloat(price);
    if (available !== undefined) souvenirsCollectibles.available = available;
    if (includes && Array.isArray(includes)) {
      souvenirsCollectibles.includes = includes.filter(i => i.trim());
    }
    if (website !== undefined) souvenirsCollectibles.website = website || null;
    if (facebook !== undefined) souvenirsCollectibles.facebook = facebook || null;
    if (images && Array.isArray(images)) {
      souvenirsCollectibles.images = images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name || souvenirsCollectibles.name
      }));
    }

    await souvenirsCollectibles.save();

    res.json({
      success: true,
      message: 'Souvenirs & Collectibles updated successfully!',
      data: souvenirsCollectibles
    });
  } catch (error) {
    console.error('Error updating souvenirs & collectibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating souvenirs & collectibles',
      error: error.message
    });
  }
});

// POST /api/souvenirs-collectibles/:id/review - Add review and rating
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid souvenirs & collectibles ID'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const souvenirsCollectibles = await SouvenirsCollectibles.findById(id);

    if (!souvenirsCollectibles) {
      return res.status(404).json({
        success: false,
        message: 'Souvenirs & Collectibles not found'
      });
    }

    // Check if user already reviewed
    const existingReview = souvenirsCollectibles.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      souvenirsCollectibles.reviews.push({
        userId: req.user._id,
        userName: req.user.name || 'Anonymous',
        rating,
        reviewText: reviewText || ''
      });
    }

    // Recalculate average rating
    const totalRating = souvenirsCollectibles.reviews.reduce((sum, r) => sum + r.rating, 0);
    souvenirsCollectibles.averageRating = totalRating / souvenirsCollectibles.reviews.length;
    souvenirsCollectibles.totalReviews = souvenirsCollectibles.reviews.length;

    await souvenirsCollectibles.save();

    res.json({
      success: true,
      message: 'Review added successfully!',
      data: {
        averageRating: souvenirsCollectibles.averageRating,
        totalReviews: souvenirsCollectibles.totalReviews,
        reviews: souvenirsCollectibles.reviews
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

