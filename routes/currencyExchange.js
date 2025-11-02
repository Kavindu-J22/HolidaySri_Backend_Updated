const express = require('express');
const router = express.Router();
const CurrencyExchange = require('../models/CurrencyExchange');
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

// POST /api/currency-exchange/publish - Create currency exchange profile and publish advertisement
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
      available,
      availableDays,
      availableHours,
      includes,
      facebook,
      website,
      image
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !image || 
        !image.url || !image.publicId) {
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

    // Create currency exchange profile
    const currencyExchange = new CurrencyExchange({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      image,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      availableDays: availableDays || '',
      availableHours: availableHours || '',
      includes: includes || [],
      facebook: facebook || '',
      website: website || ''
    });

    await currencyExchange.save();

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
    advertisement.publishedAdId = currencyExchange._id;
    advertisement.publishedAdModel = 'CurrencyExchange';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Currency exchange profile published successfully',
      data: {
        profile: currencyExchange,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing currency exchange profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/currency-exchange/browse - Get all published currency exchanges with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = {};

    // Filter by search term
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by specialization
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    // Filter by category
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    // Filter by city
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Filter by province
    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    // Get all matching profiles
    let profiles = await CurrencyExchange.find(filter).populate('userId', 'name email');

    // Filter out expired advertisements
    const activeProfiles = [];
    for (const profile of profiles) {
      const ad = await Advertisement.findById(profile.publishedAdId);
      if (ad && ad.status !== 'expired') {
        activeProfiles.push(profile);
      }
    }

    // Random shuffle
    const shuffled = activeProfiles.sort(() => Math.random() - 0.5);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedProfiles = shuffled.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: paginatedProfiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(shuffled.length / parseInt(limit)),
        total: shuffled.length
      }
    });
  } catch (error) {
    console.error('Error fetching currency exchanges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch currency exchanges'
    });
  }
});

// GET /api/currency-exchange/:id - Get single currency exchange detail
router.get('/:id', async (req, res) => {
  try {
    const currencyExchange = await CurrencyExchange.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name');

    if (!currencyExchange) {
      return res.status(404).json({
        success: false,
        message: 'Currency exchange not found'
      });
    }

    // Increment view count
    currencyExchange.viewCount += 1;
    await currencyExchange.save();

    res.status(200).json({
      success: true,
      data: currencyExchange
    });
  } catch (error) {
    console.error('Error fetching currency exchange detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch currency exchange detail'
    });
  }
});

// PUT /api/currency-exchange/:id - Update currency exchange profile
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
      availableDays,
      availableHours,
      includes,
      facebook,
      website,
      image
    } = req.body;

    // Validate required fields
    if (!name || !specialization || !category || !description ||
        experience === undefined || !city || !province || !contact || !image ||
        !image.url || !image.publicId) {
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

    // Find the currency exchange profile
    const currencyExchange = await CurrencyExchange.findById(req.params.id);
    if (!currencyExchange) {
      return res.status(404).json({
        success: false,
        message: 'Currency exchange profile not found'
      });
    }

    // Check authorization
    if (currencyExchange.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update profile
    currencyExchange.name = name;
    currencyExchange.specialization = specialization;
    currencyExchange.category = category;
    currencyExchange.description = description;
    currencyExchange.experience = parseInt(experience);
    currencyExchange.city = city;
    currencyExchange.province = province;
    currencyExchange.contact = contact;
    currencyExchange.available = available !== undefined ? available : true;
    currencyExchange.availableDays = availableDays || '';
    currencyExchange.availableHours = availableHours || '';
    currencyExchange.includes = includes || [];
    currencyExchange.facebook = facebook || '';
    currencyExchange.website = website || '';
    currencyExchange.image = image;

    await currencyExchange.save();

    res.status(200).json({
      success: true,
      message: 'Currency exchange profile updated successfully',
      data: currencyExchange
    });
  } catch (error) {
    console.error('Error updating currency exchange profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// POST /api/currency-exchange/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const currencyExchange = await CurrencyExchange.findById(req.params.id);
    if (!currencyExchange) {
      return res.status(404).json({
        success: false,
        message: 'Currency exchange not found'
      });
    }

    // Add review
    currencyExchange.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating,
      review: review || ''
    });

    // Update average rating
    const totalRating = currencyExchange.reviews.reduce((sum, r) => sum + r.rating, 0);
    currencyExchange.averageRating = totalRating / currencyExchange.reviews.length;
    currencyExchange.totalReviews = currencyExchange.reviews.length;

    await currencyExchange.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: currencyExchange
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

