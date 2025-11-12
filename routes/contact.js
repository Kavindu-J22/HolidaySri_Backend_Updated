const express = require('express');
const { sendContactFormEmail } = require('../utils/emailService');

const router = express.Router();

// Submit contact form
router.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, subject, category, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        message: 'Name, email, subject, and message are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address' 
      });
    }

    // Message length validation
    if (message.length < 10) {
      return res.status(400).json({ 
        message: 'Message must be at least 10 characters long' 
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({ 
        message: 'Message must not exceed 5000 characters' 
      });
    }

    // Send email to support
    const emailResult = await sendContactFormEmail({
      name,
      email,
      phone: phone || 'Not provided',
      subject,
      category: category || 'General Inquiry',
      message
    });

    if (!emailResult.success) {
      console.error('Failed to send contact form email:', emailResult.error);
      return res.status(500).json({ 
        message: 'Failed to send your message. Please try again or contact us directly.' 
      });
    }

    res.json({ 
      success: true,
      message: 'Thank you! Your message has been sent successfully. We\'ll get back to you within 24 hours.' 
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ 
      message: 'Server error. Please try again later.' 
    });
  }
});

module.exports = router;

