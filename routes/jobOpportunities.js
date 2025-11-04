const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { verifyToken } = require('../middleware/auth');
const JobOpportunities = require('../models/JobOpportunities');
const Advertisement = require('../models/Advertisement');

// POST - Publish a job opportunity
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      company,
      companyLogo,
      specialization,
      type,
      category,
      priority,
      description,
      salary,
      city,
      province,
      requirements,
      workType,
      contact,
      email,
      website,
      linkedin,
      pdfDocument
    } = req.body;

    // Validate required fields
    if (!title || !company || !specialization || !type || !category || !priority || 
        !description || !salary || !city || !province || !workType || !contact || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Create job opportunity document
    const jobOpportunity = new JobOpportunities({
      userId: req.user.id,
      title,
      company,
      companyLogo,
      specialization,
      type,
      category,
      priority,
      description,
      salary,
      city,
      province,
      requirements: requirements || [],
      workType,
      contact,
      email,
      website,
      linkedin,
      pdfDocument,
      publishedAt: new Date()
    });

    await jobOpportunity.save();

    // Update advertisement status and expiration
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    // Calculate expiration date based on plan (Sri Lankan timezone)
    const now = moment().tz('Asia/Colombo');
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

    advertisement.status = 'Published';
    advertisement.publishedAt = new Date();
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAdId = jobOpportunity._id;
    advertisement.publishedAdModel = 'JobOpportunities';

    await advertisement.save();

    res.json({
      success: true,
      message: 'Job opportunity published successfully',
      jobOpportunity
    });
  } catch (error) {
    console.error('Error publishing job opportunity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET - Browse job opportunities with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, type, priority, province, city, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    // Filter out expired advertisements
    const now = new Date();
    const expiredAds = await Advertisement.find({
      status: 'expired',
      publishedAdModel: 'JobOpportunities'
    }).select('publishedAdId');

    const expiredJobIds = expiredAds.map(ad => ad.publishedAdId);
    if (expiredJobIds.length > 0) {
      query._id = { $nin: expiredJobIds };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (province) query.province = province;
    if (city) query.city = city;

    const total = await JobOpportunities.countDocuments(query);

    // Get all matching jobs and shuffle them randomly
    const allJobs = await JobOpportunities.find(query);

    // Fisher-Yates shuffle algorithm for random sorting
    for (let i = allJobs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allJobs[i], allJobs[j]] = [allJobs[j], allJobs[i]];
    }

    // Apply pagination after shuffling
    const jobs = allJobs.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      jobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET - Job opportunity detail
router.get('/:id', async (req, res) => {
  try {
    const job = await JobOpportunities.findById(req.params.id)
      .populate('reviews.userId', 'name avatar');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job opportunity not found' });
    }

    // Increment view count
    job.viewCount = (job.viewCount || 0) + 1;
    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error fetching job detail:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT - Edit job opportunity
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const job = await JobOpportunities.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job opportunity not found' });
    }

    if (job.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Update fields
    const updateFields = [
      'title', 'company', 'companyLogo', 'specialization', 'type', 'category',
      'priority', 'description', 'salary', 'city', 'province', 'requirements',
      'workType', 'contact', 'email', 'website', 'linkedin', 'pdfDocument'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        job[field] = req.body[field];
      }
    });

    job.updatedAt = new Date();
    await job.save();

    res.json({ success: true, message: 'Job opportunity updated', job });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Invalid rating' });
    }

    const job = await JobOpportunities.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job opportunity not found' });
    }

    job.reviews.push({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      rating,
      comment
    });

    // Calculate average rating
    const totalRating = job.reviews.reduce((sum, r) => sum + r.rating, 0);
    job.averageRating = totalRating / job.reviews.length;

    await job.save();

    res.json({ success: true, message: 'Review added', job });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

