const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const VehicleRepairsMechanics = require('../models/VehicleRepairsMechanics');
const VehicleRepairsMechanicsReview = require('../models/VehicleRepairsMechanicsReview');
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

// GET /api/vehicle-repairs-mechanics/provinces - Get all provinces and cities
router.get('/provinces', async (req, res) => {
  try {
    res.json({
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

// POST /api/vehicle-repairs-mechanics/publish - Create vehicle repairs mechanics profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      city,
      province,
      contact,
      available,
      facebook,
      website,
      availability,
      services,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !avatar || !avatar.url || !avatar.publicId ||
        !specialization || !category || !description || experience === undefined ||
        !city || !province || !contact || !images || images.length === 0 ||
        !availability || !services || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate province/city combination
    if (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province/city combination'
      });
    }

    // Validate experience
    if (experience < 0 || experience > 70) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 70 years'
      });
    }

    // Validate services array
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service must be provided'
      });
    }

    // Validate images array
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image must be provided'
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

    // Create vehicle repairs mechanics profile
    const vehicleRepairsMechanic = new VehicleRepairsMechanics({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      avatar,
      specialization,
      category,
      description,
      experience,
      location: {
        city,
        province
      },
      contact,
      available,
      facebook: facebook || null,
      website: website || null,
      availability,
      services,
      images
    });

    await vehicleRepairsMechanic.save();

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
    advertisement.publishedAdId = vehicleRepairsMechanic._id;
    advertisement.publishedAdModel = 'VehicleRepairsMechanics';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Vehicle repairs mechanic profile published successfully!',
      data: {
        vehicleRepairsMechanic: {
          _id: vehicleRepairsMechanic._id,
          name: vehicleRepairsMechanic.name,
          specialization: vehicleRepairsMechanic.specialization,
          category: vehicleRepairsMechanic.category,
          location: vehicleRepairsMechanic.location,
          publishedAt: vehicleRepairsMechanic.publishedAt
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
    console.error('Error publishing vehicle repairs mechanic:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing vehicle repairs mechanic profile',
      error: error.message
    });
  }
});

// GET /api/vehicle-repairs-mechanics/browse - Browse all vehicle repairs mechanics with filters
router.get('/browse', async (req, res) => {
  try {
    const { province, city, specialization, category, search } = req.query;

    // Build filter object
    const filter = {};
    const andConditions = [];

    // Add location filters
    if (province) {
      andConditions.push({ 'location.province': province });
    }
    if (city) {
      andConditions.push({ 'location.city': city });
    }

    // Add specialization filter
    if (specialization) {
      andConditions.push({ specialization: { $regex: specialization, $options: 'i' } });
    }

    // Add category filter
    if (category) {
      andConditions.push({ category: { $regex: category, $options: 'i' } });
    }

    // Add search filter
    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { specialization: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Combine all conditions with $and
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Fetch mechanics
    const mechanics = await VehicleRepairsMechanics.find(filter)
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    // Filter out expired advertisements
    const validMechanics = [];
    for (const mechanic of mechanics) {
      const advertisement = await Advertisement.findById(mechanic.publishedAdId);
      if (advertisement && advertisement.status === 'Published' && (!advertisement.expiresAt || new Date(advertisement.expiresAt) > new Date())) {
        validMechanics.push(mechanic);
      }
    }

    // Shuffle the results randomly
    const shuffled = validMechanics.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: shuffled
    });
  } catch (error) {
    console.error('Error fetching vehicle repairs mechanics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle repairs mechanics'
    });
  }
});

// GET /api/vehicle-repairs-mechanics/:id - Get single mechanic profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const mechanic = await VehicleRepairsMechanics.findById(id)
      .populate('userId', 'name email avatar');

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment view count
    mechanic.viewCount = (mechanic.viewCount || 0) + 1;
    await mechanic.save();

    res.json({
      success: true,
      data: mechanic
    });
  } catch (error) {
    console.error('Error fetching mechanic profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mechanic profile'
    });
  }
});

// PUT /api/vehicle-repairs-mechanics/:id - Update mechanic profile
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
      available,
      facebook,
      website,
      availability,
      services,
      images,
      avatar
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const mechanic = await VehicleRepairsMechanics.findById(id);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Verify ownership
    if (mechanic.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }

    // Validate province/city combination
    if (province && city && (!provincesAndDistricts[province] || !provincesAndDistricts[province].includes(city))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province/city combination'
      });
    }

    // Update fields
    if (name) mechanic.name = name;
    if (specialization) mechanic.specialization = specialization;
    if (category) mechanic.category = category;
    if (description) mechanic.description = description;
    if (experience !== undefined) mechanic.experience = experience;
    if (city && province) {
      mechanic.location = { city, province };
    }
    if (available !== undefined) mechanic.available = available;
    if (facebook !== undefined) mechanic.facebook = facebook;
    if (website !== undefined) mechanic.website = website;
    if (availability) mechanic.availability = availability;
    if (services && Array.isArray(services)) mechanic.services = services;
    if (images && Array.isArray(images)) mechanic.images = images;
    if (avatar && avatar.url && avatar.publicId) mechanic.avatar = avatar;

    await mechanic.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: mechanic
    });
  } catch (error) {
    console.error('Error updating mechanic profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mechanic profile'
    });
  }
});

// DELETE /api/vehicle-repairs-mechanics/:id - Delete mechanic profile
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const mechanic = await VehicleRepairsMechanics.findById(id);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Verify ownership
    if (mechanic.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this profile'
      });
    }

    // Update advertisement status to 'Unpublished'
    const advertisement = await Advertisement.findById(mechanic.publishedAdId);
    if (advertisement) {
      advertisement.status = 'Unpublished';
      advertisement.publishedAdId = null;
      advertisement.publishedAdModel = null;
      await advertisement.save();
    }

    // Delete mechanic profile
    await VehicleRepairsMechanics.findByIdAndDelete(id);

    // Delete associated reviews
    await VehicleRepairsMechanicsReview.deleteMany({ mechanicId: id });

    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting mechanic profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete mechanic profile'
    });
  }
});

// POST /api/vehicle-repairs-mechanics/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    if (!rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating, title, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const mechanic = await VehicleRepairsMechanics.findById(id);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Create review
    const review = new VehicleRepairsMechanicsReview({
      mechanicId: id,
      userId: req.user._id,
      rating,
      title,
      comment
    });

    await review.save();

    // Update mechanic's average rating
    const allReviews = await VehicleRepairsMechanicsReview.find({ mechanicId: id });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    mechanic.averageRating = parseFloat((totalRating / allReviews.length).toFixed(1));
    mechanic.totalReviews = allReviews.length;
    await mechanic.save();

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

// GET /api/vehicle-repairs-mechanics/:id/reviews - Get reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID'
      });
    }

    const reviews = await VehicleRepairsMechanicsReview.find({ mechanicId: id })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

module.exports = router;

