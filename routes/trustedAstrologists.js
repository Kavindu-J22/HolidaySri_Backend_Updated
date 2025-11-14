const express = require('express');
const router = express.Router();
const TrustedAstrologists = require('../models/TrustedAstrologists');
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

// POST /api/trusted-astrologists/publish - Create trusted astrologist profile and publish advertisement
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
      facebook,
      website,
      whatsapp,
      avatar,
      pricingPDF,
      weekdays,
      weekends
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !whatsapp ||
        !avatar || !avatar.url || !avatar.publicId ||
        !pricingPDF || !pricingPDF.url || !pricingPDF.publicId) {
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

    // Create trusted astrologist profile
    const astrologist = new TrustedAstrologists({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      facebook: facebook || '',
      website: website || '',
      whatsapp,
      pricingPDF,
      schedule: {
        weekdays: weekdays || '',
        weekends: weekends || ''
      }
    });

    await astrologist.save();

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
    advertisement.publishedAdId = astrologist._id;
    advertisement.publishedAdModel = 'TrustedAstrologists';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Trusted Astrologist profile published successfully',
      data: {
        profile: astrologist,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing trusted astrologist profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/trusted-astrologists/browse - Browse all published profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { search = '', specialization = '', category = '', city = '', province = '', page = 1, limit = 12 } = req.query;

    // Build filter query
    const filter = { isActive: true };

    // Exclude expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'TrustedAstrologists'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    // Search by name, specialization, category, or description
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

    // Get total count
    const total = await TrustedAstrologists.countDocuments(filter);

    // Fetch profiles with random sorting
    const profiles = await TrustedAstrologists.find(filter)
      .sort({ _id: 1 }) // First sort by ID for consistency
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Shuffle the results for random display
    const shuffled = profiles.sort(() => Math.random() - 0.5);

    res.status(200).json({
      success: true,
      data: shuffled,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles. Please try again.'
    });
  }
});

// GET /api/trusted-astrologists/provinces - Get provinces and districts
router.get('/provinces', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: provincesAndDistricts
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces. Please try again.'
    });
  }
});

// GET /api/trusted-astrologists/:id - Get single profile details
router.get('/:id', async (req, res) => {
  try {
    const profile = await TrustedAstrologists.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    profile.viewCount = (profile.viewCount || 0) + 1;
    await profile.save();

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile. Please try again.'
    });
  }
});

// PUT /api/trusted-astrologists/:id - Update profile
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
      facebook,
      website,
      whatsapp,
      avatar,
      pricingPDF,
      weekdays,
      weekends
    } = req.body;

    // Find profile
    const profile = await TrustedAstrologists.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check authorization
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
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
    if (name) profile.name = name;
    if (specialization) profile.specialization = specialization;
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (experience !== undefined) profile.experience = parseInt(experience);
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (contact) profile.contact = contact;
    if (available !== undefined) profile.available = available;
    if (facebook !== undefined) profile.facebook = facebook;
    if (website !== undefined) profile.website = website;
    if (whatsapp) profile.whatsapp = whatsapp;
    if (avatar && avatar.url && avatar.publicId) profile.avatar = avatar;
    if (pricingPDF && pricingPDF.url && pricingPDF.publicId) profile.pricingPDF = pricingPDF;
    if (weekdays !== undefined || weekends !== undefined) {
      profile.schedule = {
        weekdays: weekdays !== undefined ? weekdays : profile.schedule.weekdays,
        weekends: weekends !== undefined ? weekends : profile.schedule.weekends
      };
    }

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
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/trusted-astrologists/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find profile
    const profile = await TrustedAstrologists.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Add review
    const newReview = {
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      review: review || '',
      createdAt: new Date()
    };

    profile.reviews = profile.reviews || [];
    profile.reviews.push(newReview);

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
      message: 'Failed to add review. Please try again.'
    });
  }
});

module.exports = router;

