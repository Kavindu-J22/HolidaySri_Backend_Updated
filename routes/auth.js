const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');
const { generateOTP, sendEmailVerificationOTP, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Generate JWT token
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Send OTP for email verification
router.post('/send-otp', async (req, res) => {
  try {
    console.log('📧 Send OTP request received:', req.body);
    const { email, name } = req.body;

    if (!email || !name) {
      console.log('❌ Missing email or name');
      return res.status(400).json({ message: 'Email and name are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ message: 'User with this email already exists and is verified' });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    otpStore.set(email, {
      otp,
      expires: Date.now() + 10 * 60 * 1000,
      name
    });

    // Send OTP email
    const emailResult = await sendEmailVerificationOTP(email, name, otp);
    
    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.json({ 
      message: 'OTP sent successfully to your email',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email for security
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Check if OTP exists and is valid
    const storedOTP = otpStore.get(email);
    if (!storedOTP) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }

    if (storedOTP.expires < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid
    otpStore.delete(email);
    
    res.json({ 
      message: 'Email verified successfully',
      verified: true
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { email, name, contactNumber, countryCode, password, confirmPassword, termsAccepted, emailVerified } = req.body;

    // Validation
    if (!email || !name || !contactNumber || !countryCode || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!emailVerified) {
      return res.status(400).json({ message: 'Email verification is required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!termsAccepted) {
      return res.status(400).json({ message: 'You must accept the terms and conditions' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({
      email,
      name,
      contactNumber,
      countryCode,
      password,
      termsAccepted,
      isEmailVerified: true // Since we verified via OTP
    });

    await user.save();

    // Send welcome email
    await sendWelcomeEmail(email, name);

    // Create welcome notification with new user bonus info
    await Notification.createNotification(
      user._id,
      '🎉 Welcome to HolidaySri!',
      `Welcome ${user.name}! Your account has been created successfully. Enjoy your new user bonus of 100 HSG! Start exploring our amazing travel services and promo codes.`,
      'welcome',
      {
        bonusAmount: 100,
        bonusType: 'HSG',
        isNewUser: true
      },
      'high'
    );

    res.status(201).json({
      message: 'User registered successfully. Please login to continue.',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        contactNumber: user.contactNumber,
        countryCode: user.countryCode,
        hscBalance: user.hscBalance,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        contactNumber: user.contactNumber,
        countryCode: user.countryCode,
        hscBalance: user.hscBalance,
        isEmailVerified: user.isEmailVerified,
        profileImage: user.profileImage
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google OAuth login/register
router.post('/google', async (req, res) => {
  try {
    console.log('🔐 Google OAuth request received:', req.body);
    const { googleId, email, name, profileImage } = req.body;

    if (!googleId || !email || !name) {
      console.log('❌ Missing Google authentication data');
      return res.status(400).json({ message: 'Google authentication data is required' });
    }

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (user) {
      // User exists, check if it's a Google user
      if (!user.googleId) {
        // Link Google account to existing user
        user.googleId = googleId;
        if (profileImage) user.profileImage = profileImage;
        user.lastLogin = new Date();
        await user.save();

        console.log('🔗 Linked Google account to existing user:', email);
      } else {
        // Update existing Google user
        user.lastLogin = new Date();
        if (profileImage) user.profileImage = profileImage;
        await user.save();
      }

      const token = generateToken(user._id);

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          contactNumber: user.contactNumber,
          countryCode: user.countryCode,
          hscBalance: user.hscBalance,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage
        }
      });
    } else {
      // New Google user - require registration
      return res.status(200).json({
        message: 'First time Google user. Please complete registration.',
        requiresRegistration: true,
        googleData: {
          googleId,
          email,
          name,
          profileImage
        }
      });
    }

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        contactNumber: req.user.contactNumber,
        countryCode: req.user.countryCode,
        hscBalance: req.user.hscBalance,
        isEmailVerified: req.user.isEmailVerified,
        profileImage: req.user.profileImage,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    console.log('🔑 Forgot password request received:', req.body);
    const { email } = req.body;

    if (!email) {
      console.log('❌ Missing email');
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with this email exists, you will receive a password reset link.',
        success: true
      });
    }

    // Check if user is a Google user (no password)
    if (user.googleId && !user.password) {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please use "Continue with Google" to log in.'
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, user.name, resetToken);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({ message: 'Failed to send password reset email' });
    }

    console.log('✅ Password reset email sent to:', email);
    res.json({
      message: 'If an account with this email exists, you will receive a password reset link.',
      success: true
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    console.log('🔑 Reset password request received');
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
      isActive: true
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log('✅ Password reset successful for:', user.email);
    res.json({
      message: 'Password reset successful. You can now log in with your new password.',
      success: true
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
