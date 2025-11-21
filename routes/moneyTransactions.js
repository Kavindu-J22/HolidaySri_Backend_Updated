const express = require('express');
const MoneyTransaction = require('../models/MoneyTransaction');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Get user's money transactions with search and filter
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      transactionType,
      paymentMethod,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = { userId: req.user._id };

    // Search by transaction ID or gateway transaction ID
    if (search) {
      query.$or = [
        { gatewayTransactionId: { $regex: search, $options: 'i' } },
        { gatewayOrderId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by transaction type
    if (transactionType && transactionType !== 'all') {
      query.transactionType = transactionType;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get transactions
    const transactions = await MoneyTransaction.find(query)
      .populate('relatedPaymentActivity')
      .populate('relatedHSCTransaction')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MoneyTransaction.countDocuments(query);

    // Get statistics
    const stats = await MoneyTransaction.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmountLKR: { $sum: '$amountLKR' },
          totalHSCAmount: { $sum: '$hscAmount' }
        }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await MoneyTransaction.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmountLKR: { $sum: '$amountLKR' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get payment method breakdown
    const paymentMethodBreakdown = await MoneyTransaction.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmountLKR: { $sum: '$amountLKR' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      stats: stats[0] || {
        totalTransactions: 0,
        totalAmountLKR: 0,
        totalHSCAmount: 0
      },
      categoryBreakdown,
      paymentMethodBreakdown
    });

  } catch (error) {
    console.error('Get money transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single transaction by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const transaction = await MoneyTransaction.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('relatedPaymentActivity')
      .populate('relatedHSCTransaction');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all money transactions
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      transactionType,
      status
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { gatewayTransactionId: { $regex: search, $options: 'i' } }
      ];
    }

    if (transactionType && transactionType !== 'all') {
      query.transactionType = transactionType;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const transactions = await MoneyTransaction.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MoneyTransaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Admin get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

