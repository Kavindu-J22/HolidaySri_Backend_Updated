const mongoose = require('mongoose');

const companyExpenseSchema = new mongoose.Schema({
  // Expense Details
  expenseType: {
    type: String,
    enum: [
      'Operational',
      'Marketing',
      'Salaries',
      'Infrastructure',
      'Software & Tools',
      'Legal & Compliance',
      'Office Supplies',
      'Utilities',
      'Travel',
      'Professional Services',
      'Maintenance',
      'Taxes',
      'Insurance',
      'Refund',
      'Payout',
      'Other'
    ],
    required: true
  },
  
  category: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  // Amount Information
  amountLKR: {
    type: Number,
    required: true
  },
  
  currency: {
    type: String,
    default: 'LKR'
  },
  
  // Vendor/Payee Information
  vendorName: {
    type: String,
    required: true
  },
  
  vendorEmail: {
    type: String
  },
  
  vendorPhone: {
    type: String
  },
  
  vendorAddress: {
    type: String
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Card', 'Cheque', 'Online Payment', 'Other'],
    required: true
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partially_paid', 'cancelled', 'refunded'],
    default: 'paid'
  },
  
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Transaction Details
  transactionId: {
    type: String
  },
  
  invoiceNumber: {
    type: String
  },
  
  receiptNumber: {
    type: String
  },
  
  // Additional Details
  dueDate: {
    type: Date
  },
  
  paidBy: {
    type: String // Admin name who processed the payment
  },
  
  approvedBy: {
    type: String // Manager/Admin who approved
  },
  
  department: {
    type: String
  },
  
  // Attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notes
  notes: {
    type: String
  },
  
  internalNotes: {
    type: String // Private notes for admin only
  },
  
  // Tax Information
  taxAmount: {
    type: Number,
    default: 0
  },
  
  taxPercentage: {
    type: Number,
    default: 0
  },
  
  // Related Records
  relatedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // If expense is related to a user (e.g., refund, payout)
  },
  
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId // Reference to related transaction
  },
  
  // Status
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  recurringFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
companyExpenseSchema.index({ expenseType: 1 });
companyExpenseSchema.index({ paymentStatus: 1 });
companyExpenseSchema.index({ paymentDate: -1 });
companyExpenseSchema.index({ createdAt: -1 });
companyExpenseSchema.index({ vendorName: 1 });

module.exports = mongoose.model('CompanyExpense', companyExpenseSchema);

