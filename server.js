const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializePromoCodeScheduler } = require('./utils/promoCodeScheduler');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://holidaysrinotificcation:N6CyuahgAcEzjvfR@cluster0.futoerj.mongodb.net/holidaysri');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB().then(() => {
  // Initialize promo code expiration scheduler after DB connection
  initializePromoCodeScheduler();
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const hscRoutes = require('./routes/hsc');
const adminRoutes = require('./routes/admin');
const promocodeRoutes = require('./routes/promocodes');
const notificationRoutes = require('./routes/notifications');
const destinationRoutes = require('./routes/destinations');
const reviewRoutes = require('./routes/reviews');
const favoriteRoutes = require('./routes/favorites');
const locationRoutes = require('./routes/locations');
const locationReviewRoutes = require('./routes/locationReviews');
const locationFavoriteRoutes = require('./routes/locationFavorites');
const membershipRoutes = require('./routes/membership');
const commercialPartnerRoutes = require('./routes/commercialPartner');
const newsletterRoutes = require('./routes/newsletter');
const publicRoutes = require('./routes/public');
const { startMembershipJobs } = require('./jobs/membershipExpiration');
const { startCommercialPartnershipJobs } = require('./jobs/commercialPartnerExpiration');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hsc', hscRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promocodes', promocodeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/location-reviews', locationReviewRoutes);
app.use('/api/location-favorites', locationFavoriteRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/commercial-partner', commercialPartnerRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/public', publicRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Holidaysri.com API Server' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start membership expiration jobs
  startMembershipJobs();

  // Start commercial partnership expiration jobs
  startCommercialPartnershipJobs();
});
