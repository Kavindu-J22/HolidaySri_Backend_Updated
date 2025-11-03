const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const BooksAndMagazinesEducational = require('../models/BooksAndMagazinesEducational');
const Advertisement = require('../models/Advertisement');

// POST /api/books-magazines-educational/publish - Create book profile and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      author,
      specialization,
      languages,
      categories,
      description,
      price,
      contact,
      whatsapp,
      available,
      includes,
      facebook,
      website,
      images,
      pdfDocument
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !author || !specialization || !Array.isArray(specialization) ||
        specialization.length === 0 || !languages || !Array.isArray(languages) || languages.length === 0 ||
        !categories || !Array.isArray(categories) || categories.length === 0 || !description ||
        price === undefined || !contact || !whatsapp || !images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 2)
    if (images.length > 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 images allowed'
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
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
      category: 'books_magazines_educational'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or does not belong to you'
      });
    }

    // Create book profile
    const bookProfile = new BooksAndMagazinesEducational({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      author,
      specialization,
      languages,
      categories,
      description,
      price: parseFloat(price),
      contact,
      whatsapp,
      available: available === true || available === 'true',
      includes: includes || [],
      facebook: facebook || null,
      website: website || null,
      images,
      pdfDocument: pdfDocument || null
    });

    await bookProfile.save();

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
    advertisement.publishedAdId = bookProfile._id;
    advertisement.publishedAdModel = 'BooksAndMagazinesEducational';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Book profile published successfully',
      data: {
        profile: bookProfile,
        advertisement: advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing book profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish profile. Please try again.'
    });
  }
});

// GET /api/books-magazines-educational/browse - Browse all books with filters
router.get('/browse', async (req, res) => {
  try {
    const { specialization, language, category, search, page = 1, limit = 12 } = req.query;

    // Build filter object - exclude expired advertisements
    const filter = { isActive: true };

    // Get all non-expired book IDs from advertisements
    const validAds = await Advertisement.find({
      publishedAdModel: 'BooksAndMagazinesEducational',
      status: 'Published',
      expiresAt: { $gt: new Date() }
    }).select('publishedAdId');

    const validBookIds = validAds.map(ad => ad.publishedAdId);
    filter._id = { $in: validBookIds };

    if (specialization) filter.specialization = { $in: [specialization] };
    if (language) filter.languages = { $in: [language] };
    if (category) filter.categories = { $in: [category] };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await BooksAndMagazinesEducational.countDocuments(filter);

    // Get all matching books and shuffle them
    const allBooks = await BooksAndMagazinesEducational.find(filter);
    const shuffledBooks = allBooks.sort(() => Math.random() - 0.5);
    const books = shuffledBooks.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch books'
    });
  }
});

// GET /api/books-magazines-educational/:id - Get book detail
router.get('/:id', async (req, res) => {
  try {
    const book = await BooksAndMagazinesEducational.findById(req.params.id)
      .populate('userId', 'name email');

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Increment view count
    book.viewCount = (book.viewCount || 0) + 1;
    await book.save();

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('Error fetching book detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book detail'
    });
  }
});

// PUT /api/books-magazines-educational/:id - Edit book profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      author,
      specialization,
      languages,
      categories,
      description,
      price,
      contact,
      whatsapp,
      available,
      includes,
      facebook,
      website,
      images,
      pdfDocument
    } = req.body;

    // Validate required fields
    if (!name || !author || !specialization || !Array.isArray(specialization) ||
        specialization.length === 0 || !languages || !Array.isArray(languages) || languages.length === 0 ||
        !categories || !Array.isArray(categories) || categories.length === 0 || !description ||
        price === undefined || !contact || !whatsapp || !images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 2)
    if (images.length > 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 images allowed'
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    // Find book and verify ownership
    const book = await BooksAndMagazinesEducational.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (book.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this book'
      });
    }

    // Update book profile
    book.name = name;
    book.author = author;
    book.specialization = specialization;
    book.languages = languages;
    book.categories = categories;
    book.description = description;
    book.price = parseFloat(price);
    book.contact = contact;
    book.whatsapp = whatsapp;
    book.available = available === true || available === 'true';
    book.includes = includes || [];
    book.facebook = facebook || null;
    book.website = website || null;
    book.images = images;
    book.pdfDocument = pdfDocument || null;

    await book.save();

    res.json({
      success: true,
      message: 'Book profile updated successfully',
      data: book
    });
  } catch (error) {
    console.error('Error updating book profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/books-magazines-educational/:id/reviews - Add review and rating
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Validate review
    if (!review || review.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review cannot be empty'
      });
    }

    // Find book
    const book = await BooksAndMagazinesEducational.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check if user already reviewed
    const existingReview = book.reviews.find(r => r.userId.toString() === req.user._id.toString());

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.review = review;
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      book.reviews.push({
        userId: req.user._id,
        userName: req.user.name,
        rating,
        review,
        createdAt: new Date()
      });
    }

    // Calculate average rating
    const totalRating = book.reviews.reduce((sum, r) => sum + r.rating, 0);
    book.averageRating = totalRating / book.reviews.length;
    book.totalReviews = book.reviews.length;

    await book.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: book
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
});

module.exports = router;

