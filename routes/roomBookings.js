const express = require('express');
const RoomBooking = require('../models/RoomBooking');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Earning = require('../models/Earning');
const PaymentActivity = require('../models/PaymentActivity');
const { HSCConfig, HSCTransaction } = require('../models/HSC');
const { verifyToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// POST /api/room-bookings - Create a new booking
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      hotelId,
      hotelName,
      hotelOwnerId,
      roomId,
      roomName,
      roomType,
      customerName,
      customerNicOrPassport,
      customerContactNumber,
      customerEmail,
      selectedPackage,
      packagePrice,
      checkInDate,
      numberOfDays,
      numberOfAdults,
      numberOfChildren,
      totalPersons,
      numberOfRooms,
      totalAmount,
      discountedAmount,
      finalAmount,
      promocodeUsed,
      promocodeOwnerId,
      discountPerRoom,
      earnRatePerRoom
    } = req.body;
    
    const customerId = req.user._id;
    
    // Calculate totals
    const totalDiscount = discountPerRoom * numberOfRooms;
    const totalEarnRate = earnRatePerRoom * numberOfRooms;
    
    let hscDeducted = false;
    let paymentActivityId = null;
    let earningsRecordId = null;
    
    // If promocode is used, handle HSC payment and earnings
    if (promocodeUsed && promocodeOwnerId && totalEarnRate > 0) {
      // Get current HSC value
      const hscConfig = await HSCConfig.findOne().sort({ createdAt: -1 });
      const currentHscValue = hscConfig ? hscConfig.hscValue : 100;

      // Calculate HSC required
      const hscRequired = totalEarnRate / currentHscValue;

      // Get user
      const user = await User.findById(customerId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get agent (promocode owner) - promocodeOwnerId is the agent's _id
      const agent = await Agent.findById(promocodeOwnerId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Check HSC balance
      if (user.hscBalance < hscRequired) {
        return res.status(400).json({
          success: false,
          message: `Insufficient HSC balance. You need ${hscRequired.toFixed(2)} HSC. Your current balance: ${user.hscBalance} HSC`
        });
      }

      // Deduct HSC from user
      const balanceBefore = user.hscBalance;
      user.hscBalance -= hscRequired;
      await user.save();

      // Create HSC Transaction
      const hscTransaction = new HSCTransaction({
        userId: customerId,
        tokenType: 'HSC',
        type: 'spend',
        amount: hscRequired,
        description: `Room booking agent earn rate - ${hotelName} (${roomName})`,
        balanceBefore,
        balanceAfter: user.hscBalance,
        paymentDetails: {
          paymentStatus: 'completed'
        }
      });
      await hscTransaction.save();

      // Create Payment Activity
      const paymentActivity = new PaymentActivity({
        userId: customerId,
        buyerEmail: user.email,
        item: `Room Booking Agent Fee - ${hotelName}`,
        quantity: numberOfRooms,
        category: 'Advertisement',
        originalAmount: hscRequired,
        amount: hscRequired,
        discountedAmount: 0,
        paymentMethod: 'HSC',
        status: 'completed'
      });
      await paymentActivity.save();
      paymentActivityId = paymentActivity._id;

      // Create Earnings record for agent
      const earning = new Earning({
        buyerEmail: user.email,
        buyerId: customerId,
        category: 'Promo Codes',
        amount: totalEarnRate,
        usedPromoCode: promocodeUsed,
        usedPromoCodeOwner: agent.email,
        usedPromoCodeOwnerId: agent.userId, // Use agent's userId, not agent's _id
        item: `Room Booking - ${hotelName} (${roomName})`,
        itemType: 'Room Booking',
        status: 'pending' // Will be approved when hotel owner approves booking
      });
      await earning.save();
      earningsRecordId = earning._id;

      hscDeducted = true;
    }

    // Generate booking ID
    const generatedBookingId = `BK${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create booking
    const booking = new RoomBooking({
      bookingId: generatedBookingId,
      hotelId,
      hotelName,
      hotelOwnerId,
      roomId,
      roomName,
      roomType,
      customerId,
      customerName,
      customerNicOrPassport,
      customerContactNumber,
      customerEmail,
      selectedPackage,
      packagePrice,
      checkInDate,
      numberOfDays,
      numberOfAdults,
      numberOfChildren,
      totalPersons,
      numberOfRooms,
      totalAmount,
      discountedAmount: discountedAmount || 0,
      finalAmount,
      promocodeUsed: promocodeUsed || null,
      promocodeOwnerId: promocodeOwnerId || null,
      discountPerRoom: discountPerRoom || 0,
      earnRatePerRoom: earnRatePerRoom || 0,
      totalDiscount,
      totalEarnRate,
      hscPaidForEarnRate: hscDeducted ? (totalEarnRate / (await HSCConfig.findOne().sort({ createdAt: -1 })).hscValue) : 0,
      paymentActivityId,
      earningsRecordId,
      status: 'Pending'
    });
    
    await booking.save();

    // Send email notification to hotel owner
    try {
      const hotelOwner = await User.findById(hotelOwnerId);
      if (hotelOwner && hotelOwner.email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
          to: hotelOwner.email,
          subject: '🔔 New Booking Request Received!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #10b981;">New Booking Request!</h2>
              <p>Dear Hotel Owner,</p>
              <p>You have received a new booking request for your hotel. Please review and respond as soon as possible.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                <p><strong>Hotel:</strong> ${hotelName}</p>
                <p><strong>Room:</strong> ${roomName} (${roomType})</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Contact:</strong> ${customerContactNumber}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Check-in Date:</strong> ${new Date(checkInDate).toLocaleDateString()}</p>
                <p><strong>Package:</strong> ${selectedPackage}</p>
                <p><strong>Duration:</strong> ${numberOfDays} day(s)</p>
                <p><strong>Guests:</strong> ${numberOfAdults} adult(s)${numberOfChildren > 0 ? `, ${numberOfChildren} child(ren)` : ''}</p>
                <p><strong>Number of Rooms:</strong> ${numberOfRooms}</p>
                <p><strong>Total Amount:</strong> LKR ${finalAmount.toLocaleString()}</p>
              </div>
              <p style="background: #fef3c7; padding: 10px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <strong>⚠️ Action Required:</strong> Please log in to your account and review this booking request in the "Client's Requests" tab.
              </p>
              <p>Thank you for your prompt attention!</p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">Holidaysri Team</p>
            </div>
          `
        });
        console.log('Hotel owner notification email sent successfully to:', hotelOwner.email);
      }
    } catch (emailError) {
      console.error('Error sending hotel owner email:', emailError);
    }

    // Send confirmation email to customer
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
        to: customerEmail,
        subject: '✅ Booking Request Submitted Successfully!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Booking Request Submitted!</h2>
            <p>Dear ${customerName},</p>
            <p>Your booking request has been successfully submitted to the hotel. The hotel owner will review your request and respond as soon as possible.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
              <p><strong>Hotel:</strong> ${hotelName}</p>
              <p><strong>Room:</strong> ${roomName} (${roomType})</p>
              <p><strong>Check-in Date:</strong> ${new Date(checkInDate).toLocaleDateString()}</p>
              <p><strong>Package:</strong> ${selectedPackage}</p>
              <p><strong>Duration:</strong> ${numberOfDays} day(s)</p>
              <p><strong>Guests:</strong> ${numberOfAdults} adult(s)${numberOfChildren > 0 ? `, ${numberOfChildren} child(ren)` : ''}</p>
              <p><strong>Number of Rooms:</strong> ${numberOfRooms}</p>
              <p><strong>Total Amount:</strong> LKR ${finalAmount.toLocaleString()}</p>
            </div>
            ${hscDeducted ? `
              <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>💰 Payment Information:</strong></p>
                <p>HSC Amount Paid: ${(totalEarnRate / (await HSCConfig.findOne().sort({ createdAt: -1 })).hscValue).toFixed(2)} HSC</p>
                <p style="font-size: 12px; color: #6b7280;">This amount was paid for the agent commission and will be refunded if the booking is rejected.</p>
              </div>
            ` : ''}
            <p style="background: #e0f2fe; padding: 10px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
              <strong>📌 Note:</strong> You will receive an email notification once the hotel owner approves or rejects your request.
            </p>
            <p>You can track your booking status in the "My Booking Requests" tab on the hotel details page.</p>
            <p>Thank you for choosing Holidaysri!</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">Holidaysri Team</p>
          </div>
        `
      });
      console.log('Customer confirmation email sent successfully to:', customerEmail);
    } catch (emailError) {
      console.error('Error sending customer confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully',
      bookingId: booking.bookingId,
      hscDeducted,
      data: booking
    });
    
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// GET /api/room-bookings/my-bookings - Get user's bookings
router.get('/my-bookings', verifyToken, async (req, res) => {
  try {
    const bookings = await RoomBooking.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('hotelOwnerId', 'name email');
    
    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// GET /api/room-bookings/all-client-requests - Get all hotel owner's client requests across all hotels
router.get('/all-client-requests', verifyToken, async (req, res) => {
  try {
    const bookings = await RoomBooking.find({
      hotelOwnerId: req.user._id
    })
      .sort({ createdAt: -1 })
      .populate('customerId', 'name email contactNumber')
      .populate('promocodeOwnerId', 'userName email promoCode');

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching all client requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client requests',
      error: error.message
    });
  }
});

// GET /api/room-bookings/client-requests/:hotelId - Get hotel owner's client requests for specific hotel
router.get('/client-requests/:hotelId', verifyToken, async (req, res) => {
  try {
    const { hotelId } = req.params;

    const bookings = await RoomBooking.find({
      hotelId,
      hotelOwnerId: req.user._id
    })
      .sort({ createdAt: -1 })
      .populate('customerId', 'name email contactNumber')
      .populate('promocodeOwnerId', 'userName email promoCode');

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching client requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client requests',
      error: error.message
    });
  }
});

// PUT /api/room-bookings/:bookingId/approve - Approve booking
router.put('/:bookingId/approve', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { note } = req.body;

    const booking = await RoomBooking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check ownership
    if (booking.hotelOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this booking'
      });
    }

    // Update booking status
    booking.status = 'Approved';
    booking.ownerNote = note || '';
    booking.approvedAt = new Date();
    await booking.save();

    // If there's an earnings record, mark it as processed
    if (booking.earningsRecordId) {
      await Earning.findByIdAndUpdate(booking.earningsRecordId, {
        status: 'processed',
        processedAt: new Date()
      });
    }

    // Send email to customer
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
        to: booking.customerEmail,
        subject: '✅ Your Room Booking Request Approved!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Booking Approved!</h2>
            <p>Dear ${booking.customerName},</p>
            <p>Great news! Your booking request has been approved.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
              <p><strong>Hotel:</strong> ${booking.hotelName}</p>
              <p><strong>Room:</strong> ${booking.roomName}</p>
              <p><strong>Check-in Date:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
              <p><strong>Final Amount:</strong> LKR ${booking.finalAmount.toLocaleString()}</p>
            </div>
            ${note ? `<p><strong>Note from hotel:</strong> ${note}</p>` : ''}
            <p>Thank you for choosing Holidaysri!</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking approved successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error approving booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve booking',
      error: error.message
    });
  }
});

// PUT /api/room-bookings/:bookingId/reject - Reject booking
router.put('/:bookingId/reject', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { note } = req.body;

    const booking = await RoomBooking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check ownership
    if (booking.hotelOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this booking'
      });
    }

    // Update booking status
    booking.status = 'Rejected';
    booking.ownerNote = note || '';
    booking.rejectedAt = new Date();
    await booking.save();

    // If HSC was paid, refund it
    if (booking.hscPaidForEarnRate > 0) {
      const customer = await User.findById(booking.customerId);
      if (customer) {
        const balanceBefore = customer.hscBalance;
        customer.hscBalance += booking.hscPaidForEarnRate;
        await customer.save();

        // Create HSC Transaction for refund
        const hscTransaction = new HSCTransaction({
          userId: customer._id,
          tokenType: 'HSC',
          type: 'refund',
          amount: booking.hscPaidForEarnRate,
          description: `Refund for rejected booking - ${booking.hotelName} (${booking.roomName})`,
          balanceBefore,
          balanceAfter: customer.hscBalance,
          paymentDetails: {
            paymentStatus: 'completed'
          }
        });
        await hscTransaction.save();
      }
    }

    // Delete earnings record if exists
    if (booking.earningsRecordId) {
      await Earning.findByIdAndDelete(booking.earningsRecordId);

      // Send email to agent - promocodeOwnerId is the agent's _id
      if (booking.promocodeOwnerId) {
        const agent = await Agent.findById(booking.promocodeOwnerId);
        if (agent) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
              to: agent.email,
              subject: '❌ Earning Record Deducted - Booking Rejected',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #ef4444;">Earning Record Deducted</h2>
                  <p>Dear ${agent.userName},</p>
                  <p>We regret to inform you that an earning record has been deducted because the hotel booking request where your promocode was used has been rejected.</p>
                  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                    <p><strong>Hotel:</strong> ${booking.hotelName}</p>
                    <p><strong>Room:</strong> ${booking.roomName}</p>
                    <p><strong>Promocode Used:</strong> ${booking.promocodeUsed}</p>
                    <p><strong>Deducted Amount:</strong> LKR ${booking.totalEarnRate.toLocaleString()}</p>
                  </div>
                  <p>Thank you for your understanding.</p>
                  <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">Holidaysri Team</p>
                </div>
              `
            });
            console.log('Agent notification email sent successfully to:', agent.email);
          } catch (emailError) {
            console.error('Error sending agent email:', emailError);
          }
        } else {
          console.error('Agent not found for promocodeOwnerId:', booking.promocodeOwnerId);
        }
      }
    }

    // Send email to customer
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@holidaysri.com',
        to: booking.customerEmail,
        subject: '❌ Your Room Booking Request Rejected',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">Booking Rejected</h2>
            <p>Dear ${booking.customerName},</p>
            <p>We regret to inform you that your booking request has been rejected.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
              <p><strong>Hotel:</strong> ${booking.hotelName}</p>
              <p><strong>Room:</strong> ${booking.roomName}</p>
            </div>
            ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
            ${booking.hscPaidForEarnRate > 0 ? `
              <div style="background: #10b981; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Refund Processed:</strong></p>
                <p>Your paid HSC amount of ${booking.hscPaidForEarnRate.toFixed(2)} HSC has been refunded to your account.</p>
              </div>
            ` : ''}
            <p>Thank you for your understanding.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking rejected successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error rejecting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: error.message
    });
  }
});

module.exports = router;

