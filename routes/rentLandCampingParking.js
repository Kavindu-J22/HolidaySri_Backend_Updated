const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const RentLandCampingParking = require('../models/RentLandCampingParking');
const Advertisement = require('../models/Advertisement');

const router = express.Router();

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

// POST /api/rent-land-camping-parking/publish - Create rent land camping parking profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      description,
      category,
      images,
      province,
      city,
      nearby,
      activities,
      includes,
      contact,
      website,
      facebook,
      available,
      price,
      weekendPrice,
      availability,
      mapLink
    } = req.body;

    // Validate required fields
    if (!advertisementId || !title || !description || !category || !province || !city || 
        !contact || !images || images.length === 0 || price === undefined || 
        weekendPrice === undefined || !availability) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count
    if (images.length < 1 || images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 4 images'
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

    // Validate contact number format
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact number format'
      });
    }

    // Validate advertisement ID
    if (!mongoose.isValidObjectId(advertisementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID'
      });
    }

    // Find and verify advertisement ownership
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'rent_land_camping_parking'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    // Create RentLandCampingParking document
    const rentLandCampingParking = new RentLandCampingParking({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      description,
      category,
      images,
      location: {
        province,
        city
      },
      nearby: nearby || [],
      activities: activities || [],
      includes: includes || [],
      contact,
      website: website || null,
      facebook: facebook || null,
      available: available !== undefined ? available : true,
      price,
      weekendPrice,
      availability,
      mapLink: mapLink || null
    });

    await rentLandCampingParking.save();

    // Calculate expiration date based on advertisement plan
    const now = moment.tz('Asia/Colombo');
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

    // Update advertisement status, expiration, and published ad reference
    advertisement.status = 'Published';
    advertisement.publishedAt = now.toDate();
    advertisement.expiresAt = new Date(now.toDate().getTime() + expirationTime);
    advertisement.publishedAdId = rentLandCampingParking._id;
    advertisement.publishedAdModel = 'RentLandCampingParking';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Rent Land Camping Parking published successfully!',
      data: {
        rentLandCampingParking: {
          _id: rentLandCampingParking._id,
          title: rentLandCampingParking.title,
          province: rentLandCampingParking.location.province,
          city: rentLandCampingParking.location.city,
          publishedAt: rentLandCampingParking.publishedAt
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
    console.error('Error publishing rent land camping parking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish rent land camping parking',
      error: error.message
    });
  }
});

// GET /api/rent-land-camping-parking/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
  try {
    res.json({
      success: true,
      data: provincesAndDistricts
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces',
      error: error.message
    });
  }
});

// GET /api/rent-land-camping-parking/browse - Get all published listings with filters
router.get('/browse', async (req, res) => {
  try {
    const { category, province, city, search } = req.query;

    // Build filter query
    const filter = { isActive: true };

    // Exclude expired advertisements
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'RentLandCampingParking'
    }).select('publishedAdId');

    const expiredIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredIds.length > 0) {
      filter._id = { $nin: expiredIds };
    }

    if (category) {
      filter.category = category;
    }

    if (province) {
      filter['location.province'] = province;
    }

    if (city) {
      filter['location.city'] = city;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch listings and shuffle randomly
    let listings = await RentLandCampingParking.find(filter)
      .select('_id title description category images location price weekendPrice availability averageRating totalReviews')
      .lean();

    // Shuffle array randomly
    listings = listings.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: listings,
      count: listings.length
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch listings',
      error: error.message
    });
  }
});

// GET /api/rent-land-camping-parking/:id - Get single listing details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const listing = await RentLandCampingParking.findById(id)
      .populate('userId', 'firstName lastName email profileImage')
      .lean();

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Increment view count
    await RentLandCampingParking.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch listing',
      error: error.message
    });
  }
});

// PUT /api/rent-land-camping-parking/:id - Update listing
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      images,
      province,
      city,
      nearby,
      activities,
      includes,
      contact,
      website,
      facebook,
      available,
      price,
      weekendPrice,
      availability,
      mapLink
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Find listing and verify ownership
    const listing = await RentLandCampingParking.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this listing'
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

    // Validate contact number if provided
    if (contact) {
      const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
      if (!contactRegex.test(contact)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact number format'
        });
      }
    }

    // Update listing
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (images && images.length > 0 && images.length <= 4) updateData.images = images;

    // Update location fields using dot notation to preserve existing values
    if (province && city) {
      updateData['location.province'] = province;
      updateData['location.city'] = city;
    }

    if (nearby) updateData.nearby = nearby;
    if (activities) updateData.activities = activities;
    if (includes) updateData.includes = includes;
    if (contact) updateData.contact = contact;
    if (website !== undefined) updateData.website = website || null;
    if (facebook !== undefined) updateData.facebook = facebook || null;
    if (available !== undefined) updateData.available = available;
    if (price !== undefined) updateData.price = price;
    if (weekendPrice !== undefined) updateData.weekendPrice = weekendPrice;
    if (availability) updateData.availability = availability;
    if (mapLink !== undefined) updateData.mapLink = mapLink || null;

    const updatedListing = await RentLandCampingParking.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: updatedListing
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

// POST /api/rent-land-camping-parking/:id/review - Add rating and review
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const listing = await RentLandCampingParking.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user already reviewed
    const existingReview = listing.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      listing.reviews.push({
        userId: req.user._id,
        userName: req.user.firstName + ' ' + req.user.lastName,
        userImage: req.user.profileImage,
        rating,
        reviewText: reviewText || '',
        createdAt: new Date()
      });
    }

    // Calculate average rating
    const totalRating = listing.reviews.reduce((sum, r) => sum + r.rating, 0);
    listing.averageRating = (totalRating / listing.reviews.length).toFixed(1);
    listing.totalReviews = listing.reviews.length;

    await listing.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        averageRating: listing.averageRating,
        totalReviews: listing.totalReviews,
        reviews: listing.reviews
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

// GET /api/rent-land-camping-parking/:id/reviews - Get all reviews for a listing
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const listing = await RentLandCampingParking.findById(id)
      .select('reviews averageRating totalReviews')
      .lean();

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    res.json({
      success: true,
      data: {
        averageRating: listing.averageRating,
        totalReviews: listing.totalReviews,
        reviews: listing.reviews
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
});

module.exports = router;

