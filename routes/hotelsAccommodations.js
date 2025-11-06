const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const HotelsAccommodations = require('../models/HotelsAccommodations');
const Advertisement = require('../models/Advertisement');

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

// POST /api/hotels-accommodations/publish - Publish hotel profile
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      hotelName,
      userEmail,
      category,
      description,
      climate,
      location,
      contactInfo,
      facilities,
      diningOptions,
      functionOptions,
      policies,
      activities,
      images,
      otherInfo,
      isHaveStars,
      howManyStars,
      isVerified,
      isHaveCertificate,
      isHaveLicense,
      acceptTeams
    } = req.body;

    // Validate required fields
    if (!advertisementId || !hotelName || !userEmail || !category || !description || !climate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: hotelName, userEmail, category, description, climate'
      });
    }

    // Validate location
    if (!location || !location.address || !location.city || !location.province || !location.mapUrl) {
      return res.status(400).json({
        success: false,
        message: 'Complete location information is required (address, city, province, mapUrl)'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[location.province] || !provincesAndDistricts[location.province].includes(location.city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province and city combination'
      });
    }

    // Validate contact info
    if (!contactInfo || !contactInfo.email || !contactInfo.contactNumber || !contactInfo.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'Complete contact information is required (email, contactNumber, whatsappNumber)'
      });
    }

    // Validate images
    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 image is required'
      });
    }

    if (images.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed'
      });
    }

    // Validate advertisement exists and belongs to user
    if (!mongoose.isValidObjectId(advertisementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID'
      });
    }

    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Advertisement does not belong to you'
      });
    }

    if (advertisement.status === 'Published') {
      return res.status(400).json({
        success: false,
        message: 'Advertisement is already published'
      });
    }

    if (advertisement.category !== 'hotels_accommodations') {
      return res.status(400).json({
        success: false,
        message: 'Advertisement category must be hotels_accommodations'
      });
    }

    // Create hotel profile
    const hotelProfile = new HotelsAccommodations({
      userId: req.user._id,
      publishedAdId: advertisementId,
      hotelName,
      userEmail,
      category,
      description,
      climate,
      location,
      contactInfo,
      facilities: facilities || {},
      diningOptions: diningOptions || {},
      functionOptions: functionOptions || {},
      policies: policies || {},
      activities: activities || {},
      images,
      otherInfo: otherInfo || [],
      isHaveStars: isHaveStars || false,
      howManyStars: isHaveStars ? howManyStars : undefined,
      isVerified: isVerified || false,
      isHaveCertificate: isHaveCertificate || false,
      isHaveLicense: isHaveLicense || false,
      acceptTeams: acceptTeams || false
    });

    await hotelProfile.save();

    // Calculate expiration time based on plan (Sri Lankan timezone)
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
    advertisement.publishedAdId = hotelProfile._id;
    advertisement.publishedAdModel = 'HotelsAccommodations';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Hotel profile published successfully',
      data: {
        profile: hotelProfile,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing hotel profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish hotel profile. Please try again.',
      error: error.message
    });
  }
});

// GET /api/hotels-accommodations/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/hotels-accommodations/browse - Browse hotels (only active, non-expired)
router.get('/browse', async (req, res) => {
  try {
    const { category, province, city, climate, page = 1, limit = 12 } = req.query;

    // Find all hotels
    const query = { isActive: true };

    if (category) query.category = category;
    if (province) query['location.province'] = province;
    if (city) query['location.city'] = city;
    if (climate) query.climate = climate;

    // Get all matching hotels
    let hotels = await HotelsAccommodations.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Filter out hotels with expired advertisements
    const hotelsWithAds = await Promise.all(
      hotels.map(async (hotel) => {
        if (hotel.publishedAdId) {
          const ad = await Advertisement.findById(hotel.publishedAdId);
          // Only include if ad exists and is not expired
          if (ad && ad.status !== 'Expired') {
            return hotel;
          }
          return null;
        }
        return hotel; // Include hotels without publishedAdId
      })
    );

    // Remove null entries and shuffle randomly
    const activeHotels = hotelsWithAds.filter(h => h !== null);
    const shuffled = activeHotels.sort(() => Math.random() - 0.5);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHotels = shuffled.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedHotels,
      pagination: {
        total: shuffled.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(shuffled.length / limit)
      }
    });
  } catch (error) {
    console.error('Error browsing hotels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse hotels',
      error: error.message
    });
  }
});

// GET /api/hotels-accommodations/:id - Get hotel details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hotel ID'
      });
    }

    const hotel = await HotelsAccommodations.findById(id)
      .populate('userId', 'name email contactNumber');

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    // Increment view count
    hotel.viewCount += 1;
    await hotel.save();

    res.json({
      success: true,
      data: hotel
    });
  } catch (error) {
    console.error('Error fetching hotel details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hotel details',
      error: error.message
    });
  }
});

// PUT /api/hotels-accommodations/:id - Update hotel profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      hotelName,
      category,
      description,
      climate,
      location,
      contactInfo,
      facilities,
      diningOptions,
      functionOptions,
      policies,
      activities,
      images,
      otherInfo,
      isHaveStars,
      howManyStars,
      isVerified,
      isHaveCertificate,
      isHaveLicense,
      acceptTeams
    } = req.body;

    // Validate hotel ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hotel ID'
      });
    }

    // Find hotel profile
    const hotel = await HotelsAccommodations.findById(id);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel profile not found'
      });
    }

    // Verify ownership
    if (hotel.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this hotel profile'
      });
    }

    // Validate required fields
    if (!hotelName || !category || !description || !climate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: hotelName, category, description, climate'
      });
    }

    // Validate location
    if (!location || !location.address || !location.city || !location.province || !location.mapUrl) {
      return res.status(400).json({
        success: false,
        message: 'Complete location information is required'
      });
    }

    // Validate province and city combination
    if (!provincesAndDistricts[location.province] || !provincesAndDistricts[location.province].includes(location.city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province and city combination'
      });
    }

    // Validate contact info
    if (!contactInfo || !contactInfo.email || !contactInfo.contactNumber || !contactInfo.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'Complete contact information is required'
      });
    }

    // Validate images
    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 image is required'
      });
    }

    if (images.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed'
      });
    }

    // Update hotel profile
    hotel.hotelName = hotelName;
    hotel.category = category;
    hotel.description = description;
    hotel.climate = climate;
    hotel.location = location;
    hotel.contactInfo = contactInfo;
    hotel.facilities = facilities || {};
    hotel.diningOptions = diningOptions || {};
    hotel.functionOptions = functionOptions || {};
    hotel.policies = policies || {};
    hotel.activities = activities || {};
    hotel.images = images;
    hotel.otherInfo = otherInfo || [];
    hotel.isHaveStars = isHaveStars || false;
    hotel.howManyStars = isHaveStars ? howManyStars : undefined;
    hotel.isVerified = isVerified || false;
    hotel.isHaveCertificate = isHaveCertificate || false;
    hotel.isHaveLicense = isHaveLicense || false;
    hotel.acceptTeams = acceptTeams || false;

    await hotel.save();

    res.json({
      success: true,
      message: 'Hotel profile updated successfully',
      data: hotel
    });
  } catch (error) {
    console.error('Error updating hotel profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hotel profile. Please try again.',
      error: error.message
    });
  }
});

// POST /api/hotels-accommodations/:id/review - Add review and rating
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find hotel
    const hotel = await HotelsAccommodations.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    // Check if user already reviewed
    const existingReviewIndex = hotel.reviews.findIndex(
      r => r.userId.toString() === req.user._id.toString()
    );

    const newReview = {
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };

    if (existingReviewIndex !== -1) {
      // Update existing review
      hotel.reviews[existingReviewIndex] = newReview;
    } else {
      // Add new review
      hotel.reviews.push(newReview);
    }

    // Recalculate average rating
    const totalRating = hotel.reviews.reduce((sum, review) => sum + review.rating, 0);
    hotel.averageRating = parseFloat((totalRating / hotel.reviews.length).toFixed(1));
    hotel.totalReviews = hotel.reviews.length;

    await hotel.save();

    res.status(200).json({
      success: true,
      message: existingReviewIndex !== -1 ? 'Review updated successfully' : 'Review added successfully',
      data: {
        averageRating: hotel.averageRating,
        totalReviews: hotel.totalReviews,
        reviews: hotel.reviews
      }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
});

module.exports = router;

