const mongoose = require('mongoose');

const vehicleRepairsMechanicsReviewSchema = new mongoose.Schema(
  {
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleRepairsMechanics',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    helpful: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster queries
vehicleRepairsMechanicsReviewSchema.index({ mechanicId: 1 });
vehicleRepairsMechanicsReviewSchema.index({ userId: 1 });
vehicleRepairsMechanicsReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VehicleRepairsMechanicsReview', vehicleRepairsMechanicsReviewSchema);

