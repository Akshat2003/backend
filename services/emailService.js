const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { EMAIL_TYPES } = require('../utils/constants');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@parking-operator.com';
    this.isConfigured = this.checkConfiguration();
  }

  /**
   * Create nodemailer transporter
   */
  createTransporter() {
    try {
      const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      // For development, use ethereal email if no SMTP configured
      if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
        return nodemailer.createTransporter({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: 'ethereal.user@ethereal.email',
            pass: 'ethereal.pass'
          }
        });
      }

      return nodemailer.createTransporter(config);

    } catch (error) {
      logger.error('Failed to create email transporter:', error);
      return null;
    }
  }

  /**
   * Check if email service is properly configured
   */
  checkConfiguration() {
    if (!this.transporter) {
      logger.warn('Email service is not configured');
      return false;
    }

    if (process.env.NODE_ENV !== 'development' && !process.env.SMTP_HOST) {
      logger.warn('SMTP configuration missing for production');
      return false;
    }

    return true;
  }

  /**
   * Send email
   * @param {Object} emailData - Email data
   */
  async sendEmail(emailData) {
    try {
      if (!this.isConfigured) {
        logger.warn('Email service not configured, skipping email send');
        return { success: false, message: 'Email service not configured' };
      }

      const { to, subject, html, text } = emailData;

      const mailOptions = {
        from: this.fromEmail,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };

    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} operatorId - Operator ID
   * @param {string} otp - OTP code
   * @param {string} resetToken - Reset token
   */
  async sendPasswordResetEmail(email, operatorId, otp, resetToken) {
    try {
      const subject = 'Password Reset Request - Parking Operator System';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Password Reset Request</h2>
            
            <p>Hello <strong>${operatorId}</strong>,</p>
            
            <p>You have requested to reset your password for the Parking Operator System. Please use the following OTP to complete the password reset process:</p>
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <h3 style="color: #e74c3c; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h3>
              <p style="color: #7f8c8d; margin: 10px 0 0 0;">This OTP is valid for 10 minutes</p>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul style="color: #7f8c8d;">
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this OTP with anyone</li>
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>For security reasons, you have only 3 attempts to enter the correct OTP</li>
            </ul>
            
            <p style="margin-top: 30px;">
              <strong>Account Details:</strong><br>
              Operator ID: ${operatorId}<br>
              Email: ${email}<br>
              Request Time: ${new Date().toLocaleString()}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #7f8c8d; font-size: 14px;">
              This is an automated message from the Parking Operator System. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject,
        html
      });

    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email for new user
   * @param {Object} userData - User data
   */
  async sendWelcomeEmail(userData) {
    try {
      const { email, firstName, operatorId, tempPassword } = userData;
      const subject = 'Welcome to Parking Operator System';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Welcome to Parking Operator System</h2>
            
            <p>Hello <strong>${firstName}</strong>,</p>
            
            <p>Your account has been successfully created for the Parking Operator System. Below are your login credentials:</p>
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Operator ID:</strong> ${operatorId}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${tempPassword ? `<p><strong>Temporary Password:</strong> ${tempPassword}</p>` : ''}
            </div>
            
            <p><strong>Important:</strong></p>
            <ul style="color: #7f8c8d;">
              ${tempPassword ? '<li>Please change your temporary password after your first login</li>' : ''}
              <li>Keep your login credentials secure and confidential</li>
              <li>Do not share your account with others</li>
              <li>Contact your administrator if you have any issues</li>
            </ul>
            
            <p style="margin-top: 30px;">
              Welcome to the team!<br>
              <strong>Parking Operator System</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #7f8c8d; font-size: 14px;">
              This is an automated message from the Parking Operator System. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject,
        html
      });

    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  /**
   * Send account locked notification
   * @param {string} email - User email
   * @param {string} operatorId - Operator ID
   * @param {Date} lockUntil - Lock expiry time
   */
  async sendAccountLockedEmail(email, operatorId, lockUntil) {
    try {
      const subject = 'Account Temporarily Locked - Parking Operator System';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Locked</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h2 style="color: #e74c3c; margin-bottom: 20px;">Account Temporarily Locked</h2>
            
            <p>Hello <strong>${operatorId}</strong>,</p>
            
            <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <p><strong>Account will be unlocked at:</strong><br>
              ${lockUntil.toLocaleString()}</p>
            </div>
            
            <p><strong>What to do:</strong></p>
            <ul style="color: #7f8c8d;">
              <li>Wait until the lock time expires</li>
              <li>Ensure you're using the correct password</li>
              <li>If you've forgotten your password, use the password reset feature</li>
              <li>Contact your administrator if you continue to experience issues</li>
            </ul>
            
            <p style="color: #e74c3c; margin-top: 30px;">
              <strong>Security Note:</strong> If you did not attempt to log in, please contact your administrator immediately as your account may be compromised.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #7f8c8d; font-size: 14px;">
              This is an automated security message from the Parking Operator System. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject,
        html
      });

    } catch (error) {
      logger.error('Failed to send account locked email:', error);
      throw new Error('Failed to send account locked email');
    }
  }

  /**
   * Send booking confirmation email
   * @param {string} email - Customer email
   * @param {Object} bookingData - Booking details
   */
  async sendBookingConfirmationEmail(email, bookingData) {
    try {
      const { bookingNumber, customerName, vehicleNumber, machineNumber, palletNumber, otp, startTime } = bookingData;
      const subject = `Booking Confirmation - ${bookingNumber}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h2 style="color: #27ae60; margin-bottom: 20px;">Booking Confirmed</h2>
            
            <p>Dear <strong>${customerName}</strong>,</p>
            
            <p>Your parking booking has been confirmed. Please find the details below:</p>
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Booking Number:</strong> ${bookingNumber}</p>
              <p><strong>Vehicle Number:</strong> ${vehicleNumber}</p>
              <p><strong>Machine:</strong> ${machineNumber}</p>
              <p><strong>Pallet:</strong> ${palletNumber}</p>
              <p><strong>Start Time:</strong> ${new Date(startTime).toLocaleString()}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <h3 style="color: #27ae60; margin: 0 0 10px 0;">Vehicle Retrieval OTP</h3>
              <h2 style="color: #27ae60; margin: 0; font-size: 36px; letter-spacing: 8px;">${otp}</h2>
              <p style="color: #7f8c8d; margin: 10px 0 0 0;">Use this OTP to retrieve your vehicle</p>
            </div>
            
            <p><strong>Important Instructions:</strong></p>
            <ul style="color: #7f8c8d;">
              <li>Keep this OTP safe and secure</li>
              <li>You will need this OTP to retrieve your vehicle</li>
              <li>Do not share this OTP with unauthorized persons</li>
              <li>Contact us if you lose this OTP</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #7f8c8d; font-size: 14px;">
              Thank you for using our parking service. This is an automated message, please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject,
        html
      });

    } catch (error) {
      logger.error('Failed to send booking confirmation email:', error);
      throw new Error('Failed to send booking confirmation email');
    }
  }

  /**
   * Strip HTML tags from text
   * @param {string} html - HTML string
   * @returns {string} - Plain text
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      await this.transporter.verify();
      logger.info('Email service connection test passed');
      return { success: true, message: 'Email service is working' };

    } catch (error) {
      logger.error('Email service connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send generic notification email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} message - Email message
   */
  async sendNotification(to, subject, message) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Notification</h2>
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              ${message}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #7f8c8d; font-size: 14px;">
              This is an automated message from the Parking Operator System. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({ to, subject, html });

    } catch (error) {
      logger.error('Failed to send notification email:', error);
      throw new Error('Failed to send notification email');
    }
  }
}

module.exports = new EmailService();