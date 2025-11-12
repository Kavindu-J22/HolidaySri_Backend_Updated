const express = require('express');
const router = express.Router();
const HomeOfficeAccessoriesTech = require('../models/HomeOfficeAccessoriesTech');
const Advertisement = require('../models/Advertisement');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

// Sri Lankan provinces and districts mapping
const provincesAndDistricts = {
  "Western Province": ["Colombo", "Gampaha", "Kalutara"],
  "Central Province": ["Kandy", "Matale", "Nuwara Eliya"],
  "Southern Province": ["Galle", "Matara", "Hambantota"],
  "Northern Province": ["Jaffna", "Mannar", "Vavuniya", "Kilinochchi", "Mullaitivu"],
  "Eastern Province": ["Batticaloa", "Ampara", "Trincomalee"],
  "North Western Province": ["Kurunegala", "Puttalam"],
  "North Central Province": ["Anuradhapura", "Polonnaruwa"],
  "Uva Province": ["Badulla", "Monaragala"],
  "Sabaragamuwa Province": ["Kegalle", "Ratnapura"]
};

// POST /api/home-office-accessories-tech/publish - Create product listing and publish advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      name,
      category,
      specialization,
      description,
      price,
      city,
      province,
      available,
      contact,
      website,
      facebook,
      paymentMethods,
      deliveryAvailable,
      images
    } = req.body;

    // Validate required fields
    if (!advertisementId || !name || !category || !specialization || !description || 
        price === undefined || !city || !province || !contact || !images || 
        !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate image count (max 3)
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 images allowed'
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    // Validate province and city
    if (!provincesAndDistricts[province]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province selected'
      });
    }

    if (!provincesAndDistricts[province].includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for the selected province'
      });
    }

    // Find the advertisement
    const advertisement = await Advertisement.findById(advertisementId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Check if advertisement belongs to the user
    if (advertisement.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this advertisement'
      });
    }

    // Create product listing
    const productListing = new HomeOfficeAccessoriesTech({
      userId: req.user._id,
      publishedAdId: advertisementId,
      name,
      category,
      specialization,
      description,
      price: parseFloat(price),
      city,
      province,
      images,
      available: available !== undefined ? available : true,
      contact,
      website: website || '',
      facebook: facebook || '',
      paymentMethods: paymentMethods || [],
      deliveryAvailable: deliveryAvailable !== undefined ? deliveryAvailable : false
    });

    await productListing.save();

    // Calculate expiration time based on plan (Sri Lankan timezone)
    const sriLankanNow = moment.tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = sriLankanNow.clone().add(advertisement.planDuration.hours || 1, 'hours');
        break;
      case 'daily':
        expirationTime = sriLankanNow.clone().add(advertisement.planDuration.days || 1, 'days');
        break;
      case 'monthly':
        expirationTime = sriLankanNow.clone().add(30, 'days');
        break;
      case 'yearly':
        expirationTime = sriLankanNow.clone().add(365, 'days');
        break;
      default:
        expirationTime = sriLankanNow.clone().add(1, 'day');
    }

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = productListing._id;
    advertisement.publishedAdModel = 'HomeOfficeAccessoriesTech';
    advertisement.expiresAt = expirationTime.toDate();
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Product listing published successfully',
      data: {
        productId: productListing._id,
        advertisementId: advertisement._id
      }
    });
  } catch (error) {
    console.error('Error publishing product listing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish product listing',
      error: error.message
    });
  }
});

// GET /api/home-office-accessories-tech/browse - Get all published products with filters
router.get('/browse', async (req, res) => {
  try {
    const { search, specialization, category, city, province, page = 1, limit = 12 } = req.query;

    // Build filter object
    const filter = { isActive: true };

    // Filter by search term
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by specialization
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    // Filter by category
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    // Filter by city
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Filter by province
    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    let products = await HomeOfficeAccessoriesTech.find(filter)
      .populate('publishedAdId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Filter out products whose advertisements are expired
    products = products.filter(product => {
      if (product.publishedAdId && product.publishedAdId.expiresAt) {
        return new Date(product.publishedAdId.expiresAt) > new Date();
      }
      return true;
    });

    // Randomize the order
    products = products.sort(() => Math.random() - 0.5);

    // Get total count for pagination
    const totalProducts = await HomeOfficeAccessoriesTech.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts: totalProducts
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products. Please try again.'
    });
  }
});

// GET /api/home-office-accessories-tech/provinces - Get provinces and cities
router.get('/provinces', (req, res) => {
  res.json({
    success: true,
    data: provincesAndDistricts
  });
});

// GET /api/home-office-accessories-tech/:id - Get product details
router.get('/:id', async (req, res) => {
  try {
    const product = await HomeOfficeAccessoriesTech.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('publishedAdId');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details'
    });
  }
});

// PUT /api/home-office-accessories-tech/:id - Update product listing
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      name,
      category,
      specialization,
      description,
      price,
      city,
      province,
      available,
      contact,
      website,
      facebook,
      paymentMethods,
      deliveryAvailable,
      images
    } = req.body;

    // Find the product
    const product = await HomeOfficeAccessoriesTech.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product belongs to the user
    if (product.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this product'
      });
    }

    // Validate province and city if provided
    if (province && city) {
      if (!provincesAndDistricts[province]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid province selected'
        });
      }

      if (!provincesAndDistricts[province].includes(city)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid city for the selected province'
        });
      }
    }

    // Update product fields
    if (name) product.name = name;
    if (category) product.category = category;
    if (specialization) product.specialization = specialization;
    if (description) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (city) product.city = city;
    if (province) product.province = province;
    if (available !== undefined) product.available = available;
    if (contact) product.contact = contact;
    if (website !== undefined) product.website = website;
    if (facebook !== undefined) product.facebook = facebook;
    if (paymentMethods) product.paymentMethods = paymentMethods;
    if (deliveryAvailable !== undefined) product.deliveryAvailable = deliveryAvailable;
    if (images && Array.isArray(images) && images.length > 0 && images.length <= 3) {
      product.images = images;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
});

// POST /api/home-office-accessories-tech/:id/reviews - Add review
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const product = await HomeOfficeAccessoriesTech.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Add review
    product.reviews.push({
      userId: req.user._id,
      userName: req.user.name || 'Anonymous',
      rating: parseInt(rating),
      review: review || '',
      createdAt: new Date()
    });

    // Calculate average rating
    const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.averageRating = (totalRating / product.reviews.length).toFixed(1);
    product.totalReviews = product.reviews.length;

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: product
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// GET /api/home-office-accessories-tech/:id/reviews - Get reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const product = await HomeOfficeAccessoriesTech.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reviews: product.reviews,
        averageRating: product.averageRating,
        totalReviews: product.totalReviews
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

module.exports = router;

