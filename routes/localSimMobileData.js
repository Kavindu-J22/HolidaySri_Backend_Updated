const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const LocalSimMobileData = require('../models/LocalSimMobileData');
const LocalSimMobileDataReview = require('../models/LocalSimMobileDataReview');
const Advertisement = require('../models/Advertisement');

// POST /api/local-sim-mobile-data/publish - Create local SIM mobile data profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      logo,
      category,
      description,
      experienceYears,
      contact,
      packagesPDF,
      facebook,
      website,
      specialties
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !logo || !logo.url || !logo.publicId || 
        !category || !description || experienceYears === undefined || !contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate experience years
    if (experienceYears < 0 || experienceYears > 100) {
      return res.status(400).json({
        success: false,
        message: 'Experience years must be between 0 and 100'
      });
    }

    // Validate specialties array
    if (specialties && specialties.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 specialties allowed'
      });
    }

    // Find the advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'local_sim_mobile_data'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    // Check if advertisement is already published
    if (advertisement.status === 'Published') {
      return res.status(400).json({
        success: false,
        message: 'This advertisement slot has already been published'
      });
    }

    // Create local SIM mobile data profile
    const localSimMobileDataProfile = new LocalSimMobileData({
      userId: req.user._id,
      publishedAdId: advertisement._id,
      name,
      logo: {
        url: logo.url,
        publicId: logo.publicId
      },
      category,
      description,
      experienceYears,
      contact,
      packagesPDF: packagesPDF ? {
        url: packagesPDF.url,
        publicId: packagesPDF.publicId,
        fileName: packagesPDF.fileName
      } : undefined,
      facebook: facebook || undefined,
      website: website || undefined,
      specialties: specialties || [],
      isActive: true,
      publishedAt: new Date()
    });

    await localSimMobileDataProfile.save();

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
    advertisement.publishedAdId = localSimMobileDataProfile._id;
    advertisement.publishedAdModel = 'LocalSimMobileData';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Local SIM & Mobile Data profile published successfully',
      data: {
        profile: localSimMobileDataProfile,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing local SIM mobile data profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/local-sim-mobile-data/browse - Get all active local SIM mobile data profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, category, province, city } = req.query;

    // Build query
    let query = { isActive: true };

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    // Filter by province
    if (province) {
      query.province = province;
    }

    // Filter by city
    if (city) {
      query.city = city;
    }

    // Get all matching profiles
    let profiles = await LocalSimMobileData.find(query)
      .populate('userId', 'name email')
      .populate('publishedAdId')
      .lean();

    // Filter out profiles with expired advertisements
    profiles = profiles.filter(profile => {
      if (!profile.publishedAdId) return false;
      if (profile.publishedAdId.status === 'expired') return false;
      return true;
    });

    // Shuffle profiles randomly
    profiles = profiles.sort(() => Math.random() - 0.5);

    res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles
    });
  } catch (error) {
    console.error('Error fetching local SIM mobile data profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles. Please try again.'
    });
  }
});

// GET /api/local-sim-mobile-data/:id - Get single local SIM mobile data profile by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const profile = await LocalSimMobileData.findById(id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    await profile.incrementViewCount();

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching local SIM mobile data profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile. Please try again.'
    });
  }
});

// PUT /api/local-sim-mobile-data/:id - Update local SIM mobile data profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      logo,
      category,
      description,
      experienceYears,
      contact,
      packagesPDF,
      facebook,
      website,
      specialties
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    // Find profile and verify ownership
    const profile = await LocalSimMobileData.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found or access denied'
      });
    }

    // Validate experience years
    if (experienceYears !== undefined && (experienceYears < 0 || experienceYears > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Experience years must be between 0 and 100'
      });
    }

    // Validate specialties array
    if (specialties && specialties.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 specialties allowed'
      });
    }

    // Update fields
    if (name) profile.name = name;
    if (logo && logo.url && logo.publicId) {
      profile.logo = {
        url: logo.url,
        publicId: logo.publicId
      };
    }
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (experienceYears !== undefined) profile.experienceYears = experienceYears;
    if (contact) profile.contact = contact;
    if (packagesPDF && packagesPDF.url && packagesPDF.publicId) {
      profile.packagesPDF = {
        url: packagesPDF.url,
        publicId: packagesPDF.publicId,
        fileName: packagesPDF.fileName
      };
    }
    if (facebook !== undefined) profile.facebook = facebook || undefined;
    if (website !== undefined) profile.website = website || undefined;
    if (specialties) profile.specialties = specialties;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating local SIM mobile data profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/local-sim-mobile-data/:id/reviews - Add a review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

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
        message: 'Review text is required'
      });
    }

    // Check if profile exists
    const profile = await LocalSimMobileData.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user already reviewed
    const existingReview = await LocalSimMobileDataReview.findOne({
      localSimMobileDataId: id,
      userId: req.user._id
    });

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.review = review.trim();
      await existingReview.save();

      // Recalculate average rating
      await updateAverageRating(id);

      return res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: existingReview
      });
    }

    // Create new review
    const newReview = new LocalSimMobileDataReview({
      localSimMobileDataId: id,
      userId: req.user._id,
      rating,
      review: review.trim()
    });

    await newReview.save();

    // Update average rating
    await updateAverageRating(id);

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
});

// GET /api/local-sim-mobile-data/:id/reviews - Get all reviews for a profile
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const reviews = await LocalSimMobileDataReview.find({
      localSimMobileDataId: id,
      isActive: true
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews. Please try again.'
    });
  }
});

// Helper function to update average rating
async function updateAverageRating(profileId) {
  try {
    const reviews = await LocalSimMobileDataReview.find({
      localSimMobileDataId: profileId,
      isActive: true
    });

    if (reviews.length === 0) {
      await LocalSimMobileData.findByIdAndUpdate(profileId, {
        averageRating: 0,
        totalReviews: 0
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await LocalSimMobileData.findByIdAndUpdate(profileId, {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Error updating average rating:', error);
  }
}

module.exports = router;

