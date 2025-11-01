const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const EventPlannersCoordinators = require('../models/EventPlannersCoordinators');
const EventPlannersCoordinatorsReview = require('../models/EventPlannersCoordinatorsReview');
const Advertisement = require('../models/Advertisement');
const moment = require('moment-timezone');

// Provinces and districts mapping for Sri Lanka
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

// POST /api/event-planners-coordinators/publish - Create event planner profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
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
      email,
      facebook,
      website,
      available,
      weekdayAvailability,
      weekendAvailability,
      avatar,
      packages
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !Array.isArray(specialization) || 
        specialization.length === 0 || !category || !description || experience === undefined || 
        !city || !province || !contact || !email || !avatar || !avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
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

    // Validate contact number
    const contactRegex = /^[\d\s\-\+\(\)]{7,}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid contact number'
      });
    }

    // Fetch advertisement to get plan details
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Create event planner profile
    const eventPlanner = new EventPlannersCoordinators({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      email,
      facebook: facebook || null,
      website: website || null,
      available: available !== undefined ? available : true,
      weekdayAvailability: weekdayAvailability || '',
      weekendAvailability: weekendAvailability || '',
      avatar: {
        url: avatar.url,
        publicId: avatar.publicId
      },
      packages: packages ? {
        url: packages.url,
        publicId: packages.publicId,
        fileName: packages.fileName
      } : null
    });

    await eventPlanner.save();

    // Calculate expiration date based on Sri Lankan timezone
    const now = moment().tz('Asia/Colombo');
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
    advertisement.publishedAdId = eventPlanner._id;
    advertisement.publishedAdModel = 'EventPlannersCoordinators';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Event planner profile published successfully!',
      data: {
        eventPlanner: {
          _id: eventPlanner._id,
          name: eventPlanner.name,
          province: eventPlanner.province,
          city: eventPlanner.city,
          publishedAt: eventPlanner.publishedAt
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
    console.error('Error publishing event planner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/event-planners-coordinators/provinces - Get provinces and districts
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

// GET /api/event-planners-coordinators/browse - Browse all event planners with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter object - only show active, non-expired profiles
    const filter = { isActive: true };

    // Check for expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'EventPlannersCoordinators'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (province) filter.province = province;
    if (city) filter.city = city;
    if (specialization) filter.specialization = { $in: [specialization] };
    if (category) filter.category = category;

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch profiles and shuffle randomly
    const profiles = await EventPlannersCoordinators.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Shuffle the results randomly
    const shuffled = profiles.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: shuffled
    });
  } catch (error) {
    console.error('Error browsing event planners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse event planners'
    });
  }
});

// GET /api/event-planners-coordinators/:id - Get single event planner profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if advertisement is expired
    const advertisement = await Advertisement.findOne({
      publishedAdId: id,
      publishedAdModel: 'EventPlannersCoordinators'
    });

    if (advertisement && advertisement.status === 'expired') {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }

    const profile = await EventPlannersCoordinators.findById(id)
      .populate('userId', 'name email contactNumber');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Event planner profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching event planner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// POST /api/event-planners-coordinators/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    // Validate input
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

    // Check if profile exists
    const profile = await EventPlannersCoordinators.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Event planner profile not found'
      });
    }

    // Create review
    const review = new EventPlannersCoordinatorsReview({
      eventPlannerId: id,
      userId: req.user._id,
      rating,
      title,
      comment
    });

    await review.save();

    // Update profile rating
    const allReviews = await EventPlannersCoordinatorsReview.find({ eventPlannerId: id });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / allReviews.length).toFixed(1));

    profile.averageRating = averageRating;
    profile.totalReviews = allReviews.length;
    await profile.save();

    // Populate user info
    await review.populate('userId', 'name email');

    res.status(201).json({
      success: true,
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

// GET /api/event-planners-coordinators/:id/reviews - Get reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    const reviews = await EventPlannersCoordinatorsReview.find({ eventPlannerId: id })
      .populate('userId', 'name email')
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

// PUT /api/event-planners-coordinators/:id - Update event planner profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
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
      facebook,
      website,
      weekdayAvailability,
      weekendAvailability
    } = req.body;

    // Validate input
    if (!name || !specialization || !category || !description || !experience || !city || !province || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Find and update profile
    const profile = await EventPlannersCoordinators.findByIdAndUpdate(
      id,
      {
        name,
        specialization,
        category,
        description,
        experience: parseInt(experience),
        city,
        province,
        contact,
        available: available !== false,
        facebook: facebook || null,
        website: website || null,
        weekdayAvailability: weekdayAvailability || '',
        weekendAvailability: weekendAvailability || ''
      },
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Event planner profile not found'
      });
    }

    res.json({
      success: true,
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

