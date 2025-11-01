const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const SalonMakeupArtists = require('../models/SalonMakeupArtists');
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

// POST /api/salon-makeup-artists/publish - Create salon makeup artist profile and publish advertisement
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
      packages
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !includes || !Array.isArray(includes) || includes.length === 0 ||
        !city || !province || !contact || !email || !avatar || !avatar.url || !avatar.publicId) {
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
      category: 'salon_makeup_artists'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create salon makeup artist profile
    const salonMakeupArtist = new SalonMakeupArtists({
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
      packages: packages || null
    });

    await salonMakeupArtist.save();

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
    advertisement.publishedAdId = salonMakeupArtist._id;
    advertisement.publishedAdModel = 'SalonMakeupArtists';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Salon makeup artist profile published successfully',
      data: {
        profile: salonMakeupArtist,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing salon makeup artist profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/salon-makeup-artists/provinces - Get provinces and districts
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

// GET /api/salon-makeup-artists/browse - Browse all published profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter query
    let filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'Published',
      publishedAdModel: 'SalonMakeupArtists',
      expiresAt: { $lt: new Date() }
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (province) {
      filter['location.province'] = province;
    }

    if (city) {
      filter['location.city'] = city;
    }

    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const profiles = await SalonMakeupArtists.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error('Error browsing profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse profiles'
    });
  }
});

// GET /api/salon-makeup-artists/:id - Get specific profile details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const profile = await SalonMakeupArtists.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userId', 'name email')
      .populate('reviews.userId', 'name avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
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

// POST /api/salon-makeup-artists/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const profile = await SalonMakeupArtists.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = profile.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this profile'
      });
    }

    // Add review
    profile.reviews.push({
      userId: req.user._id,
      rating,
      comment: comment || ''
    });

    // Calculate average rating
    const totalRating = profile.reviews.reduce((sum, r) => sum + r.rating, 0);
    profile.averageRating = (totalRating / profile.reviews.length).toFixed(1);
    profile.totalReviews = profile.reviews.length;

    await profile.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// PUT /api/salon-makeup-artists/:id - Update profile
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
      packages
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const profile = await SalonMakeupArtists.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Verify ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this profile'
      });
    }

    // Update fields
    if (name) profile.name = name;
    if (specialization) profile.specialization = specialization;
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (experience !== undefined) profile.experience = parseInt(experience);
    if (includes && Array.isArray(includes)) profile.includes = includes;
    if (city) profile.location.city = city;
    if (province) profile.location.province = province;
    if (contact) profile.contact = contact;
    if (email) profile.email = email;
    if (facebook !== undefined) profile.facebook = facebook || null;
    if (website !== undefined) profile.website = website || null;
    if (available !== undefined) profile.available = available === true || available === 'true';
    if (avatar) profile.avatar = avatar;
    if (packages !== undefined) profile.packages = packages || null;

    await profile.save();

    res.status(200).json({
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

module.exports = router;

