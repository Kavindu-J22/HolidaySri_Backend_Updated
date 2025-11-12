const express = require('express');
const router = express.Router();
const BabysittersChildcare = require('../models/BabysittersChildcare');
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

// POST /api/babysitters-childcare/publish - Create babysitter/childcare profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      includes,
      facebook,
      website,
      gender,
      availability,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !category || !description || 
        experience === undefined || !city || !province || !contact || 
        !gender || !images || images.length === 0) {
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

    // Validate gender
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender selected'
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

    // Validate images
    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    for (const img of images) {
      if (!img.url || !img.publicId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image data'
        });
      }
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

    // Create babysitter/childcare profile
    const babysitterProfile = new BabysittersChildcare({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      contact,
      available: available === true || available === 'true',
      includes: includes || [],
      facebook: facebook || '',
      website: website || '',
      gender,
      availability: availability || { weekdays: '', weekends: '' },
      images
    });

    await babysitterProfile.save();

    // Calculate expiration date based on Sri Lankan timezone
    const sriLankanNow = moment().tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = sriLankanNow.clone().add(advertisement.planDuration.hours || 1, 'hours').valueOf() - sriLankanNow.valueOf();
        break;
      case 'daily':
        expirationTime = sriLankanNow.clone().add(advertisement.planDuration.days || 1, 'days').valueOf() - sriLankanNow.valueOf();
        break;
      case 'monthly':
        expirationTime = sriLankanNow.clone().add(30, 'days').valueOf() - sriLankanNow.valueOf();
        break;
      case 'yearly':
        expirationTime = sriLankanNow.clone().add(365, 'days').valueOf() - sriLankanNow.valueOf();
        break;
      default:
        expirationTime = sriLankanNow.clone().add(1, 'day').valueOf() - sriLankanNow.valueOf();
    }

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = babysitterProfile._id;
    advertisement.publishedAdModel = 'BabysittersChildcare';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Babysitter/Childcare profile published successfully',
      data: {
        profile: babysitterProfile,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing babysitter/childcare profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/babysitters-childcare/browse - Get all active babysitter profiles with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, city, province, search } = req.query;

    // Build filter query
    let filter = { isActive: true };

    if (category) {
      filter.category = category;
    }

    if (city) {
      filter.city = city;
    }

    if (province) {
      filter.province = province;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all profiles matching filter
    let profiles = await BabysittersChildcare.find(filter)
      .populate('userId', 'name avatar')
      .lean();

    // Filter out expired advertisements
    const validProfiles = [];
    for (const profile of profiles) {
      const advertisement = await Advertisement.findById(profile.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        validProfiles.push(profile);
      }
    }

    // Shuffle profiles randomly
    const shuffledProfiles = validProfiles.sort(() => Math.random() - 0.5);

    res.status(200).json({
      success: true,
      data: shuffledProfiles
    });
  } catch (error) {
    console.error('Error fetching babysitter profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/babysitters-childcare/provinces - Get provinces and districts
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

// GET /api/babysitters-childcare/:id - Get single babysitter profile details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await BabysittersChildcare.findById(id)
      .populate('userId', 'name avatar email contact');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if advertisement is still valid
    const advertisement = await Advertisement.findById(profile.publishedAdId);
    if (!advertisement || advertisement.status !== 'Published' || (advertisement.expiresAt && new Date(advertisement.expiresAt) <= new Date())) {
      return res.status(404).json({
        success: false,
        message: 'This advertisement has expired'
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
    console.error('Error fetching profile details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile details'
    });
  }
});

// GET /api/babysitters-childcare/edit/:id - Get profile for editing
router.get('/edit/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await BabysittersChildcare.findById(id);

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
        message: 'Unauthorized to edit this profile'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile for edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/babysitters-childcare/:id - Update babysitter profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      includes,
      facebook,
      website,
      gender,
      availability,
      images
    } = req.body;

    const profile = await BabysittersChildcare.findById(id);

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

    // Validate experience
    if (experience !== undefined && (experience < 0 || experience > 70)) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate gender
    if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender selected'
      });
    }

    // Validate province and city
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

    // Validate images
    if (images && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed'
      });
    }

    // Update profile
    profile.name = name || profile.name;
    profile.category = category || profile.category;
    profile.description = description || profile.description;
    profile.experience = experience !== undefined ? parseInt(experience) : profile.experience;
    profile.city = city || profile.city;
    profile.province = province || profile.province;
    profile.contact = contact || profile.contact;
    profile.available = available !== undefined ? (available === true || available === 'true') : profile.available;
    profile.includes = includes || profile.includes;
    profile.facebook = facebook || profile.facebook;
    profile.website = website || profile.website;
    profile.gender = gender || profile.gender;
    profile.availability = availability || profile.availability;
    if (images) {
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
      message: 'Failed to update profile'
    });
  }
});

module.exports = router;

