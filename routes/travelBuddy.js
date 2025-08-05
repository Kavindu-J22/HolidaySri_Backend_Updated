const express = require('express');
const mongoose = require('mongoose');
const TravelBuddy = require('../models/TravelBuddy');
const TravelBuddyReview = require('../models/TravelBuddyReview');
const TravelBuddyFavorite = require('../models/TravelBuddyFavorite');
const TravelBuddyReport = require('../models/TravelBuddyReport');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const moment = require('moment-timezone');

const router = express.Router();

// Simple in-memory cache to prevent rapid duplicate view increments
const viewCache = new Map();

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

// GET /api/travel-buddy/platform - Get all active travel buddies for the platform (excluding expired ads)
router.get('/platform', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      country = '',
      gender = '',
      minAge = '',
      maxAge = '',
      sortBy = 'newest'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build match conditions
    const matchConditions = {
      isActive: true
    };

    // Search by name or description
    if (search.trim()) {
      matchConditions.$or = [
        { userName: { $regex: search.trim(), $options: 'i' } },
        { nickName: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { interests: { $in: [new RegExp(search.trim(), 'i')] } }
      ];
    }

    // Filter by country
    if (country.trim()) {
      matchConditions.country = country.trim();
    }

    // Filter by gender
    if (gender.trim()) {
      matchConditions.gender = gender.trim();
    }

    // Filter by age range
    if (minAge && !isNaN(parseInt(minAge))) {
      matchConditions.age = { ...matchConditions.age, $gte: parseInt(minAge) };
    }
    if (maxAge && !isNaN(parseInt(maxAge))) {
      matchConditions.age = { ...matchConditions.age, $lte: parseInt(maxAge) };
    }

    // Build sort conditions
    let sortConditions = {};
    switch (sortBy) {
      case 'rating':
        sortConditions = { averageRating: -1, totalReviews: -1, publishedAt: -1 };
        break;
      case 'popular':
        sortConditions = { viewCount: -1, totalReviews: -1, publishedAt: -1 };
        break;
      case 'oldest':
        sortConditions = { publishedAt: 1 };
        break;
      case 'newest':
      default:
        sortConditions = { publishedAt: -1 };
        break;
    }

    // Aggregate pipeline to get travel buddies with non-expired ads
    const pipeline = [
      {
        $lookup: {
          from: 'advertisements',
          localField: 'publishedAdId',
          foreignField: '_id',
          as: 'advertisement'
        }
      },
      {
        $unwind: '$advertisement'
      },
      {
        $match: {
          ...matchConditions,
          'advertisement.status': { $ne: 'expired' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          userName: 1,
          nickName: 1,
          age: 1,
          country: 1,
          description: 1,
          gender: 1,
          interests: 1,
          coverPhoto: 1,
          avatarImage: 1,
          viewCount: 1,
          averageRating: 1,
          totalReviews: 1,
          publishedAt: 1,
          'advertisement.expiresAt': 1,
          'advertisement.slotId': 1,
          'user.isMember': 1,
          'user.isPartner': 1,
          'user.isVerified': 1
        }
      },
      {
        $sort: sortConditions
      }
    ];

    // Get total count for pagination
    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await TravelBuddy.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Get paginated results
    const travelBuddies = await TravelBuddy.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: limitNum }
    ]);

    res.json({
      success: true,
      data: {
        travelBuddies,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching travel buddies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch travel buddies'
    });
  }
});

// GET /api/travel-buddy/:id - Get individual travel buddy profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel buddy ID'
      });
    }

    console.log(`[VIEW COUNT] Request from IP: ${clientIP} for buddy: ${id}`);

    // Find travel buddy with populated data
    const travelBuddy = await TravelBuddy.findOne({
      _id: id,
      isActive: true
    })
    .populate({
      path: 'publishedAdId',
      model: 'Advertisement',
      match: { status: { $ne: 'expired' } },
      select: 'expiresAt slotId status'
    })
    .populate({
      path: 'userId',
      model: 'User',
      select: 'name isMember isPartner isVerified'
    });

    if (!travelBuddy || !travelBuddy.publishedAdId) {
      return res.status(404).json({
        success: false,
        message: 'Travel buddy not found or no longer available'
      });
    }

    // Increment view count with rate limiting
    const cacheKey = `${clientIP}-${id}`;
    const now = Date.now();
    const lastView = viewCache.get(cacheKey);

    let updatedBuddy;
    if (!lastView || (now - lastView) > 30000) { // 30 seconds cooldown
      console.log(`[VIEW COUNT] Incrementing view count for travel buddy: ${id} from IP: ${clientIP}`);
      updatedBuddy = await TravelBuddy.findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true } // Return the updated document
      );
      viewCache.set(cacheKey, now);
      console.log(`[VIEW COUNT] Updated view count: ${updatedBuddy.viewCount}`);
    } else {
      console.log(`[VIEW COUNT] Skipping increment for ${id} - too recent (${now - lastView}ms ago)`);
      updatedBuddy = await TravelBuddy.findById(id);
    }

    // Format response data
    const responseData = {
      _id: travelBuddy._id,
      userName: travelBuddy.userName,
      nickName: travelBuddy.nickName,
      age: travelBuddy.age,
      whatsappNumber: travelBuddy.whatsappNumber,
      country: travelBuddy.country,
      description: travelBuddy.description,
      gender: travelBuddy.gender,
      interests: travelBuddy.interests,
      coverPhoto: travelBuddy.coverPhoto,
      avatarImage: travelBuddy.avatarImage,
      viewCount: updatedBuddy.viewCount, // Use the updated view count
      contactCount: travelBuddy.contactCount,
      averageRating: travelBuddy.averageRating,
      totalReviews: travelBuddy.totalReviews,
      reportCount: travelBuddy.reportCount,
      publishedAt: travelBuddy.publishedAt,
      advertisement: {
        expiresAt: travelBuddy.publishedAdId.expiresAt,
        slotId: travelBuddy.publishedAdId.slotId
      },
      user: {
        isMember: travelBuddy.userId.isMember,
        isPartner: travelBuddy.userId.isPartner,
        isVerified: travelBuddy.userId.isVerified,
        name: travelBuddy.userId.name
      }
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching travel buddy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch travel buddy profile'
    });
  }
});

// POST /api/travel-buddy/:id/contact - Increment contact count
router.post('/:id/contact', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const travelBuddy = await TravelBuddy.findById(id);
    if (!travelBuddy) {
      return res.status(404).json({
        success: false,
        message: 'Travel buddy not found'
      });
    }

    await travelBuddy.incrementContactCount();

    res.json({
      success: true,
      message: 'Contact recorded successfully'
    });

  } catch (error) {
    console.error('Error recording contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record contact'
    });
  }
});

// GET /api/travel-buddy/:id/reviews - Get reviews for a travel buddy
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const reviews = await TravelBuddyReview.find({
      travelBuddyId: id,
      isActive: true
    })
    .populate('userId', 'name profileImage')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

    const total = await TravelBuddyReview.countDocuments({
      travelBuddyId: id,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// POST /api/travel-buddy/:id/reviews - Add a review for a travel buddy
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate input
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if travel buddy exists
    const travelBuddy = await TravelBuddy.findById(id);
    if (!travelBuddy) {
      return res.status(404).json({
        success: false,
        message: 'Travel buddy not found'
      });
    }

    // Check if user already reviewed this travel buddy
    const existingReview = await TravelBuddyReview.findOne({
      travelBuddyId: id,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this travel buddy'
      });
    }

    // Create new review
    const review = new TravelBuddyReview({
      travelBuddyId: id,
      userId: req.user._id,
      rating: parseInt(rating),
      comment: comment.trim()
    });

    await review.save();

    // Populate user data for response
    await review.populate('userId', 'name profileImage');

    res.json({
      success: true,
      message: 'Review added successfully',
      data: review
    });

  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// PUT /api/travel-buddy/reviews/:reviewId - Update a travel buddy review
router.put('/reviews/:reviewId', verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    // Validate input
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find the review
    const review = await TravelBuddyReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Update the review
    review.rating = parseInt(rating);
    review.comment = comment.trim();
    await review.save();

    // Populate user data for response
    await review.populate('userId', 'name profileImage');

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
});

// DELETE /api/travel-buddy/reviews/:reviewId - Delete a travel buddy review
router.delete('/reviews/:reviewId', verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Find the review
    const review = await TravelBuddyReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    // Hard delete the review to allow user to create a new one
    await TravelBuddyReview.findByIdAndDelete(reviewId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
});

// POST /api/travel-buddy/:id/favorite - Add/Remove travel buddy from favorites
router.post('/:id/favorite', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if travel buddy exists
    const travelBuddy = await TravelBuddy.findById(id);
    if (!travelBuddy) {
      return res.status(404).json({
        success: false,
        message: 'Travel buddy not found'
      });
    }

    // Check if already in favorites
    const existingFavorite = await TravelBuddyFavorite.findOne({
      userId: req.user._id,
      travelBuddyId: id
    });

    if (existingFavorite) {
      // Remove from favorites
      await TravelBuddyFavorite.findByIdAndDelete(existingFavorite._id);

      res.json({
        success: true,
        message: 'Removed from favorites',
        isFavorite: false
      });
    } else {
      // Add to favorites
      const favorite = new TravelBuddyFavorite({
        userId: req.user._id,
        travelBuddyId: id
      });

      await favorite.save();

      res.json({
        success: true,
        message: 'Added to favorites',
        isFavorite: true
      });
    }

  } catch (error) {
    console.error('Error managing favorite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to manage favorite'
    });
  }
});

// GET /api/travel-buddy/favorites/my - Get user's favorite travel buddies
router.get('/favorites/my', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const favorites = await TravelBuddyFavorite.find({ userId: req.user._id })
      .populate({
        path: 'travelBuddyId',
        match: { isActive: true },
        populate: {
          path: 'publishedAdId',
          model: 'Advertisement',
          match: { status: { $ne: 'expired' } }
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Filter out favorites where travel buddy or ad is null (inactive/expired)
    const validFavorites = favorites.filter(fav =>
      fav.travelBuddyId && fav.travelBuddyId.publishedAdId
    );

    const total = await TravelBuddyFavorite.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        favorites: validFavorites.map(fav => fav.travelBuddyId),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorites'
    });
  }
});

// GET /api/travel-buddy/:id/favorite-status - Check if travel buddy is in user's favorites
router.get('/:id/favorite-status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const favorite = await TravelBuddyFavorite.findOne({
      userId: req.user._id,
      travelBuddyId: id
    });

    res.json({
      success: true,
      isFavorite: !!favorite
    });

  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check favorite status'
    });
  }
});

// POST /api/travel-buddy/:id/report - Report a travel buddy
router.post('/:id/report', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'other', description = '' } = req.body;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel buddy ID'
      });
    }

    // Check if travel buddy exists
    const travelBuddy = await TravelBuddy.findById(id);
    if (!travelBuddy) {
      return res.status(404).json({
        success: false,
        message: 'Travel buddy not found'
      });
    }

    // Check if user already reported this travel buddy
    const existingReport = await TravelBuddyReport.findOne({
      travelBuddyId: id,
      reportedBy: req.user._id
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this travel buddy'
      });
    }

    // Create new report
    const report = new TravelBuddyReport({
      travelBuddyId: id,
      reportedBy: req.user._id,
      reason: reason,
      description: description.trim()
    });

    await report.save();

    res.json({
      success: true,
      message: 'Report submitted successfully. Thank you for helping keep our community safe.'
    });

  } catch (error) {
    console.error('Error reporting travel buddy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report'
    });
  }
});

module.exports = router;
