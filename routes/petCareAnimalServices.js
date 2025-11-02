const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const PetCareAnimalServices = require('../models/PetCareAnimalServices');
const PetCareAnimalServicesReview = require('../models/PetCareAnimalServicesReview');
const Advertisement = require('../models/Advertisement');

// POST /api/pet-care-animal-services/publish - Create pet care profile and publish advertisement
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
      avatar,
      services,
      availability,
      facebook,
      website,
      contact
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description || 
        experience === undefined || !city || !province || !contact || !avatar || 
        !avatar.url || !avatar.publicId || !services || services.length === 0 || 
        !availability || availability.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate specialization array
    if (!Array.isArray(specialization) || specialization.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one specialization must be selected'
      });
    }

    // Validate contact format (phone or email)
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!phoneRegex.test(contact) && !emailRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number or email address'
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

    // Create pet care animal services profile
    const petCareProfile = new PetCareAnimalServices({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      experience: parseInt(experience),
      city,
      province,
      available: available === true || available === 'true',
      avatar,
      services,
      availability,
      facebook: facebook || null,
      website: website || null,
      contact
    });

    await petCareProfile.save();

    // Calculate expiration time based on plan and duration (Sri Lankan timezone)
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
    advertisement.publishedAdId = petCareProfile._id;
    advertisement.publishedAdModel = 'PetCareAnimalServices';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Pet care animal services profile published successfully',
      data: {
        profileId: petCareProfile._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing pet care animal services profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish pet care animal services profile',
      error: error.message
    });
  }
});

// GET /api/pet-care-animal-services/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  const provincesAndDistricts = {
    'Western Province': ['Colombo', 'Gampaha', 'Kalutara'],
    'Central Province': ['Kandy', 'Matale', 'Nuwara Eliya'],
    'Southern Province': ['Galle', 'Matara', 'Hambantota'],
    'Northern Province': ['Jaffna', 'Mannar', 'Vavuniya', 'Kilinochchi', 'Mullaitivu'],
    'Eastern Province': ['Batticaloa', 'Ampara', 'Trincomalee'],
    'North Western Province': ['Kurunegala', 'Puttalam'],
    'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
    'Uva Province': ['Badulla', 'Monaragala'],
    'Sabaragamuwa Province': ['Kegalle', 'Ratnapura']
  };

  res.status(200).json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/pet-care-animal-services/browse - Get all pet care profiles with filters
router.get('/browse/all', async (req, res) => {
  try {
    const { search, specialization, category, city, province } = req.query;

    // Build filter
    const filter = { isActive: true };

    if (specialization) {
      filter.specialization = specialization;
    }

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
    let profiles = await PetCareAnimalServices.find(filter)
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
    console.error('Error fetching pet care profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});

// GET /api/pet-care-animal-services/:id - Get single pet care profile details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await PetCareAnimalServices.findById(id)
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

// GET /api/pet-care-animal-services/edit/:id - Get profile for editing
router.get('/edit/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await PetCareAnimalServices.findById(id);

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

// PUT /api/pet-care-animal-services/:id - Update pet care profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
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
      avatar,
      services,
      availability,
      facebook,
      website
    } = req.body;

    const profile = await PetCareAnimalServices.findById(id);

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
    if (experience !== undefined && experience < 0) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be a positive number'
      });
    }

    // Validate province and city
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
    profile.name = name || profile.name;
    profile.specialization = specialization || profile.specialization;
    profile.category = category || profile.category;
    profile.description = description || profile.description;
    profile.experience = experience !== undefined ? parseInt(experience) : profile.experience;
    profile.city = city || profile.city;
    profile.province = province || profile.province;
    profile.contact = contact || profile.contact;
    profile.available = available !== undefined ? (available === true || available === 'true') : profile.available;
    profile.services = services || profile.services;
    profile.availability = availability || profile.availability;
    profile.facebook = facebook || profile.facebook;
    profile.website = website || profile.website;
    if (avatar && avatar.url && avatar.publicId) {
      profile.avatar = avatar;
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

