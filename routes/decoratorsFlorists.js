const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const DecoratorsFlorists = require('../models/DecoratorsFlorists');
const DecoratorsFloristsReview = require('../models/DecoratorsFloristsReview');
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

// POST /api/decorators-florists/publish - Create decorator/florist profile and publish advertisement
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
      available,
      facebook,
      website,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !Array.isArray(includes) || includes.length === 0 || 
        !city || !province || !contact || !email || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count (max 4)
    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
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
      category: 'decorators_florists'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create decorator/florist profile
    const decoratorFlorist = new DecoratorsFlorists({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      includes: includes.filter(item => item.trim()),
      city,
      province,
      contact,
      email,
      available: available === true || available === 'true',
      facebook: facebook || null,
      website: website || null,
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      }))
    });

    await decoratorFlorist.save();

    // Calculate expiration date based on selectedPlan and planDuration (Sri Lankan timezone)
    const sriLankanTz = 'Asia/Colombo';
    let expiresAt = null;

    if (advertisement.selectedPlan === 'hourly' && advertisement.planDuration?.hours) {
      expiresAt = moment.tz(sriLankanTz).add(advertisement.planDuration.hours, 'hours').toDate();
    } else if (advertisement.selectedPlan === 'daily' && advertisement.planDuration?.days) {
      expiresAt = moment.tz(sriLankanTz).add(advertisement.planDuration.days, 'days').toDate();
    } else if (advertisement.selectedPlan === 'monthly') {
      expiresAt = moment.tz(sriLankanTz).add(1, 'month').toDate();
    } else if (advertisement.selectedPlan === 'yearly') {
      expiresAt = moment.tz(sriLankanTz).add(1, 'year').toDate();
    }

    // Update advertisement status and expiration
    await Advertisement.findByIdAndUpdate(
      advertisementId,
      {
        status: 'Published',
        publishedAt: moment.tz(sriLankanTz).toDate(),
        expiresAt: expiresAt,
        publishedAdId: decoratorFlorist._id,
        publishedAdModel: 'DecoratorsFlorists'
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Decorator/Florist profile published successfully',
      data: decoratorFlorist
    });
  } catch (error) {
    console.error('Error publishing decorator/florist profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish decorator/florist profile',
      error: error.message
    });
  }
});

// GET /api/decorators-florists/provinces - Get provinces and cities
router.get('/provinces', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: provincesAndDistricts
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces',
      error: error.message
    });
  }
});

// GET /api/decorators-florists/browse - Browse all decorators/florists with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter object - only show active profiles with non-expired advertisements
    const filter = {};

    if (province) filter.province = province;
    if (city) filter.city = city;
    if (specialization) filter.specialization = { $regex: specialization, $options: 'i' };
    if (category) filter.category = { $regex: category, $options: 'i' };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all matching decorators
    let decorators = await DecoratorsFlorists.find(filter)
      .populate('userId', 'name email')
      .lean();

    // Filter out expired advertisements
    const now = moment().tz('Asia/Colombo').toDate();
    decorators = await Promise.all(
      decorators.map(async (decorator) => {
        const ad = await Advertisement.findById(decorator.publishedAdId);
        if (ad && ad.status === 'Published' && ad.expiresAt > now) {
          return decorator;
        }
        return null;
      })
    );

    decorators = decorators.filter(d => d !== null);

    res.status(200).json({
      success: true,
      data: decorators
    });
  } catch (error) {
    console.error('Error browsing decorators/florists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse decorators/florists',
      error: error.message
    });
  }
});

// GET /api/decorators-florists/:id - Get specific decorator/florist profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decorator ID'
      });
    }

    const decorator = await DecoratorsFlorists.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userId', 'name email');

    if (!decorator) {
      return res.status(404).json({
        success: false,
        message: 'Decorator/Florist profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: decorator
    });
  } catch (error) {
    console.error('Error fetching decorator profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// PUT /api/decorators-florists/:id - Update decorator/florist profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decorator ID'
      });
    }

    // Check ownership
    const decorator = await DecoratorsFlorists.findById(id);
    if (!decorator) {
      return res.status(404).json({
        success: false,
        message: 'Decorator/Florist profile not found'
      });
    }

    if (decorator.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'specialization', 'category', 'description', 'experience',
                           'includes', 'city', 'province', 'contact', 'email', 'available',
                           'facebook', 'website', 'images'];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedDecorator = await DecoratorsFlorists.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedDecorator
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// DELETE /api/decorators-florists/:id - Delete decorator/florist profile
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decorator ID'
      });
    }

    const decorator = await DecoratorsFlorists.findById(id);
    if (!decorator) {
      return res.status(404).json({
        success: false,
        message: 'Decorator/Florist profile not found'
      });
    }

    if (decorator.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this profile'
      });
    }

    await DecoratorsFlorists.findByIdAndDelete(id);
    await DecoratorsFloristsReview.deleteMany({ decoratorId: id });

    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile',
      error: error.message
    });
  }
});

// POST /api/decorators-florists/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, title, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decorator ID'
      });
    }

    if (!rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating, title, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const decorator = await DecoratorsFlorists.findById(id);
    if (!decorator) {
      return res.status(404).json({
        success: false,
        message: 'Decorator/Florist profile not found'
      });
    }

    // Create review
    const review = new DecoratorsFloristsReview({
      decoratorId: id,
      userId,
      rating,
      title,
      comment
    });

    await review.save();
    await review.populate('userId', 'name email');

    // Update decorator's average rating
    const allReviews = await DecoratorsFloristsReview.find({ decoratorId: id });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / allReviews.length).toFixed(1));

    await DecoratorsFlorists.findByIdAndUpdate(
      id,
      {
        averageRating,
        totalReviews: allReviews.length
      }
    );

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: review
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

// GET /api/decorators-florists/:id/reviews - Get reviews for a decorator
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decorator ID'
      });
    }

    const reviews = await DecoratorsFloristsReview.find({ decoratorId: id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
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
