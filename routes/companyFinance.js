const express = require('express');
const router = express.Router();
const MoneyTransaction = require('../models/MoneyTransaction');
const CompanyExpense = require('../models/CompanyExpense');
const { verifyAdminToken } = require('../middleware/auth');

// Get financial summary (earnings, expenses, profit)
router.get('/summary', verifyAdminToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Get total earnings from MoneyTransactions (completed LKR payments)
    const earningsResult = await MoneyTransaction.aggregate([
      {
        $match: {
          paymentMethod: 'LKR',
          status: 'completed',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$amountLKR' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get total expenses
    const expensesResult = await CompanyExpense.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['paid', 'partially_paid'] },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amountLKR' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalEarnings = earningsResult[0]?.totalEarnings || 0;
    const earningsCount = earningsResult[0]?.count || 0;
    const totalExpenses = expensesResult[0]?.totalExpenses || 0;
    const expensesCount = expensesResult[0]?.count || 0;
    const totalProfit = totalEarnings - totalExpenses;
    
    // Get earnings breakdown by category
    const earningsBreakdown = await MoneyTransaction.aggregate([
      {
        $match: {
          paymentMethod: 'LKR',
          status: 'completed',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amountLKR' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    // Get expenses breakdown by type
    const expensesBreakdown = await CompanyExpense.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['paid', 'partially_paid'] },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$expenseType',
          total: { $sum: '$amountLKR' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    res.json({
      success: true,
      summary: {
        totalEarnings,
        earningsCount,
        totalExpenses,
        expensesCount,
        totalProfit,
        profitMargin: totalEarnings > 0 ? ((totalProfit / totalEarnings) * 100).toFixed(2) : 0
      },
      earningsBreakdown,
      expensesBreakdown
    });
    
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all money transactions (earnings) with filters
router.get('/earnings', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      transactionType,
      paymentGateway,
      status,
      category,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { paymentMethod: 'LKR' };
    
    if (search) {
      query.$or = [
        { gatewayTransactionId: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (transactionType && transactionType !== 'all') {
      query.transactionType = transactionType;
    }
    
    if (paymentGateway && paymentGateway !== 'all') {
      query.paymentGateway = paymentGateway;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const transactions = await MoneyTransaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email profileImage');

    const total = await MoneyTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all expenses with filters
router.get('/expenses', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      expenseType,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    if (expenseType && expenseType !== 'all') {
      query.expenseType = expenseType;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const expenses = await CompanyExpense.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedUserId', 'name email');

    const total = await CompanyExpense.countDocuments(query);

    res.json({
      success: true,
      expenses,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new expense
router.post('/expenses', verifyAdminToken, async (req, res) => {
  try {
    const expense = new CompanyExpense(req.body);
    await expense.save();

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      expense
    });

  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update expense
router.put('/expenses/:id', verifyAdminToken, async (req, res) => {
  try {
    const expense = await CompanyExpense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      expense
    });

  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete expense
router.delete('/expenses/:id', verifyAdminToken, async (req, res) => {
  try {
    const expense = await CompanyExpense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single expense
router.get('/expenses/:id', verifyAdminToken, async (req, res) => {
  try {
    const expense = await CompanyExpense.findById(req.params.id)
      .populate('relatedUserId', 'name email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({
      success: true,
      expense
    });

  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

