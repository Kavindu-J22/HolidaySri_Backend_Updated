const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const TalentedEntertainersArtists = require('../models/TalentedEntertainersArtists');
const Advertisement = require('../models/Advertisement');

// POST /api/talented-entertainers-artists/publish - Create profile and publish advertisement
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
      avatar
    } = req.body;

    // Validate required fields
    if (!name || !specialization || !category || !description || !experience || !city || !province || !contact || !avatar) {
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

    // Find advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify ownership
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this advertisement'
      });
    }

    // Create profile
    const profile = new TalentedEntertainersArtists({
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
      available: available === true || available === 'true',
      availability,
      avatar,
      social: {
        facebook: facebook || '',
        website: website || ''
      }
    });

    await profile.save();

    // Calculate expiration date based on plan
    const sriLankanNow = moment.tz('Asia/Colombo');
    let expirationTime = 0;

    if (advertisement.selectedPlan === 'hourly') {
      expirationTime = advertisement.planDuration.hours * 60 * 60 * 1000;
    } else if (advertisement.selectedPlan === 'daily') {
      expirationTime = advertisement.planDuration.days * 24 * 60 * 60 * 1000;
    } else if (advertisement.selectedPlan === 'monthly') {
      expirationTime = 30 * 24 * 60 * 60 * 1000;
    } else if (advertisement.selectedPlan === 'yearly') {
      expirationTime = 365 * 24 * 60 * 60 * 1000;
    }

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = profile._id;
    advertisement.publishedAdModel = 'TalentedEntertainersArtists';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Profile published successfully',
      data: {
        profile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/talented-entertainers-artists/browse - Get all profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { specialization, category, province, city, search, sort } = req.query;
    let query = { isActive: true };

    // Filter by specialization
    if (specialization) {
      query.specialization = specialization;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by province
    if (province) {
      query.province = province;
    }

    // Filter by city
    if (city) {
      query.city = city;
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter out expired advertisements
    const now = new Date();
    const profileIds = await Advertisement.find({
      status: 'Published',
      publishedAdModel: 'TalentedEntertainersArtists',
      expiresAt: { $gt: now }
    }).select('publishedAdId');

    const validIds = profileIds.map(ad => ad.publishedAdId);
    query._id = { $in: validIds };

    let sortOption = {};
    if (sort === 'random') {
      const profiles = await TalentedEntertainersArtists.find(query)
        .populate('userId', 'name email')
        .lean();
      
      // Shuffle array
      for (let i = profiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
      }

      return res.json({
        success: true,
        data: profiles
      });
    } else {
      sortOption = { createdAt: -1 };
    }

    const profiles = await TalentedEntertainersArtists.find(query)
      .sort(sortOption)
      .populate('userId', 'name email')
      .lean();

    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/talented-entertainers-artists/:id - Get profile details
router.get('/:id', async (req, res) => {
  try {
    const profile = await TalentedEntertainersArtists.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviews.userId', 'name');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    profile.viewCount = (profile.viewCount || 0) + 1;
    await profile.save();

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/talented-entertainers-artists/:id - Update profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const profile = await TalentedEntertainersArtists.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Verify ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Update fields
    const { name, specialization, category, description, experience, city, province, contact, available, availability, facebook, website, avatar } = req.body;

    if (name) profile.name = name;
    if (specialization) profile.specialization = specialization;
    if (category) profile.category = category;
    if (description) profile.description = description;
    if (experience !== undefined) profile.experience = parseInt(experience);
    if (city) profile.city = city;
    if (province) profile.province = province;
    if (contact) profile.contact = contact;
    if (available !== undefined) profile.available = available === true || available === 'true';
    if (availability) profile.availability = availability;
    if (avatar) profile.avatar = avatar;
    if (facebook !== undefined) profile.social.facebook = facebook;
    if (website !== undefined) profile.social.website = website;

    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// POST /api/talented-entertainers-artists/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const profile = await TalentedEntertainersArtists.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    profile.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating,
      review: review || ''
    });

    // Update average rating
    const totalRating = profile.reviews.reduce((sum, r) => sum + r.rating, 0);
    profile.averageRating = totalRating / profile.reviews.length;
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
      message: 'Failed to add review'
    });
  }
});

module.exports = router;

