const mongoose = require('mongoose');

const moneyTransactionSchema = new mongoose.Schema({
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },

  // Transaction Type
  transactionType: {
    type: String,
    enum: ['HSC_PURCHASE', 'HSC_SPEND', 'REFUND', 'WITHDRAWAL', 'EARNING_PAYOUT'],
    required: true
  },

  // Payment Gateway Information (for purchases)
  paymentGateway: {
    type: String,
    enum: ['PayHere', 'Stripe', 'PayPal', 'Bank Transfer', 'Manual', 'HSC'],
    default: 'PayHere'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'cash', 'HSC', 'LKR'],
    required: true
  },

  // Amount Information
  amountLKR: {
    type: Number,
    required: true // Amount in LKR (Sri Lankan Rupees)
  },
  hscAmount: {
    type: Number,
    default: 0 // HSC tokens involved in transaction
  },
  hscValue: {
    type: Number // HSC to LKR conversion rate at time of transaction
  },

  // Transaction Details
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'HSC Purchase',
      'Package Purchase',
      'Advertisement',
      'Membership',
      'Promo Code',
      'Commercial Partnership',
      'Donation',
      'Refund',
      'Withdrawal',
      'Earning Payout',
      'Other'
    ]
  },

  // Payment Gateway Transaction Details
  gatewayTransactionId: {
    type: String, // PayHere order ID or other gateway transaction ID
    required: true
  },
  gatewayOrderId: {
    type: String // Additional order ID if different from transaction ID
  },
  gatewayStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'completed'
  },

  // Customer Details (from payment form)
  customerDetails: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    country: {
      type: String,
      default: 'Sri Lanka'
    }
  },

  // Package/Item Details
  itemDetails: {
    itemName: String,
    itemId: mongoose.Schema.Types.ObjectId,
    quantity: {
      type: Number,
      default: 1
    },
    packageType: String // e.g., 'Starter', 'Premium', 'Custom'
  },

  // Balance Information
  balanceBefore: {
    hsc: Number,
    hsg: Number,
    hsd: Number
  },
  balanceAfter: {
    hsc: Number,
    hsg: Number,
    hsd: Number
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'completed'
  },

  // Additional Metadata
  ipAddress: String,
  userAgent: String,
  notes: String,

  // Related Records
  relatedPaymentActivity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentActivity'
  },
  relatedHSCTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSCTransaction'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
moneyTransactionSchema.index({ userId: 1, createdAt: -1 });
moneyTransactionSchema.index({ userEmail: 1 });
moneyTransactionSchema.index({ gatewayTransactionId: 1 });
moneyTransactionSchema.index({ transactionType: 1, status: 1 });
moneyTransactionSchema.index({ createdAt: -1 });
moneyTransactionSchema.index({ status: 1 });

module.exports = mongoose.model('MoneyTransaction', moneyTransactionSchema);

