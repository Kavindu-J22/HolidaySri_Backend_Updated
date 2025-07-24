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
      name: 'Holidaysri Tourism',
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
            <a href="http://localhost:5173/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
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
    console.error('Expiration warning email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send promo code expired notification email
const sendPromoCodeExpiredNotification = async (email, name, promoCode, promoType) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: {
      name: 'Holidaysri Tourism',
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
            <a href="http://localhost:5173/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Renew My Promo Code
            </a>
          </div>

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
      name: 'Holidaysri Tourism',
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
            <a href="http://localhost:5173/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
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
      name: 'Holidaysri Tourism',
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
            <a href="http://localhost:5173/profile" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              View My Dashboard
            </a>
          </div>

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
      name: 'Holidaysri Tourism',
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
              Congratulations! You have successfully purchased a <strong>${promoCodeDetails.promoCodeType.toUpperCase()}</strong> promo code and are now an official agent with Holidaysri Tourism!
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
            <a href="http://localhost:5173/profile" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
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
    console.error('Promo code purchase success email sending error:', error);
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
  sendPromoCodePurchaseSuccess
};
