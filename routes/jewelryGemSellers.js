const express = require('express');
const router = express.Router();
const JewelryGemSellers = require('../models/JewelryGemSellers');
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

// POST /api/jewelry-gem-sellers/publish - Create jewelry gem seller profile and publish advertisement
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
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
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

    // Create jewelry gem seller profile
    const jewelryGemSeller = new JewelryGemSellers({
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
      available: available !== undefined ? available : true,
      availability: {
        weekdays: availability?.weekdays || '',
        weekends: availability?.weekends || ''
      },
      facebook: facebook || null,
      website: website || null,
      images: images || []
    });

    await jewelryGemSeller.save();

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
    advertisement.publishedAdId = jewelryGemSeller._id;
    advertisement.publishedAdModel = 'JewelryGemSellers';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Jewelry & Gem Seller profile published successfully',
      data: {
        jewelryGemSellerId: jewelryGemSeller._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing jewelry gem seller profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish jewelry gem seller profile',
      error: error.message
    });
  }
});

// GET /api/jewelry-gem-sellers/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/jewelry-gem-sellers/browse - Get all published jewelry gem sellers with filters
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

    // Get all jewelry gem sellers with filters
    const allSellers = await JewelryGemSellers.find(filter)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    // Filter out sellers with expired advertisements
    const activeSellers = allSellers.filter(seller => {
      return seller.publishedAdId && seller.publishedAdId.status !== 'expired';
    });

    // Randomize the results
    const shuffled = activeSellers.sort(() => Math.random() - 0.5);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Apply pagination to shuffled results
    const paginatedSellers = shuffled.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: paginatedSellers,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(shuffled.length / limitNum),
        totalItems: shuffled.length,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching jewelry gem sellers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jewelry gem sellers'
    });
  }
});

// GET /api/jewelry-gem-sellers/:id - Get jewelry gem seller profile by ID
router.get('/:id', async (req, res) => {
  try {
    const jewelrySeller = await JewelryGemSellers.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!jewelrySeller) {
      return res.status(404).json({
        success: false,
        message: 'Jewelry Gem Seller profile not found'
      });
    }

    // Increment view count
    jewelrySeller.viewCount = (jewelrySeller.viewCount || 0) + 1;
    await jewelrySeller.save();

    res.json({
      success: true,
      data: jewelrySeller
    });
  } catch (error) {
    console.error('Error fetching jewelry gem seller profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jewelry gem seller profile'
    });
  }
});

// PUT /api/jewelry-gem-sellers/:id - Update jewelry gem seller profile
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

    // Find jewelry gem seller
    const jewelrySeller = await JewelryGemSellers.findById(req.params.id);
    if (!jewelrySeller) {
      return res.status(404).json({
        success: false,
        message: 'Jewelry Gem Seller profile not found'
      });
    }

    // Check if user owns this profile
    if (jewelrySeller.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update fields
    jewelrySeller.name = name;
    jewelrySeller.specialization = specialization;
    jewelrySeller.category = category;
    jewelrySeller.description = description;
    jewelrySeller.experience = parseInt(experience);
    jewelrySeller.city = city;
    jewelrySeller.province = province;
    jewelrySeller.contact = contact;
    jewelrySeller.available = available !== undefined ? available : true;
    jewelrySeller.availability = {
      weekdays: availability?.weekdays || '',
      weekends: availability?.weekends || ''
    };
    jewelrySeller.facebook = facebook || null;
    jewelrySeller.website = website || null;

    if (images && images.length > 0) {
      jewelrySeller.images = images;
    }

    await jewelrySeller.save();

    res.json({
      success: true,
      message: 'Jewelry Gem Seller profile updated successfully',
      data: jewelrySeller
    });
  } catch (error) {
    console.error('Error updating jewelry gem seller profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update jewelry gem seller profile'
    });
  }
});

// POST /api/jewelry-gem-sellers/:id/reviews - Add review and rating
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

    // Find jewelry gem seller
    const jewelrySeller = await JewelryGemSellers.findById(req.params.id);
    if (!jewelrySeller) {
      return res.status(404).json({
        success: false,
        message: 'Jewelry Gem Seller profile not found'
      });
    }

    // Initialize reviews array if it doesn't exist
    if (!jewelrySeller.reviews) {
      jewelrySeller.reviews = [];
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
    jewelrySeller.reviews.push(newReview);

    // Calculate average rating
    const totalRating = jewelrySeller.reviews.reduce((sum, r) => sum + r.rating, 0);
    jewelrySeller.averageRating = (totalRating / jewelrySeller.reviews.length).toFixed(1);
    jewelrySeller.totalReviews = jewelrySeller.reviews.length;

    await jewelrySeller.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: jewelrySeller
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

