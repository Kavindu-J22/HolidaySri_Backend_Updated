const mongoose = require('mongoose');

const hstcTransactionSchema = new mongoose.Schema({
  // Sender information
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CaregiversTimeCurrency',
    required: true
  },
  senderCareID: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },

  // Receiver information
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CaregiversTimeCurrency',
    required: true
  },
  receiverCareID: {
    type: String,
    required: true
  },
  receiverName: {
    type: String,
    required: true
  },

  // Transaction details
  amount: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'HSTC amount must be a whole number (no decimals)'
    }
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // Transaction type (for receiver/sender perspective)
  transactionType: {
    type: String,
    enum: ['Transfer', 'Received'],
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
hstcTransactionSchema.index({ senderId: 1, createdAt: -1 });
hstcTransactionSchema.index({ receiverId: 1, createdAt: -1 });
hstcTransactionSchema.index({ senderCareID: 1 });
hstcTransactionSchema.index({ receiverCareID: 1 });

module.exports = mongoose.model('HSTCTransaction', hstcTransactionSchema);

