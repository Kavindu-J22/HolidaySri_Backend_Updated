const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const { CaregiversTimeCurrency, CaregiverReview } = require('../models/CaregiversTimeCurrency');
const Advertisement = require('../models/Advertisement');

// Sri Lankan provinces and districts mapping for validation
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

// Generate unique careID (CHS + 4 digits)
const generateCareID = async () => {
  let careID;
  let isUnique = false;

  while (!isUnique) {
    // Generate 4-digit random number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    careID = `CHS${randomNum}`;

    // Check if this ID already exists
    const existing = await CaregiversTimeCurrency.findOne({ careID });
    if (!existing) {
      isUnique = true;
    }
  }

  return careID;
};

// Calculate expiration date based on plan and duration (Sri Lankan timezone)
const calculateExpirationDate = (selectedPlan, planDuration) => {
  const sriLankanNow = moment.tz('Asia/Colombo');
  let expirationTime;

  switch (selectedPlan) {
    case 'hourly':
      expirationTime = (planDuration.hours || 1) * 60 * 60 * 1000;
      break;
    case 'daily':
      expirationTime = (planDuration.days || 1) * 24 * 60 * 60 * 1000;
      break;
    case 'monthly':
      expirationTime = 30 * 24 * 60 * 60 * 1000;
      break;
    case 'yearly':
      expirationTime = 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      expirationTime = 24 * 60 * 60 * 1000; // fallback to 1 day
  }

  return new Date(sriLankanNow.valueOf() + expirationTime);
};

// POST /api/caregivers-time-currency/publish - Create caregiver/care needer profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      gender,
      age,
      description,
      city,
      province,
      contact,
      available,
      occupied,
      facebook,
      website,
      avatar,
      speakingLanguages,
      type,
      experience,
      services,
      reason,
      specialNeeds
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !gender || !age || !description || 
        !city || !province || !contact || !avatar || !avatar.url || 
        !avatar.publicId || !speakingLanguages || speakingLanguages.length === 0 || !type) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate age
    if (age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100'
      });
    }

    // Validate province and city combination
    const validCities = provincesAndDistricts[province];
    if (!validCities || !validCities.includes(city)) {
      return res.status(400).json({
        success: false,
        message: `Invalid city "${city}" for province "${province}"`
      });
    }

    // Validate type-specific fields
    if (type === 'Care Giver') {
      if (experience === undefined || experience === null) {
        return res.status(400).json({
          success: false,
          message: 'Experience is required for Care Giver'
        });
      }
      if (!services || services.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one service is required for Care Giver'
        });
      }
      if (experience < 0 || experience > 70) {
        return res.status(400).json({
          success: false,
          message: 'Experience must be between 0 and 70 years'
        });
      }
    } else if (type === 'Care Needer') {
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for Care Needer'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Care Giver" or "Care Needer"'
      });
    }

    // Verify advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'caregivers_time_currency'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Check if advertisement is already published
    if (advertisement.status === 'Published') {
      return res.status(400).json({
        success: false,
        message: 'This advertisement has already been published'
      });
    }

    // Generate unique careID
    const careID = await generateCareID();

    // Prepare profile data
    const profileData = {
      userId: req.user._id,
      publishedAdId: advertisementId,
      careID,
      type,
      name,
      gender,
      age,
      description,
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      occupied: occupied !== undefined ? occupied : false,
      facebook: facebook || '',
      website: website || '',
      avatar,
      speakingLanguages
    };

    // Add type-specific fields
    if (type === 'Care Giver') {
      profileData.careGiverDetails = {
        experience,
        services
      };
      profileData.HSTC = 36;
    } else if (type === 'Care Needer') {
      profileData.careNeederDetails = {
        reason,
        specialNeeds: specialNeeds || []
      };
      profileData.HSTC = 720;
    }

    // Create caregiver/care needer profile
    const profile = new CaregiversTimeCurrency(profileData);
    await profile.save();

    // Calculate expiration date
    const sriLankanNow = moment.tz('Asia/Colombo');
    const expiresAt = calculateExpirationDate(advertisement.selectedPlan, advertisement.planDuration);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = profile._id;
    advertisement.publishedAdModel = 'CaregiversTimeCurrency';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Caregiver/Care Needer profile published successfully',
      data: {
        profile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing caregiver/care needer profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/caregivers-time-currency/provinces - Get all provinces and cities
router.get('/provinces', async (req, res) => {
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

// GET /api/caregivers-time-currency/check-access - Check if user has access to browse page
router.get('/check-access', verifyToken, async (req, res) => {
  try {
    // Check if user has an advertisement with category caregivers_time_currency
    const advertisement = await Advertisement.findOne({
      userId: req.user._id,
      category: 'caregivers_time_currency',
      status: { $in: ['Published', 'active'] }
    });

    if (!advertisement) {
      return res.json({
        success: false,
        hasAccess: false,
        message: 'no_advertisement',
        data: null
      });
    }

    // Check if user has published their profile
    const profile = await CaregiversTimeCurrency.findOne({
      publishedAdId: advertisement._id
    });

    if (!profile) {
      return res.json({
        success: false,
        hasAccess: false,
        message: 'no_published_profile',
        data: null
      });
    }

    res.json({
      success: true,
      hasAccess: true,
      message: 'access_granted',
      data: {
        advertisement,
        profile
      }
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access'
    });
  }
});

// GET /api/caregivers-time-currency/browse - Get all active caregiver profiles (with filters)
router.get('/browse', async (req, res) => {
  try {
    const { type, city, province, search } = req.query;

    // Build query
    let query = { isActive: true };

    if (type && (type === 'Care Giver' || type === 'Care Needer')) {
      query.type = type;
    }

    if (city) {
      query.city = city;
    }

    if (province) {
      query.province = province;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all profiles
    let profiles = await CaregiversTimeCurrency.find(query)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'status expiresAt')
      .lean();

    // Filter out expired advertisements
    profiles = profiles.filter(profile => {
      if (!profile.publishedAdId) return false;
      if (profile.publishedAdId.status === 'expired') return false;
      return true;
    });

    // Randomize the order
    profiles = profiles.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('Error fetching caregiver profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/caregivers-time-currency/:id - Get single caregiver profile by ID
router.get('/:id', async (req, res) => {
  try {
    const profile = await CaregiversTimeCurrency.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId', 'status expiresAt');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if advertisement is expired
    if (profile.publishedAdId && profile.publishedAdId.status === 'expired') {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
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

// GET /api/caregivers-time-currency/user/my-profile - Get user's own profile
router.get('/user/my-profile', verifyToken, async (req, res) => {
  try {
    const profile = await CaregiversTimeCurrency.findOne({ userId: req.user._id })
      .populate('publishedAdId', 'status expiresAt');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/caregivers-time-currency/:id - Update caregiver profile (HSTC cannot be changed)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      gender,
      age,
      description,
      city,
      province,
      contact,
      available,
      occupied,
      facebook,
      website,
      avatar,
      speakingLanguages,
      type,
      experience,
      services,
      reason,
      specialNeeds
    } = req.body;

    // Find profile
    const profile = await CaregiversTimeCurrency.findById(req.params.id);

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
        message: 'You do not have permission to edit this profile'
      });
    }

    // Validate required fields
    if (!name || !gender || !age || !description || !city || !province ||
        !contact || !avatar || !avatar.url || !speakingLanguages ||
        speakingLanguages.length === 0 || !type) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate age
    if (age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100'
      });
    }

    // Validate province and city combination
    const validCities = provincesAndDistricts[province];
    if (!validCities || !validCities.includes(city)) {
      return res.status(400).json({
        success: false,
        message: `Invalid city "${city}" for province "${province}"`
      });
    }

    // Store the original HSTC value (cannot be changed)
    const originalHSTC = profile.HSTC;

    // Update basic fields
    profile.name = name;
    profile.gender = gender;
    profile.age = age;
    profile.description = description;
    profile.city = city;
    profile.province = province;
    profile.contact = contact;
    profile.available = available !== undefined ? available : profile.available;
    profile.occupied = occupied !== undefined ? occupied : profile.occupied;
    profile.facebook = facebook || '';
    profile.website = website || '';
    profile.avatar = avatar;
    profile.speakingLanguages = speakingLanguages;
    profile.type = type;

    // Update type-specific fields based on new type
    if (type === 'Care Giver') {
      if (experience === undefined || experience === null) {
        return res.status(400).json({
          success: false,
          message: 'Experience is required for Care Giver'
        });
      }
      if (!services || services.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one service is required for Care Giver'
        });
      }
      if (experience < 0 || experience > 70) {
        return res.status(400).json({
          success: false,
          message: 'Experience must be between 0 and 70 years'
        });
      }
      profile.careGiverDetails = {
        experience,
        services
      };
      profile.careNeederDetails = {
        reason: '',
        specialNeeds: []
      };
    } else if (type === 'Care Needer') {
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for Care Needer'
        });
      }
      profile.careNeederDetails = {
        reason,
        specialNeeds: specialNeeds || []
      };
      profile.careGiverDetails = {
        experience: undefined,
        services: []
      };
    }

    // Restore the original HSTC value (prevent changes)
    profile.HSTC = originalHSTC;

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
      message: error.message || 'Failed to update profile'
    });
  }
});

// POST /api/caregivers-time-currency/:id/review - Add a review and rating
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const caregiverId = req.params.id;

    // Validate input
    if (!rating || !review) {
      return res.status(400).json({
        success: false,
        message: 'Rating and review are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find the caregiver profile
    const profile = await CaregiversTimeCurrency.findById(caregiverId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user is trying to review their own profile
    if (profile.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot review your own profile'
      });
    }

    // Check if user has already reviewed this profile
    const existingReview = await CaregiverReview.findOne({
      caregiverId,
      userId: req.user._id
    });

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.review = review;
      await existingReview.save();

      // Recalculate average rating
      const allReviews = await CaregiverReview.find({ caregiverId });
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      profile.averageRating = totalRating / allReviews.length;
      profile.totalReviews = allReviews.length;
      await profile.save();

      return res.json({
        success: true,
        message: 'Review updated successfully',
        data: existingReview
      });
    }

    // Create new review
    const newReview = new CaregiverReview({
      caregiverId,
      userId: req.user._id,
      userName: req.user.name,
      userAvatar: req.user.avatar || '',
      rating,
      review
    });

    await newReview.save();

    // Update profile's average rating and total reviews
    const allReviews = await CaregiverReview.find({ caregiverId });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    profile.averageRating = totalRating / allReviews.length;
    profile.totalReviews = allReviews.length;
    await profile.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// GET /api/caregivers-time-currency/:id/reviews - Get all reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await CaregiverReview.find({ caregiverId: req.params.id })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews,
      count: reviews.length
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

