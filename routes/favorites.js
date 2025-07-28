const express = require('express');
const Favorite = require('../models/Favorite');
const Destination = require('../models/Destination');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/favorites - Get user's favorite destinations
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const favorites = await Favorite.find({ userId: req.user._id })
      .populate({
        path: 'destinationId',
        match: { isActive: true },
        select: '-__v'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out favorites where destination was deleted
    const validFavorites = favorites.filter(fav => fav.destinationId);

    const total = await Favorite.countDocuments({ userId: req.user._id });

    res.json({
      favorites: validFavorites,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/favorites/check/:destinationId - Check if destination is favorited
router.get('/check/:destinationId', verifyToken, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      userId: req.user._id,
      destinationId: req.params.destinationId
    });

    res.json({ isFavorite: !!favorite });

  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/favorites - Add destination to favorites
router.post('/', verifyToken, async (req, res) => {
  try {
    const { destinationId } = req.body;

    if (!destinationId) {
      return res.status(400).json({ message: 'Destination ID is required' });
    }

    // Check if destination exists
    const destination = await Destination.findById(destinationId);
    if (!destination || !destination.isActive) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({
      userId: req.user._id,
      destinationId
    });

    if (existingFavorite) {
      return res.status(400).json({ message: 'Destination already in favorites' });
    }

    // Create favorite
    const favorite = new Favorite({
      userId: req.user._id,
      destinationId
    });

    await favorite.save();

    res.status(201).json({
      message: 'Destination added to favorites',
      favorite
    });

  } catch (error) {
    console.error('Add favorite error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/favorites/:destinationId - Remove destination from favorites
router.delete('/:destinationId', verifyToken, async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({
      userId: req.user._id,
      destinationId: req.params.destinationId
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Destination removed from favorites' });

  } catch (error) {
    console.error('Remove favorite error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Invalid destination ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
