const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const VehicleRentalsHire = require('../models/VehicleRentalsHire');
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

// POST /api/vehicle-rentals-hire/publish - Create vehicle rentals hire profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      vehicleCategory,
      serviceCategory,
      images,
      province,
      city,
      contact,
      pricePerKm,
      features,
      vehicleStatus,
      driverStatus,
      driverGender,
      capacity,
      description,
      facebook,
      website
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !vehicleCategory || !serviceCategory ||
        !province || !city || !contact || !images || images.length === 0 ||
        pricePerKm === undefined || !vehicleStatus || !driverStatus || !driverGender ||
        !capacity || !description) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count (maximum 3 images)
    if (images.length < 1 || images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 3 images'
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

    // Validate contact number format (flexible for all countries)
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact number format'
      });
    }

    // Validate price per km
    if (pricePerKm < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price per km must be a positive number'
      });
    }

    // Validate capacity
    if (capacity < 1 || capacity > 100) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be between 1 and 100'
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
      category: 'vehicle_rentals_hire'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    // Create VehicleRentalsHire document
    const vehicleRentalsHire = new VehicleRentalsHire({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      vehicleCategory,
      serviceCategory,
      images,
      province,
      city,
      contact,
      pricePerKm,
      features: features || [],
      vehicleStatus,
      driverStatus,
      driverGender,
      capacity,
      description,
      facebook: facebook || null,
      website: website || null
    });

    await vehicleRentalsHire.save();

    // Calculate expiration date based on advertisement plan (Sri Lankan timezone)
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
    advertisement.publishedAdId = vehicleRentalsHire._id;
    advertisement.publishedAdModel = 'VehicleRentalsHire';
    await advertisement.save();

    res.json({
      success: true,
      message: 'Vehicle Rentals Hire published successfully!',
      data: {
        vehicleRentalsHire: {
          _id: vehicleRentalsHire._id,
          name: vehicleRentalsHire.name,
          vehicleCategory: vehicleRentalsHire.vehicleCategory,
          province: vehicleRentalsHire.province,
          city: vehicleRentalsHire.city,
          publishedAt: vehicleRentalsHire.publishedAt
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
    console.error('Error publishing vehicle rentals hire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish vehicle rentals hire',
      error: error.message
    });
  }
});

// GET /api/vehicle-rentals-hire/provinces - Get provinces and districts
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

// GET /api/vehicle-rentals-hire/browse - Get all published vehicle rentals hire (with filters)
router.get('/browse', async (req, res) => {
  try {
    const { vehicleCategory, serviceCategory, province, city, search, driverStatus, driverGender } = req.query;

    // Build filter query
    const filter = { isActive: true };

    if (vehicleCategory) filter.vehicleCategory = vehicleCategory;
    if (serviceCategory) filter.serviceCategory = serviceCategory;
    if (province) filter.province = province;
    if (city) filter.city = city;
    if (driverStatus) filter.driverStatus = driverStatus;
    if (driverGender) filter.driverGender = driverGender;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all matching vehicle rentals hire
    let results = await VehicleRentalsHire.find(filter)
      .select('_id name vehicleCategory serviceCategory images province city pricePerKm averageRating totalReviews vehicleStatus driverStatus driverGender capacity')
      .lean();

    // Filter out expired advertisements
    const validResults = [];
    for (const result of results) {
      const advertisement = await Advertisement.findOne({
        publishedAdId: result._id,
        publishedAdModel: 'VehicleRentalsHire'
      });

      if (advertisement && advertisement.status !== 'expired') {
        validResults.push(result);
      }
    }

    // Shuffle results randomly
    const shuffled = validResults.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: shuffled
    });
  } catch (error) {
    console.error('Error fetching vehicle rentals hire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle rentals hire',
      error: error.message
    });
  }
});

// GET /api/vehicle-rentals-hire/:id - Get vehicle rentals hire detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle rentals hire ID'
      });
    }

    const vehicleRentalsHire = await VehicleRentalsHire.findById(id)
      .populate('userId', 'firstName lastName profileImage');

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found'
      });
    }

    // Check if advertisement is expired
    const advertisement = await Advertisement.findOne({
      publishedAdId: id,
      publishedAdModel: 'VehicleRentalsHire'
    });

    if (advertisement && advertisement.status === 'expired') {
      return res.status(404).json({
        success: false,
        message: 'This listing has expired'
      });
    }

    res.json({
      success: true,
      data: vehicleRentalsHire
    });
  } catch (error) {
    console.error('Error fetching vehicle rentals hire detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle rentals hire detail',
      error: error.message
    });
  }
});

// GET /api/vehicle-rentals-hire/manage/:publishedAdId - Get vehicle rentals hire for editing
router.get('/manage/:publishedAdId', verifyToken, async (req, res) => {
  try {
    const { publishedAdId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(publishedAdId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Find the vehicle rentals hire profile by its own ID
    const vehicleRentalsHire = await VehicleRentalsHire.findOne({
      _id: publishedAdId,
      userId: userId
    });

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    // Verify the advertisement exists and is not expired
    const advertisement = await Advertisement.findOne({
      _id: vehicleRentalsHire.publishedAdId,
      userId: userId,
      category: 'vehicle_rentals_hire'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or access denied'
      });
    }

    res.json({
      success: true,
      data: vehicleRentalsHire
    });
  } catch (error) {
    console.error('Error fetching vehicle rentals hire for management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle rentals hire profile',
      error: error.message
    });
  }
});

// PUT /api/vehicle-rentals-hire/:id - Update vehicle rentals hire
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      vehicleCategory,
      serviceCategory,
      images,
      province,
      city,
      contact,
      pricePerKm,
      features,
      vehicleStatus,
      driverStatus,
      driverGender,
      capacity,
      description,
      facebook,
      website
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle rentals hire ID'
      });
    }

    // Validate required fields
    if (!name || !vehicleCategory || !serviceCategory || !province || !city ||
        !contact || !images || images.length === 0 || pricePerKm === undefined ||
        !vehicleStatus || !driverStatus || !driverGender || !capacity || !description) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images count
    if (images.length < 1 || images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Please upload between 1 and 3 images'
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

    // Validate contact number
    const contactRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
    if (!contactRegex.test(contact)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact number format'
      });
    }

    // Validate price and capacity
    if (pricePerKm < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price per km must be a positive number'
      });
    }

    if (capacity < 1 || capacity > 100) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be between 1 and 100'
      });
    }

    // Find and verify ownership
    const vehicleRentalsHire = await VehicleRentalsHire.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found or access denied'
      });
    }

    // Update the document
    vehicleRentalsHire.name = name;
    vehicleRentalsHire.vehicleCategory = vehicleCategory;
    vehicleRentalsHire.serviceCategory = serviceCategory;
    vehicleRentalsHire.images = images;
    vehicleRentalsHire.province = province;
    vehicleRentalsHire.city = city;
    vehicleRentalsHire.contact = contact;
    vehicleRentalsHire.pricePerKm = pricePerKm;
    vehicleRentalsHire.features = features || [];
    vehicleRentalsHire.vehicleStatus = vehicleStatus;
    vehicleRentalsHire.driverStatus = driverStatus;
    vehicleRentalsHire.driverGender = driverGender;
    vehicleRentalsHire.capacity = capacity;
    vehicleRentalsHire.description = description;
    vehicleRentalsHire.facebook = facebook || null;
    vehicleRentalsHire.website = website || null;
    vehicleRentalsHire.updatedAt = new Date();

    await vehicleRentalsHire.save();

    res.json({
      success: true,
      message: 'Vehicle rentals hire updated successfully',
      data: vehicleRentalsHire
    });
  } catch (error) {
    console.error('Error updating vehicle rentals hire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle rentals hire',
      error: error.message
    });
  }
});

// POST /api/vehicle-rentals-hire/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle rentals hire ID'
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!reviewText || reviewText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    const vehicleRentalsHire = await VehicleRentalsHire.findById(id);

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found'
      });
    }

    // Check if user already reviewed
    const existingReview = vehicleRentalsHire.reviews.find(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this listing'
      });
    }

    // Add review
    vehicleRentalsHire.reviews.push({
      userId: req.user._id,
      userName: req.user.name || req.user.username || 'Anonymous',
      rating,
      reviewText,
      createdAt: new Date()
    });

    // Calculate average rating
    const totalRating = vehicleRentalsHire.reviews.reduce((sum, r) => sum + r.rating, 0);
    vehicleRentalsHire.averageRating = (totalRating / vehicleRentalsHire.reviews.length).toFixed(1);
    vehicleRentalsHire.totalReviews = vehicleRentalsHire.reviews.length;

    await vehicleRentalsHire.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        averageRating: vehicleRentalsHire.averageRating,
        totalReviews: vehicleRentalsHire.totalReviews
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

// POST /api/vehicle-rentals-hire/:id/live-rides - Add a live ride
router.post('/:id/live-rides', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      from,
      to,
      date,
      time,
      description,
      maxPassengerCount,
      availablePassengerCount,
      pricePerSeat,
      status,
      approximateTimeToRide
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle rentals hire ID'
      });
    }

    // Validate required fields
    if (!from || !to || !date || !time || !maxPassengerCount ||
        availablePassengerCount === undefined || pricePerSeat === undefined ||
        !status || !approximateTimeToRide) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const vehicleRentalsHire = await VehicleRentalsHire.findById(id);

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found'
      });
    }

    // Check if user owns this listing
    if (vehicleRentalsHire.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to add live rides to this listing'
      });
    }

    // Create new live ride
    const newLiveRide = {
      from,
      to,
      date: new Date(date),
      time,
      description: description || '',
      maxPassengerCount: parseInt(maxPassengerCount),
      availablePassengerCount: parseInt(availablePassengerCount),
      pricePerSeat: parseFloat(pricePerSeat),
      status,
      approximateTimeToRide,
      createdAt: new Date()
    };

    vehicleRentalsHire.liveRides.push(newLiveRide);
    await vehicleRentalsHire.save();

    res.status(201).json({
      success: true,
      message: 'Live ride added successfully',
      data: vehicleRentalsHire.liveRides[vehicleRentalsHire.liveRides.length - 1]
    });
  } catch (error) {
    console.error('Error adding live ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add live ride',
      error: error.message
    });
  }
});

// PUT /api/vehicle-rentals-hire/:id/live-rides/:rideId - Update a live ride
router.put('/:id/live-rides/:rideId', verifyToken, async (req, res) => {
  try {
    const { id, rideId } = req.params;
    const {
      from,
      to,
      date,
      time,
      description,
      maxPassengerCount,
      availablePassengerCount,
      pricePerSeat,
      status,
      approximateTimeToRide
    } = req.body;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID'
      });
    }

    const vehicleRentalsHire = await VehicleRentalsHire.findById(id);

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found'
      });
    }

    // Check if user owns this listing
    if (vehicleRentalsHire.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit live rides on this listing'
      });
    }

    // Find the live ride
    const liveRide = vehicleRentalsHire.liveRides.id(rideId);

    if (!liveRide) {
      return res.status(404).json({
        success: false,
        message: 'Live ride not found'
      });
    }

    // Update live ride fields
    if (from) liveRide.from = from;
    if (to) liveRide.to = to;
    if (date) liveRide.date = new Date(date);
    if (time) liveRide.time = time;
    if (description !== undefined) liveRide.description = description;
    if (maxPassengerCount) liveRide.maxPassengerCount = parseInt(maxPassengerCount);
    if (availablePassengerCount !== undefined) liveRide.availablePassengerCount = parseInt(availablePassengerCount);
    if (pricePerSeat !== undefined) liveRide.pricePerSeat = parseFloat(pricePerSeat);
    if (status) liveRide.status = status;
    if (approximateTimeToRide) liveRide.approximateTimeToRide = approximateTimeToRide;

    await vehicleRentalsHire.save();

    res.json({
      success: true,
      message: 'Live ride updated successfully',
      data: liveRide
    });
  } catch (error) {
    console.error('Error updating live ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update live ride',
      error: error.message
    });
  }
});

// DELETE /api/vehicle-rentals-hire/:id/live-rides/:rideId - Delete a live ride
router.delete('/:id/live-rides/:rideId', verifyToken, async (req, res) => {
  try {
    const { id, rideId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID'
      });
    }

    const vehicleRentalsHire = await VehicleRentalsHire.findById(id);

    if (!vehicleRentalsHire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle rentals hire not found'
      });
    }

    // Check if user owns this listing
    if (vehicleRentalsHire.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete live rides from this listing'
      });
    }

    // Remove the live ride
    vehicleRentalsHire.liveRides.pull(rideId);
    await vehicleRentalsHire.save();

    res.json({
      success: true,
      message: 'Live ride deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting live ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete live ride',
      error: error.message
    });
  }
});

module.exports = router;

