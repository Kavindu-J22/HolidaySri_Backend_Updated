const express = require('express');
const router = express.Router();
const EducationalTutoring = require('../models/EducationalTutoring');
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

// POST /api/educational-tutoring/publish - Create educational tutoring profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    console.log('Educational Tutoring Publish Request:', {
      body: req.body,
      userId: req.user._id
    });

    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      website,
      facebook,
      avatar,
      images,
      availability
    } = req.body;

    // Validate required fields with detailed error messages
    if (!advertisementId) {
      return res.status(400).json({
        success: false,
        message: 'Advertisement ID is required'
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (!description || description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    if (experience === undefined || experience === null || experience === '') {
      return res.status(400).json({
        success: false,
        message: 'Experience is required'
      });
    }

    if (!city || city.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }

    if (!province || province.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Province is required'
      });
    }

    if (!contact || contact.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Contact is required'
      });
    }

    if (!avatar || !avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Avatar with URL and public ID is required'
      });
    }

    // Validate specialization is an array
    if (!Array.isArray(specialization) || specialization.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one specialization must be provided'
      });
    }

    // Validate experience
    const experienceNum = parseInt(experience);
    if (isNaN(experienceNum) || experienceNum < 0 || experienceNum > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be a valid number between 0 and 70 years'
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

    // Create educational tutoring profile
    const educationalTutoring = new EducationalTutoring({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name: name.trim(),
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      category: category.trim(),
      description: description.trim(),
      experience: experienceNum,
      location: {
        province: province.trim(),
        city: city.trim()
      },
      contact: contact.trim(),
      available: available !== undefined ? available : true,
      website: website && website.trim() ? website.trim() : null,
      facebook: facebook && facebook.trim() ? facebook.trim() : null,
      avatar,
      images: images || [],
      availability: availability || {}
    });

    await educationalTutoring.save();

    // Calculate expiration time based on plan (Sri Lankan timezone)
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
    advertisement.publishedAdId = educationalTutoring._id;
    advertisement.publishedAdModel = 'EducationalTutoring';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Educational tutoring profile published successfully',
      data: {
        profile: educationalTutoring,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing educational tutoring profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/educational-tutoring/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  try {
    const provinces = Object.keys(provincesAndDistricts).map(province => ({
      province,
      districts: provincesAndDistricts[province]
    }));

    res.json({
      success: true,
      data: provinces
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces'
    });
  }
});

// GET /api/educational-tutoring/browse - Get all active educational tutoring profiles
router.get('/browse', async (req, res) => {
  try {
    const { specialization, category, city, province, search, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = { isActive: true };

    // Filter by advertisement status (not expired)
    const Advertisement = require('../models/Advertisement');
    const activeAds = await Advertisement.find({
      status: 'Published',
      publishedAdModel: 'EducationalTutoring',
      expiresAt: { $gt: new Date() }
    }).select('publishedAdId');

    const activeAdIds = activeAds.map(ad => ad.publishedAdId);
    filter._id = { $in: activeAdIds };

    if (specialization) {
      filter.specialization = { $in: Array.isArray(specialization) ? specialization : [specialization] };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    if (city) {
      filter['location.city'] = city;
    }

    if (province) {
      filter['location.province'] = province;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { specialization: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Get total count
    const total = await EducationalTutoring.countDocuments(filter);

    // Get profiles with random sorting
    const profiles = await EducationalTutoring.find(filter)
      .populate('userId', 'name email')
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Shuffle results for random display
    const shuffled = profiles.sort(() => Math.random() - 0.5);

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
    console.error('Error fetching educational tutoring profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/educational-tutoring/:id - Get single educational tutoring profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await EducationalTutoring.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if advertisement is expired
    const Advertisement = require('../models/Advertisement');
    const ad = await Advertisement.findById(profile.publishedAdId);

    if (!ad || ad.status !== 'Published' || (ad.expiresAt && ad.expiresAt < new Date())) {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }

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

// GET /api/educational-tutoring/:id/edit - Get profile for editing (owner only)
router.get('/:id/edit', verifyToken, async (req, res) => {
  try {
    const profile = await EducationalTutoring.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user is the owner
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this profile'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile for edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/educational-tutoring/:id - Update educational tutoring profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      website,
      facebook,
      avatar,
      images,
      availability
    } = req.body;

    const profile = await EducationalTutoring.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user is the owner
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this profile'
      });
    }

    // Validate required fields
    if (!name || !specialization || !category || !description || experience === undefined || !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Update profile
    profile.name = name.trim();
    profile.specialization = Array.isArray(specialization) ? specialization : [specialization];
    profile.category = category.trim();
    profile.description = description.trim();
    profile.experience = parseInt(experience);
    profile.location = { province: province.trim(), city: city.trim() };
    profile.contact = contact.trim();
    profile.available = available !== undefined ? available : true;
    profile.website = website && website.trim() ? website.trim() : null;
    profile.facebook = facebook && facebook.trim() ? facebook.trim() : null;

    if (avatar && avatar.url) {
      profile.avatar = avatar;
    }

    if (images && Array.isArray(images)) {
      profile.images = images;
    }

    if (availability) {
      profile.availability = availability;
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

// POST /api/educational-tutoring/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!review || review.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    const profile = await EducationalTutoring.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = profile.reviews.find(r => r.userId.toString() === req.user._id.toString());

    if (existingReview) {
      // Update existing review
      existingReview.userName = req.user.name || 'Anonymous';
      existingReview.rating = rating;
      existingReview.reviewText = review.trim();
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      profile.reviews.push({
        userId: req.user._id,
        userName: req.user.name || 'Anonymous',
        rating,
        reviewText: review.trim(),
        createdAt: new Date()
      });
    }

    // Calculate average rating
    const avgRating = profile.reviews.reduce((sum, r) => sum + r.rating, 0) / profile.reviews.length;
    profile.averageRating = parseFloat(avgRating.toFixed(1));
    profile.totalReviews = profile.reviews.length;

    await profile.save();

    res.json({
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

module.exports = router;

