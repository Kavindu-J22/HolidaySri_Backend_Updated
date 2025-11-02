const express = require('express');
const router = express.Router();
const OtherProfessionalsServices = require('../models/OtherProfessionalsServices');
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

// POST /api/other-professionals-services/publish - Create profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      type,
      description,
      experience,
      city,
      province,
      contact,
      available,
      weekdays,
      weekends,
      facebook,
      website,
      avatar
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !type || !description || 
        experience === undefined || !city || !province || !contact || !avatar || 
        !avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate type
    if (!['Professionals', 'Service'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Professionals" or "Service"'
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

    // Create professional/service profile
    const professional = new OtherProfessionalsServices({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      avatar,
      specialization,
      category,
      type,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      available: available !== undefined ? available : true,
      weekdays: weekdays || '',
      weekends: weekends || '',
      facebook: facebook || '',
      website: website || ''
    });

    await professional.save();

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
    advertisement.publishedAdId = professional._id;
    advertisement.publishedAdModel = 'OtherProfessionalsServices';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Professional/Service profile published successfully',
      data: {
        profile: professional,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing professional/service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/other-professionals-services/provinces - Get provinces and districts
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
      message: 'Failed to fetch provinces'
    });
  }
});

// GET /api/other-professionals-services/browse - Get all published professionals with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, type, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    if (type) {
      filter.type = type;
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const totalCount = await OtherProfessionalsServices.countDocuments(filter);

    // Get professionals with random sorting
    const professionals = await OtherProfessionalsServices.find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    // Filter out expired advertisements
    const filteredProfessionals = [];
    for (const professional of professionals) {
      const advertisement = await Advertisement.findById(professional.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        filteredProfessionals.push(professional);
      }
    }

    res.status(200).json({
      success: true,
      data: filteredProfessionals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professionals'
    });
  }
});

// GET /api/other-professionals-services/:id - Get professional detail
router.get('/:id', async (req, res) => {
  try {
    const professional = await OtherProfessionalsServices.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name');

    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    // Increment view count
    professional.viewCount = (professional.viewCount || 0) + 1;
    await professional.save();

    res.status(200).json({
      success: true,
      data: professional
    });
  } catch (error) {
    console.error('Error fetching professional detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professional details'
    });
  }
});

// PUT /api/other-professionals-services/:id - Update professional profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      specialization,
      category,
      type,
      description,
      experience,
      city,
      province,
      contact,
      available,
      weekdays,
      weekends,
      facebook,
      website,
      avatar
    } = req.body;

    // Validate required fields
    if (!name || !specialization || !category || !type || !description ||
        experience === undefined || !city || !province || !contact || !avatar ||
        !avatar.url || !avatar.publicId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate type
    if (!['Professionals', 'Service'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Professionals" or "Service"'
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

    // Find professional
    const professional = await OtherProfessionalsServices.findById(req.params.id);
    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    // Check authorization
    if (professional.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update fields
    professional.name = name;
    professional.specialization = specialization;
    professional.category = category;
    professional.type = type;
    professional.description = description;
    professional.experience = parseInt(experience);
    professional.city = city;
    professional.province = province;
    professional.contact = contact;
    professional.available = available !== undefined ? available : true;
    professional.weekdays = weekdays || '';
    professional.weekends = weekends || '';
    professional.facebook = facebook || '';
    professional.website = website || '';
    professional.avatar = avatar;

    await professional.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: professional
    });
  } catch (error) {
    console.error('Error updating professional profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// POST /api/other-professionals-services/:id/reviews - Add review
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

    // Find professional
    const professional = await OtherProfessionalsServices.findById(req.params.id);
    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    // Add review
    professional.reviews.push({
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      review: review || '',
      createdAt: new Date()
    });

    // Calculate average rating
    const totalRating = professional.reviews.reduce((sum, r) => sum + r.rating, 0);
    professional.averageRating = (totalRating / professional.reviews.length).toFixed(1);
    professional.totalReviews = professional.reviews.length;

    await professional.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: professional
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

