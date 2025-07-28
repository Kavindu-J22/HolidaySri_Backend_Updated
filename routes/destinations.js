const express = require('express');
const Destination = require('../models/Destination');
const Review = require('../models/Review');
const Favorite = require('../models/Favorite');
const { verifyToken, verifyAdminToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'daa9e83as',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Constants for validation
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

const climateOptions = [
  "Dry zone",
  "Intermediate zone",
  "Montane zone",
  "Semi-Arid zone",
  "Oceanic zone",
  "Tropical Wet zone",
  "Tropical Submontane",
  "Tropical Dry Zone",
  "Tropical Monsoon Climate",
  "Tropical Savanna Climate"
];

const destinationTypes = ['Famous', 'Popular', 'Hidden', 'Adventure', 'Cultural', 'Beach', 'Mountain', 'Historical', 'Wildlife', 'Religious'];

// GET /api/destinations - Get all destinations with search, filter, and sort
router.get('/', async (req, res) => {
  try {
    const {
      search,
      type,
      climate,
      province,
      district,
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

    // Filter by type
    if (type && destinationTypes.includes(type)) {
      query.type = type;
    }

    // Filter by climate
    if (climate && climateOptions.includes(climate)) {
      query.climate = climate;
    }

    // Filter by province
    if (province && Object.keys(provincesAndDistricts).includes(province)) {
      query.province = province;
    }

    // Filter by district
    if (district) {
      query.district = district;
    }

    // Build sort object
    let sort = {};
    if (sortBy === 'rating') {
      sort.averageRating = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'distance') {
      sort.distanceFromColombo = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const destinations = await Destination.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count for pagination
    const total = await Destination.countDocuments(query);

    res.json({
      destinations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get destinations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/destinations/options - Get filter options
router.get('/options', (req, res) => {
  res.json({
    types: destinationTypes,
    climates: climateOptions,
    provincesAndDistricts
  });
});

// GET /api/destinations/:id - Get single destination
router.get('/:id', async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id)
      .select('-__v');

    if (!destination || !destination.isActive) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    res.json(destination);

  } catch (error) {
    console.error('Get destination error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Destination not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/destinations - Create new destination (Admin only)
router.post('/', verifyAdminToken, async (req, res) => {
  try {
    const {
      name,
      type,
      description,
      images,
      mapUrl,
      distanceFromColombo,
      province,
      district,
      climate
    } = req.body;

    // Validate required fields
    if (!name || !type || !description || !images || !mapUrl || 
        distanceFromColombo === undefined || !province || !district || !climate) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate images array
    if (!Array.isArray(images) || images.length === 0 || images.length > 5) {
      return res.status(400).json({ message: 'Please provide 1-5 images' });
    }

    // Validate province and district combination
    if (!provincesAndDistricts[province]?.includes(district)) {
      return res.status(400).json({ message: 'Invalid province and district combination' });
    }

    // Create destination
    const destination = new Destination({
      name,
      type,
      description,
      images,
      mapUrl,
      distanceFromColombo: parseFloat(distanceFromColombo),
      province,
      district,
      climate
    });

    await destination.save();

    res.status(201).json({
      message: 'Destination created successfully',
      destination
    });

  } catch (error) {
    console.error('Create destination error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/destinations/:id - Update destination (Admin only)
router.put('/:id', verifyAdminToken, async (req, res) => {
  try {
    const {
      name,
      type,
      description,
      images,
      mapUrl,
      distanceFromColombo,
      province,
      district,
      climate
    } = req.body;

    const destination = await Destination.findById(req.params.id);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Validate province and district combination if provided
    if (province && district && !provincesAndDistricts[province]?.includes(district)) {
      return res.status(400).json({ message: 'Invalid province and district combination' });
    }

    // Update fields
    if (name) destination.name = name;
    if (type) destination.type = type;
    if (description) destination.description = description;
    if (images) destination.images = images;
    if (mapUrl) destination.mapUrl = mapUrl;
    if (distanceFromColombo !== undefined) destination.distanceFromColombo = parseFloat(distanceFromColombo);
    if (province) destination.province = province;
    if (district) destination.district = district;
    if (climate) destination.climate = climate;

    await destination.save();

    res.json({
      message: 'Destination updated successfully',
      destination
    });

  } catch (error) {
    console.error('Update destination error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Destination not found' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/destinations/:id - Delete destination (Admin only)
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Soft delete by setting isActive to false
    destination.isActive = false;
    await destination.save();

    res.json({ message: 'Destination deleted successfully' });

  } catch (error) {
    console.error('Delete destination error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Destination not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
