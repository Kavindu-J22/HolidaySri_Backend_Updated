const express = require('express');
const router = express.Router();
const HomeBannerSlot = require('../models/HomeBannerSlot');
const Advertisement = require('../models/Advertisement');
const SlotNotification = require('../models/SlotNotification');
const { verifyToken } = require('../middleware/auth');
const moment = require('moment-timezone');

// GET /api/home-banner-slot/active - Get all active home banner slots for display
router.get('/active', async (req, res) => {
  try {
    // Get all active home banner slots
    const activeSlots = await HomeBannerSlot.find({ isActive: true })
      .populate({
        path: 'publishedAdId',
        select: 'status expiresAt'
      })
      .select('slotNumber title description image link buttonText publishedAdId')
      .sort({ slotNumber: 1 });

    // Filter out expired slots
    const validSlots = [];
    for (const slot of activeSlots) {
      if (slot.publishedAdId) {
        const ad = slot.publishedAdId;

        // Check if advertisement is expired
        const isExpired = ad.status === 'expired' ||
                         (ad.expiresAt && new Date(ad.expiresAt) < new Date());

        if (!isExpired) {
          // Slot is still valid
          validSlots.push({
            slotNumber: slot.slotNumber,
            title: slot.title,
            description: slot.description,
            image: slot.image,
            link: slot.link,
            buttonText: slot.buttonText
          });
        } else {
          // Advertisement expired, deactivate the slot
          await HomeBannerSlot.findByIdAndUpdate(slot._id, { isActive: false });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: validSlots
    });
  } catch (error) {
    console.error('Error fetching active banner slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active banner slots'
    });
  }
});

// GET /api/home-banner-slot/slots/availability - Get slot availability status
router.get('/slots/availability', async (req, res) => {
  try {
    // Get all active home banner slots
    const activeSlots = await HomeBannerSlot.find({ isActive: true })
      .populate({
        path: 'publishedAdId',
        select: 'status expiresAt'
      })
      .select('slotNumber publishedAdId');

    // Initialize all 6 slots as available
    const slots = Array.from({ length: 6 }, (_, i) => ({
      slotNumber: i + 1,
      isAvailable: true,
      occupiedBy: null,
      expiresAt: null
    }));

    // Check each active slot
    for (const slot of activeSlots) {
      if (slot.publishedAdId) {
        const ad = slot.publishedAdId;

        // Check if advertisement is expired
        const isExpired = ad.status === 'expired' ||
                         (ad.expiresAt && new Date(ad.expiresAt) < new Date());

        if (!isExpired) {
          // Slot is occupied
          const slotIndex = slot.slotNumber - 1;
          slots[slotIndex] = {
            slotNumber: slot.slotNumber,
            isAvailable: false,
            occupiedBy: slot._id,
            expiresAt: ad.expiresAt
          };
        } else {
          // Advertisement expired, deactivate the slot
          await HomeBannerSlot.findByIdAndUpdate(slot._id, { isActive: false });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: slots
    });
  } catch (error) {
    console.error('Error fetching slot availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slot availability'
    });
  }
});

// POST /api/home-banner-slot/publish - Publish a home banner slot advertisement
router.post('/publish', verifyToken, async (req, res) => {
  try {
    const {
      advertisementId,
      title,
      description,
      image,
      link,
      buttonText,
      slotNumber
    } = req.body;

    // Validation
    if (!advertisementId || !title || !description || !image || !link || !buttonText || !slotNumber) {
      return res.status(400).json({
        success: false,
        message: 'All fields including slot number are required'
      });
    }

    // Validate slot number
    if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 6) {
      return res.status(400).json({
        success: false,
        message: 'Slot number must be between 1 and 6'
      });
    }

    // Check if slot is available
    const existingSlot = await HomeBannerSlot.findOne({
      slotNumber,
      isActive: true
    }).populate('publishedAdId');

    if (existingSlot && existingSlot.publishedAdId) {
      const ad = existingSlot.publishedAdId;
      const isExpired = ad.status === 'expired' ||
                       (ad.expiresAt && new Date(ad.expiresAt) < new Date());

      if (!isExpired) {
        return res.status(400).json({
          success: false,
          message: `Slot ${slotNumber} is currently occupied. Please select another slot.`,
          expiresAt: ad.expiresAt
        });
      } else {
        // Deactivate expired slot
        await HomeBannerSlot.findByIdAndUpdate(existingSlot._id, { isActive: false });
      }
    }

    // Validate title length
    if (title.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Title must be maximum 30 characters'
      });
    }

    // Validate description length
    if (description.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Description must be maximum 100 characters'
      });
    }

    // Validate buttonText length
    if (buttonText.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Button text must be maximum 15 characters'
      });
    }

    // Validate image object
    if (!image.url || !image.publicId) {
      return res.status(400).json({
        success: false,
        message: 'Valid image is required'
      });
    }

    // Find and verify advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      category: 'home_banner_slot',
      status: 'active'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or not eligible for publishing'
      });
    }

    // Check if already published
    if (advertisement.publishedAdId) {
      return res.status(400).json({
        success: false,
        message: 'This advertisement slot has already been published'
      });
    }

    // Create home banner slot
    const homeBannerSlot = new HomeBannerSlot({
      userId: req.user._id,
      publishedAdId: advertisementId,
      slotNumber,
      title,
      description,
      image: {
        url: image.url,
        publicId: image.publicId
      },
      link,
      buttonText,
      publishedAt: new Date()
    });

    await homeBannerSlot.save();

    // Calculate expiration date based on plan and duration (Sri Lankan timezone)
    const sriLankanNow = moment.tz('Asia/Colombo');
    let expirationTime;

    switch (advertisement.selectedPlan) {
      case 'hourly':
        expirationTime = (advertisement.planDuration.hours || 1) * 60 * 60 * 1000;
        break;
      case 'daily':
        expirationTime = (advertisement.planDuration.days || 1) * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        expirationTime = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'yearly':
        expirationTime = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        expirationTime = 24 * 60 * 60 * 1000; // fallback to 1 day
    }

    const expiresAt = new Date(sriLankanNow.valueOf() + expirationTime);

    // Update advertisement status
    advertisement.status = 'Published';
    advertisement.publishedAdId = homeBannerSlot._id;
    advertisement.publishedAdModel = 'HomeBannerSlot';
    advertisement.expiresAt = expiresAt;
    advertisement.publishedAt = new Date(sriLankanNow.valueOf());

    await advertisement.save();

    res.status(201).json({
      success: true,
      message: 'Home banner slot published successfully',
      data: {
        homeBannerSlot,
        advertisement
      }
    });
  } catch (error) {
    console.error('Error publishing home banner slot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish home banner slot. Please try again.'
    });
  }
});

// GET /api/home-banner-slot/active - Get all active home banner slots
router.get('/active', async (req, res) => {
  try {
    const homeBannerSlots = await HomeBannerSlot.find({ isActive: true })
      .populate('userId', 'name email')
      .populate('publishedAdId')
      .sort({ publishedAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: homeBannerSlots
    });
  } catch (error) {
    console.error('Error fetching active home banner slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home banner slots'
    });
  }
});

// PATCH /api/home-banner-slot/:id/increment-view - Increment view count
router.patch('/:id/increment-view', async (req, res) => {
  try {
    const homeBannerSlot = await HomeBannerSlot.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!homeBannerSlot) {
      return res.status(404).json({
        success: false,
        message: 'Home banner slot not found'
      });
    }

    res.status(200).json({
      success: true,
      data: homeBannerSlot
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to increment view count'
    });
  }
});

// PATCH /api/home-banner-slot/:id/increment-click - Increment click count
router.patch('/:id/increment-click', async (req, res) => {
  try {
    const homeBannerSlot = await HomeBannerSlot.findByIdAndUpdate(
      req.params.id,
      { $inc: { clickCount: 1 } },
      { new: true }
    );

    if (!homeBannerSlot) {
      return res.status(404).json({
        success: false,
        message: 'Home banner slot not found'
      });
    }

    res.status(200).json({
      success: true,
      data: homeBannerSlot
    });
  } catch (error) {
    console.error('Error incrementing click count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to increment click count'
    });
  }
});

// POST /api/home-banner-slot/notify-me - Register for slot availability notification
router.post('/notify-me', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user already has a pending notification request
    const existingNotification = await SlotNotification.findOne({
      userId: req.user._id,
      isNotified: false
    });

    if (existingNotification) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending notification request'
      });
    }

    // Create notification request
    const notification = new SlotNotification({
      email,
      userId: req.user._id
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: 'You will be notified via email when a slot becomes available',
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification request'
    });
  }
});

// GET /api/home-banner-slot/my-notification - Check if user has pending notification
router.get('/my-notification', verifyToken, async (req, res) => {
  try {
    const notification = await SlotNotification.findOne({
      userId: req.user._id,
      isNotified: false
    });

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification'
    });
  }
});

// DELETE /api/home-banner-slot/cancel-notification - Cancel notification request
router.delete('/cancel-notification', verifyToken, async (req, res) => {
  try {
    const result = await SlotNotification.findOneAndDelete({
      userId: req.user._id,
      isNotified: false
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No pending notification found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel notification'
    });
  }
});

// GET /api/home-banner-slot/:id - Get home banner slot by ID for editing
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const bannerSlot = await HomeBannerSlot.findById(id)
      .populate({
        path: 'publishedAdId',
        select: 'status expiresAt'
      });

    if (!bannerSlot) {
      return res.status(404).json({
        success: false,
        message: 'Home banner slot not found'
      });
    }

    // Check if user owns this banner slot
    if (bannerSlot.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this banner slot'
      });
    }

    res.status(200).json({
      success: true,
      data: bannerSlot
    });
  } catch (error) {
    console.error('Error fetching home banner slot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home banner slot'
    });
  }
});

// PUT /api/home-banner-slot/:id - Update home banner slot
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image, link, buttonText, slotNumber, reactivate } = req.body;

    // Validation
    if (!title || !description || !image || !link || !buttonText) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate field lengths
    if (title.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Title must not exceed 30 characters'
      });
    }

    if (description.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Description must not exceed 100 characters'
      });
    }

    if (buttonText.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Button text must not exceed 15 characters'
      });
    }

    // Find the banner slot
    const bannerSlot = await HomeBannerSlot.findById(id);

    if (!bannerSlot) {
      return res.status(404).json({
        success: false,
        message: 'Home banner slot not found'
      });
    }

    // Check if user owns this banner slot
    if (bannerSlot.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this banner slot'
      });
    }

    // If reactivating (isActive was false and user selected a new slot)
    if (reactivate && slotNumber) {
      // Validate slot number
      if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 6) {
        return res.status(400).json({
          success: false,
          message: 'Slot number must be between 1 and 6'
        });
      }

      // Check if slot is available
      const existingSlot = await HomeBannerSlot.findOne({
        slotNumber,
        isActive: true,
        _id: { $ne: id } // Exclude current banner slot
      }).populate('publishedAdId');

      if (existingSlot) {
        // Check if the existing slot's advertisement is expired
        const ad = existingSlot.publishedAdId;
        const isExpired = ad && (ad.status === 'expired' ||
                                (ad.expiresAt && new Date(ad.expiresAt) < new Date()));

        if (!isExpired) {
          return res.status(400).json({
            success: false,
            message: `Slot ${slotNumber} is currently occupied. Please select another slot.`
          });
        } else {
          // Deactivate the expired slot
          await HomeBannerSlot.findByIdAndUpdate(existingSlot._id, { isActive: false });
        }
      }

      // Update slot number and reactivate
      bannerSlot.slotNumber = slotNumber;
      bannerSlot.isActive = true;
    }

    // Update the banner slot content
    bannerSlot.title = title;
    bannerSlot.description = description;
    bannerSlot.image = image;
    bannerSlot.link = link;
    bannerSlot.buttonText = buttonText;

    await bannerSlot.save();

    res.status(200).json({
      success: true,
      message: 'Home banner slot updated successfully',
      data: bannerSlot
    });
  } catch (error) {
    console.error('Error updating home banner slot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update home banner slot'
    });
  }
});

module.exports = router;

