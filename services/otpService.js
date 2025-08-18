const encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const { VALIDATION_RULES } = require('../utils/constants');

class OTPService {
  constructor() {
    this.otpExpireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || VALIDATION_RULES.OTP_EXPIRE_MINUTES;
    this.otpLength = parseInt(process.env.OTP_LENGTH) || VALIDATION_RULES.OTP_LENGTH;
    this.maxAttempts = 3;
  }

  /**
   * Generate OTP
   * @returns {Object} - OTP details
   */
  generateOTP() {
    try {
      const code = encryption.generateOTP(this.otpLength);
      const expiresAt = new Date(Date.now() + this.otpExpireMinutes * 60 * 1000);
      
      logger.debug('OTP generated successfully', {
        length: this.otpLength,
        expiresAt
      });
      
      return {
        code,
        expiresAt,
        attempts: 0
      };
    } catch (error) {
      logger.error('Error generating OTP:', error);
      throw new Error('Failed to generate OTP');
    }
  }

  /**
   * Verify OTP
   * @param {string} inputOTP - User provided OTP
   * @param {Object} storedOTP - Stored OTP object
   * @returns {Object} - Verification result
   */
  verifyOTP(inputOTP, storedOTP) {
    const result = {
      isValid: false,
      message: '',
      attemptsRemaining: 0
    };

    try {
      // Check if OTP exists
      if (!storedOTP || !storedOTP.code) {
        result.message = 'No OTP found. Please request a new one.';
        return result;
      }

      // Check if OTP has expired
      if (new Date() > new Date(storedOTP.expiresAt)) {
        result.message = 'OTP has expired. Please request a new one.';
        return result;
      }

      // Check if max attempts exceeded
      if (storedOTP.attempts >= this.maxAttempts) {
        result.message = 'Maximum OTP attempts exceeded. Please request a new one.';
        return result;
      }

      // Calculate remaining attempts
      result.attemptsRemaining = this.maxAttempts - (storedOTP.attempts + 1);

      // Verify OTP
      if (inputOTP === storedOTP.code) {
        result.isValid = true;
        result.message = 'OTP verified successfully';
        
        logger.debug('OTP verification successful');
      } else {
        result.message = `Invalid OTP. ${result.attemptsRemaining} attempts remaining.`;
        
        logger.warn('OTP verification failed', {
          attempts: storedOTP.attempts + 1,
          attemptsRemaining: result.attemptsRemaining
        });
      }

      return result;
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      result.message = 'OTP verification failed';
      return result;
    }
  }

  /**
   * Check if OTP is expired
   * @param {Object} otpData - OTP object
   * @returns {boolean} - Expiration status
   */
  isExpired(otpData) {
    if (!otpData || !otpData.expiresAt) {
      return true;
    }
    
    return new Date() > new Date(otpData.expiresAt);
  }

  /**
   * Check if OTP attempts are exhausted
   * @param {Object} otpData - OTP object
   * @returns {boolean} - Attempts exhausted status
   */
  isAttemptsExhausted(otpData) {
    if (!otpData) {
      return false;
    }
    
    return otpData.attempts >= this.maxAttempts;
  }

  /**
   * Get remaining time for OTP expiration
   * @param {Object} otpData - OTP object
   * @returns {number} - Remaining time in seconds
   */
  getRemainingTime(otpData) {
    if (!otpData || !otpData.expiresAt) {
      return 0;
    }
    
    const now = new Date();
    const expiresAt = new Date(otpData.expiresAt);
    const remainingMs = expiresAt - now;
    
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Format OTP for display (with spaces for readability)
   * @param {string} otp - OTP code
   * @returns {string} - Formatted OTP
   */
  formatOTP(otp) {
    if (!otp || typeof otp !== 'string') {
      return '';
    }
    
    // Add space every 3 digits for 6-digit OTP (123 456)
    if (otp.length === 6) {
      return `${otp.substring(0, 3)} ${otp.substring(3)}`;
    }
    
    return otp;
  }

  /**
   * Generate OTP for password reset
   * @param {string} email - User email
   * @returns {Object} - OTP details
   */
  generatePasswordResetOTP(email) {
    try {
      const otpData = this.generateOTP();
      
      logger.info('Password reset OTP generated', {
        email,
        expiresAt: otpData.expiresAt
      });
      
      return otpData;
    } catch (error) {
      logger.error('Error generating password reset OTP:', error);
      throw new Error('Failed to generate password reset OTP');
    }
  }

  /**
   * Generate OTP for account verification
   * @param {string} identifier - User identifier (email/phone)
   * @returns {Object} - OTP details
   */
  generateVerificationOTP(identifier) {
    try {
      const otpData = this.generateOTP();
      
      logger.info('Verification OTP generated', {
        identifier,
        expiresAt: otpData.expiresAt
      });
      
      return otpData;
    } catch (error) {
      logger.error('Error generating verification OTP:', error);
      throw new Error('Failed to generate verification OTP');
    }
  }

  /**
   * Clean up expired OTP data
   * @param {Object} otpData - OTP object
   * @returns {Object|null} - Cleaned OTP data or null if expired
   */
  cleanupExpiredOTP(otpData) {
    if (!otpData) {
      return null;
    }
    
    if (this.isExpired(otpData)) {
      logger.debug('Cleaning up expired OTP');
      return null;
    }
    
    return otpData;
  }

  /**
   * Increment OTP attempts
   * @param {Object} otpData - OTP object
   * @returns {Object} - Updated OTP data
   */
  incrementAttempts(otpData) {
    if (!otpData) {
      return null;
    }
    
    otpData.attempts = (otpData.attempts || 0) + 1;
    
    logger.debug('OTP attempts incremented', {
      attempts: otpData.attempts,
      maxAttempts: this.maxAttempts
    });
    
    return otpData;
  }

  /**
   * Get OTP status information
   * @param {Object} otpData - OTP object
   * @returns {Object} - OTP status
   */
  getOTPStatus(otpData) {
    if (!otpData) {
      return {
        exists: false,
        expired: true,
        attemptsExhausted: false,
        remainingTime: 0,
        attemptsRemaining: this.maxAttempts
      };
    }
    
    const expired = this.isExpired(otpData);
    const attemptsExhausted = this.isAttemptsExhausted(otpData);
    const remainingTime = this.getRemainingTime(otpData);
    const attemptsRemaining = Math.max(0, this.maxAttempts - (otpData.attempts || 0));
    
    return {
      exists: true,
      expired,
      attemptsExhausted,
      remainingTime,
      attemptsRemaining
    };
  }

  /**
   * Validate OTP format
   * @param {string} otp - OTP to validate
   * @returns {Object} - Validation result
   */
  validateOTPFormat(otp) {
    const result = {
      isValid: false,
      message: ''
    };
    
    if (!otp || typeof otp !== 'string') {
      result.message = 'OTP is required';
      return result;
    }
    
    const cleanOTP = otp.replace(/\s/g, ''); // Remove spaces
    
    if (cleanOTP.length !== this.otpLength) {
      result.message = `OTP must be ${this.otpLength} digits`;
      return result;
    }
    
    if (!/^\d+$/.test(cleanOTP)) {
      result.message = 'OTP must contain only numbers';
      return result;
    }
    
    result.isValid = true;
    result.message = 'OTP format is valid';
    return result;
  }
}

module.exports = new OTPService();