const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const ProfessionalDrivers = require('../models/ProfessionalDrivers');
const ProfessionalDriversReview = require('../models/ProfessionalDriversReview');
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

// POST /api/professional-drivers/publish - Create professional driver profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      categories,
      description,
      experience,
      city,
      province,
      available,
      weekdayAvailability,
      weekendAvailability,
      contact,
      website,
      facebook,
      avatar
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !categories || !Array.isArray(categories) || 
        categories.length === 0 || !description || experience === undefined || !city || !province || 
        !contact || !avatar || !avatar.url || !avatar.publicId) {
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
      category: 'professional_drivers'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create professional driver profile
    const professionalDriver = new ProfessionalDrivers({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      categories,
      description,
      experience: parseInt(experience),
      city,
      province,
      available: available === true || available === 'true',
      weekdayAvailability,
      weekendAvailability,
      contact,
      website: website || null,
      facebook: facebook || null,
      avatar
    });

    await professionalDriver.save();

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
    advertisement.publishedAdId = professionalDriver._id;
    advertisement.publishedAdModel = 'ProfessionalDrivers';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Professional driver profile published successfully',
      data: {
        profile: professionalDriver,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing professional driver profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/professional-drivers/provinces - Get provinces and districts
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

// GET /api/professional-drivers/browse - Browse all professional drivers with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (province) filter.province = province;
    if (city) filter.city = city;
    if (specialization) filter.specialization = specialization;
    if (category) filter.categories = { $in: [category] };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { categories: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch professional drivers
    const drivers = await ProfessionalDrivers.find(filter)
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    // Filter out expired advertisements
    const validDrivers = [];
    for (const driver of drivers) {
      const advertisement = await Advertisement.findById(driver.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        validDrivers.push(driver);
      }
    }

    res.json({
      success: true,
      data: validDrivers
    });
  } catch (error) {
    console.error('Error fetching professional drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professional drivers'
    });
  }
});

// GET /api/professional-drivers/:id - Get single professional driver profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await ProfessionalDrivers.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    profile.viewCount += 1;
    await profile.save();

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/professional-drivers/:id - Update professional driver profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      specialization,
      categories,
      description,
      experience,
      city,
      province,
      available,
      weekdayAvailability,
      weekendAvailability,
      contact,
      website,
      facebook,
      avatar
    } = req.body;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    // Find profile and verify ownership
    const profile = await ProfessionalDrivers.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this profile'
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

    // Validate experience if provided
    if (experience !== undefined && (experience < 0 || experience > 70)) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Update profile
    if (name) profile.name = name;
    if (specialization) profile.specialization = specialization;
    if (categories && Array.isArray(categories) && categories.length > 0) profile.categories = categories;
    if (description) profile.description = description;
    if (experience !== undefined) profile.experience = experience;
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (available !== undefined) profile.available = available;
    if (weekdayAvailability) profile.weekdayAvailability = weekdayAvailability;
    if (weekendAvailability) profile.weekendAvailability = weekendAvailability;
    if (contact) profile.contact = contact;
    if (website) profile.website = website;
    if (facebook) profile.facebook = facebook;
    if (avatar && avatar.url && avatar.publicId) {
      profile.avatar = avatar;
    }

    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// POST /api/professional-drivers/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    // Validate review data
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

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    // Find profile
    const profile = await ProfessionalDrivers.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Create review
    const review = new ProfessionalDriversReview({
      profileId: id,
      userId: req.user._id,
      rating,
      title,
      comment
    });

    await review.save();

    // Update profile ratings
    const allReviews = await ProfessionalDriversReview.find({
      profileId: id,
      isActive: true
    });

    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;

    profile.averageRating = parseFloat(averageRating.toFixed(1));
    profile.totalReviews = allReviews.length;

    await profile.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: review
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// GET /api/professional-drivers/:id/reviews - Get reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const reviews = await ProfessionalDriversReview.find({
      profileId: id,
      isActive: true
    })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

module.exports = router;

