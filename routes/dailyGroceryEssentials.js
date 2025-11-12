const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const DailyGroceryEssentials = require('../models/DailyGroceryEssentials');
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

// POST /api/daily-grocery-essentials/publish - Create listing and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      specialization,
      category,
      description,
      price,
      city,
      province,
      paymentMethods,
      deliveryAvailable,
      contact,
      facebook,
      website,
      discount,
      images,
      available,
      mapLink
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !specialization || !category || !description ||
        !price || !city || !province || !paymentMethods || paymentMethods.length === 0 ||
        !contact || !images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images (max 2)
    if (images.length > 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 images allowed'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province or city combination'
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
      category: 'daily_grocery_essentials'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create DailyGroceryEssentials document
    const dailyGroceryEssentials = new DailyGroceryEssentials({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      specialization,
      category,
      description,
      price: parseFloat(price),
      city,
      province,
      paymentMethods,
      deliveryAvailable: deliveryAvailable === true || deliveryAvailable === 'true',
      contact,
      facebook: facebook || null,
      website: website || null,
      discount: discount ? parseFloat(discount) : 0,
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || name
      })),
      available: available === true || available === 'true',
      mapLink: mapLink || null
    });

    await dailyGroceryEssentials.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const now = moment.tz('Asia/Colombo');
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
    advertisement.publishedAdId = dailyGroceryEssentials._id;
    advertisement.publishedAdModel = 'DailyGroceryEssentials';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Daily Grocery Essentials published successfully!',
      data: {
        dailyGroceryEssentials: {
          _id: dailyGroceryEssentials._id,
          name: dailyGroceryEssentials.name,
          specialization: dailyGroceryEssentials.specialization,
          category: dailyGroceryEssentials.category,
          province: dailyGroceryEssentials.province,
          city: dailyGroceryEssentials.city,
          publishedAt: dailyGroceryEssentials.publishedAt
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
    console.error('Error publishing daily grocery essentials:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing daily grocery essentials',
      error: error.message
    });
  }
});

// GET /api/daily-grocery-essentials/provinces - Get provinces and districts
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
      message: 'Error fetching provinces',
      error: error.message
    });
  }
});

// GET /api/daily-grocery-essentials/:id - Get single listing
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const listing = await DailyGroceryEssentials.findById(id)
      .populate('userId', 'name email contactNumber')
      .populate('reviews.userId', 'name');

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Increment view count
    listing.viewCount = (listing.viewCount || 0) + 1;
    await listing.save();

    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
      error: error.message
    });
  }
});

// GET /api/daily-grocery-essentials/browse/all - Browse all listings with filters
router.get('/browse/all', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build match conditions
    const matchConditions = { isActive: true };

    if (search) {
      matchConditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    if (specialization) {
      matchConditions.specialization = { $regex: specialization, $options: 'i' };
    }

    if (category) {
      matchConditions.category = { $regex: category, $options: 'i' };
    }

    if (city) {
      matchConditions.city = { $regex: city, $options: 'i' };
    }

    if (province) {
      matchConditions.province = { $regex: province, $options: 'i' };
    }

    // Aggregate pipeline to get listings with non-expired ads
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
        $unwind: {
          path: '$advertisement',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          ...matchConditions,
          $or: [
            { 'advertisement.status': { $ne: 'expired' } },
            { 'advertisement': null }
          ]
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
        $sample: { size: parseInt(limit) * 2 } // Get more for random selection
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      }
    ];

    const listings = await DailyGroceryEssentials.aggregate(pipeline);

    // Get total count
    const countPipeline = [
      {
        $lookup: {
          from: 'advertisements',
          localField: 'publishedAdId',
          foreignField: '_id',
          as: 'advertisement'
        }
      },
      {
        $unwind: {
          path: '$advertisement',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          ...matchConditions,
          $or: [
            { 'advertisement.status': { $ne: 'expired' } },
            { 'advertisement': null }
          ]
        }
      },
      {
        $count: 'total'
      }
    ];

    const countResult = await DailyGroceryEssentials.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: listings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: parseInt(page) * parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error browsing listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error browsing listings',
      error: error.message
    });
  }
});

// PUT /api/daily-grocery-essentials/:id - Update listing
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      specialization,
      category,
      description,
      price,
      city,
      province,
      paymentMethods,
      deliveryAvailable,
      contact,
      facebook,
      website,
      discount,
      images,
      available,
      mapLink
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Find listing and verify ownership
    const listing = await DailyGroceryEssentials.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this listing'
      });
    }

    // Validate province and city if provided
    if (province && city) {
      if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid province or city combination'
        });
      }
    }

    // Update listing
    if (name) listing.name = name;
    if (specialization) listing.specialization = specialization;
    if (category) listing.category = category;
    if (description) listing.description = description;
    if (price) listing.price = parseFloat(price);
    if (city) listing.city = city;
    if (province) listing.province = province;
    if (paymentMethods) listing.paymentMethods = paymentMethods;
    if (deliveryAvailable !== undefined) listing.deliveryAvailable = deliveryAvailable === true || deliveryAvailable === 'true';
    if (contact) listing.contact = contact;
    if (facebook !== undefined) listing.facebook = facebook || null;
    if (website !== undefined) listing.website = website || null;
    if (discount !== undefined) listing.discount = discount ? parseFloat(discount) : 0;
    if (images) listing.images = images.map(img => ({
      url: img.url,
      publicId: img.publicId,
      alt: img.alt || name
    }));
    if (available !== undefined) listing.available = available === true || available === 'true';
    if (mapLink !== undefined) listing.mapLink = mapLink || null;

    await listing.save();

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: listing
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating listing',
      error: error.message
    });
  }
});

// POST /api/daily-grocery-essentials/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const listing = await DailyGroceryEssentials.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user already reviewed
    const existingReview = listing.reviews.find(r => r.userId.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this listing'
      });
    }

    // Add review
    listing.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      reviewText: reviewText || ''
    });

    // Calculate average rating
    const totalRating = listing.reviews.reduce((sum, r) => sum + r.rating, 0);
    listing.averageRating = totalRating / listing.reviews.length;
    listing.totalReviews = listing.reviews.length;

    await listing.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: listing
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding review',
      error: error.message
    });
  }
});

module.exports = router;

