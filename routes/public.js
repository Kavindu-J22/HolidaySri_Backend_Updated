const express = require('express');
const router = express.Router();
const AdvertisementSlotCharges = require('../models/AdvertisementSlotCharges');

// Public endpoint for getting advertisement slot charges (no auth required)
router.get('/advertisement-slot-charges', async (req, res) => {
  try {
    console.log('Public advertisement slot charges request received');
    let slotCharges = await AdvertisementSlotCharges.findOne({ isActive: true });

    if (!slotCharges) {
      console.log('No advertisement slot charges config found, creating default');
      // Create default configuration if none exists
      slotCharges = new AdvertisementSlotCharges({
        updatedBy: 'system'
      });
      await slotCharges.save();
      console.log('Default advertisement slot charges config created');
    }

    console.log('Returning public advertisement slot charges config');
    res.json({
      success: true,
      config: slotCharges
    });

  } catch (error) {
    console.error('Get public advertisement slot charges config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
