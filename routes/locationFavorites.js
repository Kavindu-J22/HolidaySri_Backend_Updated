const express = require('express');
const LocationFavorite = require('../models/LocationFavorite');
const Location = require('../models/Location');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/location-favorites - Get user's favorite locations
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const userId = req.user.id;

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get favorites with location details
    const favorites = await LocationFavorite.find({ userId })
      .populate({
        path: 'locationId',
        match: { isActive: true },
        populate: {
          path: 'mainDestination',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Filter out favorites where location was deleted
    const validFavorites = favorites.filter(fav => fav.locationId);

    // Get total count
    const totalFavorites = await LocationFavorite.countDocuments({ userId });
    const totalPages = Math.ceil(totalFavorites / limitNum);

    res.json({
      favorites: validFavorites,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total: totalFavorites,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching location favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/location-favorites/check/:locationId - Check if location is favorited
router.get('/check/:locationId', verifyToken, async (req, res) => {
  try {
    const { locationId } = req.params;
    const userId = req.user.id;

    const favorite = await LocationFavorite.findOne({ userId, locationId });
    
    res.json({ isFavorite: !!favorite });
  } catch (error) {
    console.error('Error checking location favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/location-favorites - Add location to favorites
router.post('/', verifyToken, async (req, res) => {
  try {
    const { locationId } = req.body;
    const userId = req.user.id;

    if (!locationId) {
      return res.status(400).json({ message: 'Location ID is required' });
    }

    // Check if location exists
    const location = await Location.findById(locationId);
    if (!location || !location.isActive) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if already favorited
    const existingFavorite = await LocationFavorite.findOne({ userId, locationId });
    if (existingFavorite) {
      return res.status(400).json({ message: 'Location already in favorites' });
    }

    // Create favorite
    const favorite = new LocationFavorite({ userId, locationId });
    await favorite.save();

    // Populate location data for response
    await favorite.populate({
      path: 'locationId',
      populate: {
        path: 'mainDestination',
        select: 'name'
      }
    });

    res.status(201).json(favorite);
  } catch (error) {
    console.error('Error adding location to favorites:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/location-favorites/:locationId - Remove location from favorites
router.delete('/:locationId', verifyToken, async (req, res) => {
  try {
    const { locationId } = req.params;
    const userId = req.user.id;

    const favorite = await LocationFavorite.findOneAndDelete({ userId, locationId });
    
    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Location removed from favorites' });
  } catch (error) {
    console.error('Error removing location from favorites:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid location ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/location-favorites/stats - Get user's favorite location stats
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total count
    const totalFavorites = await LocationFavorite.countDocuments({ userId });

    // Get favorites by location type
    const typeStats = await LocationFavorite.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: 'locations',
          localField: 'locationId',
          foreignField: '_id',
          as: 'location'
        }
      },
      { $unwind: '$location' },
      { $match: { 'location.isActive': true } },
      {
        $group: {
          _id: '$location.locationType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get favorites by climate
    const climateStats = await LocationFavorite.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: 'locations',
          localField: 'locationId',
          foreignField: '_id',
          as: 'location'
        }
      },
      { $unwind: '$location' },
      { $match: { 'location.isActive': true } },
      {
        $group: {
          _id: '$location.climate',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      total: totalFavorites,
      byType: typeStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      byClimate: climateStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching location favorite stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
