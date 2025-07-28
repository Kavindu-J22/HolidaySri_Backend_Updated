const express = require('express');
const Location = require('../models/Location');
const LocationReview = require('../models/LocationReview');
const LocationFavorite = require('../models/LocationFavorite');
const Destination = require('../models/Destination');
const { verifyToken, verifyAdminToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'daa9e83as',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Get constants for frontend
router.get('/constants', (req, res) => {
  res.json({
    locationTypes: Location.locationTypes,
    provincesAndDistricts: Location.provincesAndDistricts,
    climateOptions: Location.climateOptions
  });
});

// GET /api/locations - Get all locations with search, filter, and sort
router.get('/', async (req, res) => {
  try {
    const {
      search,
      locationType,
      climate,
      province,
      district,
      mainDestination,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    // Build query
    let query = { isActive: true };

    // Search by name or description
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by location type
    if (locationType && Location.locationTypes.includes(locationType)) {
      query.locationType = locationType;
    }

    // Filter by climate
    if (climate && Location.climateOptions.includes(climate)) {
      query.climate = climate;
    }

    // Filter by province
    if (province && Object.keys(Location.provincesAndDistricts).includes(province)) {
      query.province = province;
    }

    // Filter by district
    if (district) {
      query.district = district;
    }

    // Filter by main destination
    if (mainDestination) {
      query.mainDestination = mainDestination;
    }

    // Build sort object
    let sortObj = {};
    if (sortBy === 'rating') {
      sortObj.averageRating = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'name') {
      sortObj.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'distance') {
      sortObj.distanceFromColombo = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Add text score for search queries
    if (search) {
      sortObj.score = { $meta: 'textScore' };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const locations = await Location.find(query)
      .populate('mainDestination', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await Location.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      locations,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/locations/:id - Get single location by ID
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('mainDestination', 'name type province district')
      .lean();

    if (!location || !location.isActive) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid location ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/locations - Create new location (Admin only)
router.post('/', verifyAdminToken, async (req, res) => {
  try {
    const {
      name,
      locationType,
      description,
      images,
      mapUrl,
      distanceFromColombo,
      province,
      district,
      climate,
      recommendedToVisit,
      enteringFee,
      facilities,
      nearbyActivities,
      mainDestination
    } = req.body;

    // Validate required fields
    if (!name || !locationType || !description || !images || !mapUrl ||
        distanceFromColombo === undefined || !province || !district || 
        !climate || !recommendedToVisit || !mainDestination) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Validate images array
    if (!Array.isArray(images) || images.length === 0 || images.length > 6) {
      return res.status(400).json({ message: 'Please provide 1-6 images' });
    }

    // Validate location type
    if (!Location.locationTypes.includes(locationType)) {
      return res.status(400).json({ message: 'Invalid location type' });
    }

    // Validate climate
    if (!Location.climateOptions.includes(climate)) {
      return res.status(400).json({ message: 'Invalid climate option' });
    }

    // Validate province and district combination
    if (!Location.provincesAndDistricts[province]?.includes(district)) {
      return res.status(400).json({ message: 'Invalid province and district combination' });
    }

    // Validate main destination exists
    const destinationExists = await Destination.findById(mainDestination);
    if (!destinationExists) {
      return res.status(400).json({ message: 'Main destination not found' });
    }

    // Create location
    const location = new Location({
      name,
      locationType,
      description,
      images,
      mapUrl,
      distanceFromColombo,
      province,
      district,
      climate,
      recommendedToVisit,
      enteringFee: enteringFee || { isFree: true, amount: 0, currency: 'LKR' },
      facilities: facilities || [],
      nearbyActivities: nearbyActivities || [],
      mainDestination
    });

    await location.save();

    // Populate main destination for response
    await location.populate('mainDestination', 'name');

    res.status(201).json(location);
  } catch (error) {
    console.error('Error creating location:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/locations/:id - Update location (Admin only)
router.put('/:id', verifyAdminToken, async (req, res) => {
  try {
    const {
      name,
      locationType,
      description,
      images,
      mapUrl,
      distanceFromColombo,
      province,
      district,
      climate,
      recommendedToVisit,
      enteringFee,
      facilities,
      nearbyActivities,
      mainDestination
    } = req.body;

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Validate province and district combination if provided
    if (province && district && !Location.provincesAndDistricts[province]?.includes(district)) {
      return res.status(400).json({ message: 'Invalid province and district combination' });
    }

    // Validate main destination exists if provided
    if (mainDestination) {
      const destinationExists = await Destination.findById(mainDestination);
      if (!destinationExists) {
        return res.status(400).json({ message: 'Main destination not found' });
      }
    }

    // Update fields
    if (name) location.name = name;
    if (locationType) location.locationType = locationType;
    if (description) location.description = description;
    if (images) location.images = images;
    if (mapUrl) location.mapUrl = mapUrl;
    if (distanceFromColombo !== undefined) location.distanceFromColombo = distanceFromColombo;
    if (province) location.province = province;
    if (district) location.district = district;
    if (climate) location.climate = climate;
    if (recommendedToVisit) location.recommendedToVisit = recommendedToVisit;
    if (enteringFee) location.enteringFee = enteringFee;
    if (facilities) location.facilities = facilities;
    if (nearbyActivities) location.nearbyActivities = nearbyActivities;
    if (mainDestination) location.mainDestination = mainDestination;

    await location.save();

    // Populate main destination for response
    await location.populate('mainDestination', 'name');

    res.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid location ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/locations/:id - Delete location (Admin only)
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Soft delete by setting isActive to false
    location.isActive = false;
    await location.save();

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid location ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
