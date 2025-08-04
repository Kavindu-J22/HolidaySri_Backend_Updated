const express = require('express');
const PaymentActivity = require('../models/PaymentActivity');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get user's payment activities with search and filter
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      paymentMethod,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = { userId: req.user._id };

    // Search by transaction ID
    if (search) {
      query.transactionId = { $regex: search, $options: 'i' };
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const activities = await PaymentActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('promoCodeOwnerId', 'name email');

    const total = await PaymentActivity.countDocuments(query);

    // Get summary statistics
    const stats = await PaymentActivity.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalOriginalAmount: { $sum: '$originalAmount' },
          totalDiscountedAmount: { $sum: '$discountedAmount' }
        }
      }
    ]);

    // Get HSC-specific statistics
    const hscStats = await PaymentActivity.aggregate([
      { $match: { userId: req.user._id, paymentMethod: 'HSC' } },
      {
        $group: {
          _id: null,
          totalHSCAmount: { $sum: '$amount' },
          totalHSCOriginalAmount: { $sum: '$originalAmount' },
          totalHSCDiscountedAmount: { $sum: '$discountedAmount' }
        }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await PaymentActivity.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get payment method breakdown
    const paymentMethodBreakdown = await PaymentActivity.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      stats: {
        ...(stats[0] || {
          totalTransactions: 0,
          totalAmount: 0,
          totalOriginalAmount: 0,
          totalDiscountedAmount: 0
        }),
        ...(hscStats[0] || {
          totalHSCAmount: 0,
          totalHSCOriginalAmount: 0,
          totalHSCDiscountedAmount: 0
        })
      },
      categoryBreakdown,
      paymentMethodBreakdown
    });

  } catch (error) {
    console.error('Get payment activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment activity details by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const activity = await PaymentActivity.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('userId', 'name email')
      .populate('promoCodeOwnerId', 'name email');

    if (!activity) {
      return res.status(404).json({ message: 'Payment activity not found' });
    }

    res.json(activity);

  } catch (error) {
    console.error('Get payment activity details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available filter options
router.get('/filters/options', verifyToken, async (req, res) => {
  try {
    // Get unique categories for this user
    const categories = await PaymentActivity.distinct('category', { userId: req.user._id });
    
    // Get unique payment methods for this user
    const paymentMethods = await PaymentActivity.distinct('paymentMethod', { userId: req.user._id });
    
    // Get unique statuses for this user
    const statuses = await PaymentActivity.distinct('status', { userId: req.user._id });

    res.json({
      categories: categories.sort(),
      paymentMethods: paymentMethods.sort(),
      statuses: statuses.sort()
    });

  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
