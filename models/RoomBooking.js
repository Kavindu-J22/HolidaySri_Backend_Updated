const mongoose = require('mongoose');

const roomBookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Hotel and Room Information
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HotelsAccommodations',
    required: true
  },
  hotelName: {
    type: String,
    required: true
  },
  hotelOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: String,
    required: true
  },
  roomName: {
    type: String,
    required: true
  },
  roomType: {
    type: String,
    required: true
  },
  
  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerNicOrPassport: {
    type: String,
    required: true
  },
  customerContactNumber: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  
  // Booking Details
  selectedPackage: {
    type: String,
    required: true,
    enum: ['Per Night', 'Full Day', 'Full Board', 'Half Board']
  },
  packagePrice: {
    type: Number,
    required: true
  },
  checkInDate: {
    type: Date,
    required: true
  },
  numberOfDays: {
    type: Number,
    required: true,
    min: 1
  },
  numberOfAdults: {
    type: Number,
    required: true,
    min: 1
  },
  numberOfChildren: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPersons: {
    type: Number,
    required: true
  },
  numberOfRooms: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Pricing Information
  totalAmount: {
    type: Number,
    required: true
  },
  discountedAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  
  // Promocode Information (if applicable)
  promocodeUsed: {
    type: String,
    uppercase: true,
    default: null
  },
  promocodeOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  discountPerRoom: {
    type: Number,
    default: 0
  },
  earnRatePerRoom: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalEarnRate: {
    type: Number,
    default: 0
  },
  hscPaidForEarnRate: {
    type: Number,
    default: 0
  },
  
  // Status and Actions
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  ownerNote: {
    type: String,
    default: ''
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  
  // Related Records
  paymentActivityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentActivity'
  },
  earningsRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Earnings'
  }
}, {
  timestamps: true
});

// Auto-generate booking ID before saving
roomBookingSchema.pre('save', function(next) {
  if (this.isNew && !this.bookingId) {
    this.bookingId = `BK${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }
  next();
});

// Index for faster queries
roomBookingSchema.index({ customerId: 1, createdAt: -1 });
roomBookingSchema.index({ hotelOwnerId: 1, status: 1, createdAt: -1 });
roomBookingSchema.index({ bookingId: 1 });

const RoomBooking = mongoose.model('RoomBooking', roomBookingSchema);

module.exports = RoomBooking;

