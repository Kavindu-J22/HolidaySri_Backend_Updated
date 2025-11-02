const express = require('express');
const router = express.Router();
const ExpertArchitects = require('../models/ExpertArchitects');
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

// POST /api/expert-architects/publish - Create expert architect profile and publish advertisement
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
      availability,
      facebook,
      website,
      avatar,
      images
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

    // Validate images (max 4)
    if (images && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
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

    // Create expert architect profile
    const expertArchitect = new ExpertArchitects({
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
      availability: {
        weekdays: availability?.weekdays || '',
        weekends: availability?.weekends || ''
      },
      facebook: facebook || null,
      website: website || null,
      images: images || []
    });

    await expertArchitect.save();

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
    advertisement.publishedAdId = expertArchitect._id;
    advertisement.publishedAdModel = 'ExpertArchitects';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Expert Architect profile published successfully',
      data: {
        expertArchitectId: expertArchitect._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing expert architect profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish expert architect profile',
      error: error.message
    });
  }
});

// GET /api/expert-architects/browse - Get all published expert architects with filters
// IMPORTANT: This route MUST come before /:id route to avoid "browse" being treated as an ID
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = {};

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
      filter.province = province;
    }

    // Get all expert architects with filters
    const allArchitects = await ExpertArchitects.find(filter)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    // Filter out architects with expired advertisements
    const activeArchitects = allArchitects.filter(architect => {
      return architect.publishedAdId && architect.publishedAdId.status !== 'expired';
    });

    // Randomize the results
    const shuffled = activeArchitects.sort(() => Math.random() - 0.5);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Apply pagination to shuffled results
    const paginatedArchitects = shuffled.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: paginatedArchitects,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(shuffled.length / limitNum),
        totalItems: shuffled.length,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching expert architects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expert architects'
    });
  }
});

// GET /api/expert-architects/:id - Get expert architect profile by ID
router.get('/:id', async (req, res) => {
  try {
    const expertArchitect = await ExpertArchitects.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!expertArchitect) {
      return res.status(404).json({
        success: false,
        message: 'Expert Architect profile not found'
      });
    }

    // Increment view count
    expertArchitect.viewCount = (expertArchitect.viewCount || 0) + 1;
    await expertArchitect.save();

    res.json({
      success: true,
      data: expertArchitect
    });
  } catch (error) {
    console.error('Error fetching expert architect profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expert architect profile'
    });
  }
});

// PUT /api/expert-architects/:id - Update expert architect profile
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
      availability,
      facebook,
      website,
      avatar,
      images
    } = req.body;

    // Validate required fields
    if (!name || !specialization || !category || !description ||
        experience === undefined || !city || !province || !contact) {
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

    // Validate images (max 4)
    if (images && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Find expert architect
    const expertArchitect = await ExpertArchitects.findById(req.params.id);
    if (!expertArchitect) {
      return res.status(404).json({
        success: false,
        message: 'Expert Architect profile not found'
      });
    }

    // Check if user owns this profile
    if (expertArchitect.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update fields
    expertArchitect.name = name;
    expertArchitect.specialization = specialization;
    expertArchitect.category = category;
    expertArchitect.description = description;
    expertArchitect.experience = parseInt(experience);
    expertArchitect.city = city;
    expertArchitect.province = province;
    expertArchitect.contact = contact;
    expertArchitect.available = available !== undefined ? available : true;
    expertArchitect.availability = {
      weekdays: availability?.weekdays || '',
      weekends: availability?.weekends || ''
    };
    expertArchitect.facebook = facebook || null;
    expertArchitect.website = website || null;

    if (avatar && avatar.url && avatar.publicId) {
      expertArchitect.avatar = avatar;
    }

    if (images && images.length > 0) {
      expertArchitect.images = images;
    }

    await expertArchitect.save();

    res.json({
      success: true,
      message: 'Expert Architect profile updated successfully',
      data: expertArchitect
    });
  } catch (error) {
    console.error('Error updating expert architect profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expert architect profile'
    });
  }
});

// POST /api/expert-architects/:id/reviews - Add review and rating
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

    // Validate review
    if (!review || review.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review cannot be empty'
      });
    }

    // Find expert architect
    const expertArchitect = await ExpertArchitects.findById(req.params.id);
    if (!expertArchitect) {
      return res.status(404).json({
        success: false,
        message: 'Expert Architect profile not found'
      });
    }

    // Initialize reviews array if it doesn't exist
    if (!expertArchitect.reviews) {
      expertArchitect.reviews = [];
    }

    // Create review object
    const newReview = {
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      review: review.trim(),
      createdAt: new Date()
    };

    // Add review
    expertArchitect.reviews.push(newReview);

    // Calculate average rating
    const totalRating = expertArchitect.reviews.reduce((sum, r) => sum + r.rating, 0);
    expertArchitect.averageRating = (totalRating / expertArchitect.reviews.length).toFixed(1);
    expertArchitect.totalReviews = expertArchitect.reviews.length;

    await expertArchitect.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: expertArchitect
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

