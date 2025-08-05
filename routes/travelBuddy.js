const express = require('express');
const TravelBuddy = require('../models/TravelBuddy');
const Advertisement = require('../models/Advertisement');
const { verifyToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const moment = require('moment-timezone');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'daa9e83as',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Country list for validation
const countries = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Bolivia', 'Bosnia and Herzegovina', 'Brazil', 'Bulgaria',
  'Cambodia', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic',
  'Denmark', 'Ecuador', 'Egypt', 'Estonia', 'Ethiopia',
  'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
  'Latvia', 'Lebanon', 'Lithuania', 'Luxembourg',
  'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Norway',
  'Pakistan', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia',
  'Saudi Arabia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam'
];

// GET /api/travel-buddy/countries - Get list of countries
router.get('/countries', (req, res) => {
  try {
    res.json({
      success: true,
      countries: countries.sort()
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch countries'
    });
  }
});

// POST /api/travel-buddy/publish - Create travel buddy profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      userName,
      nickName,
      age,
      whatsappNumber,
      country,
      description,
      gender,
      interests,
      coverPhoto,
      avatarImage
    } = req.body;

    // Validate required fields
    if (!advertisementId || !userName || !age || !whatsappNumber || !country || 
        !description || !gender || !coverPhoto || !avatarImage) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate advertisement exists and belongs to user
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'travel_buddys',
      status: 'active'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or not eligible for publishing'
      });
    }

    // Validate age
    if (age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100'
      });
    }

    // Validate country
    if (!countries.includes(country)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country selected'
      });
    }

    // Validate gender
    const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender selected'
      });
    }

    // Validate WhatsApp number format
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    if (!whatsappRegex.test(whatsappNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid WhatsApp number format'
      });
    }

    // Validate images
    if (!coverPhoto.url || !coverPhoto.publicId || !avatarImage.url || !avatarImage.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Cover photo and avatar image are required with valid URLs and public IDs'
      });
    }

    // Create travel buddy profile
    const travelBuddy = new TravelBuddy({
      userId: req.user._id,
      publishedAdId: advertisementId,
      userName,
      nickName: nickName || '',
      age,
      whatsappNumber,
      country,
      description,
      gender,
      interests: interests || [],
      coverPhoto,
      avatarImage
    });

    await travelBuddy.save();

    // Calculate expiration date based on Sri Lankan timezone
    const now = moment().tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = now.clone().add(advertisement.planDuration.hours || 1, 'hours');
        break;
      case 'daily':
        expirationTime = now.clone().add(advertisement.planDuration.days || 1, 'days');
        break;
      case 'monthly':
        expirationTime = now.clone().add(30, 'days');
        break;
      case 'yearly':
        expirationTime = now.clone().add(365, 'days');
        break;
      default:
        expirationTime = now.clone().add(1, 'day');
    }

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAdId = travelBuddy._id;
    advertisement.publishedAdModel = 'TravelBuddy';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Travel buddy profile published successfully!',
      data: {
        travelBuddy: {
          _id: travelBuddy._id,
          userName: travelBuddy.userName,
          nickName: travelBuddy.nickName,
          country: travelBuddy.country,
          publishedAt: travelBuddy.publishedAt
        },
        advertisement: {
          _id: advertisement._id,
          slotId: advertisement.slotId,
          status: advertisement.status,
          publishedAt: advertisement.publishedAt,
          expiresAt: advertisement.expiresAt
        }
      }
    });

  } catch (error) {
    console.error('Error publishing travel buddy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish travel buddy profile. Please try again.'
    });
  }
});

module.exports = router;
