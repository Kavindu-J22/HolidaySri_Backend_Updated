const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const FashionDesigners = require('../models/FashionDesigners');
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

// POST /api/fashion-designers/publish - Create fashion designer profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      experience,
      includes,
      city,
      province,
      contact,
      email,
      facebook,
      website,
      available,
      avatar,
      packages,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !includes || !Array.isArray(includes) || includes.length === 0 ||
        !city || !province || !contact || !email || !avatar || !avatar.url || !avatar.publicId ||
        !images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
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
      category: 'fashion_designers'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create fashion designer profile
    const fashionDesigner = new FashionDesigners({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      includes,
      location: {
        province,
        city
      },
      contact,
      email,
      facebook: facebook || null,
      website: website || null,
      available: available === true || available === 'true',
      avatar,
      packages: packages || null,
      images
    });

    await fashionDesigner.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    let expirationTime;
    const sriLankanNow = moment.tz('Asia/Colombo');

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
    advertisement.publishedAdId = fashionDesigner._id;
    advertisement.publishedAdModel = 'FashionDesigners';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Fashion designer profile published successfully',
      data: {
        profile: fashionDesigner,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing fashion designer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/fashion-designers/provinces - Get provinces and districts
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

// GET /api/fashion-designers/browse - Browse all fashion designers with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter query
    const filter = { isActive: true };

    // Filter by non-expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'FashionDesigners'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (province) filter['location.province'] = province;
    if (city) filter['location.city'] = city;
    if (specialization) filter.specialization = { $regex: specialization, $options: 'i' };
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch designers and shuffle randomly
    const designers = await FashionDesigners.find(filter)
      .populate('userId', 'name email')
      .sort({ publishedAt: -1 });

    // Shuffle array randomly
    const shuffled = designers.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: shuffled
    });
  } catch (error) {
    console.error('Error fetching fashion designers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fashion designers'
    });
  }
});

// GET /api/fashion-designers/:id - Get single fashion designer profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designer ID'
      });
    }

    // Check if advertisement is expired
    const advertisement = await Advertisement.findOne({
      publishedAdId: id,
      publishedAdModel: 'FashionDesigners'
    });

    if (advertisement && advertisement.status === 'Expired') {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }

    const designer = await FashionDesigners.findById(id)
      .populate('userId', 'name email');

    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Fashion designer not found'
      });
    }

    // Increment view count
    designer.viewCount = (designer.viewCount || 0) + 1;
    await designer.save();

    res.json({
      success: true,
      data: designer
    });
  } catch (error) {
    console.error('Error fetching fashion designer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fashion designer'
    });
  }
});

// GET /api/fashion-designers/:id/reviews - Get reviews for a designer
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designer ID'
      });
    }

    const designer = await FashionDesigners.findById(id);

    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Fashion designer not found'
      });
    }

    const skip = (page - 1) * limit;
    const reviews = designer.reviews.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: designer.reviews.length
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// POST /api/fashion-designers/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designer ID'
      });
    }

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

    const designer = await FashionDesigners.findById(id);

    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Fashion designer not found'
      });
    }

    // Check if user already reviewed
    const existingReview = designer.reviews.find(r => r.userId.toString() === req.user._id.toString());

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.review = review;
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      designer.reviews.push({
        userId: req.user._id,
        userName: req.user.name,
        rating,
        review,
        createdAt: new Date()
      });
    }

    // Recalculate average rating
    const totalRating = designer.reviews.reduce((sum, r) => sum + r.rating, 0);
    designer.averageRating = (totalRating / designer.reviews.length).toFixed(1);
    designer.totalReviews = designer.reviews.length;

    await designer.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: designer
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// PUT /api/fashion-designers/:id - Update fashion designer profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      specialization,
      category,
      description,
      experience,
      includes,
      city,
      province,
      contact,
      email,
      facebook,
      website,
      available,
      avatar,
      packages,
      images
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designer ID'
      });
    }

    const designer = await FashionDesigners.findById(id);

    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Fashion designer not found'
      });
    }

    // Verify ownership
    if (designer.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this profile'
      });
    }

    // Validate experience if provided
    if (experience !== undefined && (experience < 0 || experience > 70)) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate province and city if provided
    if (province && city) {
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

    // Update fields
    if (name) designer.name = name;
    if (specialization) designer.specialization = specialization;
    if (category) designer.category = category;
    if (description) designer.description = description;
    if (experience !== undefined) designer.experience = parseInt(experience);
    if (includes && Array.isArray(includes)) designer.includes = includes;
    if (province && city) {
      designer.location = { province, city };
    }
    if (contact) designer.contact = contact;
    if (email) designer.email = email;
    if (facebook !== undefined) designer.facebook = facebook || null;
    if (website !== undefined) designer.website = website || null;
    if (available !== undefined) designer.available = available === true || available === 'true';
    if (avatar) designer.avatar = avatar;
    if (packages !== undefined) designer.packages = packages || null;
    if (images && Array.isArray(images)) designer.images = images;

    await designer.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: designer
    });
  } catch (error) {
    console.error('Error updating fashion designer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

module.exports = router;

