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
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Email Verification - Holidaysri.com',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Holidaysri.com</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">Email Verification Required</h2>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Thank you for registering with Holidaysri.com! To complete your registration and secure your account, please verify your email address using the OTP below:
          </p>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2563eb; margin: 0 0 10px 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 5px; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">This code expires in 10 minutes</p>
          </div>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            If you didn't create an account with Holidaysri.com, please ignore this email.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Welcome to Holidaysri.com!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Welcome to Holidaysri.com!</h1>
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
              © 2024 Holidaysri.com. All rights reserved.
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

  const resetUrl = `https://www.holidaysri.com/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Password Reset - Holidaysri.com',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Holidaysri.com</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your Holidaysri.com account. If you didn't make this request, you can safely ignore this email.
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
              © 2024 Holidaysri.com. All rights reserved.
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

// Send promo code expiration warning email (2 days before)
const sendPromoCodeExpirationWarning = async (email, name, promoCode, promoType, expirationDate) => {
  const transporter = createTransporter();

  const formattedDate = new Date(expirationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '⚠️ Your Promo Code Expires in 2 Days - Take Action Now!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Urgent Notice</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Promo Code is About to Expire!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">⏰ Time is Running Out!</h3>
            <p style="color: #92400e; margin: 0; font-size: 16px;">
              Your <strong>${promoType.toUpperCase()}</strong> promo code <strong>${promoCode}</strong> will expire on <strong>${formattedDate}</strong> - that's just 2 days away!
            </p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Don't lose your agent status and earning potential! Here's what you need to do:
          </p>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">🚀 Take Action Now:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Log in to your agent dashboard</li>
              <li style="margin-bottom: 10px;">Navigate to the renewal section</li>
              <li style="margin-bottom: 10px;">Choose to renew or upgrade your promo code</li>
              <li style="margin-bottom: 10px;">Continue earning commissions without interruption</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Renew My Promo Code Now
            </a>
          </div>

          <div style="background: #fee2e2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #dc2626; margin: 0; font-size: 14px; text-align: center;">
              <strong>Important:</strong> If your promo code expires, it will be automatically deactivated and you won't be able to earn commissions until you renew it.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Expiration warning email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send promo code expired notification email
const sendPromoCodeExpiredNotification = async (email, name, promoCode, promoType) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🔴 Your Promo Code Has Expired - Renew Now to Continue Earning!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔴 Promo Code Expired</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Agent Status is Now Inactive</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0;">❌ Promo Code Deactivated</h3>
            <p style="color: #dc2626; margin: 0; font-size: 16px;">
              Your <strong>${promoType.toUpperCase()}</strong> promo code <strong>${promoCode}</strong> has expired and has been automatically deactivated.
            </p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Don't worry! You can easily renew your promo code and get back to earning commissions right away.
          </p>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">🔄 Renew Your Promo Code:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Visit your agent dashboard</li>
              <li style="margin-bottom: 10px;">Click on "Renew Promo Code"</li>
              <li style="margin-bottom: 10px;">Choose renewal or upgrade option</li>
              <li style="margin-bottom: 10px;">Get back to earning immediately!</li>
            </ul>
          </div>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0;">💡 Why Renew?</h3>
            <ul style="color: #059669; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Continue earning commissions on referrals</li>
              <li style="margin-bottom: 8px;">Keep your agent status active</li>
              <li style="margin-bottom: 8px;">Access exclusive agent benefits</li>
              <li style="margin-bottom: 8px;">Upgrade to higher tiers for better earnings</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Renew My Promo Code
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Expiration notification email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send promo code renewal success email
const sendPromoCodeRenewalSuccess = async (email, name, promoCode, promoType, renewalType, expirationDate) => {
  const transporter = createTransporter();

  const formattedDate = new Date(expirationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isUpgrade = renewalType === 'upgrade';
  const actionText = isUpgrade ? 'Upgraded & Renewed' : 'Renewed';

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `🎉 Promo Code ${actionText} Successfully - You're Back in Business!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Promo Code Has Been ${actionText}!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">✅ ${actionText} Successfully!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Your <strong>${promoType.toUpperCase()}</strong> promo code <strong>${promoCode}</strong> has been ${isUpgrade ? 'upgraded and' : ''} renewed successfully!
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">📋 Renewal Details:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>Promo Code:</strong> ${promoCode}</li>
              <li style="margin-bottom: 8px;"><strong>Tier:</strong> ${promoType.toUpperCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Status:</strong> Active & Earning</li>
              <li style="margin-bottom: 8px;"><strong>Valid Until:</strong> ${formattedDate}</li>
              ${isUpgrade ? `<li style="margin-bottom: 8px;"><strong>Action:</strong> Upgraded & Renewed</li>` : `<li style="margin-bottom: 8px;"><strong>Action:</strong> Renewed</li>`}
            </ul>
          </div>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0;">🚀 You're Ready to Earn Again!</h3>
            <ul style="color: #059669; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Your promo code is now active for another full year</li>
              <li style="margin-bottom: 8px;">Start sharing your code and earning commissions immediately</li>
              <li style="margin-bottom: 8px;">Access your agent dashboard to track your progress</li>
              <li style="margin-bottom: 8px;">Enjoy all the benefits of being an active agent</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              View My Dashboard
            </a>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px; text-align: center;">
              <strong>Pro Tip:</strong> Share your promo code with friends and family to maximize your earnings. The more people use your code, the more you earn!
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Renewal success email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send promo code sold notification to seller
const sendPromoCodeSoldNotification = async (sellerEmail, sellerName, promoCodeDetails, buyerDetails, earnedAmount, earnedAmountLKR) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: sellerEmail,
    subject: '🎉 Great News! Your Promo Code Has Been Sold!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Promo Code Has Been Sold!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${sellerName},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">💰 Sale Completed Successfully!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Your <strong>${promoCodeDetails.promoCodeType.toUpperCase()}</strong> promo code has been purchased and you've earned <strong>${earnedAmount} HSC (≈ ${earnedAmountLKR.toLocaleString()} LKR)</strong>!
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">📋 Sale Details:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>Promo Code:</strong> ${promoCodeDetails.promoCode}</li>
              <li style="margin-bottom: 8px;"><strong>Type:</strong> ${promoCodeDetails.promoCodeType.toUpperCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Sale Price:</strong> ${promoCodeDetails.sellingPrice} HSC</li>
              <li style="margin-bottom: 8px;"><strong>LKR Equivalent:</strong> ${promoCodeDetails.sellingPriceLKR.toLocaleString()} LKR</li>
              <li style="margin-bottom: 8px;"><strong>Sale Date:</strong> ${formattedDate}</li>
            </ul>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">👤 Buyer Information:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>Buyer Name:</strong> ${buyerDetails.buyerName}</li>
              <li style="margin-bottom: 8px;"><strong>Email:</strong> ${buyerDetails.buyerEmail}</li>
              <li style="margin-bottom: 8px;"><strong>Purchase Date:</strong> ${formattedDate}</li>
            </ul>
          </div>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0;">💡 What Happens Next?</h3>
            <ul style="color: #059669; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Your earnings have been recorded in your HSC account</li>
              <li style="margin-bottom: 8px;">The promo code ownership has been transferred to the buyer</li>
              <li style="margin-bottom: 8px;">You can view your earnings in your dashboard</li>
              <li style="margin-bottom: 8px;">Consider listing more promo codes for additional income</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              View My Dashboard
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Promo code sold notification email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send promo code purchase success notification to buyer
const sendPromoCodePurchaseSuccess = async (buyerEmail, buyerName, promoCodeDetails, paidAmount, paidAmountLKR) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: buyerEmail,
    subject: '🎉 Welcome to Our Agent Network! Your Promo Code Purchase is Complete',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome Agent!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You're Now Part of Our Agent Network!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${buyerName},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">✅ Purchase Successful!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Congratulations! You have successfully purchased a <strong>${promoCodeDetails.promoCodeType.toUpperCase()}</strong> promo code and are now an official agent with Holidaysri.com!
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">📋 Purchase Details:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>Your Promo Code:</strong> ${promoCodeDetails.promoCode}</li>
              <li style="margin-bottom: 8px;"><strong>Type:</strong> ${promoCodeDetails.promoCodeType.toUpperCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Amount Paid:</strong> ${paidAmount} HSC</li>
              <li style="margin-bottom: 8px;"><strong>LKR Equivalent:</strong> ${paidAmountLKR.toLocaleString()} LKR</li>
              <li style="margin-bottom: 8px;"><strong>Purchase Date:</strong> ${formattedDate}</li>
              <li style="margin-bottom: 8px;"><strong>Status:</strong> Active & Ready to Use</li>
            </ul>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">🚀 As Our New Agent, You Can:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Share your promo code and earn referral commissions</li>
              <li style="margin-bottom: 8px;">Access exclusive agent benefits and discounts</li>
              <li style="margin-bottom: 8px;">Track your earnings in real-time through your dashboard</li>
              <li style="margin-bottom: 8px;">Build your network and increase your income potential</li>
            </ul>
          </div>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0;">📈 Start Earning Today:</h3>
            <ul style="color: #059669; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Visit your agent dashboard to get started</li>
              <li style="margin-bottom: 8px;">Share your promo code with friends and family</li>
              <li style="margin-bottom: 8px;">Monitor your referrals and earnings</li>
              <li style="margin-bottom: 8px;">Explore additional earning opportunities</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Access My Agent Dashboard
            </a>
          </div>

          <div style="background: #dbeafe; border: 1px solid #93c5fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #1e40af; margin: 0; font-size: 14px; text-align: center;">
              <strong>Pro Tip:</strong> The more you share your promo code, the more you earn! Start building your network today and watch your income grow.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Promo code purchase success email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send HSC earned claim approval notification email
const sendHSCEarnedClaimApprovalEmail = async (email, name, hscAmount, lkrAmount) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'HSC Earned Claim Approved - Bank Transfer Completed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
          <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <div style="color: white; font-size: 36px; font-weight: bold;">✓</div>
          </div>
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
            HSC Earned Claim Approved!
          </h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
            Your bank transfer has been completed successfully
          </p>
        </div>

        <div style="background-color: white; padding: 40px 30px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Dear ${name},
          </p>

          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Great news! Your HSC earned claim has been approved and the bank transfer has been completed successfully.
          </p>

          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
            <div style="color: white; font-size: 32px; font-weight: bold; margin-bottom: 8px;">
              ${lkrAmount.toLocaleString()} LKR
            </div>
            <div style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin-bottom: 15px;">
              (${hscAmount.toLocaleString()} HSC converted)
            </div>
            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; display: inline-block;">
              <div style="color: white; font-size: 14px; font-weight: 500;">
                Transfer Date: ${formattedDate}
              </div>
            </div>
          </div>

          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">
              What happens next?
            </h3>
            <ul style="color: #6b7280; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li style="margin-bottom: 8px;">The amount has been transferred to your registered bank account</li>
              <li style="margin-bottom: 8px;">Please allow 1-3 business days for the transfer to reflect in your account</li>
              <li style="margin-bottom: 8px;">Your HSC earned records have been updated to "Paid as LKR" status</li>
              <li>You can continue earning more HSC through our platform activities</li>
            </ul>
          </div>

          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
              <strong>Note:</strong> If you don't see the transfer in your account within 3 business days,
              please contact our support team with your claim reference.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/hsc-earnings-claim"
               style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; display: inline-block; transition: all 0.3s ease;">
              View HSC Earnings
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
            Thank you for being a valued member of the Holidaysri.com community.
            Keep earning and growing with us!
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('HSC earned claim approval email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send membership purchase success email
const sendMembershipPurchaseEmail = async (email, name, membershipType, startDate, expirationDate, features) => {
  const transporter = createTransporter();

  const formattedStartDate = startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedExpirationDate = expirationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const featuresList = features.map(feature => `<li style="margin: 8px 0; color: #555;">${feature}</li>`).join('');

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `🎉 Welcome to Holidaysri Membership - ${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Plan Activated!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🎉 Welcome to Holidaysri Membership!</h1>
            <p style="color: #666; margin: 5px 0;">Premium Benefits Activated</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">✅ Membership Activated</h2>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Plan</p>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Valid until ${formattedExpirationDate}</p>
          </div>

          <h3 style="color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Your Premium Benefits</h3>
          <ul style="padding-left: 20px; margin: 15px 0;">
            ${featuresList}
          </ul>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="color: #495057; margin: 0 0 10px 0;">Membership Details</h4>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)}</p>
            <p style="margin: 5px 0;"><strong>Start Date:</strong> ${formattedStartDate}</p>
            <p style="margin: 5px 0;"><strong>Expiration Date:</strong> ${formattedExpirationDate}</p>
          </div>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
            <p style="margin: 0; color: #1565c0;"><strong>What's Next?</strong> Start enjoying your premium benefits immediately! Your advertisements will now appear in Featured Ads and you'll have enhanced visibility across the platform.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6c757d; margin: 0;">Thank you for choosing</p>
            <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
            <p style="color: #6c757d; margin: 0; font-size: 14px;">Your trusted travel platform</p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Membership purchase email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send membership expiration warning email
const sendMembershipExpirationWarning = async (email, name, membershipType, expirationDate) => {
  const transporter = createTransporter();

  const formattedExpirationDate = expirationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const daysLeft = Math.ceil((expirationDate - new Date()) / (1000 * 60 * 60 * 24));

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `⚠️ Membership Expiring Soon - ${daysLeft} Days Left | Holidaysri`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0;">⚠️ Membership Expiring Soon</h1>
            <p style="color: #666; margin: 5px 0;">Don't lose your premium benefits</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">⏰ ${daysLeft} Days Left</h2>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">Your ${membershipType} membership expires on</p>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 16px;">${formattedExpirationDate}</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Your Holidaysri membership is about to expire. Don't miss out on your premium benefits including featured ads, enhanced visibility, and priority support.
          </p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Renew Now</strong> to continue enjoying all premium benefits without interruption.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6c757d; margin: 0;">Thank you for being a valued member of</p>
            <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Membership expiration warning email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send membership expired email
const sendMembershipExpiredEmail = async (email, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `❌ Membership Expired - Renew to Restore Benefits | Holidaysri`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">❌ Membership Expired</h1>
            <p style="color: #666; margin: 5px 0;">Your premium benefits have been suspended</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">Membership Expired</h2>
            <p style="margin: 0; font-size: 16px; opacity: 0.9;">Your premium benefits are no longer active</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Your Holidaysri membership has expired. You can still use our platform, but premium features like featured ads and enhanced visibility are no longer available.
          </p>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
            <p style="margin: 0; color: #1565c0;"><strong>Renew Today</strong> to restore all your premium benefits and continue growing your business with enhanced visibility.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6c757d; margin: 0;">We'd love to have you back as a member of</p>
            <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Membership expired email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send commercial partner welcome email
const sendCommercialPartnerWelcomeEmail = async (email, name, partnerDetails) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const expirationDate = new Date(partnerDetails.expirationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🎉 Welcome to Holidaysri Commercial Partnership!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome Commercial Partner!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You're Now a Holidaysri Commercial Partner!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">✅ Partnership Activated!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Congratulations! Your commercial partnership with Holidaysri.com is now active. Welcome to our exclusive business network!
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">📋 Partnership Details:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>Company:</strong> ${partnerDetails.companyName}</li>
              <li style="margin-bottom: 8px;"><strong>Partnership Type:</strong> ${partnerDetails.partnershipType.charAt(0).toUpperCase() + partnerDetails.partnershipType.slice(1)}</li>
              <li style="margin-bottom: 8px;"><strong>Start Date:</strong> ${formattedDate}</li>
              <li style="margin-bottom: 8px;"><strong>Valid Until:</strong> ${expirationDate}</li>
              <li style="margin-bottom: 8px;"><strong>Status:</strong> Active</li>
            </ul>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">🚀 Your Commercial Partner Benefits:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              ${partnerDetails.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
            </ul>
          </div>

          <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #0277bd; margin: 0 0 15px 0;">📞 Next Steps:</h3>
            <ul style="color: #0277bd; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Log in to your account to access partner features</li>
              <li style="margin-bottom: 8px;">Update your business logo anytime from your partner dashboard</li>
              <li style="margin-bottom: 8px;">Start enjoying enhanced visibility for your advertisements</li>
              <li style="margin-bottom: 8px;">Access exclusive business tools and analytics</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/ads/opportunities/partnerships"
               style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Access Partner Dashboard
            </a>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Thank you for choosing Holidaysri.com as your business partner. We're excited to help grow your business!
          </p>

          <p style="color: #555; line-height: 1.6;">
            Best regards,<br>
            <strong>The Holidaysri.com Team</strong>
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Commercial partner welcome email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send commercial partner expiration warning email
const sendCommercialPartnerExpirationWarning = async (email, name, partnerDetails) => {
  const transporter = createTransporter();

  const expirationDate = new Date(partnerDetails.expirationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '⚠️ Your Commercial Partnership is Expiring Soon',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Partnership Expiring</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Don't Lose Your Commercial Benefits!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Partnership Expiring Soon</h3>
            <p style="color: #92400e; margin: 0; font-size: 16px;">
              Your commercial partnership for <strong>${partnerDetails.companyName}</strong> will expire on <strong>${expirationDate}</strong>.
            </p>
          </div>

          <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #0277bd; margin: 0 0 15px 0;">🔄 Renew Your Partnership</h3>
            <p style="color: #0277bd; margin: 0 0 15px 0;">
              Don't lose access to your exclusive commercial partner benefits. Renew your partnership today to continue enjoying:
            </p>
            <ul style="color: #0277bd; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Enhanced advertisement visibility</li>
              <li style="margin-bottom: 8px;">Priority customer support</li>
              <li style="margin-bottom: 8px;">Access to exclusive business tools</li>
              <li style="margin-bottom: 8px;">Premium listing features</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/ads/opportunities/partnerships"
               style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Renew Partnership Now
            </a>
          </div>

          <p style="color: #555; line-height: 1.6;">
            Best regards,<br>
            <strong>The Holidaysri.com Team</strong>
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Commercial partner expiration warning email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send commercial partner expired email
const sendCommercialPartnerExpiredEmail = async (email, name, partnerDetails) => {
  const transporter = createTransporter();

  const expirationDate = new Date(partnerDetails.expirationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '❌ Your Commercial Partnership has Expired',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">❌ Partnership Expired</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Renew to Restore Your Benefits</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0;">❌ Partnership Expired</h3>
            <p style="color: #dc2626; margin: 0; font-size: 16px;">
              Your commercial partnership for <strong>${partnerDetails.companyName}</strong> expired on <strong>${expirationDate}</strong>.
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">🔄 Renew Your Partnership</h3>
            <p style="color: #1e40af; margin: 0 0 15px 0;">
              You can renew your partnership anytime to restore all your commercial benefits and continue growing your business with us.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/ads/opportunities/partnerships"
               style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Renew Partnership
            </a>
          </div>

          <p style="color: #555; line-height: 1.6;">
            Best regards,<br>
            <strong>The Holidaysri.com Team</strong>
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Commercial partner expired email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send newsletter subscription confirmation email
const sendNewsletterSubscriptionConfirmation = async (email) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🎉 Welcome to Holidaysri Newsletter!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Thank You for Subscribing!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Welcome to the Holidaysri family!</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Welcome to Our Newsletter!</h2>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Thank you for subscribing to the Holidaysri.com newsletter! We're excited to have you join our community of travel enthusiasts.
          </p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What to Expect:</h3>
            <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
              <li>🏝️ Exclusive travel destinations and hidden gems in Sri Lanka</li>
              <li>🎯 Special offers and discounts on tours and packages</li>
              <li>📅 Updates on upcoming events and festivals</li>
              <li>💡 Travel tips and insider recommendations</li>
              <li>📰 Latest tourism news and updates</li>
              <li>💡 And more Earning opportunities</li>
            </ul>
          </div>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            We promise to send you only valuable content and respect your inbox. You can update your preferences or unsubscribe at any time.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://holidaysri.com" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Explore Holidaysri
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">
              You received this email because you subscribed to our newsletter.
              <a href="#" style="color: #10b981;">Unsubscribe</a> |
              <a href="#" style="color: #10b981;">Update Preferences</a>
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
    console.error('Newsletter confirmation email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send custom newsletter email
const sendNewsletterEmail = async (email, subject, htmlBody) => {
  const transporter = createTransporter();

  // Process the HTML body to ensure proper formatting and link styling
  let processedHtmlBody = htmlBody.replace(/\n/g, '<br>'); // Convert line breaks to HTML breaks

  // Enhanced link processing - handle all possible link formats
  // This approach ensures all links get proper styling regardless of their original format
  console.log('🔗 Processing email body for links...');
  console.log('Original body:', htmlBody);

  processedHtmlBody = processedHtmlBody.replace(
    /<a\s+[^>]*?href\s*=\s*["']([^"']*?)["'][^>]*?>([^<]*?)<\/a>/gi,
    '<a href="$1" style="color: #10b981 !important; text-decoration: none !important; font-weight: bold !important; border-bottom: 1px solid #10b981 !important; padding-bottom: 1px !important; display: inline-block !important; margin: 2px 0 !important;">$2</a>'
  );

  console.log('Processed body:', processedHtmlBody);
  console.log('🔗 Link processing completed.');

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <img src="https://res.cloudinary.com/dqdcmluxj/image/upload/v1752712704/4_xi6zj7.png" alt="Holidaysri" style="height: 40px; margin-bottom: 10px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Holidaysri.com</h1>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="color: #333; line-height: 1.6; font-size: 16px;">
            ${processedHtmlBody}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">
              You received this email because you subscribed to our newsletter.
              <a href="#" style="color: #10b981; text-decoration: none;">Unsubscribe</a> |
              <a href="#" style="color: #10b981; text-decoration: none;">Update Preferences</a>
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
    console.error('Newsletter email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send advertisement purchase success email
const sendAdvertisementPurchaseEmail = async (user, advertisementData) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const expirationDate = new Date(advertisementData.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Format plan duration display
  let planDurationText = '';
  if (advertisementData.selectedPlan === 'hourly') {
    planDurationText = `${advertisementData.planDuration.hours || 1} hour${(advertisementData.planDuration.hours || 1) > 1 ? 's' : ''}`;
  } else if (advertisementData.selectedPlan === 'daily') {
    planDurationText = `${advertisementData.planDuration.days || 1} day${(advertisementData.planDuration.days || 1) > 1 ? 's' : ''}`;
  } else if (advertisementData.selectedPlan === 'monthly') {
    planDurationText = '30 days (1 month)';
  } else if (advertisementData.selectedPlan === 'yearly') {
    planDurationText = '365 days (1 year)';
  }

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '🎉 Advertisement Purchase Successful - Your Ad is Now Live!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Advertisement Active!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Advertisement is Now Live!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${user.name},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">✅ Purchase Successful!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Congratulations! Your <strong>${advertisementData.categoryName}</strong> advertisement has been successfully purchased and is now active on our platform.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">📋 Advertisement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Category:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.categoryName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Plan:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.selectedPlan.charAt(0).toUpperCase() + advertisementData.selectedPlan.slice(1)} (${planDurationText})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Payment Method:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Transaction ID:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Purchase Date:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Expires On:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600;">${expirationDate}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">💰 Payment Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #92400e;">Original Amount:</td>
                <td style="padding: 8px 0; color: #92400e; font-weight: 600; text-align: right;">${advertisementData.originalAmount} ${advertisementData.paymentMethod}</td>
              </tr>
              ${advertisementData.discountAmount > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #059669;">Discount Applied:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: 600; text-align: right;">-${advertisementData.discountAmount} ${advertisementData.paymentMethod}</td>
              </tr>
              ${advertisementData.usedPromoCode ? `
              <tr>
                <td style="padding: 8px 0; color: #059669; font-size: 14px;">Promo Code Used:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: 600; text-align: right; font-size: 14px;">${advertisementData.usedPromoCode}</td>
              </tr>
              ` : ''}
              ` : ''}
              <tr style="border-top: 2px solid #92400e;">
                <td style="padding: 12px 0 8px 0; color: #92400e; font-weight: 700; font-size: 16px;">Total Paid:</td>
                <td style="padding: 12px 0 8px 0; color: #92400e; font-weight: 700; text-align: right; font-size: 16px;">${advertisementData.finalAmount} ${advertisementData.paymentMethod}</td>
              </tr>
            </table>
          </div>

          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #1d4ed8; margin: 0 0 10px 0;">📈 What's Next?</h3>
            <ul style="color: #1d4ed8; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Your advertisement is now live and visible to visitors</li>
              <li style="margin: 8px 0;">Monitor your advertisement performance in your profile</li>
              <li style="margin: 8px 0;">Track engagement metrics and reach</li>
              <li style="margin: 8px 0;">Renew before expiration to maintain visibility</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View My Advertisements
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>Need Help?</strong><br>
              If you have any questions about your advertisement or need assistance, please contact our support team at support@holidaysri.com or visit our help center.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.<br>
              This email was sent regarding your advertisement purchase on ${formattedDate}.
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
    console.error('Advertisement purchase email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send token gift congratulations email
const sendTokenGiftEmail = async (email, name, tokenType, amount, adminMessage, newBalance) => {
  const transporter = createTransporter();

  // Token specific configurations
  const tokenConfig = {
    HSC: {
      name: 'HSC Tokens',
      fullName: 'Holidaysri Coins',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      icon: '🪙',
      description: 'Use these tokens to publish advertisements and promote your tourism services!'
    },
    HSG: {
      name: 'HSG Gems',
      fullName: 'Holidaysri Gems',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      icon: '💎',
      description: 'Special gift tokens to help you get started with advertising!'
    },
    HSD: {
      name: 'HSD Diamonds',
      fullName: 'Holidaysri Diamonds',
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      icon: '💍',
      description: 'Premium reward tokens for our valued users!'
    }
  };

  const config = tokenConfig[tokenType] || tokenConfig.HSC;

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `🎉 Congratulations! You've Received ${amount} ${config.name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: ${config.gradient}; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
              <div style="font-size: 48px; margin-bottom: 10px;">${config.icon}</div>
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You've received ${config.name}!</p>
            </div>
          </div>

          <!-- Greeting -->
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
            Dear ${name},
          </p>

          <!-- Gift Details -->
          <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 25px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid ${config.color};">
            <div style="text-align: center;">
              <div style="font-size: 36px; color: ${config.color}; font-weight: bold; margin-bottom: 10px;">
                +${amount.toLocaleString()} ${tokenType}
              </div>
              <p style="color: #666; margin: 0; font-size: 14px;">
                ${config.fullName} added to your wallet
              </p>
              <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 5px;">
                <p style="margin: 0; color: #555; font-size: 14px;">
                  <strong>New Balance:</strong> ${newBalance.toLocaleString()} ${tokenType}
                </p>
              </div>
            </div>
          </div>

          <!-- Admin Message -->
          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
            <div style="display: flex; align-items: flex-start;">
              <div style="font-size: 20px; margin-right: 10px;">💌</div>
              <div>
                <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">Message from Admin:</h3>
                <p style="color: #78350f; margin: 0; line-height: 1.6; font-style: italic;">
                  "${adminMessage}"
                </p>
              </div>
            </div>
          </div>

          <!-- Token Usage Info -->
          <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #22c55e;">
            <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 16px;">
              ${config.icon} How to Use Your ${config.name}:
            </h3>
            <p style="color: #166534; margin: 0 0 10px 0; line-height: 1.6;">
              ${config.description}
            </p>
            <ul style="color: #166534; margin: 10px 0; padding-left: 20px;">
              <li>Visit your wallet to see your updated balance</li>
              <li>Use tokens when creating advertisements</li>
              <li>Check our platform for the latest token values</li>
            </ul>
          </div>

          <!-- Call to Action -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/hsc"
               style="display: inline-block; background: ${config.gradient}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              View My Wallet ${config.icon}
            </a>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Token gift email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Export all functions including the newsletter ones
// Send advertisement expiration warning email
const sendAdvertisementExpiringWarning = async (email, name, slotId, categoryName, expirationDate) => {
  const transporter = createTransporter();

  const formattedExpirationDate = expirationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedExpirationTime = expirationDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const hoursLeft = Math.ceil((expirationDate - new Date()) / (1000 * 60 * 60));

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `⚠️ Advertisement Expiring Soon - ${hoursLeft}h Left | ${slotId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0;">⚠️ Advertisement Expiring Soon</h1>
            <p style="color: #666; margin: 5px 0;">Take action to prevent expiration</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">⏰ ${hoursLeft} Hours Left</h2>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">Your ${categoryName} advertisement slot</p>
            <p style="margin: 5px 0; opacity: 0.9; font-size: 16px; font-family: monospace;">${slotId}</p>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Expires on ${formattedExpirationDate} at ${formattedExpirationTime}</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Your advertisement slot is about to expire. To prevent losing your slot, you can:
          </p>

          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
            <h3 style="margin: 0 0 10px 0; color: #1976d2;">💡 Available Actions:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #1565c0;">
              <li style="margin-bottom: 8px;"><strong>Pause Expiration:</strong> Stop the countdown and publish later</li>
              <li style="margin-bottom: 8px;"><strong>Renew Slot:</strong> Extend your advertisement duration</li>
              <li><strong>Publish Now:</strong> If you're ready to go live</li>
            </ul>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> Once expired, you'll need to purchase a new slot to advertise in this category.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6c757d; margin: 0;">Manage your advertisements at</p>
            <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Advertisement expiration warning email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send advertisement expired email
const sendAdvertisementExpiredEmail = async (email, name, slotId, categoryName, expiredDate) => {
  const transporter = createTransporter();

  const formattedExpiredDate = expiredDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedExpiredTime = expiredDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `❌ Advertisement Expired - Action Required | ${slotId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">❌ Advertisement Expired</h1>
            <p style="color: #666; margin: 5px 0;">Your slot is no longer active</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">⏰ Slot Expired</h2>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">Your ${categoryName} advertisement slot</p>
            <p style="margin: 5px 0; opacity: 0.9; font-size: 16px; font-family: monospace;">${slotId}</p>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Expired on ${formattedExpiredDate} at ${formattedExpiredTime}</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Your advertisement slot has expired and is no longer active on our platform. Don't worry - you can easily renew this slot to continue advertising your business.
          </p>

          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin: 0 0 10px 0; color: #dc2626;">🔄 Renew Your Slot</h3>
            <p style="margin: 0; color: #991b1b;">
              Click the <strong>"Expired Slot Renew Now"</strong> button in your dashboard to reactivate this advertisement slot and continue reaching your target audience.
            </p>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
            <h3 style="margin: 0 0 10px 0; color: #0369a1;">💡 Why Renew?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #075985;">
              <li style="margin-bottom: 8px;">Continue advertising in the ${categoryName} category</li>
              <li style="margin-bottom: 8px;">Maintain your business visibility on Holidaysri</li>
              <li>Keep attracting potential customers to your services</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6c757d; margin: 0;">Manage your advertisements at</p>
            <h3 style="color: #495057; margin: 10px 0;">🏝️ Holidaysri</h3>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Advertisement expired email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send advertisement renewal success email
const sendAdvertisementRenewalEmail = async (user, advertisementData) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const expirationDate = new Date(advertisementData.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Format plan duration display
  let planDurationText = '';
  if (advertisementData.selectedPlan === 'hourly') {
    planDurationText = `${advertisementData.planDuration.hours || 1} hour${(advertisementData.planDuration.hours || 1) > 1 ? 's' : ''}`;
  } else if (advertisementData.selectedPlan === 'daily') {
    planDurationText = `${advertisementData.planDuration.days || 1} day${(advertisementData.planDuration.days || 1) > 1 ? 's' : ''}`;
  } else if (advertisementData.selectedPlan === 'monthly') {
    planDurationText = '30 days (1 month)';
  } else if (advertisementData.selectedPlan === 'yearly') {
    planDurationText = '365 days (1 year)';
  }

  const isExpiredRenewal = advertisementData.renewalType === 'expired';
  const renewalTypeText = isExpiredRenewal ? 'Expired Slot Renewal' : 'Advertisement Renewal';

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '🔄 Advertisement Renewal Successful - Your Ad is Extended!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔄 Renewal Successful!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Advertisement has been Extended!</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${user.name},
          </p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #059669; margin: 0 0 10px 0;">✅ Renewal Successful!</h3>
            <p style="color: #059669; margin: 0; font-size: 16px;">
              Great news! Your <strong>${advertisementData.categoryName}</strong> advertisement has been successfully ${isExpiredRenewal ? 'reactivated and' : ''} renewed. ${isExpiredRenewal ? 'Your expired slot is now active again!' : 'Your advertisement duration has been extended!'}
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">📋 Renewal Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Category:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.categoryName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Renewal Type:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${renewalTypeText}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Plan:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.selectedPlan.charAt(0).toUpperCase() + advertisementData.selectedPlan.slice(1)} (${planDurationText})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Payment Method:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Transaction ID:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${advertisementData.transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Renewal Date:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">New Expiration:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 600;">${expirationDate}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">💰 Payment Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #92400e;">Original Amount:</td>
                <td style="padding: 8px 0; color: #92400e; font-weight: 600; text-align: right;">${advertisementData.originalAmount} ${advertisementData.paymentMethod}</td>
              </tr>
              ${advertisementData.discountAmount > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #059669;">Discount Applied:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: 600; text-align: right;">-${advertisementData.discountAmount} ${advertisementData.paymentMethod}</td>
              </tr>
              ${advertisementData.usedPromoCode ? `
              <tr>
                <td style="padding: 8px 0; color: #059669; font-size: 14px;">Promo Code Used:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: 600; text-align: right; font-size: 14px;">${advertisementData.usedPromoCode}</td>
              </tr>
              ` : ''}
              ` : ''}
              <tr style="border-top: 2px solid #92400e;">
                <td style="padding: 12px 0 8px 0; color: #92400e; font-weight: 700; font-size: 16px;">Total Paid:</td>
                <td style="padding: 12px 0 8px 0; color: #92400e; font-weight: 700; text-align: right; font-size: 16px;">${advertisementData.finalAmount} ${advertisementData.paymentMethod}</td>
              </tr>
            </table>
          </div>

          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #1d4ed8; margin: 0 0 10px 0;">📈 What's Next?</h3>
            <ul style="color: #1d4ed8; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Your advertisement is ${isExpiredRenewal ? 'now active again and' : 'still'} visible to visitors</li>
              <li style="margin: 8px 0;">Continue monitoring your advertisement performance</li>
              <li style="margin: 8px 0;">Track engagement metrics and reach</li>
              <li style="margin: 8px 0;">Set reminders to renew before the new expiration date</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View My Advertisements
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>Need Help?</strong><br>
              If you have any questions about your advertisement renewal or need assistance, please contact our support team at support@holidaysri.com or visit our help center.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.<br>
              This email was sent regarding your advertisement renewal on ${formattedDate}.
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
    console.error('Advertisement renewal email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send customize tour partner notification email
const sendCustomizeTourPartnerNotification = async (email, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🎯 New Customize Tour Request Available - Partner Opportunity!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #f97316, #fb923c); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎯 New Tour Request!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Partner Opportunity Available</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #ea580c; margin: 0 0 10px 0;">🌟 New Opportunity!</h3>
            <p style="color: #ea580c; margin: 0; font-size: 16px;">
              A new customize tour package request has been made available for commercial partners. Check the CUSTOMIZE YOUR SRI LANKAN ADVENTURE page to view and approve this request!
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">📋 What You Can Do</h3>
            <ul style="color: #6b7280; margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li style="margin: 8px 0;">View detailed tour customization requests</li>
              <li style="margin: 8px 0;">Review customer requirements and preferences</li>
              <li style="margin: 8px 0;">Approve requests that match your services</li>
              <li style="margin: 8px 0;">Connect with potential customers</li>
            </ul>
          </div>

          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #1d4ed8; margin: 0 0 10px 0;">💡 How to Access</h3>
            <ol style="color: #1d4ed8; margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li style="margin: 8px 0;">Log in to your Holidaysri.com account</li>
              <li style="margin: 8px 0;">Navigate to <strong>Tourism And Travel → Customize Tour Package</strong></li>
              <li style="margin: 8px 0;">Click on the <strong>"Partner Requests"</strong> tab</li>
              <li style="margin: 8px 0;">Review and approve requests that interest you</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/customize-tour-package" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Customize Requests
            </a>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
              <strong>⚡ Act Fast!</strong> Other partners can also view and approve these requests. Be the first to connect with potential customers!
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>Need Help?</strong><br>
              If you have any questions about the customize tour requests or need assistance, please contact our support team at support@holidaysri.com
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This email was sent to you as an active commercial partner.
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
    console.error('Customize tour partner notification email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send customize event request notification to partners & members
const sendCustomizeEventPartnerNotification = async (email, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🎉 New Customize Event Request Available!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Event Request!</h1>
        </div>

        <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hello <strong>${name}</strong>,
          </p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Great news! A new <strong>Customize Event Request</strong> is now available for partners and members to review.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.6;">
              <strong>📋 What to do next:</strong><br>
              Visit the <strong>Customize Your Event</strong> page and check the <strong>Open Requests</strong> tab to view the details and approve the request if you're interested.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/ads/events-management/customize-event"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              View Open Requests
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
            As a valued partner/member, you have exclusive access to these event requests. Don't miss this opportunity!
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
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
    console.error('Customize event partner notification email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send email to partner when they approve a customize tour package request
const sendTourPackageApprovalConfirmation = async (email, name, requestDetails) => {
  const transporter = createTransporter();

  const activitiesList = requestDetails.activities && requestDetails.activities.length > 0
    ? requestDetails.activities.map(activity => `<li style="margin: 5px 0;">${activity}</li>`).join('')
    : '<li style="margin: 5px 0;">No specific activities selected</li>';

  const accommodationDisplay = requestDetails.accommodation === 'other'
    ? requestDetails.accommodationOther
    : requestDetails.accommodation.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formattedStartDate = new Date(requestDetails.startDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '✅ Successfully Accepted Customize Tour Request | Holidaysri',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
        <div style="background: white; border-radius: 15px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px;">✅</span>
            </div>
            <h1 style="color: #2d3748; margin: 0; font-size: 28px; font-weight: 700;">
              Request Accepted Successfully!
            </h1>
            <p style="color: #718096; margin: 10px 0 0 0; font-size: 16px;">
              You have successfully accepted a customize tour request
            </p>
          </div>

          <!-- Greeting -->
          <div style="margin-bottom: 30px;">
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0;">
              Dear <strong>${name}</strong>,
            </p>
            <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 15px 0 0 0;">
              Congratulations! You have successfully accepted a customize tour package request. The customer will be notified with your contact details.
            </p>
          </div>

          <!-- Request Details Card -->
          <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-left: 4px solid #667eea; border-radius: 10px; padding: 25px; margin: 25px 0;">
            <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
              📋 Tour Request Details
            </h2>

            <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                👤 Customer Information
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 40%;">Full Name:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${requestDetails.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px;">Email:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${requestDetails.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px;">Contact Number:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${requestDetails.contactNumber}</td>
                </tr>
              </table>
            </div>

            <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                ✈️ Travel Details
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 40%;">Start Date:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${formattedStartDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px;">Number of Travelers:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${requestDetails.numberOfTravelers} ${requestDetails.numberOfTravelers === 1 ? 'person' : 'people'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px;">Duration:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${requestDetails.duration} ${requestDetails.duration === 1 ? 'day' : 'days'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 14px;">Accommodation:</td>
                  <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600;">${accommodationDisplay}</td>
                </tr>
              </table>
            </div>

            <div style="background: white; border-radius: 8px; padding: 20px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                🎯 Activities & Preferences
              </h3>
              <ul style="margin: 10px 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                ${activitiesList}
              </ul>
              ${requestDetails.specialRequests ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                  <p style="color: #718096; font-size: 13px; margin: 0 0 5px 0; font-weight: 600;">Special Requests:</p>
                  <p style="color: #4a5568; font-size: 14px; margin: 0; line-height: 1.6; font-style: italic;">${requestDetails.specialRequests}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Next Steps -->
          <div style="background: #fff5f5; border-left: 4px solid #f56565; border-radius: 10px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #c53030; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
              📌 Next Steps
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #742a2a; font-size: 14px; line-height: 1.8;">
              <li>The customer has been notified with your contact information</li>
              <li>They will reach out to you directly to discuss the tour details</li>
              <li>Please respond promptly to provide the best customer experience</li>
              <li>Prepare a customized tour package based on their requirements</li>
            </ul>
          </div>

          <!-- Support Section -->
          <div style="background: #f7fafc; border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #4a5568; font-size: 14px; margin: 0 0 10px 0;">
              Need assistance? Our support team is here to help!
            </p>
            <p style="color: #718096; font-size: 13px; margin: 0;">
              Contact us at <a href="mailto:support@holidaysri.com" style="color: #667eea; text-decoration: none; font-weight: 600;">support@holidaysri.com</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #a0aec0; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #cbd5e0; font-size: 12px; margin: 5px 0 0 0;">
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
    console.error('Tour package approval confirmation email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send email to partner/member when they approve an event request
const sendEventRequestApprovalConfirmation = async (email, name, requestDetails) => {
  const transporter = createTransporter();

  const activitiesList = requestDetails.activities && requestDetails.activities.length > 0
    ? requestDetails.activities.map(activity => `<li style="margin: 5px 0;">${activity}</li>`).join('')
    : '<li style="margin: 5px 0;">No specific activities selected</li>';

  const eventTypeDisplay = requestDetails.eventType === 'other'
    ? requestDetails.eventTypeOther
    : requestDetails.eventType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '✅ Event Request Approval Confirmation - Holidaysri.com',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">

                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎉 Approval Confirmed!</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">You've successfully approved an event request</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">Dear <strong>${name}</strong>,</p>

                    <p style="margin: 0 0 25px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                      Thank you for approving the customize event request! The customer will be notified, and you can now proceed with planning their special event.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; color: #667eea; font-size: 20px;">📋 Event Request Details</h2>

                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 40%;"><strong>Event Type:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${eventTypeDisplay}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Customer Name:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${requestDetails.fullName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Email:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${requestDetails.email}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Contact Number:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${requestDetails.contactNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Number of Guests:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${requestDetails.numberOfGuests} guests</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Estimated Budget:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${requestDetails.estimatedBudget} LKR</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Submitted On:</strong></td>
                          <td style="padding: 8px 0; color: #333333; font-size: 14px;">${new Date(requestDetails.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 12px 0; color: #856404; font-size: 16px;">🎯 Requested Activities & Services</h3>
                      <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px; line-height: 1.8;">${activitiesList}</ul>
                    </div>

                    ${requestDetails.specialRequests ? `
                    <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 12px 0; color: #0d47a1; font-size: 16px;">💬 Special Requests</h3>
                      <p style="margin: 0; color: #1565c0; font-size: 14px; line-height: 1.6;">${requestDetails.specialRequests}</p>
                    </div>` : ''}

                    <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 12px 0; color: #155724; font-size: 16px;">✅ Next Steps</h3>
                      <ul style="margin: 0; padding-left: 20px; color: #155724; font-size: 14px; line-height: 1.8;">
                        <li>Contact the customer using the provided contact details</li>
                        <li>Discuss event requirements and finalize arrangements</li>
                        <li>Provide a detailed quote based on their budget and needs</li>
                        <li>Coordinate with the customer for event planning and execution</li>
                      </ul>
                    </div>

                    <p style="margin: 25px 0 0 0; color: #333333; font-size: 16px;">
                      If you have any questions, please contact our support team.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                      Best regards,<br><strong style="color: #667eea;">The Holidaysri.com Team</strong>
                    </p>
                    <p style="margin: 15px 0 0 0; color: #999999; font-size: 12px;">
                      This is an automated confirmation email.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Event request approval confirmation email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('Error sending event request approval confirmation email:', error);
    return { success: false, error: error.message };
  }
};

// Send donation fund paid confirmation email
const sendDonationFundPaidConfirmation = async (userEmail, userName, paymentDetails) => {
  const transporter = createTransporter();

  const {
    campaignTitle,
    organizer,
    raisedAmountHSC,
    raisedAmountLKR,
    requestedAmountHSC,
    requestedAmountLKR,
    paidAt,
    bankDetails
  } = paymentDetails;

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: userEmail,
    subject: '🎉 Congratulations! Your Raised Funds Have Been Paid - Holidaysri.com',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Holidaysri.com</h1>
            <p style="color: #666; margin: 5px 0;">Sri Lanka's Premier Tourism Platform</p>
          </div>

          <!-- Congratulations Banner -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h2>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your raised funds have been successfully paid</p>
          </div>

          <!-- Greeting -->
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
            Dear ${userName},
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
            We are delighted to inform you that the funds raised through your donation campaign have been successfully transferred to your registered bank account. Thank you for using Holidaysri.com to make a positive impact!
          </p>

          <!-- Payment Invoice -->
          <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
            <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px;">📋 Payment Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Campaign Title:</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${campaignTitle}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Organizer:</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${organizer}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Goal Amount:</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${requestedAmountHSC.toLocaleString()} HSC (LKR ${requestedAmountLKR.toLocaleString()})</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Amount Raised:</td>
                <td style="padding: 10px 0; color: #10b981; font-weight: 700; text-align: right; font-size: 16px; border-bottom: 1px solid #e2e8f0;">${raisedAmountHSC.toLocaleString()} HSC (LKR ${raisedAmountLKR.toLocaleString()})</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Payment Date:</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${new Date(paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Bank Account:</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right;">${bankDetails?.accountNumber ? `****${bankDetails.accountNumber.slice(-4)}` : 'On File'}</td>
              </tr>
            </table>
          </div>

          <!-- Bank Details -->
          ${bankDetails?.bankName ? `
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h4 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px;">💳 Transfer Details</h4>
            <p style="color: #475569; margin: 5px 0; font-size: 14px;"><strong>Bank:</strong> ${bankDetails.bankName}</p>
            <p style="color: #475569; margin: 5px 0; font-size: 14px;"><strong>Account Holder:</strong> ${bankDetails.accountHolderName || userName}</p>
            <p style="color: #475569; margin: 5px 0; font-size: 14px;"><strong>Branch:</strong> ${bankDetails.branchName || 'N/A'}</p>
          </div>
          ` : ''}

          <!-- Important Note -->
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
            <h4 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⚠️ Important Information</h4>
            <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
              Please allow 2-5 business days for the funds to reflect in your bank account. If you have any questions or concerns, please contact our support team.
            </p>
          </div>

          <!-- Thank You Message -->
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
            Thank you for your dedication to making a difference. We are proud to support your cause and wish you continued success in your future endeavors.
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
            Best regards,<br>
            <strong>The Holidaysri.com Team</strong>
          </p>

          <!-- Footer -->
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">
              This is an automated payment confirmation. Please do not reply to this email.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              For support, contact us at support@holidaysri.com
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment confirmation email sent to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    return { success: false, error: error.message };
  }
};

// Send contact form submission email to support
const sendContactFormEmail = async ({ name, email, phone, subject, category, message }) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri Contact Form',
      address: process.env.EMAIL_USER
    },
    to: 'holidaysri.notificcation@gmail.com',
    replyTo: email,
    subject: `🔔 New Contact Form Submission: ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2563eb;">
            <h1 style="color: #2563eb; margin: 0;">📧 New Contact Form Submission</h1>
            <p style="color: #666; margin: 5px 0;">Holidaysri Support Center</p>
          </div>

          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">Contact Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold; width: 120px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0; color: #2563eb;">
                  <a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Phone:</td>
                <td style="padding: 8px 0; color: #333;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Category:</td>
                <td style="padding: 8px 0;">
                  <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                    ${category}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Submitted:</td>
                <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
            <h2 style="color: #c2410c; margin: 0 0 15px 0; font-size: 18px;">Subject</h2>
            <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">${subject}</p>
          </div>

          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #22c55e;">
            <h2 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">Message</h2>
            <div style="color: #333; line-height: 1.8; white-space: pre-wrap; font-size: 15px;">${message}</div>
          </div>

          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">⚡ Action Required</h3>
            <p style="color: #555; margin: 0; line-height: 1.6;">
              Please respond to this inquiry within 24 hours. You can reply directly to this email to contact <strong>${name}</strong>.
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <a href="mailto:${email}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
              Reply to ${name}
            </a>
            <a href="https://www.holidaysri.com/admin" style="display: inline-block; background-color: #6b7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Admin Dashboard
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated notification from the Holidaysri Contact Form.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Contact form email sent to support from ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Contact form email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send new trip request notification to all travel buddies
const sendNewTripRequestNotification = async (email, name, tripRequestDetails) => {
  const transporter = createTransporter();

  const formattedStartDate = new Date(tripRequestDetails.startDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedEndDate = new Date(tripRequestDetails.endDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const destinationsList = tripRequestDetails.destinations.join(', ');

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '🌍 New Trip Request Available - Find Your Travel Buddy! | Holidaysri',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
        <div style="background: white; border-radius: 15px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px;">🌍</span>
            </div>
            <h1 style="color: #333; margin: 0; font-size: 28px; font-weight: 700;">New Trip Request!</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">A new adventure awaits</p>
          </div>

          <!-- Greeting -->
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Hi <strong>${name}</strong>,
          </p>

          <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
            Great news! A new trip request has been posted on the Travel Buddies Platform. This could be your next adventure!
          </p>

          <!-- Trip Details Card -->
          <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h2 style="color: #333; font-size: 20px; margin: 0 0 20px 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
              🗺️ Trip Details
            </h2>

            <div style="margin-bottom: 15px;">
              <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">Organizer</p>
              <p style="color: #333; font-size: 16px; margin: 0; font-weight: 600;">${tripRequestDetails.organizerName}</p>
            </div>

            <div style="margin-bottom: 15px;">
              <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">📍 Destinations</p>
              <p style="color: #333; font-size: 16px; margin: 0; font-weight: 600;">${destinationsList}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
              <div>
                <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">📅 Start Date</p>
                <p style="color: #333; font-size: 15px; margin: 0; font-weight: 600;">${formattedStartDate}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">📅 End Date</p>
                <p style="color: #333; font-size: 15px; margin: 0; font-weight: 600;">${formattedEndDate}</p>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
              <div>
                <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">⏱️ Duration</p>
                <p style="color: #333; font-size: 15px; margin: 0; font-weight: 600;">${tripRequestDetails.days} Days</p>
              </div>
              <div>
                <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">👥 Buddies Needed</p>
                <p style="color: #333; font-size: 15px; margin: 0; font-weight: 600;">${tripRequestDetails.requiredBuddies}</p>
              </div>
            </div>

            <div style="margin-bottom: 15px;">
              <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">💰 Budget Per Person</p>
              <p style="color: #333; font-size: 16px; margin: 0; font-weight: 600;">LKR ${tripRequestDetails.budgetPerPerson.toLocaleString()}</p>
            </div>

            <div style="margin-bottom: 0;">
              <p style="color: #666; font-size: 13px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">📝 Description</p>
              <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.6;">${tripRequestDetails.description}</p>
            </div>
          </div>

          <!-- Call to Action -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/travel-buddies"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s;">
              View Trip Request
            </a>
          </div>

          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: center;">
            Visit the <strong>Trip Requests</strong> tab on the Travel Buddies Platform to see full details and connect with the organizer!
          </p>

          <!-- Info Box -->
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin: 25px 0;">
            <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.6;">
              <strong>💡 Tip:</strong> Respond quickly to increase your chances of joining this adventure. The organizer is looking for travel companions like you!
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">
              You received this email because you are a registered Travel Buddy on Holidaysri.com
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated notification. Please do not reply to this email.
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
    console.error('Trip request notification email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send advertisement deletion notification email
const sendAdvertisementDeletionNotification = async (email, name, slotId, categoryName, adminNote) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `⚠️ Advertisement Deleted - Slot ${slotId} | Holidaysri`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #dc2626;">
            <h1 style="color: #dc2626; margin: 0;">⚠️ Advertisement Deleted</h1>
            <p style="color: #666; margin: 5px 0;">Holidaysri Admin Team</p>
          </div>

          <div style="margin-bottom: 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Dear <strong>${name}</strong>,
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              We regret to inform you that your advertisement has been deleted by our admin team.
            </p>
          </div>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">Deleted Advertisement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Slot ID:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${slotId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Category:</td>
                <td style="padding: 8px 0; color: #333;">${categoryName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Deleted On:</td>
                <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          ${adminNote ? `
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #f59e0b; margin: 0 0 10px 0; font-size: 16px;">📝 Admin Note:</h3>
            <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${adminNote}</p>
          </div>
          ` : ''}

          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #3b82f6; margin: 0 0 10px 0; font-size: 16px;">ℹ️ What This Means:</h3>
            <ul style="color: #333; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>Your advertisement slot has been permanently removed from our platform</li>
              <li>The published content associated with this slot has also been deleted</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #10b981; margin: 0 0 10px 0; font-size: 16px;">💡 Next Steps:</h3>
            <ul style="color: #333; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>If you believe this was done in error, please contact our support team</li>
              <li>You can create a new advertisement slot if you wish to continue advertising</li>
              <li>Please review our advertising guidelines before posting new content</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
              Need help or have questions?
            </p>
            <a href="https://www.holidaysri.com/contact" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: 600;">
              Contact Support
            </a>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © 2024 Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated notification from Holidaysri Admin Team.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Advertisement deletion notification sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Advertisement deletion email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send photo post deletion notification email
const sendPhotoPostDeletionNotification = async (email, name, caption, location, adminNote) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `⚠️ Photo Post Deleted - Photos from Travelers | Holidaysri`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #dc2626;">
            <h1 style="color: #dc2626; margin: 0;">⚠️ Photo Post Deleted</h1>
            <p style="color: #666; margin: 5px 0;">Holidaysri Admin Team</p>
          </div>

          <div style="margin-bottom: 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Dear <strong>${name}</strong>,
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              We regret to inform you that your photo post from the "Photos from Travelers" section has been deleted by our admin team.
            </p>
          </div>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">Deleted Photo Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Caption:</td>
                <td style="padding: 8px 0; color: #333;">${caption}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Location:</td>
                <td style="padding: 8px 0; color: #333;">${location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 600;">Deleted On:</td>
                <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          ${adminNote ? `
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #f59e0b; margin: 0 0 10px 0; font-size: 16px;">📝 Admin Note:</h3>
            <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${adminNote}</p>
          </div>
          ` : ''}

          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #3b82f6; margin: 0 0 10px 0; font-size: 16px;">ℹ️ What This Means:</h3>
            <ul style="color: #333; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>Your photo post has been permanently removed from our platform</li>
              <li>All associated data including likes, comments, and saves have been deleted</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="color: #10b981; margin: 0 0 10px 0; font-size: 16px;">💡 Next Steps:</h3>
            <ul style="color: #333; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>If you believe this was done in error, please contact our support team</li>
              <li>You can upload new photos if you wish to continue sharing your travel memories</li>
              <li>Please review our community guidelines before posting new content</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              If you have any questions or concerns, please don't hesitate to contact us.
            </p>
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
              Best regards,<br>
              <strong>The Holidaysri Team</strong>
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Holidaysri.com. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Send verification rejection notification email
const sendVerificationRejectionNotification = async (email, name, reason) => {
  const transporter = createTransporter();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: {
      name: 'Holidaysri.com',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: '⚠️ Verification Status Update - Action Required | Holidaysri',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Verification Update</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your verification documents require attention</p>
            </div>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear ${name},
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            We have reviewed your verification documents submitted to Holidaysri.com. Unfortunately, we are unable to approve your verification at this time.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 30px 0; border-radius: 5px;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">
              📋 Reason for Rejection:
            </h3>
            <p style="color: #991b1b; margin: 0; line-height: 1.6;">
              ${reason || 'The submitted documents do not meet our verification requirements. Please ensure all documents are clear, valid, and match your account information.'}
            </p>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">📝 What This Means:</h3>
            <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Your verification documents have been removed from our system</li>
              <li>Your account verification status has been reset to "Pending"</li>
              <li>You can resubmit new verification documents at any time</li>
              <li>Certain features may be limited until verification is complete</li>
            </ul>
          </div>

          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #15803d; margin: 0 0 15px 0;">✅ Next Steps:</h3>
            <ol style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Review the reason for rejection carefully</li>
              <li>Prepare clear, valid identification documents (NIC or Passport)</li>
              <li>Ensure all documents are:
                <ul style="margin-top: 8px;">
                  <li>Clear and readable</li>
                  <li>Not expired</li>
                  <li>Match your account information</li>
                  <li>Show all corners and edges</li>
                </ul>
              </li>
              <li>Log in to your account and resubmit your documents</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.holidaysri.com/profile" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Resubmit Verification Documents
            </a>
          </div>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 5px;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>💡 Tip:</strong> Make sure to upload high-quality images in good lighting. Both front and back of your NIC should be clearly visible, or a clear photo of your passport information page.
            </p>
          </div>

          <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">Need Help?</h3>
            <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
              If you have questions about the verification process or need assistance, our support team is here to help:
            </p>
            <p style="color: #555; margin: 5px 0;">
              📧 Email: <a href="mailto:support@holidaysri.com" style="color: #2563eb; text-decoration: none;">support@holidaysri.com</a>
            </p>
            <p style="color: #555; margin: 5px 0;">
              🌐 Website: <a href="https://www.holidaysri.com/contact" style="color: #2563eb; text-decoration: none;">Contact Us</a>
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              © ${new Date().getFullYear()} Holidaysri.com. All rights reserved.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              This is an automated message regarding your verification status.
            </p>
            <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
              Notification sent on ${formattedDate}
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
    console.error('Verification rejection email sending error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendEmailVerificationOTP,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPromoCodeExpirationWarning,
  sendPromoCodeExpiredNotification,
  sendPromoCodeRenewalSuccess,
  sendPromoCodeSoldNotification,
  sendPromoCodePurchaseSuccess,
  sendHSCEarnedClaimApprovalEmail,
  sendMembershipPurchaseEmail,
  sendMembershipExpirationWarning,
  sendMembershipExpiredEmail,
  sendCommercialPartnerWelcomeEmail,
  sendCommercialPartnerExpirationWarning,
  sendCommercialPartnerExpiredEmail,
  sendNewsletterSubscriptionConfirmation,
  sendNewsletterEmail,
  sendAdvertisementPurchaseEmail,
  sendAdvertisementRenewalEmail,
  sendTokenGiftEmail,
  sendAdvertisementExpiringWarning,
  sendAdvertisementExpiredEmail,
  sendCustomizeTourPartnerNotification,
  sendNewTripRequestNotification,
  sendCustomizeEventPartnerNotification,
  sendEventRequestApprovalConfirmation,
  sendTourPackageApprovalConfirmation,
  sendDonationFundPaidConfirmation,
  sendContactFormEmail,
  sendAdvertisementDeletionNotification,
  sendPhotoPostDeletionNotification,
  sendVerificationRejectionNotification
};
