const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const EventsUpdates = require('../models/EventsUpdates');
const Advertisement = require('../models/Advertisement');

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// POST /api/events-updates/publish - Publish event
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      eventName,
      categoryType,
      description,
      city,
      province,
      eventLocation,
      mapLink,
      date,
      time,
      ticketPrice,
      ticketsAvailable,
      contact,
      organizer,
      facebook,
      website,
      includes,
      images,
      featured
    } = req.body;

    // Validate required fields
    if (!advertisementId || !eventName || !categoryType || !description || 
        !city || !province || !eventLocation || !date || !time || 
        !ticketPrice || !contact || !organizer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate images
    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate advertisement exists and belongs to user
    const advertisement = await Advertisement.findById(advertisementId);
    
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to advertisement'
      });
    }

    // Validate advertisement category
    if (advertisement.category !== 'events_updates') {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement category'
      });
    }

    // Check if advertisement is already published
    if (advertisement.status === 'Published') {
      return res.status(400).json({
        success: false,
        message: 'Advertisement is already published'
      });
    }

    // Determine ticketsAvailable based on ticketPrice
    const isFreeEvent = ticketPrice.toLowerCase().includes('free');
    const finalTicketsAvailable = isFreeEvent ? undefined : ticketsAvailable;

    // Create event
    const event = new EventsUpdates({
      userId: req.user._id,
      publishedAdId: advertisementId,
      eventName,
      categoryType,
      description,
      city,
      province,
      eventLocation,
      mapLink: mapLink || '',
      date: new Date(date),
      time,
      ticketPrice,
      ticketsAvailable: finalTicketsAvailable !== undefined ? finalTicketsAvailable : true,
      contact,
      organizer,
      facebook: facebook || '',
      website: website || '',
      includes: includes || [],
      images,
      featured: featured || false,
      isActive: true,
      publishedAt: new Date()
    });

    await event.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
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
    advertisement.publishedAdId = event._id;
    advertisement.publishedAdModel = 'EventsUpdates';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Event published successfully',
      data: {
        event,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish event. Please try again.'
    });
  }
});

// GET /api/events-updates/public - Get all published events (public)
router.get('/public', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      province,
      city,
      categoryType,
      featured,
      search,
      sortBy = 'random'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (province) query.province = province;
    if (city) query.city = city;
    if (categoryType) query.categoryType = categoryType;
    if (featured === 'true') query.featured = true;
    if (search) {
      query.$or = [
        { eventName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { categoryType: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all events first to filter by advertisement status
    let events = await EventsUpdates.find(query)
      .populate('userId', 'name email')
      .populate('publishedAdId')
      .lean();

    // Filter out events with expired advertisements
    events = events.filter(event => {
      if (!event.publishedAdId) return false;
      return event.publishedAdId.status !== 'expired';
    });

    // Sorting
    if (sortBy === 'random') {
      events = shuffleArray(events);
    } else {
      events.sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(a.date) - new Date(b.date); // Upcoming events first
          case 'newest':
            return new Date(b.publishedAt) - new Date(a.publishedAt);
          case 'popular':
            return (b.viewCount || 0) - (a.viewCount || 0);
          case 'rating':
            return (b.averageRating || 0) - (a.averageRating || 0);
          default:
            return new Date(a.date) - new Date(b.date);
        }
      });
    }

    // Pagination
    const total = events.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedEvents = events.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedEvents,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total: total
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

// GET /api/events-updates/public/:id - Get single event by ID (public)
router.get('/public/:id', async (req, res) => {
  try {
    const event = await EventsUpdates.findById(req.params.id)
      .populate('userId', 'name email')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment view count
    await EventsUpdates.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1 }
    });

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event'
    });
  }
});

// GET /api/events-updates/provinces - Get provinces and districts
router.get('/provinces', (req, res) => {
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

  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/events-updates/user/:id - Get user's event by ID (for editing)
router.get('/user/:id', verifyToken, async (req, res) => {
  try {
    console.log('Fetching event with ID:', req.params.id);
    console.log('User ID from token:', req.user._id);

    const event = await EventsUpdates.findById(req.params.id);

    if (!event) {
      console.log('Event not found');
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    console.log('Event userId:', event.userId.toString());
    console.log('Token userId:', req.user._id.toString());

    // Verify ownership - req.user is the full User document, so use req.user._id
    if (event.userId.toString() !== req.user._id.toString()) {
      console.log('Ownership verification failed');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this event'
      });
    }

    console.log('Sending event data');
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    console.error('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event: ' + error.message
    });
  }
});

// PUT /api/events-updates/:id - Update event
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const event = await EventsUpdates.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Verify ownership - req.user is the full User document, so use req.user._id
    if (event.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this event'
      });
    }

    // Update fields
    const allowedFields = [
      'eventName', 'categoryType', 'description', 'province', 'city',
      'eventLocation', 'mapLink', 'date', 'time', 'ticketPrice',
      'ticketsAvailable', 'contact', 'organizer', 'facebook', 'website',
      'includes', 'images', 'featured'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event'
    });
  }
});

// POST /api/events-updates/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    // Validation
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

    const event = await EventsUpdates.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user already reviewed - req.user is the full User document, so use req.user._id
    const existingReview = event.reviews.find(
      review => review.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this event'
      });
    }

    // Add review
    event.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating,
      comment,
      createdAt: new Date()
    });

    // Calculate average rating
    event.calculateAverageRating();

    await event.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: event
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// GET /api/events-updates/:id/reviews - Get reviews for an event
router.get('/:id/reviews', async (req, res) => {
  try {
    const event = await EventsUpdates.findById(req.params.id)
      .select('reviews averageRating totalReviews')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: event.reviews || [],
        averageRating: event.averageRating || 0,
        totalReviews: event.totalReviews || 0
      }
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

