const express = require('express');
const router = express.Router();
const HolidayMemory = require('../models/HolidayMemory');
const PhotoEarned = require('../models/PhotoEarned');
const User = require('../models/User');
const PaymentActivity = require('../models/PaymentActivity');
const HSCEarned = require('../models/HSCEarned');
const { HSCTransaction } = require('../models/HSC');
const { verifyToken, verifyEmailVerified } = require('../middleware/auth');

// POST /api/holiday-memories/upload - Upload a new photo/post
router.post('/upload', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const {
      image,
      imagePublicId,
      caption,
      location,
      mapLink,
      tags
    } = req.body;

    // Validation
    if (!image || !caption || !location || !location.name) {
      return res.status(400).json({ message: 'Image, caption, and location name are required' });
    }

    // Validate tags (max 5)
    if (tags && tags.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 tags allowed' });
    }

    const user = await User.findById(req.user._id);

    const newPost = new HolidayMemory({
      userId: req.user._id,
      userEmail: user.email,
      userName: user.name,
      userAvatar: user.profileImage,
      image,
      imagePublicId,
      caption,
      location,
      mapLink,
      tags: tags || []
    });

    await newPost.save();

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      post: newPost
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/browse - Get all posts with filters
router.get('/browse', async (req, res) => {
  try {
    const {
      city,
      province,
      tag,
      search,
      page = 1,
      limit = 12,
      sortBy = 'recent' // recent, popular, mostDownloaded
    } = req.query;

    const skip = (page - 1) * limit;
    let filter = { isActive: true };

    // Apply filters
    if (city) filter['location.city'] = city;
    if (province) filter['location.province'] = province;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { 'location.name': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Determine sort order
    let sort = {};
    if (sortBy === 'popular') {
      sort = { 'likes': -1, createdAt: -1 };
    } else if (sortBy === 'mostDownloaded') {
      sort = { 'downloads': -1, createdAt: -1 };
    } else {
      sort = { createdAt: -1 };
    }

    const posts = await HolidayMemory.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email profileImage');

    const total = await HolidayMemory.countDocuments(filter);

    // Transform posts to include like count and comment count
    const transformedPosts = posts.map(post => ({
      ...post.toObject(),
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      saveCount: post.saves.length,
      downloadCount: post.downloads.length
    }));

    res.json({
      success: true,
      posts: transformedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    console.error('Browse posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/:id - Get single post details
router.get('/:id', async (req, res) => {
  try {
    const post = await HolidayMemory.findById(req.params.id)
      .populate('userId', 'name email profileImage')
      .populate('comments.userId', 'name profileImage');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    res.json({
      success: true,
      post: {
        ...post.toObject(),
        likeCount: post.likes.length,
        commentCount: post.comments.length,
        saveCount: post.saves.length,
        downloadCount: post.downloads.length
      }
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/holiday-memories/:id/like - Like/Unlike a post
router.post('/:id/like', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const post = await HolidayMemory.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.findIndex(
      like => like.userId.toString() === req.user._id.toString()
    );

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      await post.save();
      return res.json({
        success: true,
        liked: false,
        likeCount: post.likes.length,
        likes: post.likes
      });
    } else {
      // Like
      post.likes.push({ userId: req.user._id });
      await post.save();
      return res.json({
        success: true,
        liked: true,
        likeCount: post.likes.length,
        likes: post.likes
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/holiday-memories/:id/comment - Add a comment
router.post('/:id/comment', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await HolidayMemory.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const user = await User.findById(req.user._id);

    const newComment = {
      userId: req.user._id,
      userName: user.name,
      userAvatar: user.profileImage,
      text: text.trim()
    };

    post.comments.push(newComment);
    await post.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: newComment,
      commentCount: post.comments.length
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/holiday-memories/:id/save - Save/Unsave a post
router.post('/:id/save', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const post = await HolidayMemory.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const saveIndex = post.saves.findIndex(
      save => save.userId.toString() === req.user._id.toString()
    );

    if (saveIndex > -1) {
      // Unsave
      post.saves.splice(saveIndex, 1);
      await post.save();
      return res.json({
        success: true,
        saved: false,
        saveCount: post.saves.length,
        saves: post.saves
      });
    } else {
      // Save
      post.saves.push({ userId: req.user._id });
      await post.save();
      return res.json({
        success: true,
        saved: true,
        saveCount: post.saves.length,
        saves: post.saves
      });
    }

  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/holiday-memories/:id/download - Download a photo (requires 2.5 HSC payment)
router.post('/:id/download', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const post = await HolidayMemory.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const buyer = await User.findById(req.user._id);
    const photoOwner = await User.findById(post.userId);

    // Check if user is trying to download their own photo
    if (post.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot download your own photo' });
    }

    // Check if already downloaded
    const alreadyDownloaded = post.downloads.some(
      download => download.userId.toString() === req.user._id.toString()
    );

    if (alreadyDownloaded) {
      return res.status(400).json({
        message: 'You have already downloaded this photo',
        alreadyDownloaded: true
      });
    }

    const downloadPrice = post.downloadPrice || 2.5;
    const ownerEarning = 1.5; // Photo owner earns 1.5 HSC

    // Check buyer's HSC balance
    if (buyer.hscBalance < downloadPrice) {
      return res.status(400).json({
        message: `Insufficient HSC balance. You need ${downloadPrice} HSC. Your current balance: ${buyer.hscBalance} HSC`,
        insufficientBalance: true,
        required: downloadPrice,
        current: buyer.hscBalance
      });
    }

    // Deduct HSC from buyer
    const buyerBalanceBefore = buyer.hscBalance;
    buyer.hscBalance -= downloadPrice;
    await buyer.save();

    // Add download record to post
    post.downloads.push({
      userId: req.user._id,
      hscPaid: downloadPrice
    });
    post.totalEarnings += ownerEarning;
    await post.save();

    // Create HSC Transaction for buyer (deduction)
    const buyerTransaction = new HSCTransaction({
      userId: buyer._id,
      tokenType: 'HSC',
      type: 'spend',
      amount: downloadPrice,
      description: `Photo download - ${post.location.name}`,
      balanceBefore: buyerBalanceBefore,
      balanceAfter: buyer.hscBalance,
      paymentDetails: {
        paymentStatus: 'completed'
      }
    });
    await buyerTransaction.save();

    // Generate unique transaction ID
    const transactionId = `PHOTO_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Create Payment Activity for buyer
    const paymentActivity = new PaymentActivity({
      userId: buyer._id,
      buyerEmail: buyer.email,
      item: `Photo Download - ${post.location.name}`,
      quantity: 1,
      category: 'Photo Download',
      originalAmount: downloadPrice,
      amount: downloadPrice,
      discountedAmount: 0,
      paymentMethod: 'HSC',
      status: 'completed'
    });
    await paymentActivity.save();

    // Create PhotoEarned record for photo owner
    const photoEarned = new PhotoEarned({
      userId: photoOwner._id,
      userEmail: photoOwner.email,
      userName: photoOwner.name,
      postId: post._id,
      postLocation: {
        name: post.location.name,
        city: post.location.city,
        province: post.location.province
      },
      postImage: post.image,
      buyerUserId: buyer._id,
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      hscEarnAmount: ownerEarning,
      hscPaidByBuyer: downloadPrice,
      transactionId: transactionId,
      status: 'completed'
    });
    await photoEarned.save();

    // Create HSCEarned record for photo owner
    const hscEarned = new HSCEarned({
      userId: photoOwner._id,
      buyerUserId: buyer._id,
      earnedAmount: ownerEarning,
      category: 'Photo Download',
      itemDetails: {
        postId: post._id,
        postLocation: `${post.location.name}, ${post.location.city || ''}`,
        photoEarnAmount: ownerEarning
      },
      buyerDetails: {
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        purchaseDate: new Date()
      },
      transactionId: transactionId,
      status: 'completed',
      description: `Photo download earning - ${post.location.name}`
    });
    await hscEarned.save();

    res.json({
      success: true,
      message: 'Photo downloaded successfully',
      download: {
        postId: post._id,
        image: post.image,
        location: post.location,
        mapLink: post.mapLink,
        hscPaid: downloadPrice,
        newBalance: buyer.hscBalance
      }
    });

  } catch (error) {
    console.error('Download photo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/user/saved - Get user's saved posts
router.get('/user/saved', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Find all posts where user has saved
    const posts = await HolidayMemory.find({
      'saves.userId': req.user._id,
      isActive: true
    })
      .sort({ 'saves.savedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email profileImage');

    const total = await HolidayMemory.countDocuments({
      'saves.userId': req.user._id,
      isActive: true
    });

    const transformedPosts = posts.map(post => ({
      ...post.toObject(),
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      saveCount: post.saves.length,
      downloadCount: post.downloads.length
    }));

    res.json({
      success: true,
      savedPosts: transformedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/user/downloads - Get user's downloaded photos
router.get('/user/downloads', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    // Find all posts where user has downloaded
    const posts = await HolidayMemory.find({
      'downloads.userId': req.user._id,
      isActive: true
    })
      .sort({ 'downloads.downloadedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email profileImage');

    const total = await HolidayMemory.countDocuments({
      'downloads.userId': req.user._id,
      isActive: true
    });

    const transformedPosts = posts.map(post => {
      const userDownload = post.downloads.find(
        d => d.userId.toString() === req.user._id.toString()
      );
      return {
        ...post.toObject(),
        downloadedAt: userDownload?.downloadedAt,
        hscPaid: userDownload?.hscPaid,
        likeCount: post.likes.length,
        commentCount: post.comments.length
      };
    });

    res.json({
      success: true,
      downloads: transformedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalDownloads: total,
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    console.error('Get downloads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/user/earnings - Get user's photo earnings
router.get('/user/earnings', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const earnings = await PhotoEarned.find({
      userId: req.user._id,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('postId', 'image location caption')
      .populate('buyerUserId', 'name email');

    const total = await PhotoEarned.countDocuments({
      userId: req.user._id,
      status: 'completed'
    });

    // Calculate total earnings
    const totalEarnings = await PhotoEarned.aggregate([
      {
        $match: {
          userId: req.user._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$hscEarnAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      earnings,
      totalEarnings: totalEarnings.length > 0 ? totalEarnings[0].total : 0,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasMore: skip + earnings.length < total
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/holiday-memories/user/my-posts - Get user's own posts
router.get('/user/my-posts', verifyToken, verifyEmailVerified, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await HolidayMemory.find({
      userId: req.user._id,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HolidayMemory.countDocuments({
      userId: req.user._id,
      isActive: true
    });

    const transformedPosts = posts.map(post => ({
      ...post.toObject(),
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      saveCount: post.saves.length,
      downloadCount: post.downloads.length
    }));

    res.json({
      success: true,
      posts: transformedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

