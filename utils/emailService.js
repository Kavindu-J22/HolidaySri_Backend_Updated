const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Remove any spaces from app password
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email verification OTP
const sendEmailVerificationOTP = async (email, name, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri Tourism',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Email Verification - Holidaysri Tourism',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Holidaysri Tourism</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">Email Verification Required</h2>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Thank you for registering with Holidaysri Tourism! To complete your registration and secure your account, please verify your email address using the OTP below:
          </p>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2563eb; margin: 0 0 10px 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 5px; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">This code expires in 10 minutes</p>
          </div>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            If you didn't create an account with Holidaysri Tourism, please ignore this email.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri Tourism. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, name) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: {
      name: 'Holidaysri Tourism',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Welcome to Holidaysri Tourism!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Welcome to Holidaysri Tourism!</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Congratulations! Your email has been successfully verified and your account is now active.
          </p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            You can now:
          </p>
          
          <ul style="color: #555; line-height: 1.8; margin-bottom: 20px;">
            <li>Browse and book amazing tourism services</li>
            <li>Purchase HSC tokens to publish your own advertisements</li>
            <li>Connect with local guides, hotels, and restaurants</li>
            <li>Discover the beauty of Sri Lanka</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Start Exploring
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri Tourism. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Welcome email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const transporter = createTransporter();

  const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: {
      name: 'Holidaysri Tourism',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Password Reset - Holidaysri Tourism',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Holidaysri Tourism</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your Holidaysri Tourism account. If you didn't make this request, you can safely ignore this email.
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
            To reset your password, click the button below:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Or copy and paste this link into your browser:
          </p>

          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all;">
            <a href="${resetUrl}" style="color: #2563eb; text-decoration: none;">${resetUrl}</a>
          </div>

          <p style="color: #888; font-size: 14px; margin-bottom: 20px;">
            This link will expire in 1 hour for security reasons.
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            If you continue to have problems, please contact our support team.
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri Tourism. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Password reset email sending error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendEmailVerificationOTP,
  sendWelcomeEmail,
  sendPasswordResetEmail
};
