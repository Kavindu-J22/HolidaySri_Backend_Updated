const express = require('express');
const router = express.Router();
const GraphicsITTechRepair = require('../models/GraphicsITTechRepair');
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

// POST /api/graphics-it-tech-repair/publish - Create profile and publish advertisement
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
      available,
      includes,
      contact,
      facebook,
      website,
      linkedin,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !images || 
        !Array.isArray(images) || images.length === 0 || !includes || !Array.isArray(includes) || includes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (1-3 images)
    if (images.length < 1 || images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 3 images'
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

    // Create graphics IT tech repair profile
    const profile = new GraphicsITTechRepair({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      available: available !== undefined ? available : true,
      includes,
      contact,
      social: {
        facebook: facebook || '',
        website: website || '',
        linkedin: linkedin || ''
      },
      images
    });

    await profile.save();

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
    advertisement.publishedAdId = profile._id;
    advertisement.publishedAdModel = 'GraphicsITTechRepair';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Graphics IT Tech Repair profile published successfully',
      data: {
        profile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing graphics IT tech repair profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/graphics-it-tech-repair/browse - Get all published profiles with filters
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

    // Get profiles and check if their advertisements are not expired
    const skip = (page - 1) * limit;

    let profiles = await GraphicsITTechRepair.find(filter)
      .populate('publishedAdId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Filter out profiles whose advertisements are expired
    profiles = profiles.filter(profile => {
      if (profile.publishedAdId && profile.publishedAdId.expiresAt) {
        return new Date(profile.publishedAdId.expiresAt) > new Date();
      }
      return true;
    });

    // Randomize the order
    profiles = profiles.sort(() => Math.random() - 0.5);

    // Get total count for pagination
    const totalProfiles = await GraphicsITTechRepair.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: profiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProfiles / limit),
        totalProfiles: totalProfiles
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

// GET /api/graphics-it-tech-repair/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
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

// GET /api/graphics-it-tech-repair/:id - Get profile details
router.get('/:id', async (req, res) => {
  try {
    const profile = await GraphicsITTechRepair.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    profile.viewCount += 1;
    await profile.save();

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile details. Please try again.'
    });
  }
});

// PUT /api/graphics-it-tech-repair/:id - Update profile
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
      available,
      includes,
      contact,
      facebook,
      website,
      linkedin,
      images
    } = req.body;

    // Find the profile
    const profile = await GraphicsITTechRepair.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user owns this profile
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
    if (includes && Array.isArray(includes)) profile.includes = includes;
    if (facebook !== undefined) profile.social.facebook = facebook;
    if (website !== undefined) profile.social.website = website;
    if (linkedin !== undefined) profile.social.linkedin = linkedin;
    if (images && Array.isArray(images) && images.length > 0) {
      profile.images = images;
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

// POST /api/graphics-it-tech-repair/:id/reviews - Add review and rating
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

    // Find the profile
    const profile = await GraphicsITTechRepair.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
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
    if (!profile.reviews) {
      profile.reviews = [];
    }

    // Add review
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

// GET /api/graphics-it-tech-repair/:id/reviews - Get all reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const profile = await GraphicsITTechRepair.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reviews: profile.reviews || [],
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews
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

