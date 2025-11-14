const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const FitnessHealthSpasGym = require('../models/FitnessHealthSpasGym');
const Advertisement = require('../models/Advertisement');

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

// POST /api/fitness-health-spas-gym/publish - Create profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      type,
      category,
      specialization,
      description,
      city,
      province,
      avatar,
      availability,
      includes,
      contact,
      packages
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !type || !category || !specialization || 
        !description || !city || !province || !avatar || !avatar.url || !avatar.publicId ||
        !availability || !availability.weekdays || !availability.weekends ||
        !includes || includes.length === 0 || !contact || !contact.phone) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate type
    if (!['Service', 'Professionals'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be Service or Professionals'
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

    // Create fitness health spas gym profile
    const fitnessProfile = new FitnessHealthSpasGym({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      type,
      category,
      specialization,
      description,
      city,
      province,
      avatar,
      availability,
      includes,
      contact,
      packages: packages || null
    });

    await fitnessProfile.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    let expirationTime;
    const sriLankanNow = moment.tz('Asia/Colombo');

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

    const expiresAt = new Date(sriLankanNow.toDate().getTime() + expirationTime);

    // Update advertisement status and expiration
    await Advertisement.findByIdAndUpdate(
      advertisementId,
      {
        status: 'Published',
        publishedAt: sriLankanNow.toDate(),
        expiresAt: expiresAt,
        publishedAdId: fitnessProfile._id,
        publishedAdModel: 'FitnessHealthSpasGym'
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Fitness/Health/Spas/Gym profile published successfully',
      data: fitnessProfile
    });
  } catch (error) {
    console.error('Error publishing fitness profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish fitness profile',
      error: error.message
    });
  }
});

// GET /api/fitness-health-spas-gym/browse - Browse all fitness profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const {
      type = 'all',
      category,
      specialization,
      city,
      province,
      search,
      page = 1,
      limit = 12
    } = req.query;

    const skip = (page - 1) * limit;
    let filter = {};

    // Filter by type (Service or Professionals)
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by specialization
    if (specialization) {
      filter.specialization = specialization;
    }

    // Filter by city
    if (city) {
      filter.city = city;
    }

    // Filter by province
    if (province) {
      filter.province = province;
    }

    // Search by name or description
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Exclude expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'FitnessHealthSpasGym'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId.toString());
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    // Get all matching profiles
    let profiles = await FitnessHealthSpasGym.find(filter)
      .populate('userId', 'name avatar')
      .lean();

    // Shuffle profiles randomly
    profiles = profiles.sort(() => Math.random() - 0.5);

    // Pagination
    const total = profiles.length;
    const paginatedProfiles = profiles.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: paginatedProfiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error browsing fitness profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse fitness profiles',
      error: error.message
    });
  }
});

// GET /api/fitness-health-spas-gym/:id - Get single fitness profile details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await FitnessHealthSpasGym.findById(id)
      .populate('userId', 'name avatar email phone');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Fitness profile not found'
      });
    }

    // Check if advertisement is expired
    const ad = await Advertisement.findById(profile.publishedAdId);
    if (!ad || ad.status === 'expired' || ad.expiresAt < new Date()) {
      return res.status(404).json({
        success: false,
        message: 'This profile is no longer available'
      });
    }

    // Increment view count
    await FitnessHealthSpasGym.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching fitness profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fitness profile',
      error: error.message
    });
  }
});

// PUT /api/fitness-health-spas-gym/:id - Update fitness profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      category,
      specialization,
      description,
      city,
      province,
      avatar,
      availability,
      includes,
      contact,
      packages
    } = req.body;

    // Find profile
    const profile = await FitnessHealthSpasGym.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Fitness profile not found'
      });
    }

    // Check ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Validate province and city if provided
    if (province && city) {
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
    }

    // Update profile
    const updatedProfile = await FitnessHealthSpasGym.findByIdAndUpdate(
      id,
      {
        name: name || profile.name,
        type: type || profile.type,
        category: category || profile.category,
        specialization: specialization || profile.specialization,
        description: description || profile.description,
        city: city || profile.city,
        province: province || profile.province,
        avatar: avatar || profile.avatar,
        availability: availability || profile.availability,
        includes: includes || profile.includes,
        contact: contact || profile.contact,
        packages: packages !== undefined ? packages : profile.packages
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Fitness profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    console.error('Error updating fitness profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fitness profile',
      error: error.message
    });
  }
});

// DELETE /api/fitness-health-spas-gym/:id - Delete fitness profile
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await FitnessHealthSpasGym.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Fitness profile not found'
      });
    }

    // Check ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this profile'
      });
    }

    // Delete profile
    await FitnessHealthSpasGym.findByIdAndDelete(id);

    // Update advertisement status to draft
    await Advertisement.findByIdAndUpdate(
      profile.publishedAdId,
      { status: 'Draft' }
    );

    res.status(200).json({
      success: true,
      message: 'Fitness profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting fitness profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fitness profile',
      error: error.message
    });
  }
});

module.exports = router;

