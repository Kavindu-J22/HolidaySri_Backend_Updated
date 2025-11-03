const express = require('express');
const router = express.Router();
const ExclusiveGiftPacks = require('../models/ExclusiveGiftPacks');
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

// POST /api/exclusive-gift-packs/publish - Create gift pack and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      price,
      available,
      includes,
      city,
      province,
      contact,
      facebook,
      website,
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

    // Validate images count
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
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

    // Create exclusive gift pack
    const giftPack = new ExclusiveGiftPacks({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      price: parseFloat(price),
      available: available !== undefined ? available : true,
      includes: includes || [],
      location: {
        province,
        city
      },
      contact,
      facebook: facebook || '',
      website: website || '',
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: name
      }))
    });

    await giftPack.save();

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
    advertisement.publishedAdId = giftPack._id;
    advertisement.publishedAdModel = 'ExclusiveGiftPacks';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Exclusive Gift Pack published successfully',
      data: {
        giftPack,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing gift pack:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish gift pack',
      error: error.message
    });
  }
});

// GET /api/exclusive-gift-packs/browse - Get all published gift packs with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, province, city, specialization, search, page = 1, limit = 12, random = false } = req.query;

    // Build filter query
    const filter = { isActive: true };

    // Exclude expired advertisements
    const now = new Date();
    const expiredAds = await Advertisement.find({
      expiresAt: { $lt: now },
      status: 'Published'
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

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ExclusiveGiftPacks.countDocuments(filter);

    // Use random sorting if requested, otherwise sort by creation date
    let query = ExclusiveGiftPacks.find(filter);

    if (random === 'true') {
      query = query.sort({ _id: 1 }).skip(skip).limit(parseInt(limit));
      // Fetch all matching documents and shuffle them
      const allGiftPacks = await ExclusiveGiftPacks.find(filter);
      const shuffled = allGiftPacks.sort(() => Math.random() - 0.5);
      const paginatedGiftPacks = shuffled.slice(skip, skip + parseInt(limit));

      res.json({
        success: true,
        data: paginatedGiftPacks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
          hasNext: parseInt(page) * parseInt(limit) < total,
          hasPrev: parseInt(page) > 1
        }
      });
    } else {
      const giftPacks = await query
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: giftPacks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
          hasNext: parseInt(page) * parseInt(limit) < total,
          hasPrev: parseInt(page) > 1
        }
      });
    }
  } catch (error) {
    console.error('Error fetching gift packs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gift packs',
      error: error.message
    });
  }
});

// GET /api/exclusive-gift-packs/:id - Get single gift pack details
router.get('/:id', async (req, res) => {
  try {
    const giftPack = await ExclusiveGiftPacks.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!giftPack) {
      return res.status(404).json({
        success: false,
        message: 'Gift pack not found'
      });
    }

    // Increment view count
    giftPack.viewCount += 1;
    await giftPack.save();

    res.json({
      success: true,
      data: giftPack
    });
  } catch (error) {
    console.error('Error fetching gift pack:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gift pack',
      error: error.message
    });
  }
});

// PUT /api/exclusive-gift-packs/:id - Update gift pack
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      description,
      price,
      available,
      includes,
      city,
      province,
      contact,
      facebook,
      website,
      images
    } = req.body;

    const giftPack = await ExclusiveGiftPacks.findById(req.params.id);
    if (!giftPack) {
      return res.status(404).json({
        success: false,
        message: 'Gift pack not found'
      });
    }

    // Check if user owns this gift pack
    if (giftPack.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this gift pack'
      });
    }

    // Validate province and city
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

    // Update fields
    if (name) giftPack.name = name;
    if (specialization) giftPack.specialization = specialization;
    if (category) giftPack.category = category;
    if (description) giftPack.description = description;
    if (price !== undefined) giftPack.price = parseFloat(price);
    if (available !== undefined) giftPack.available = available;
    if (includes) giftPack.includes = includes;
    if (city) giftPack.location.city = city;
    if (province) giftPack.location.province = province;
    if (contact) giftPack.contact = contact;
    if (facebook !== undefined) giftPack.facebook = facebook;
    if (website !== undefined) giftPack.website = website;
    if (images && images.length > 0) {
      giftPack.images = images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: name || 'Gift pack image'
      }));
    }

    await giftPack.save();

    res.json({
      success: true,
      message: 'Gift pack updated successfully',
      data: giftPack
    });
  } catch (error) {
    console.error('Error updating gift pack:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update gift pack',
      error: error.message
    });
  }
});

// POST /api/exclusive-gift-packs/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const giftPack = await ExclusiveGiftPacks.findById(req.params.id);
    if (!giftPack) {
      return res.status(404).json({
        success: false,
        message: 'Gift pack not found'
      });
    }

    const review = {
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      reviewText: reviewText || ''
    };

    giftPack.reviews.push(review);
    giftPack.totalReviews = giftPack.reviews.length;
    giftPack.averageRating = (giftPack.reviews.reduce((sum, r) => sum + r.rating, 0) / giftPack.reviews.length).toFixed(1);

    await giftPack.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: giftPack
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

