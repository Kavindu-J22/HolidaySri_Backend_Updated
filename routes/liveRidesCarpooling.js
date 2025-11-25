const express = require('express');
const router = express.Router();
const LiveRidesCarpooling = require('../models/LiveRidesCarpooling');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const VehicleRentalsHire = require('../models/VehicleRentalsHire');
const ProfessionalDrivers = require('../models/ProfessionalDrivers');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');
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

// Publish live rides carpooling
router.post('/publish', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      advertisementId,
      images,
      vehicleNumber,
      vehicleBrand,
      vehicleOwnerName,
      ownerLocation,
      phoneNumber,
      rideRoute,
      description,
      maxPassengerCount,
      availablePassengerCount,
      status,
      pricePerSeat,
      rideDate,
      rideTime,
      approximateTimeToRide
    } = req.body;

    // Validate required fields
    if (!advertisementId || !images || !vehicleNumber || !vehicleBrand || 
        !vehicleOwnerName || !ownerLocation || !phoneNumber || !rideRoute || 
        !description || !maxPassengerCount || availablePassengerCount === undefined || 
        !status || pricePerSeat === undefined || !rideDate || !rideTime || 
        !approximateTimeToRide) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate images
    if (!images.vehicleImage || !images.numberPlate || !images.ownerPhoto || 
        !images.ownerNICFront || !images.ownerNICBack) {
      return res.status(400).json({
        success: false,
        message: 'All 5 images are required (Vehicle Image, Number Plate, Owner Photo, Owner NIC Front, Owner NIC Back)'
      });
    }

    // Validate owner location
    if (!ownerLocation.address || !ownerLocation.city || !ownerLocation.province) {
      return res.status(400).json({
        success: false,
        message: 'Complete owner location (address, city, province) is required'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[ownerLocation.province]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province selected'
      });
    }

    if (!provincesAndDistricts[ownerLocation.province].includes(ownerLocation.city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for the selected province'
      });
    }

    // Validate ride route
    if (!rideRoute.from || !rideRoute.to) {
      return res.status(400).json({
        success: false,
        message: 'Ride route (from and to) is required'
      });
    }

    // Validate passenger counts
    if (maxPassengerCount < 1 || availablePassengerCount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid passenger count values'
      });
    }

    if (availablePassengerCount > maxPassengerCount) {
      return res.status(400).json({
        success: false,
        message: 'Available passenger count cannot exceed maximum passenger count'
      });
    }

    // Validate status
    const validStatuses = ['Ongoing Ride', 'Starting Soon', 'Over Soon', 'Upcoming Ride', 'Over'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride status'
      });
    }

    // Validate price
    if (pricePerSeat < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price per seat must be a positive number'
      });
    }

    // Find the advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'live_rides_carpooling'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Check if advertisement is already published
    if (advertisement.status === 'Published' && advertisement.publishedAdId) {
      return res.status(400).json({
        success: false,
        message: 'This advertisement slot has already been published'
      });
    }

    // Create live rides carpooling entry
    const liveRide = new LiveRidesCarpooling({
      userId: req.user._id,
      advertisementId,
      images,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleBrand,
      vehicleOwnerName,
      ownerLocation,
      phoneNumber,
      rideRoute,
      description,
      maxPassengerCount: parseInt(maxPassengerCount),
      availablePassengerCount: parseInt(availablePassengerCount),
      status,
      pricePerSeat: parseFloat(pricePerSeat),
      rideDate: new Date(rideDate),
      rideTime,
      approximateTimeToRide
    });

    await liveRide.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    let expirationTime;
    const sriLankanNow = moment.tz('Asia/Colombo');

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
    advertisement.publishedAdId = liveRide._id;
    advertisement.publishedAdModel = 'LiveRidesCarpooling';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Live ride carpooling published successfully',
      data: {
        liveRide,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing live ride carpooling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish live ride carpooling. Please try again.',
      error: error.message
    });
  }
});

// Get all live rides carpooling (public)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      from, 
      to, 
      province, 
      city,
      minPrice,
      maxPrice,
      rideDate
    } = req.query;

    const query = { isActive: true };

    if (status) {
      query.status = status;
    }

    if (from) {
      query['rideRoute.from'] = { $regex: from, $options: 'i' };
    }

    if (to) {
      query['rideRoute.to'] = { $regex: to, $options: 'i' };
    }

    if (province) {
      query['ownerLocation.province'] = province;
    }

    if (city) {
      query['ownerLocation.city'] = city;
    }

    if (minPrice || maxPrice) {
      query.pricePerSeat = {};
      if (minPrice) query.pricePerSeat.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerSeat.$lte = parseFloat(maxPrice);
    }

    if (rideDate) {
      const startOfDay = new Date(rideDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(rideDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.rideDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const liveRides = await LiveRidesCarpooling.find(query)
      .populate('userId', 'name email')
      .sort({ publishedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LiveRidesCarpooling.countDocuments(query);

    res.json({
      success: true,
      data: liveRides,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    console.error('Error fetching live rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live rides'
    });
  }
});

// GET /api/live-rides-carpooling/browse - Browse live rides with filters (exclude expired ads)
// NOTE: This route MUST come before /:id route to avoid route conflicts
router.get('/browse', async (req, res) => {
  try {
    const {
      search,
      fromLocation,
      toLocation,
      city,
      province,
      minPrice,
      maxPrice,
      rideDate
    } = req.query;

    // Build filter query
    const filter = {};

    // Search by vehicle, owner, or description
    if (search) {
      filter.$or = [
        { vehicleNumber: { $regex: search, $options: 'i' } },
        { vehicleBrand: { $regex: search, $options: 'i' } },
        { vehicleOwnerName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by from location
    if (fromLocation) {
      filter['rideRoute.from'] = { $regex: fromLocation, $options: 'i' };
    }

    // Filter by to location
    if (toLocation) {
      filter['rideRoute.to'] = { $regex: toLocation, $options: 'i' };
    }

    // Filter by city
    if (city) {
      filter['ownerLocation.city'] = city;
    }

    // Filter by province
    if (province) {
      filter['ownerLocation.province'] = province;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      filter.pricePerSeat = {};
      if (minPrice) filter.pricePerSeat.$gte = parseFloat(minPrice);
      if (maxPrice) filter.pricePerSeat.$lte = parseFloat(maxPrice);
    }

    // Filter by ride date
    if (rideDate) {
      const startOfDay = moment(rideDate).startOf('day').toDate();
      const endOfDay = moment(rideDate).endOf('day').toDate();
      filter.rideDate = { $gte: startOfDay, $lte: endOfDay };
    }

    // Fetch live rides
    const liveRides = await LiveRidesCarpooling.find(filter)
      .populate('userId', 'name email profileImage')
      .populate('advertisementId')
      .sort({ createdAt: -1 });

    // Filter out rides where the advertisement is expired
    const activeRides = liveRides.filter(ride => {
      if (!ride.advertisementId) return false;
      return ride.advertisementId.status !== 'expired';
    });

    res.status(200).json({
      success: true,
      data: activeRides,
      count: activeRides.length
    });
  } catch (error) {
    console.error('Error browsing live rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to browse live rides',
      error: error.message
    });
  }
});

// Get single live ride by ID
router.get('/:id', async (req, res) => {
  try {
    const liveRide = await LiveRidesCarpooling.findById(req.params.id)
      .populate('userId', 'name email profileImage')
      .populate('reviews.userId', 'name profileImage');

    if (!liveRide) {
      return res.status(404).json({
        success: false,
        message: 'Live ride not found'
      });
    }

    // Increment view count
    liveRide.viewCount += 1;
    await liveRide.save();

    res.json({
      success: true,
      data: liveRide
    });
  } catch (error) {
    console.error('Error fetching live ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live ride'
    });
  }
});

// Update live ride (protected)
router.put('/:id', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const liveRide = await LiveRidesCarpooling.findById(req.params.id);

    if (!liveRide) {
      return res.status(404).json({
        success: false,
        message: 'Live ride not found'
      });
    }

    // Check if user owns this live ride
    if (liveRide.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this live ride'
      });
    }

    const {
      images,
      vehicleNumber,
      vehicleBrand,
      vehicleOwnerName,
      ownerLocation,
      phoneNumber,
      rideRoute,
      description,
      maxPassengerCount,
      availablePassengerCount,
      status,
      pricePerSeat,
      rideDate,
      rideTime,
      approximateTimeToRide
    } = req.body;

    // Validate province and city
    if (ownerLocation && ownerLocation.province && ownerLocation.city) {
      const validCities = provincesAndDistricts[ownerLocation.province];
      if (!validCities || !validCities.includes(ownerLocation.city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid city for the selected province'
        });
      }
    }

    // Update fields
    if (images) liveRide.images = images;
    if (vehicleNumber) liveRide.vehicleNumber = vehicleNumber;
    if (vehicleBrand) liveRide.vehicleBrand = vehicleBrand;
    if (vehicleOwnerName) liveRide.vehicleOwnerName = vehicleOwnerName;
    if (ownerLocation) liveRide.ownerLocation = ownerLocation;
    if (phoneNumber) liveRide.phoneNumber = phoneNumber;
    if (rideRoute) liveRide.rideRoute = rideRoute;
    if (description) liveRide.description = description;
    if (maxPassengerCount !== undefined) liveRide.maxPassengerCount = maxPassengerCount;
    if (availablePassengerCount !== undefined) liveRide.availablePassengerCount = availablePassengerCount;
    if (status) liveRide.status = status;
    if (pricePerSeat !== undefined) liveRide.pricePerSeat = pricePerSeat;
    if (rideDate) liveRide.rideDate = rideDate;
    if (rideTime) liveRide.rideTime = rideTime;
    if (approximateTimeToRide) liveRide.approximateTimeToRide = approximateTimeToRide;

    await liveRide.save();

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

// Add review and rating (protected)
router.post('/:id/review', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { rating, comment } = req.body;

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

    const liveRide = await LiveRidesCarpooling.findById(req.params.id);

    if (!liveRide) {
      return res.status(404).json({
        success: false,
        message: 'Live ride not found'
      });
    }

    // Check if user already reviewed
    const existingReview = liveRide.reviews.find(
      review => review.userId.toString() === req.user.userId
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this live ride'
      });
    }

    // Get user details
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);

    // Add review
    liveRide.reviews.push({
      userId: req.user.userId,
      userName: user.name,
      userProfileImage: user.profileImage || '',
      rating: parseInt(rating),
      comment: comment.trim()
    });

    // Update average rating and total reviews
    const totalRatings = liveRide.reviews.reduce((sum, review) => sum + review.rating, 0);
    liveRide.averageRating = totalRatings / liveRide.reviews.length;
    liveRide.totalReviews = liveRide.reviews.length;

    await liveRide.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: liveRide
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

// Get V & D Rides (Vehicle Rentals & Professional Drivers Live Rides)
router.get('/v-and-d-rides', async (req, res) => {
  try {
    const { fromLocation, toLocation } = req.query;

    // Build filter for live rides
    const liveRideFilter = {};
    if (fromLocation) {
      liveRideFilter['liveRides.from'] = { $regex: fromLocation, $options: 'i' };
    }
    if (toLocation) {
      liveRideFilter['liveRides.to'] = { $regex: toLocation, $options: 'i' };
    }

    // Fetch Vehicle Rentals Hire with live rides
    const vehicleRentals = await VehicleRentalsHire.find({
      isActive: true,
      'liveRides.0': { $exists: true }, // Has at least one live ride
      ...liveRideFilter
    })
      .populate('userId', 'name email contactNumber countryCode')
      .populate('publishedAdId')
      .lean();

    // Fetch Professional Drivers with live rides
    const professionalDrivers = await ProfessionalDrivers.find({
      isActive: true,
      'liveRides.0': { $exists: true }, // Has at least one live ride
      ...liveRideFilter
    })
      .populate('userId', 'name email contactNumber countryCode')
      .populate('publishedAdId')
      .lean();

    // Filter out records where advertisement is expired
    const activeVehicleRentals = vehicleRentals.filter(vehicle => {
      if (!vehicle.publishedAdId) return false;
      return vehicle.publishedAdId.status !== 'expired';
    });

    const activeProfessionalDrivers = professionalDrivers.filter(driver => {
      if (!driver.publishedAdId) return false;
      return driver.publishedAdId.status !== 'expired';
    });

    // Transform and combine the results
    const allRides = [];

    // Process Vehicle Rentals
    activeVehicleRentals.forEach(vehicle => {
      vehicle.liveRides.forEach(ride => {
        // Apply filters to individual rides
        if (fromLocation && !ride.from.toLowerCase().includes(fromLocation.toLowerCase())) {
          return;
        }
        if (toLocation && !ride.to.toLowerCase().includes(toLocation.toLowerCase())) {
          return;
        }

        allRides.push({
          _id: `vehicle-${vehicle._id}-${ride._id}`,
          rideId: ride._id,
          sourceType: 'vehicle',
          sourceId: vehicle._id,
          sourceName: vehicle.name,
          image: vehicle.images && vehicle.images.length > 0 ? vehicle.images[0].url : null,
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          description: ride.description,
          maxPassengerCount: ride.maxPassengerCount,
          availablePassengerCount: ride.availablePassengerCount,
          pricePerSeat: ride.pricePerSeat,
          status: ride.status,
          approximateTimeToRide: ride.approximateTimeToRide,
          createdAt: ride.createdAt,
          ownerName: vehicle.userId?.name || 'Unknown',
          ownerContact: vehicle.userId ? `${vehicle.userId.countryCode}${vehicle.userId.contactNumber}` : null,
          province: vehicle.province,
          city: vehicle.city,
          vehicleCategory: vehicle.vehicleCategory,
          serviceCategory: vehicle.serviceCategory
        });
      });
    });

    // Process Professional Drivers
    activeProfessionalDrivers.forEach(driver => {
      driver.liveRides.forEach(ride => {
        // Apply filters to individual rides
        if (fromLocation && !ride.from.toLowerCase().includes(fromLocation.toLowerCase())) {
          return;
        }
        if (toLocation && !ride.to.toLowerCase().includes(toLocation.toLowerCase())) {
          return;
        }

        allRides.push({
          _id: `driver-${driver._id}-${ride._id}`,
          rideId: ride._id,
          sourceType: 'driver',
          sourceId: driver._id,
          sourceName: driver.name,
          image: driver.avatar?.url || null,
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          description: ride.description,
          maxPassengerCount: ride.maxPassengerCount,
          availablePassengerCount: ride.availablePassengerCount,
          pricePerSeat: ride.pricePerSeat,
          status: ride.status,
          approximateTimeToRide: ride.approximateTimeToRide,
          createdAt: ride.createdAt,
          ownerName: driver.userId?.name || 'Unknown',
          ownerContact: driver.userId ? `${driver.userId.countryCode}${driver.userId.contactNumber}` : null,
          province: driver.province,
          city: driver.city,
          specialization: driver.specialization,
          experience: driver.experience
        });
      });
    });

    // Shuffle rides randomly
    const shuffledRides = allRides.sort(() => Math.random() - 0.5);

    res.status(200).json({
      success: true,
      data: shuffledRides,
      count: shuffledRides.length
    });
  } catch (error) {
    console.error('Error fetching V & D rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch V & D rides',
      error: error.message
    });
  }
});

module.exports = router;

