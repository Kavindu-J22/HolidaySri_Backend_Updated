const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },
  countryCode: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not Google user
    },
    minlength: 6
  },
  googleId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  hscBalance: {
    type: Number,
    default: 0
  },
  hsgBalance: {
    type: Number,
    default: 100 // New user gift
  },
  hsdBalance: {
    type: Number,
    default: 0
  },
  termsAccepted: {
    type: Boolean,
    required: true,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String
  },
  bankDetails: {
    bank: {
      type: String,
      trim: true
    },
    branch: {
      type: String,
      trim: true
    },
    accountNo: {
      type: String,
      trim: true
    },
    accountName: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    binanceId: {
      type: String,
      trim: true
    }
  },
  // Membership fields
  isMember: {
    type: Boolean,
    default: false
  },
  membershipType: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: null
  },
  membershipStartDate: {
    type: Date,
    default: null
  },
  membershipExpirationDate: {
    type: Date,
    default: null
  },
  // Commercial Partner fields
  isPartner: {
    type: Boolean,
    default: false
  },
  partnerExpirationDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  this.emailVerificationToken = token;
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

module.exports = mongoose.model('User', userSchema);
