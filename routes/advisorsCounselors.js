const express = require('express');
const router = express.Router();
const AdvisorsCounselors = require('../models/AdvisorsCounselors');
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

// POST /api/advisors-counselors/publish - Create advisor/counselor profile and publish advertisement
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
      weekdays,
      weekends,
      times,
      facebook,
      website,
      avatar
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !avatar || 
        !avatar.url || !avatar.publicId) {
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

    // Create advisor/counselor profile
    const advisorCounselor = new AdvisorsCounselors({
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
      weekdays: weekdays || [],
      weekends: weekends || [],
      times: times || [],
      facebook: facebook || '',
      website: website || ''
    });

    await advisorCounselor.save();

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
    advertisement.publishedAdId = advisorCounselor._id;
    advertisement.publishedAdModel = 'AdvisorsCounselors';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Advisor/Counselor profile published successfully',
      data: {
        profile: advisorCounselor,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing advisor/counselor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/advisors-counselors/browse - Get all published advisors with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = { isActive: true };

    // Filter by search term (name, specialization, category, description)
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

    // Get advisors and check if their advertisements are not expired
    const skip = (page - 1) * limit;

    let advisors = await AdvisorsCounselors.find(filter)
      .populate('publishedAdId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Filter out advisors whose advertisements are expired
    advisors = advisors.filter(advisor => {
      if (advisor.publishedAdId && advisor.publishedAdId.expiresAt) {
        return new Date(advisor.publishedAdId.expiresAt) > new Date();
      }
      return true;
    });

    // Randomize the order
    advisors = advisors.sort(() => Math.random() - 0.5);

    // Get total count for pagination
    const totalAdvisors = await AdvisorsCounselors.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: advisors,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalAdvisors / limit),
        totalAdvisors: totalAdvisors
      }
    });
  } catch (error) {
    console.error('Error fetching advisors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advisors. Please try again.'
    });
  }
});

// GET /api/advisors-counselors/:id - Get advisor/counselor details
router.get('/:id', async (req, res) => {
  try {
    const advisor = await AdvisorsCounselors.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!advisor) {
      return res.status(404).json({
        success: false,
        message: 'Advisor/Counselor not found'
      });
    }

    // Increment view count
    advisor.viewCount += 1;
    await advisor.save();

    res.status(200).json({
      success: true,
      data: advisor
    });
  } catch (error) {
    console.error('Error fetching advisor details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advisor details. Please try again.'
    });
  }
});

// PUT /api/advisors-counselors/:id - Update advisor/counselor profile
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
      weekdays,
      weekends,
      times,
      facebook,
      website,
      avatar
    } = req.body;

    // Find the advisor
    const advisor = await AdvisorsCounselors.findById(req.params.id);
    if (!advisor) {
      return res.status(404).json({
        success: false,
        message: 'Advisor/Counselor not found'
      });
    }

    // Check if user owns this profile
    if (advisor.userId.toString() !== req.user._id.toString()) {
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
    if (name) advisor.name = name;
    if (specialization) advisor.specialization = specialization;
    if (category) advisor.category = category;
    if (description) advisor.description = description;
    if (experience !== undefined) advisor.experience = parseInt(experience);
    if (city) advisor.city = city;
    if (province) advisor.province = province;
    if (contact) advisor.contact = contact;
    if (available !== undefined) advisor.available = available;
    if (weekdays) advisor.weekdays = weekdays;
    if (weekends) advisor.weekends = weekends;
    if (times) advisor.times = times;
    if (facebook !== undefined) advisor.facebook = facebook;
    if (website !== undefined) advisor.website = website;
    if (avatar && avatar.url && avatar.publicId) {
      advisor.avatar = avatar;
    }

    await advisor.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: advisor
    });
  } catch (error) {
    console.error('Error updating advisor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/advisors-counselors/:id/reviews - Add review and rating
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

    // Find the advisor
    const advisor = await AdvisorsCounselors.findById(req.params.id);
    if (!advisor) {
      return res.status(404).json({
        success: false,
        message: 'Advisor/Counselor not found'
      });
    }

    // Create review object
    const newReview = {
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      review: review || '',
      createdAt: new Date()
    };

    // Initialize reviews array if it doesn't exist
    if (!advisor.reviews) {
      advisor.reviews = [];
    }

    // Add review
    advisor.reviews.push(newReview);

    // Calculate average rating
    const totalRating = advisor.reviews.reduce((sum, r) => sum + r.rating, 0);
    advisor.averageRating = (totalRating / advisor.reviews.length).toFixed(1);
    advisor.totalReviews = advisor.reviews.length;

    await advisor.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: advisor
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
});

// GET /api/advisors-counselors/:id/reviews - Get all reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const advisor = await AdvisorsCounselors.findById(req.params.id);
    if (!advisor) {
      return res.status(404).json({
        success: false,
        message: 'Advisor/Counselor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reviews: advisor.reviews || [],
        averageRating: advisor.averageRating,
        totalReviews: advisor.totalReviews
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews. Please try again.'
    });
  }
});

module.exports = router;

