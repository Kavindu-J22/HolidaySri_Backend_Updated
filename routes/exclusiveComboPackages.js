const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const ExclusiveComboPackages = require('../models/ExclusiveComboPackages');
const Advertisement = require('../models/Advertisement');

// POST /api/exclusive-combo-packages/publish - Create package and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      categoryType,
      locations,
      description,
      images,
      days,
      pax,
      activities,
      includes,
      price,
      provider
    } = req.body;

    // Validate required fields
    if (!advertisementId || !title || !categoryType || !locations || !description || 
        !images || images.length === 0 || !days || !pax || !price || 
        !provider || !provider.name || !provider.avatar || !provider.contact) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 3)
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    // Validate days
    if (days < 1) {
      return res.status(400).json({
        success: false,
        message: 'Days must be at least 1'
      });
    }

    // Get advertisement
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

    // Create exclusive combo package
    const comboPackage = new ExclusiveComboPackages({
      userId: req.user._id,
      publishedAdId: advertisementId,
      title,
      categoryType,
      locations,
      description,
      images: images.map(img => ({
        url: img.url,
        publicId: img.publicId,
        alt: title
      })),
      days: parseInt(days),
      pax,
      activities: activities || [],
      includes: includes || [],
      price: parseFloat(price),
      provider: {
        name: provider.name,
        avatar: {
          url: provider.avatar.url,
          publicId: provider.avatar.publicId
        },
        facebook: provider.facebook || null,
        website: provider.website || null,
        contact: provider.contact
      }
    });

    await comboPackage.save();

    // Calculate expiration time based on plan duration
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
    advertisement.publishedAdId = comboPackage._id;
    advertisement.publishedAdModel = 'ExclusiveComboPackages';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Exclusive combo package published successfully',
      data: {
        packageId: comboPackage._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing exclusive combo package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish package',
      error: error.message
    });
  }
});

// GET /api/exclusive-combo-packages/browse - Get all packages with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, locations, categoryType, page = 1, limit = 12 } = req.query;

    // Build filter query
    const filter = { isActive: true };

    // Filter by expiration - only show non-expired packages
    filter.publishedAdId = { $exists: true };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (locations) {
      filter.locations = { $regex: locations, $options: 'i' };
    }

    if (categoryType) {
      filter.categoryType = categoryType;
    }

    // Get packages and filter by advertisement status
    const allPackages = await ExclusiveComboPackages.find(filter).lean();

    // Filter out packages where the associated advertisement is expired
    const validPackages = [];
    for (const pkg of allPackages) {
      const ad = await Advertisement.findById(pkg.publishedAdId);
      if (ad && ad.status !== 'expired') {
        validPackages.push(pkg);
      }
    }

    // Shuffle the valid packages for random sorting
    const shuffled = validPackages.sort(() => Math.random() - 0.5);

    // Apply pagination
    const total = shuffled.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedPackages = shuffled.slice(startIndex, startIndex + limitNum);

    res.status(200).json({
      success: true,
      data: paginatedPackages,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages',
      error: error.message
    });
  }
});

// GET /api/exclusive-combo-packages/:id - Get package details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    const comboPackage = await ExclusiveComboPackages.findById(id);

    if (!comboPackage) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Increment view count
    comboPackage.viewCount = (comboPackage.viewCount || 0) + 1;
    await comboPackage.save();

    res.status(200).json({
      success: true,
      data: comboPackage
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch package',
      error: error.message
    });
  }
});

// PUT /api/exclusive-combo-packages/:id - Update package
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      categoryType,
      locations,
      description,
      images,
      days,
      pax,
      activities,
      includes,
      price,
      provider
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    const comboPackage = await ExclusiveComboPackages.findById(id);

    if (!comboPackage) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Check ownership
    if (comboPackage.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this package'
      });
    }

    // Validate image count
    if (images && images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Update fields
    if (title) comboPackage.title = title;
    if (categoryType) comboPackage.categoryType = categoryType;
    if (locations) comboPackage.locations = locations;
    if (description) comboPackage.description = description;
    if (images) comboPackage.images = images.map(img => ({
      url: img.url,
      publicId: img.publicId,
      alt: title || comboPackage.title
    }));
    if (days) comboPackage.days = parseInt(days);
    if (pax) comboPackage.pax = pax;
    if (activities) comboPackage.activities = activities;
    if (includes) comboPackage.includes = includes;
    if (price) comboPackage.price = parseFloat(price);
    if (provider) {
      if (provider.name) comboPackage.provider.name = provider.name;
      if (provider.avatar) comboPackage.provider.avatar = {
        url: provider.avatar.url,
        publicId: provider.avatar.publicId
      };
      if (provider.facebook !== undefined) comboPackage.provider.facebook = provider.facebook;
      if (provider.website !== undefined) comboPackage.provider.website = provider.website;
      if (provider.contact) comboPackage.provider.contact = provider.contact;
    }

    await comboPackage.save();

    res.status(200).json({
      success: true,
      message: 'Package updated successfully',
      data: comboPackage
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update package',
      error: error.message
    });
  }
});

// POST /api/exclusive-combo-packages/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const comboPackage = await ExclusiveComboPackages.findById(id);

    if (!comboPackage) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Create review
    const review = {
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };

    // Add review
    if (!comboPackage.reviews) {
      comboPackage.reviews = [];
    }
    comboPackage.reviews.push(review);

    // Calculate average rating
    const totalRating = comboPackage.reviews.reduce((sum, r) => sum + r.rating, 0);
    comboPackage.averageRating = (totalRating / comboPackage.reviews.length).toFixed(1);
    comboPackage.totalReviews = comboPackage.reviews.length;

    await comboPackage.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: {
        review,
        averageRating: comboPackage.averageRating,
        totalReviews: comboPackage.totalReviews
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

