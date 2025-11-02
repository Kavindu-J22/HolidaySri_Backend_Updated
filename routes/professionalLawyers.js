const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const Advertisement = require('../models/Advertisement');
const ProfessionalLawyers = require('../models/ProfessionalLawyers');
const ProfessionalLawyersReview = require('../models/ProfessionalLawyersReview');

// Sri Lankan provinces and districts
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

// POST /api/professional-lawyers/publish - Create professional lawyer profile and publish advertisement
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
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
      });
    }

    // Find advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'professional_lawyers'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Create professional lawyer profile
    const professionalLawyer = new ProfessionalLawyers({
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
      available: available || true,
      weekdays: weekdays || [],
      weekends: weekends || [],
      times: times || [],
      facebook: facebook || null,
      website: website || null,
      avatar: {
        url: avatar.url,
        publicId: avatar.publicId
      }
    });

    await professionalLawyer.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const sriLankanNow = moment.tz('Asia/Colombo');
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
    advertisement.publishedAdId = professionalLawyer._id;
    advertisement.publishedAdModel = 'ProfessionalLawyers';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Professional lawyer profile published successfully',
      data: {
        profile: professionalLawyer,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing professional lawyer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/professional-lawyers/provinces - Get provinces and districts
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

// GET /api/professional-lawyers/browse - Get all published professional lawyers with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter query
    const filter = {};

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

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    // Get total count
    const totalCount = await ProfessionalLawyers.countDocuments(filter);

    // Get paginated results with random sorting
    const skip = (page - 1) * limit;
    const lawyers = await ProfessionalLawyers.find(filter)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Shuffle results randomly
    const shuffled = lawyers.sort(() => Math.random() - 0.5);

    // Get reviews for each lawyer
    const lawyersWithReviews = await Promise.all(
      shuffled.map(async (lawyer) => {
        const reviews = await ProfessionalLawyersReview.find({
          professionalLawyerId: lawyer._id,
          status: 'approved'
        }).lean();

        const avgRating = reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 0;

        return {
          ...lawyer,
          averageRating: parseFloat(avgRating),
          totalReviews: reviews.length
        };
      })
    );

    res.json({
      success: true,
      data: lawyersWithReviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching professional lawyers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professional lawyers'
    });
  }
});

// GET /api/professional-lawyers/:id - Get single professional lawyer with reviews
router.get('/:id', async (req, res) => {
  try {
    const lawyer = await ProfessionalLawyers.findById(req.params.id)
      .populate('userId', 'name email')
      .lean();

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Professional lawyer not found'
      });
    }

    // Get reviews
    const reviews = await ProfessionalLawyersReview.find({
      professionalLawyerId: req.params.id,
      status: 'approved'
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        ...lawyer,
        averageRating: parseFloat(avgRating),
        totalReviews: reviews.length,
        reviews
      }
    });
  } catch (error) {
    console.error('Error fetching professional lawyer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professional lawyer'
    });
  }
});

// POST /api/professional-lawyers/:id/review - Add review
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

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

    // Check if lawyer exists
    const lawyer = await ProfessionalLawyers.findById(req.params.id);
    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Professional lawyer not found'
      });
    }

    // Check if user already reviewed
    const existingReview = await ProfessionalLawyersReview.findOne({
      professionalLawyerId: req.params.id,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this lawyer'
      });
    }

    // Create review
    const newReview = new ProfessionalLawyersReview({
      professionalLawyerId: req.params.id,
      userId: req.user._id,
      userName: req.user.name,
      userAvatar: req.user.avatar || null,
      rating: parseInt(rating),
      review,
      status: 'approved'
    });

    await newReview.save();

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

// GET /api/professional-lawyers/:id/reviews - Get all reviews for a lawyer
router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await ProfessionalLawyersReview.find({
      professionalLawyerId: req.params.id,
      status: 'approved'
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

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

// PUT /api/professional-lawyers/:id - Update professional lawyer profile
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

    // Find lawyer and verify ownership
    const lawyer = await ProfessionalLawyers.findById(req.params.id);

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Professional lawyer not found'
      });
    }

    if (lawyer.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this profile'
      });
    }

    // Validate province and city if provided
    if (province && city) {
      if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid province or city combination'
        });
      }
    }

    // Update fields
    if (name) lawyer.name = name;
    if (specialization) lawyer.specialization = specialization;
    if (category) lawyer.category = category;
    if (description) lawyer.description = description;
    if (experience !== undefined) lawyer.experience = parseInt(experience);
    if (city) lawyer.city = city;
    if (province) lawyer.province = province;
    if (contact) lawyer.contact = contact;
    if (available !== undefined) lawyer.available = available;
    if (weekdays) lawyer.weekdays = weekdays;
    if (weekends) lawyer.weekends = weekends;
    if (times) lawyer.times = times;
    if (facebook) lawyer.facebook = facebook;
    if (website) lawyer.website = website;
    if (avatar && avatar.url && avatar.publicId) {
      lawyer.avatar = {
        url: avatar.url,
        publicId: avatar.publicId
      };
    }

    await lawyer.save();

    res.json({
      success: true,
      message: 'Professional lawyer profile updated successfully',
      data: lawyer
    });
  } catch (error) {
    console.error('Error updating professional lawyer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

module.exports = router;

